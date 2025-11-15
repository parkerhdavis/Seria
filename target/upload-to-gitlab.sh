#!/usr/bin/env bash

# ════════════════════════════════════════════════════════════════════════════════
# Seria - GitLab Package Registry Upload Script
# ════════════════════════════════════════════════════════════════════════════════
# Uploads release artifacts (.AppImage, .deb, .rpm, .exe) to GitLab's Generic
# Packages Repository.
#
# Usage:
#   cd target/
#   ./upload-to-gitlab.sh              # Upload artifacts
#   ./upload-to-gitlab.sh --dry-run    # Show what would be uploaded without uploading
#
# Prerequisites:
#   - Set GITLAB_PROJECT_ID and GITLAB_PRIVATE_TOKEN in top-level .env file
#   - Build artifacts must exist in target/release/bundle/ and/or target/x86_64-pc-windows-msvc/release/
# ════════════════════════════════════════════════════════════════════════════════

set -e  # Exit on error

# ────────────────────────────────────────────────────────────────────────────────
# Parse Command-Line Arguments
# ────────────────────────────────────────────────────────────────────────────────

DRY_RUN=false

for arg in "$@"; do
    case $arg in
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        *)
            echo "Unknown option: $arg"
            echo "Usage: $0 [--dry-run]"
            exit 1
            ;;
    esac
done

# ────────────────────────────────────────────────────────────────────────────────
# Configuration
# ────────────────────────────────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$PROJECT_ROOT/.env"

# GitLab API endpoint
GITLAB_API_URL="https://gitlab.com/api/v4"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ────────────────────────────────────────────────────────────────────────────────
# Helper Functions
# ────────────────────────────────────────────────────────────────────────────────

log_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

log_success() {
    echo -e "${GREEN}✓${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}⚠${NC} $1"
}

log_error() {
    echo -e "${RED}✗${NC} $1"
}

# ────────────────────────────────────────────────────────────────────────────────
# Load Environment Variables
# ────────────────────────────────────────────────────────────────────────────────

if [ ! -f "$ENV_FILE" ]; then
    log_error "Environment file not found: $ENV_FILE"
    log_info "Please create .env file from .env.example and configure GitLab credentials"
    exit 1
fi

log_info "Loading environment variables from $ENV_FILE"

# Load .env file and export variables
set -a  # Automatically export all variables
source "$ENV_FILE"
set +a  # Stop auto-exporting

# ────────────────────────────────────────────────────────────────────────────────
# Validate Configuration
# ────────────────────────────────────────────────────────────────────────────────

# In dry-run mode, we only need version info
if [ -z "$VITE_APP_VERSION" ]; then
    log_error "VITE_APP_VERSION is not set in .env file"
    exit 1
fi

if [ -z "$GITLAB_PACKAGE_NAME" ]; then
    log_warn "GITLAB_PACKAGE_NAME not set, defaulting to 'seria'"
    GITLAB_PACKAGE_NAME="seria"
fi

# Only validate credentials if not in dry-run mode
if [ "$DRY_RUN" = false ]; then
    if [ -z "$GITLAB_PROJECT_ID" ] || [ "$GITLAB_PROJECT_ID" = "your_project_id_here" ]; then
        log_error "GITLAB_PROJECT_ID is not set in .env file"
        log_info "Find your project ID at: GitLab Project > Settings > General"
        exit 1
    fi

    if [ -z "$GITLAB_PRIVATE_TOKEN" ] || [ "$GITLAB_PRIVATE_TOKEN" = "your_access_token_here" ]; then
        log_error "GITLAB_PRIVATE_TOKEN is not set in .env file"
        log_info "Create an access token at: GitLab User Settings > Access Tokens"
        log_info "Required scopes: api"
        exit 1
    fi

    if [ -z "$GITLAB_USERNAME" ] || [ "$GITLAB_USERNAME" = "your_gitlab_username" ]; then
        log_error "GITLAB_USERNAME is not set in .env file"
        log_info "Set this to your GitLab username (e.g., parkerhdavis)"
        exit 1
    fi

    if [ -z "$GITLAB_PROJECT_NAME" ] || [ "$GITLAB_PROJECT_NAME" = "YourProjectName" ]; then
        log_error "GITLAB_PROJECT_NAME is not set in .env file"
        log_info "Set this to your GitLab project name (e.g., Seria)"
        exit 1
    fi
fi

if [ "$DRY_RUN" = true ]; then
    log_warn "DRY RUN MODE - No files will be uploaded"
    echo ""
fi

log_success "Configuration validated"
log_info "Version: $VITE_APP_VERSION"
log_info "Package name: $GITLAB_PACKAGE_NAME"
if [ "$DRY_RUN" = false ]; then
    log_info "Project ID: $GITLAB_PROJECT_ID"
fi

# ────────────────────────────────────────────────────────────────────────────────
# Find Release Artifacts
# ────────────────────────────────────────────────────────────────────────────────

log_info "Searching for release artifacts..."

declare -a artifacts=()

