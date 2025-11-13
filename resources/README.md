# Seria Resources

This directory contains additional resources for Seria installation and customization.

## Linux Desktop Integration

### Seria.desktop

This is a `.desktop` file for Linux systems that provides desktop environment integration. It enables:

- Application menu entries
- File associations for CSV files
- Right-click "Open with" integration
- Custom application icons

### Installing the .desktop File

**For current user only:**
```bash
cp Seria.desktop ~/.local/share/applications/
update-desktop-database ~/.local/share/applications/
```

**System-wide installation (requires root):**
```bash
sudo cp Seria.desktop /usr/share/applications/
sudo update-desktop-database
```

### Customizing the .desktop File

You can customize the `.desktop` file to change:

- **Exec**: The command used to launch Seria (e.g., full path to binary)
- **Icon**: The icon name or path to a custom icon file
- **Categories**: Where the app appears in your desktop menu
- **MimeType**: Which file types open with Seria by default

**Example: Using a custom icon**
```ini
Icon=/home/username/.local/share/icons/my-Seria-icon.png
```

**Example: Using a specific binary path**
```ini
Exec=/opt/Seria/Seria %F
```

### File Associations

To make Seria the default application for CSV files:

```bash
xdg-mime default Seria.desktop text/csv
xdg-mime default Seria.desktop text/comma-separated-values
```

To check if it worked:
```bash
xdg-mime query default text/csv
```

### Icon Installation

If you want to use a custom icon, place your icon file in one of these locations:

**Current user:**
- PNG: `~/.local/share/icons/hicolor/256x256/apps/Seria.png`
- SVG: `~/.local/share/icons/hicolor/scalable/apps/Seria.svg`

**System-wide (requires root):**
- PNG: `/usr/share/icons/hicolor/256x256/apps/Seria.png`
- SVG: `/usr/share/icons/hicolor/scalable/apps/Seria.svg`

After installing an icon, update the icon cache:
```bash
# Current user
gtk-update-icon-cache ~/.local/share/icons/hicolor/

# System-wide
sudo gtk-update-icon-cache /usr/share/icons/hicolor/
```

## Platform-Specific Installation

### Linux Package Installation

**AppImage:**
```bash
chmod +x Seria-0.1.0-x86_64.AppImage
./Seria-0.1.0-x86_64.AppImage
```

Optional: Move to system location
```bash
sudo mv Seria-0.1.0-x86_64.AppImage /opt/Seria/Seria
```

**Debian/Ubuntu (.deb):**
```bash
sudo dpkg -i Seria_0.1.0_amd64.deb
sudo apt-get install -f  # Install dependencies if needed
```

**Fedora/RHEL/openSUSE (.rpm):**
```bash
sudo rpm -i Seria-0.1.0.x86_64.rpm
```

### Windows Installation

Double-click the installer:
- `Seria_0.1.0_x64_en-US.msi` - Standard Windows installer
- `Seria_0.1.0_x64-setup.exe` - NSIS installer with more options

The application will be installed to `C:\Program Files\Seria\` by default.

### macOS Installation

1. Open the `.dmg` file
2. Drag Seria.app to your Applications folder
3. First launch: Right-click → Open (to bypass Gatekeeper)

## Build Information

See `wiki-internal/Build-and-Distribution.md` for detailed information about:
- Building from source
- Creating custom installers
- Platform-specific build requirements
- Troubleshooting build issues
