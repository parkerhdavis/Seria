/**
 * File Operations Module
 *
 * Tauri commands for file I/O operations:
 * - Open and read CSV files
 * - Save CSV files
 *
 * Note: In Tauri 2.0, file dialogs are handled by the tauri-plugin-dialog
 * from the frontend instead of custom Rust commands.
 */

use std::fs;

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