# Find Linux artifacts (Tauri puts them in target/release/bundle/)
if [ -d "$SCRIPT_DIR/release/bundle" ]; then
    while IFS= read -r -d '' file; do
        artifacts+=("$file")
    done < <(find "$SCRIPT_DIR/release/bundle" -type f \( -name "*.AppImage" -o -name "*.deb" -o -name "*.rpm" \) -print0)
fi

# Find Windows artifacts (cross-compiled builds go to target/x86_64-pc-windows-msvc/release/)
if [ -f "$SCRIPT_DIR/x86_64-pc-windows-msvc/release/seria.exe" ]; then
    artifacts+=("$SCRIPT_DIR/x86_64-pc-windows-msvc/release/seria.exe")
fi

# Also check for native Windows builds (if building on Windows)
if [ -f "$SCRIPT_DIR/release/seria.exe" ]; then
    artifacts+=("$SCRIPT_DIR/release/seria.exe")
fi

if [ ${#artifacts[@]} -eq 0 ]; then
    log_error "No release artifacts found"
    log_info "Expected files: .AppImage, .deb, .rpm, .exe"
    log_info "Run 'make build' first to generate release artifacts"
    exit 1
fi

log_success "Found ${#artifacts[@]} artifact(s) to upload"
echo ""

# ────────────────────────────────────────────────────────────────────────────────
# Display/Upload Artifacts
# ────────────────────────────────────────────────────────────────────────────────

upload_count=0
error_count=0
declare -a uploaded_files=()

if [ "$DRY_RUN" = true ]; then
    # Dry run mode - just show what would be uploaded
    log_info "The following artifacts would be uploaded:"
    echo ""

    for artifact in "${artifacts[@]}"; do
        filename=$(basename "$artifact")
        filesize=$(du -h "$artifact" | cut -f1)

        # Construct upload URL (with actual project ID for display)
        upload_url="${GITLAB_API_URL}/projects/${GITLAB_PROJECT_ID}/packages/generic/${GITLAB_PACKAGE_NAME}/${VITE_APP_VERSION}/${filename}"

        echo "  📦 ${filename} (${filesize})"
        echo "     → ${upload_url}"
        echo ""
    done

    log_info "Total: ${#artifacts[@]} artifact(s) ready for upload"
    log_info "Run without --dry-run to perform the actual upload"
else
    # Actual upload
    # Temporarily disable exit-on-error to continue uploading even if one fails
    set +e

    for artifact in "${artifacts[@]}"; do
        filename=$(basename "$artifact")

        log_info "Uploading: $filename"

        # Construct upload URL
        upload_url="${GITLAB_API_URL}/projects/${GITLAB_PROJECT_ID}/packages/generic/${GITLAB_PACKAGE_NAME}/${VITE_APP_VERSION}/${filename}"

        # Upload file (with error output visible)
        response=$(curl -s -w "\n%{http_code}" \
            --header "PRIVATE-TOKEN: ${GITLAB_PRIVATE_TOKEN}" \
            --upload-file "$artifact" \
            "$upload_url" 2>&1)
        curl_exit_code=$?

        # Check if curl command itself failed
        if [ $curl_exit_code -ne 0 ]; then
            log_error "Failed to upload: $filename (curl error code: $curl_exit_code)"
            echo "$response"
            error_count=$((error_count + 1))
            continue
        fi

        # Extract HTTP status code (last line of response)
        http_code=$(echo "$response" | tail -n1)

        if [ "$http_code" -eq 201 ]; then
            log_success "Uploaded: $filename"
            upload_count=$((upload_count + 1))
            uploaded_files+=("$filename")
        else
            log_error "Failed to upload: $filename (HTTP $http_code)"
            # Print response body (all lines except the last one)
            echo "$response" | head -n -1
            error_count=$((error_count + 1))
        fi
    done

    # Re-enable exit-on-error
    set -e
fi

# ────────────────────────────────────────────────────────────────────────────────
# Summary
# ────────────────────────────────────────────────────────────────────────────────

if [ "$DRY_RUN" = false ]; then
    echo ""
    log_info "════════════════════════════════════════════════════════════════"
    if [ $error_count -eq 0 ]; then
        log_success "All $upload_count artifact(s) uploaded successfully"
    else
        log_warn "Uploaded: $upload_count, Failed: $error_count"
    fi

    # Display stable package URLs
    if [ ${#uploaded_files[@]} -gt 0 ]; then
        echo ""
        log_info "Package URLs (stable links):"
        echo ""
        for filename in "${uploaded_files[@]}"; do
            stable_url="https://gitlab.com/${GITLAB_USERNAME}/${GITLAB_PROJECT_NAME}/-/packages/generic/${GITLAB_PACKAGE_NAME}/${VITE_APP_VERSION}/${filename}"
            echo "  🔗 ${filename}"
            echo "     ${stable_url}"
            echo ""
        done
        log_info "View all packages at: https://gitlab.com/${GITLAB_USERNAME}/${GITLAB_PROJECT_NAME}/-/packages"
    fi

    # Exit with appropriate status
    if [ $error_count -eq 0 ]; then
        exit 0
    else
        exit 1
    fi
else
    # Dry run completed successfully
    exit 0
fi
