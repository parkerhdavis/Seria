/**
 * Storage Module
 *
 * Tauri commands for persistent storage:
 * - User preferences (JSON)
 * - Custom Print templates (JSON files)
 * - Per-file configuration storage
 *
 * Storage location is platform-specific:
 * - Windows: %APPDATA%\juniper
 * - macOS: ~/Library/Application Support/juniper
 * - Linux: ~/.config/juniper
 */

use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

/// Get the application data directory path
fn get_app_data_dir(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data directory: {}", e))
}

/// Get the preferences file path
fn get_preferences_path(app: &AppHandle) -> Result<PathBuf, String> {
    let mut path = get_app_data_dir(app)?;
    path.push("preferences.json");
    Ok(path)
}

/// Get the custom prints directory path
fn get_prints_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let mut path = get_app_data_dir(app)?;
    path.push("prints");
    Ok(path)
}

/// Load user preferences from JSON file
#[tauri::command]
pub fn load_preferences(app: AppHandle) -> Result<String, String> {
    let path = get_preferences_path(&app)?;

    if !path.exists() {
        // Return default preferences if file doesn't exist
        return Ok("{}".to_string());
    }

    fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read preferences: {}", e))
}

/// Save user preferences to JSON file
#[tauri::command]
pub fn save_preferences(app: AppHandle, data: String) -> Result<(), String> {
    let path = get_preferences_path(&app)?;

    // Ensure parent directory exists
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create preferences directory: {}", e))?;
    }

    fs::write(&path, data)
        .map_err(|e| format!("Failed to write preferences: {}", e))
}

/// Load all custom Print templates
/// Returns a vector of JSON strings, one for each template
#[tauri::command]
pub fn load_custom_prints(app: AppHandle) -> Result<Vec<String>, String> {
    let prints_dir = get_prints_dir(&app)?;

    if !prints_dir.exists() {
        // No custom prints yet
        return Ok(vec![]);
    }

    let mut prints = Vec::new();

    let entries = fs::read_dir(&prints_dir)
        .map_err(|e| format!("Failed to read prints directory: {}", e))?;

    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read directory entry: {}", e))?;
        let path = entry.path();

        if path.extension().and_then(|s| s.to_str()) == Some("json") {
            let content = fs::read_to_string(&path)
                .map_err(|e| format!("Failed to read print file: {}", e))?;
            prints.push(content);
        }
    }

    Ok(prints)
}

/// Save a custom Print template
#[tauri::command]
pub fn save_custom_print(app: AppHandle, name: String, data: String) -> Result<(), String> {
    let mut path = get_prints_dir(&app)?;

    // Ensure prints directory exists
    fs::create_dir_all(&path)
        .map_err(|e| format!("Failed to create prints directory: {}", e))?;

    // Sanitize filename (remove special characters)
    let safe_name = name
        .chars()
        .filter(|c| c.is_alphanumeric() || *c == '-' || *c == '_')
        .collect::<String>();

    path.push(format!("{}.json", safe_name));

    fs::write(&path, data)
        .map_err(|e| format!("Failed to write print template: {}", e))
}

/// Delete a custom Print template
#[tauri::command]
pub fn delete_custom_print(app: AppHandle, name: String) -> Result<(), String> {
    let mut path = get_prints_dir(&app)?;

    // Sanitize filename
    let safe_name = name
        .chars()
        .filter(|c| c.is_alphanumeric() || *c == '-' || *c == '_')
        .collect::<String>();

    path.push(format!("{}.json", safe_name));

    if path.exists() {
        fs::remove_file(&path)
            .map_err(|e| format!("Failed to delete print template: {}", e))?;
    }

    Ok(())
}

/// Get the file configs path
fn get_file_configs_path(app: &AppHandle) -> Result<PathBuf, String> {
    let mut path = get_app_data_dir(app)?;
    path.push("file-configs.json");
    Ok(path)
}

/// Load file configs from JSON file
/// This stores per-file settings like column widths, filters, and display preferences
#[tauri::command]
pub fn load_file_configs(app: AppHandle) -> Result<String, String> {
    let path = get_file_configs_path(&app)?;

    if !path.exists() {
        // Return empty config structure if file doesn't exist
        return Ok(r#"{"version":1,"configs":[]}"#.to_string());
    }

    fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read file configs: {}", e))
}

/// Save file configs to JSON file
#[tauri::command]
pub fn save_file_configs(app: AppHandle, data: String) -> Result<(), String> {
    let path = get_file_configs_path(&app)?;

    // Ensure parent directory exists
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create config directory: {}", e))?;
    }

    fs::write(&path, data)
        .map_err(|e| format!("Failed to write file configs: {}", e))
}
