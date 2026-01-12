use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::env;
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
use std::io::Read;
use std::path::{Path, PathBuf};

/// Common path validation checks for preventing path traversal attacks
/// Returns a PathBuf if basic validation passes, or an error if the path is suspicious
fn validate_path_basics(path: &str) -> Result<PathBuf, String> {
    // Check for suspicious patterns that indicate path traversal
    if path.contains("..") {
        return Err("Path traversal detected: '..' is not allowed in file paths".to_string());
    }

    // Check for null bytes (can be used to bypass checks)
    if path.contains('\0') {
        return Err("Invalid path: null bytes are not allowed".to_string());
    }

    // Create path and check if it's absolute
    let path_buf = PathBuf::from(path);

    // For file operations, we require absolute paths
    if !path_buf.is_absolute() {
        return Err("Only absolute file paths are allowed".to_string());
    }

    Ok(path_buf)
}

/// Verify a canonicalized path doesn't contain path traversal patterns
fn verify_canonical_path(canonical: &Path) -> Result<(), String> {
    if canonical.to_string_lossy().contains("..") {
        return Err("Path traversal detected after canonicalization".to_string());
    }
    Ok(())
}

/// Validates a file path to prevent path traversal attacks
/// Returns the canonicalized path if valid, or an error if the path is suspicious
fn validate_file_path(path: &str) -> Result<PathBuf, String> {
    let path_buf = validate_path_basics(path)?;

    // Canonicalize the path to resolve any symbolic links and get the real path
    let canonical = path_buf
        .canonicalize()
        .map_err(|e| format!("Failed to resolve path: {}", e))?;

    verify_canonical_path(&canonical)?;

    Ok(canonical)
}

/// Validates a file path for writing (file may not exist yet)
/// Uses parent directory validation to prevent path traversal
fn validate_file_path_for_write(path: &str) -> Result<PathBuf, String> {
    let path_buf = validate_path_basics(path)?;

    // Get the parent directory and validate it exists
    let parent = path_buf
        .parent()
        .ok_or("Invalid path: no parent directory")?;

    // Canonicalize the parent directory to ensure it exists and is valid
    let canonical_parent = parent
        .canonicalize()
        .map_err(|e| format!("Failed to resolve parent directory: {}", e))?;

    verify_canonical_path(&canonical_parent)?;

    // Get the filename and construct the final path
    let filename = path_buf.file_name().ok_or("Invalid path: no filename")?;

    Ok(canonical_parent.join(filename))
}

/// Read a Cell file (CSV, TSV, or JSON) from disk and return its contents as a string
#[tauri::command]
pub fn open_cell_file(path: String) -> Result<String, String> {
    // Validate path to prevent path traversal attacks
    let safe_path = validate_file_path(&path)?;

    fs::read_to_string(&safe_path).map_err(|e| format!("Failed to read file: {}", e))
}

/// Write Cell file content (CSV, TSV, or JSON) to a file on disk
#[tauri::command]
pub fn save_cell_file(path: String, content: String) -> Result<(), String> {
    // Validate path to prevent path traversal attacks
    let safe_path = validate_file_path_for_write(&path)?;

    fs::write(&safe_path, content).map_err(|e| format!("Failed to write file: {}", e))
}

/// Create a temporary Cell file and return its path
/// The file will be created in the system temp directory with a unique name
#[tauri::command]
pub fn create_temp_file() -> Result<String, String> {
    let temp_dir = env::temp_dir();

    // Create a unique temp file name with timestamp and nanoseconds for uniqueness
    // Using both seconds and nanoseconds prevents collisions when multiple files
    // are created in rapid succession
    let duration = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|e| format!("System time error: {}", e))?;

    let timestamp = duration.as_secs();
    let nanos = duration.subsec_nanos();

    let temp_file_name = format!("seria_temp_{}_{}.csv", timestamp, nanos);
    let temp_file_path = temp_dir.join(temp_file_name);

    // Create the file with empty CSV content (just headers)
    let initial_content = "Column1,Column2,Column3\n";
    fs::write(&temp_file_path, initial_content)
        .map_err(|e| format!("Failed to create temp file: {}", e))?;

    // Return the path as a string
    temp_file_path
        .to_str()
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
    // Validate path to prevent path traversal attacks
    let safe_path = validate_file_path(&path)?;
    let path_obj = safe_path.as_path();

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
    let metadata =
        fs::metadata(&safe_path).map_err(|e| format!("Failed to get file metadata: {}", e))?;
    let file_size = metadata.len();

    // Get OS file ID (inode on Unix/Mac, File ID on Windows)
    let os_file_id = get_os_file_id(safe_path.to_str().unwrap_or(""));

    // Calculate partial content hash if file is large enough
    let content_hash_partial = if file_size > 100_000 {
        Some(calculate_content_hash(safe_path.to_str().unwrap_or(""))?)
    } else {
        None
    };

    Ok(FileIdentifiers {
        absolute_path: safe_path.to_string_lossy().to_string(),
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
    let mut file =
        fs::File::open(path).map_err(|e| format!("Failed to open file for hashing: {}", e))?;

    let mut hasher = Sha256::new();
    let mut buffer = vec![0; 1024 * 1024]; // 1MB buffer

    // Read first 1MB (or entire file if smaller)
    let bytes_read = file
        .read(&mut buffer)
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
