// Prevents additional console window on Windows in release builds
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

/**
 * Juniper - Main Tauri Application
 *
 * This is the minimal Rust backend for the Juniper desktop application.
 * It provides file I/O and storage commands to the React frontend.
 *
 * Most business logic lives in the frontend (React + TypeScript).
 * This backend handles only:
 * - File system operations (open, save, dialogs)
 * - User preferences storage
 * - Custom Print template storage
 */

mod file_ops;
mod storage;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            // File operations
            file_ops::open_csv_file,
            file_ops::save_csv_file,
            // Storage operations
            storage::load_preferences,
            storage::save_preferences,
            storage::load_custom_prints,
            storage::save_custom_print,
            storage::delete_custom_print,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
