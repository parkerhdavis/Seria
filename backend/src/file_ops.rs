/**
 * File Operations Module
 *
 * Tauri commands for file I/O operations:
 * - Open and read Cell files (CSV, TSV, JSON)
 * - Save Cell files
 * - Get file identifiers for config matching
 * - Calculate partial content hashes
 *
 * Note: In Tauri 2.0, file dialogs are handled by the tauri-plugin-dialog
 * from the frontend instead of custom Rust commands.
 */
use std::fs;
use std::path::Path;
use serde::{Deserialize, Serialize};
use sha2::{Sha256, Digest};
use std::io::Read;
use std::env;

/// Read a Cell file (CSV, TSV, or JSON) from disk and return its contents as a string
#[tauri::command]
pub fn open_cell_file(path: String) -> Result<String, String> {
    fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read file: {}", e))
}

/// Write Cell file content (CSV, TSV, or JSON) to a file on disk
#[tauri::command]
pub fn save_cell_file(path: String, content: String) -> Result<(), String> {
    fs::write(&path, content)
        .map_err(|e| format!("Failed to write file: {}", e))
}

/// Create a temporary Cell file and return its path
/// The file will be created in the system temp directory with a unique name
#[tauri::command]
pub fn create_temp_file() -> Result<String, String> {
    let temp_dir = env::temp_dir();

    // Create a unique temp file name with timestamp
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs();

    let temp_file_name = format!("seria_temp_{}.csv", timestamp);
    let temp_file_path = temp_dir.join(temp_file_name);

    // Create the file with empty CSV content (just headers)
    let initial_content = "Column1,Column2,Column3\n";
    fs::write(&temp_file_path, initial_content)
        .map_err(|e| format!("Failed to create temp file: {}", e))?;

    // Return the path as a string
    temp_file_path.to_str()
        .ok_or("Failed to convert temp file path to string".to_string())
        .map(|s| s.to_string())
}

/// File identifiers used for config matching
#[derive(Serialize, Deserialize)]
pub struct FileIdentifiers {
    pub absolute_path: String,
    pub filename: String,
    pub parent_dir: String,
    pub file_size: u64,
    pub content_hash_partial: Option<String>,
    pub os_file_id: Option<String>,
}

/// Get all identifiers for a file
/// These identifiers are used for matching file configs across renames and moves
#[tauri::command]
pub fn get_file_identifiers(path: String) -> Result<FileIdentifiers, String> {
    let path_obj = Path::new(&path);

    // Get filename
    let filename = path_obj
        .file_name()
        .and_then(|n| n.to_str())
        .ok_or("Invalid filename")?
        .to_string();

    // Get parent directory name (not full path, just the immediate parent)
    let parent_dir = path_obj
        .parent()
        .and_then(|p| p.file_name())
        .and_then(|n| n.to_str())
        .unwrap_or("")
        .to_string();

    // Get file size
    let metadata = fs::metadata(&path)
        .map_err(|e| format!("Failed to get file metadata: {}", e))?;
    let file_size = metadata.len();

    // Get OS file ID (inode on Unix/Mac, File ID on Windows)
    let os_file_id = get_os_file_id(&path);

    // Calculate partial content hash if file is large enough
    let content_hash_partial = if file_size > 100_000 {
        Some(calculate_content_hash(&path)?)
    } else {
        None
    };

    Ok(FileIdentifiers {
        absolute_path: path,
        filename,
        parent_dir,
        file_size,
        content_hash_partial,
        os_file_id,
    })
}

/// Calculate partial content hash (first 1MB or entire file if smaller)
/// This helps identify files even after they're moved or renamed
fn calculate_content_hash(path: &str) -> Result<String, String> {
    let mut file = fs::File::open(path)
        .map_err(|e| format!("Failed to open file for hashing: {}", e))?;

    let mut hasher = Sha256::new();
    let mut buffer = vec![0; 1024 * 1024]; // 1MB buffer

    // Read first 1MB (or entire file if smaller)
    let bytes_read = file.read(&mut buffer)
        .map_err(|e| format!("Failed to read file for hashing: {}", e))?;

    hasher.update(&buffer[..bytes_read]);
    let result = hasher.finalize();

    Ok(format!("{:x}", result))
}

/// Get OS-specific file ID (inode on Unix/Mac, File ID on Windows)
#[cfg(unix)]
fn get_os_file_id(path: &str) -> Option<String> {
    use std::os::unix::fs::MetadataExt;

    fs::metadata(path)
        .ok()
        .map(|m| format!("inode-{}", m.ino()))
}

#[cfg(windows)]
fn get_os_file_id(path: &str) -> Option<String> {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};

    // Note: The file_index() method is unstable in Rust, so we use a hash of the path
    // as a stable alternative. This provides a consistent identifier for the file.
    // In production, you might want to use the Win32 API to get the actual file index.
    let mut hasher = DefaultHasher::new();
    path.hash(&mut hasher);
    Some(format!("fileid-{}", hasher.finish()))
}

#[cfg(not(any(unix, windows)))]
fn get_os_file_id(_path: &str) -> Option<String> {
    // Unsupported platform
    None
}
