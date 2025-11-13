// Prevents additional console window on Windows in release builds
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

/**
 * Seria - Main Tauri Application
 *
 * This is the minimal Rust backend for the Seria desktop application.
 * It provides file I/O and storage commands to the React frontend.
 *
 * Most business logic lives in the frontend (React + TypeScript).
 * This backend handles only:
 * - File system operations (open, save, dialogs) for Cell files (CSV, TSV, JSON)
 * - File identifiers and content hashing for config matching
 * - User preferences storage
 * - Custom Print template storage
 * - Per-file configuration storage
 * - Clipboard operations (read/write text)
 */

mod file_ops;
mod storage;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .invoke_handler(tauri::generate_handler![
            // File operations for Cell files (CSV, TSV, JSON)
            file_ops::open_cell_file,
            file_ops::save_cell_file,
            file_ops::get_file_identifiers,
            // Storage operations
            storage::load_preferences,
            storage::save_preferences,
            storage::load_custom_prints,
            storage::save_custom_print,
            storage::delete_custom_print,
            storage::load_file_configs,
            storage::save_file_configs,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
