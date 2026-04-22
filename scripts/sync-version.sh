#!/bin/bash
# Sync version from .env to tauri.conf.json
# This ensures VITE_APP_VERSION is the single source of truth

set -e

# Load version from .env
if [ ! -f .env ]; then
    echo "Error: .env file not found"
    exit 1
fi

VERSION=$(grep "^VITE_APP_VERSION=" .env | cut -d '=' -f2)

if [ -z "$VERSION" ]; then
    echo "Error: VITE_APP_VERSION not found in .env"
    exit 1
fi

echo "Syncing version $VERSION to tauri.conf.json..."

# Update version in tauri.conf.json using sed
sed -i "s/\"version\": \"[^\"]*\"/\"version\": \"$VERSION\"/" backend/tauri.conf.json

echo "✅ Version synced: $VERSION"
