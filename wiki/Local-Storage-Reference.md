# Local Storage Reference

This document provides a complete reference of all local storage used by Juniper, what data is stored, where it's located, and how it's managed. Juniper uses several storage mechanisms to persist your settings, configurations, and custom templates.

## Overview

Juniper stores data locally on your machine in these locations:

**Windows:**
```
%LOCALAPPDATA%\juniper\
```

**macOS:**
```
~/Library/Application Support/juniper/
```

**Linux:**
```
~/.local/share/juniper/
```

Additionally, some data is stored in your browser's localStorage (see [Print Recipe Storage](#print-recipe-storage) below).

## Storage Components

### 1. File Configurations (file-configs.json)

**Location:** `<app-data-dir>/file-configs.json`

**Purpose:** Stores per-file settings so your workspace preferences persist across sessions.

**What's Stored:**
- Column widths and auto-fit state
- Column summaries (count, average, etc.)
- Active filters and filter configurations
- Display preferences (text wrapping, separators, row coloring)
- Hover highlight mode
- Print drawer position and size

**Managed By:** File Config Store (`fileConfigStore.ts`)

**File Format:** JSON with versioning

**For detailed information,** see [File Configuration Persistence](./File-Configuration-Persistence.md).

**Example Structure:**
```json
{
    "version": 1,
    "configs": [
        {
            "id": "uuid-123-456",
            "identifiers": {
                "absolutePath": "/path/to/file.csv",
                "filename": "file.csv",
                "parentDir": "data",
                "fileSize": 45320,
                "contentHashPartial": "sha256-...",
                "osFileId": "inode-12345"
            },
            "lastSeen": "2025-11-12T10:30:00Z",
            "config": {
                "columnWidths": { "0": 200, "1": 150 },
                "filters": [...],
                "wrapText": false,
                "autoFitColumns": true,
                ...
            }
        }
    ]
}
```

**Privacy Note:** This file contains file paths from your system. Be cautious when sharing or version-controlling this file if your file paths contain sensitive information.

---

### 2. Print Recipe Storage (Browser localStorage)

**Location:** Browser localStorage (key: `juniper-print-recipe-storage`)

**Purpose:** Stores your Print recipe configurations and field mappings for CSV-to-Print rendering.

**What's Stored:**
- Field mappings (which CSV columns map to which Print fields)
- Render settings for each recipe (fonts, spacing, margins, etc.)
- Selected recipe ID
- Last modified timestamps

**Managed By:** Print Recipe Store (`printRecipeStore.ts`) using Zustand's persist middleware

**Technology:** Browser localStorage (Web Storage API)

**Example Data:**
```json
{
    "state": {
        "configurations": {
            "screenplay-basic": {
                "recipeId": "screenplay-basic",
                "fieldMappings": [
                    {
                        "ingredientId": "character",
                        "csvColumn": "Speaker"
                    },
                    {
                        "ingredientId": "dialogue",
                        "csvColumn": "Line"
                    }
                ],
                "renderSettings": {
                    "pageWidth": 8.5,
                    "pageHeight": 11,
                    "marginTop": 1,
                    ...
                },
                "lastModified": "2025-11-12T10:30:00Z"
            }
        },
        "selectedRecipeId": "screenplay-basic"
    },
    "version": 0
}
```

