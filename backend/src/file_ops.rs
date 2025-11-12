/**
 * File Operations Module
 *
 * Tauri commands for file I/O operations:
 * - Open and read CSV files
 * - Save CSV files
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

/// Read a CSV file from disk and return its contents as a string
#[tauri::command]
pub fn open_csv_file(path: String) -> Result<String, String> {
    fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read file: {}", e))
}

/// Write CSV content to a file on disk
#[tauri::command]
pub fn save_csv_file(path: String, content: String) -> Result<(), String> {
    fs::write(&path, content)
        .map_err(|e| format!("Failed to write file: {}", e))
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
    use std::os::windows::fs::MetadataExt;

    fs::metadata(path)
        .ok()
        .and_then(|m| {
            // Windows file index is a combination of volume serial and file index
            // This is a simplified version - in production you'd want the full file ID
            Some(format!("fileid-{}", m.file_index().unwrap_or(0)))
        })
}

#[cfg(not(any(unix, windows)))]
fn get_os_file_id(_path: &str) -> Option<String> {
    // Unsupported platform
    None
}