**Important Notes:**
- This data is stored in **browser localStorage**, not in files on disk
- Data is isolated per-origin (only accessible to Juniper)
- Clearing browser data or localStorage will erase these configurations
- Not automatically backed up (see [Backup Strategies](#backup-strategies) below)

**Limitations:**
- localStorage typically has a 5-10MB size limit per origin
- Data persists only for the current Tauri webview
- Reinstalling Juniper may or may not preserve this data (platform-dependent)

---

### 3. User Preferences (preferences.json)

**Location:** `<app-data-dir>/preferences.json`

**Purpose:** Stores application-wide user preferences and settings.

**What's Stored:**
- Theme preference (light, dark, auto)
- Window state and position
- Recent files list
- Global display preferences
- Configuration management preferences (auto-save, retention days, etc.)

**Managed By:** Various stores and settings modules via Tauri storage commands

**File Format:** JSON

**Example Structure:**
```json
{
    "theme": "dark",
    "windowState": {
        "width": 1280,
        "height": 800,
        "x": 100,
        "y": 100,
        "maximized": false
    },
    "recentFiles": [
        "/path/to/file1.csv",
        "/path/to/file2.csv"
    ],
    "configPreferences": {
        "autoSaveConfigs": true,
        "configRetentionDays": 180,
        "promptForAmbiguousMatches": true
    }
}
```

**Privacy Note:** This file may contain paths to recently opened files. Consider this when backing up or sharing this file.

---

### 4. Custom Print Templates (prints/*.json)

**Location:** `<app-data-dir>/prints/` directory

**Purpose:** Stores user-created custom Print recipes/templates.

**What's Stored:**
- Custom Print recipe definitions
- Recipe metadata (name, description, author)
- Ingredient definitions (field types and styling)
- Render settings specific to the custom template

**Managed By:** Print Recipe Store via Tauri storage commands

**File Format:** Individual JSON files (one per custom template)

**File Naming:** Sanitized template names (alphanumeric, dashes, underscores only)

**Example File:** `custom-game-dialogue.json`
```json
{
    "id": "custom-game-dialogue",
    "name": "Custom Game Dialogue",
    "description": "My custom dialogue format for RPG games",
    "version": "1.0.0",
    "author": "User Name",
    "isCustom": true,
    "ingredients": [
        {
            "id": "character",
            "label": "Character Name",
            "type": "text",
            "required": true,
            "style": {
                "font": "Arial",
                "size": 12,
                "bold": true,
                "color": "#333333"
            }
        },
        {
            "id": "line",
            "label": "Dialogue Line",
            "type": "text",
            "required": true,
            "style": {
                "font": "Georgia",
                "size": 11,
                "italic": false
            }
        }
    ],
    "renderSettings": {
        "pageWidth": 8.5,
        "pageHeight": 11,
        "marginTop": 1,
        "marginBottom": 1,
        "marginLeft": 1.5,
        "marginRight": 1.5
    }
}
```

**Important Notes:**
- Each custom template is a separate file
- Bundled templates (shipped with Juniper) are NOT stored here
- Deleting a file removes that custom template permanently
- Can be backed up by copying the entire `prints/` directory

---

## Storage Size and Performance

### Expected Storage Usage

| Component | Typical Size | Notes |
|-----------|-------------|-------|
| File Configs | 10-500 KB | Grows with number of CSV files opened |
| Print Recipe Storage | 5-50 KB | Browser localStorage; minimal size |
| User Preferences | 1-10 KB | Very small; rarely changes |
| Custom Print Templates | 5-20 KB each | Depends on number of custom templates |

**Total:** Usually under 1 MB for typical usage

### Large File Warnings

If `file-configs.json` exceeds 10 MB:
1. Run **Cleanup Old Configs** in Settings
2. Reduce **Config Retention Days** (default: 180 days)
3. Manually export, prune, and re-import configs
4. Consider this may indicate hundreds or thousands of CSV files tracked

---

## Backup Strategies

### Manual Backup

**Backup All Data:**
1. Navigate to your app data directory (see [Overview](#overview))
2. Copy the entire `juniper/` folder to a backup location
3. For Print Recipe Storage, use **Export Configs** in Settings (if available)

**Backup File Configs Only:**
1. Open Juniper Settings (Ctrl+,)
2. Navigate to **File Configuration Management**
3. Click **Export Configs**
4. Save the exported JSON file to a safe location

**Restore from Backup:**
1. Replace files in the app data directory, or
2. Use **Import Configs** in Settings to restore file configurations

### Version Control Integration

You can track Juniper configurations in Git alongside your CSV files:

```bash
# Export file configs
# (Use Settings > Export Configs in Juniper)

# Add to repository
git add juniper-configs.json
git commit -m "Save Juniper CSV configurations"
```

**Benefits:**
- Track changes to column layouts and filters over time
- Share configurations with team members
- Revert to previous configuration states
- Sync configs across machines

### Automated Backup

Consider creating a script to periodically back up your Juniper data:

**Example (Linux/macOS):**
```bash
#!/bin/bash
BACKUP_DIR="$HOME/backups/juniper"
APP_DATA="$HOME/Library/Application Support/juniper"  # macOS

mkdir -p "$BACKUP_DIR"
cp -r "$APP_DATA" "$BACKUP_DIR/juniper-$(date +%Y%m%d)"
```

**Example (Windows PowerShell):**
```powershell
$BackupDir = "$env:USERPROFILE\backups\juniper"
$AppData = "$env:LOCALAPPDATA\juniper"

New-Item -ItemType Directory -Force -Path $BackupDir
Copy-Item -Recurse -Path $AppData -Destination "$BackupDir\juniper-$(Get-Date -Format 'yyyyMMdd')"
```

---

## Privacy and Security

### What Data Is NOT Stored

Juniper does **NOT** store:
- CSV file contents (except temporarily in memory while editing)
- User credentials or passwords
- Personally identifiable information (except file paths you choose)
- Network requests or analytics data
- Telemetry or usage statistics

### Data Permissions

**File Permissions:**
- All storage files use standard user permissions
- Only your user account can read/write these files
- No network transmission of stored data

**Browser localStorage:**
- Isolated per-origin (Tauri webview)
- Not accessible to other applications
- Not synchronized across devices

### Sensitive Data Warning

**Be aware that stored data may include:**
- **File paths** - May reveal your folder structure and file organization
- **Filter values** - Stored in plain text; may contain sensitive search terms
- **Recent files list** - Shows which CSV files you've recently opened

**Recommendations:**
- Review data before sharing exported configs
- Exclude Juniper data directories from cloud sync if privacy is a concern
- Clear old configs periodically using **Cleanup Old Configs**

---

## Clearing Storage

### Clear All Storage (Reset to Defaults)

**Warning:** This will delete all your settings, configurations, and custom templates.

**Steps:**
1. Close Juniper completely
2. Navigate to your app data directory (see [Overview](#overview))
3. Delete the entire `juniper/` folder
4. Restart Juniper (storage will be recreated with defaults)

**To preserve some data:**
- Back up `file-configs.json` before deleting (reimport later)
- Back up `prints/` directory to keep custom templates

### Clear File Configurations Only

**Option 1: Cleanup Old Configs**
1. Open Settings (Ctrl+,)
2. Navigate to **File Configuration Management**
3. Click **Cleanup Old Configs**
4. Configs for files not opened recently (default: 180 days) will be removed

**Option 2: Manual Deletion**
1. Close Juniper
2. Delete `<app-data-dir>/file-configs.json`
3. Restart Juniper

### Clear Print Recipe Storage

**Browser localStorage:**
1. Open Developer Tools (Ctrl+Shift+I in dev mode)
2. Navigate to Application > Local Storage
3. Find `juniper-print-recipe-storage` key
4. Delete the entry

**Or:** Clear all browser data for the Tauri webview (platform-specific)

### Clear Custom Print Templates

1. Navigate to `<app-data-dir>/prints/`
2. Delete individual `.json` files, or
3. Delete the entire `prints/` directory

**Note:** Bundled templates (shipped with Juniper) cannot be deleted and will always be available.

---

## Migration and Portability

### Moving to a New Machine

**Same Operating System:**
1. Export file configs (Settings > Export Configs)
2. Copy `prints/` directory (for custom templates)
3. Copy `preferences.json` (for global settings)
4. On new machine, import configs and copy files to new app data directory

**Different Operating System:**
- File paths in `file-configs.json` will not match (different path formats)
- Content hashes and filenames will still allow matching
- Recommended: Export configs, move CSV files, open files on new machine, then import configs

**Portable Mode (Not Yet Implemented):**
A future feature may allow storing configs relative to CSV file locations, enabling USB drive portability.

### Team Collaboration

**Sharing Configurations:**
1. Export file configs (Settings > Export Configs)
2. Share the exported JSON file with team members
3. Team members import the configs
4. Configs will match files by filename, size, and content hash

**Best Practices:**
- Use relative or portable configs when available
- Review configs before sharing (may contain personal file paths)
- Establish team standards for column layouts and filters
- Version control configs alongside CSV files

---

## Troubleshooting

### Storage Not Persisting

**Symptoms:** Settings don't save between sessions

**Check:**
1. Write permissions to app data directory
2. Auto-save is enabled (Settings > File Configuration Management)
3. Sufficient disk space available
4. Tauri storage commands are working (check console for errors)

**Solutions:**
- Run Juniper with appropriate permissions
- Manually trigger a save by changing a setting
- Check console logs (Ctrl+Shift+I) for storage errors
- Reinstall Juniper if storage directory is corrupted

### localStorage Quota Exceeded

**Symptoms:** Error messages about localStorage being full

**Cause:** Browser localStorage has a 5-10MB limit per origin

**Solutions:**
1. Clear old Print recipe configurations
2. Remove unused custom templates
3. Check for duplicate or corrupted data in localStorage
4. Report issue if legitimate use exceeds quota

### Corrupted Storage Files

**Symptoms:** Juniper won't start, or shows JSON parse errors

**Solutions:**
1. Locate the app data directory
2. Rename `preferences.json` to `preferences.json.backup`
3. Rename `file-configs.json` to `file-configs.json.backup`
4. Restart Juniper (will create new files with defaults)
5. Attempt to manually fix JSON syntax errors in backup files
6. Reimport corrected files using **Import Configs**

### Can't Find App Data Directory

**Windows:**
Open File Explorer and paste this into the address bar:
```
%LOCALAPPDATA%\juniper
```

**macOS:**
Open Finder > Go menu > Hold Option key > Library > Application Support > juniper

**Linux:**
Open terminal and run:
```bash
cd ~/.local/share/juniper && ls -la
```

---

## Advanced Usage

### Scripting Configuration Changes

Since all storage is JSON-based, you can programmatically modify configurations:

**Example (Python):**
```python
import json

# Load file configs
with open('file-configs.json', 'r') as f:
    configs = json.load(f)

# Bulk update all configs (e.g., enable auto-fit for all files)
for config in configs['configs']:
    config['config']['autoFitColumns'] = True

# Save modified configs
with open('file-configs.json', 'w') as f:
    json.dump(configs, f, indent=2)
```

**Example (Node.js):**
```javascript
const fs = require('fs');

// Load preferences
const prefs = JSON.parse(fs.readFileSync('preferences.json', 'utf8'));

// Update theme
prefs.theme = 'dark';

// Save preferences
fs.writeFileSync('preferences.json', JSON.stringify(prefs, null, 2));
```

**Warning:** Always back up files before scripting modifications.

### Monitoring Storage Changes

**Watch for file changes (Linux/macOS):**
```bash
# Monitor file configs for changes
watch -n 1 'ls -lh ~/.local/share/juniper/file-configs.json'
```

**Windows PowerShell:**
```powershell
# Watch app data directory
Get-ChildItem "$env:LOCALAPPDATA\juniper" | Select-Object Name, Length, LastWriteTime
```

### Custom Storage Locations (Not Supported)

Juniper currently does not support custom storage locations. All data is stored in platform-specific app data directories. If you need custom storage locations:

1. Use symbolic links to redirect the app data directory
2. Request this feature on the GitHub repository
3. Use Export/Import workflows as a workaround

---

## Data Retention and Cleanup

### Automatic Cleanup

Juniper can automatically clean up old file configurations:

**When Cleanup Runs:** On app startup (if enabled)

**Default Retention:** 180 days (configurable in Settings)

**What Gets Removed:** Configs for files not opened within the retention period

**Configure Retention:**
1. Open Settings (Ctrl+,)
2. Navigate to **File Configuration Management**
3. Adjust **Config Retention Days** (30-365 days)

### Manual Cleanup Best Practices

**Recommended Schedule:**
- **Monthly:** Review and cleanup old file configs
- **Quarterly:** Back up custom Print templates
- **Annually:** Review and cleanup recent files list

**Steps:**
1. Export current configs (backup)
2. Run **Cleanup Old Configs** in Settings
3. Delete unused custom Print templates
4. Clear localStorage if Print recipe storage is large
5. Verify essential configs are still present

---

## Future Enhancements

Planned improvements to storage management:

- **Cloud Sync** - Optional cloud backup and sync across devices
- **Portable Mode** - Store configs relative to CSV files (for USB drives)
- **Storage Analytics** - View storage usage breakdown in Settings
- **Selective Export** - Export configs for specific files only
- **Compressed Storage** - Reduce file size for large config databases
- **Encrypted Storage** - Optional encryption for sensitive data

---

## Related Documentation

- [File Configuration Persistence](./File-Configuration-Persistence.md) - Detailed guide to per-file settings
- [Print Recipes](./Print-Recipes.md) - Understanding Print templates and recipes
- [Settings Reference](./Settings-Reference.md) - Complete settings documentation

---

**Last Updated:** November 2025
**Applies to:** Juniper v0.1.0+

For questions, issues, or feature requests, please visit our [GitHub repository](https://github.com/your-org/juniper).
