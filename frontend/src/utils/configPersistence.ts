/**
 * Config Persistence Utilities
 *
 * Helper functions for saving and managing file configurations.
 */

import { invoke } from "@tauri-apps/api/core";
import { useCSVStore } from "@stores/csvStore";
import { useSettingsStore } from "@stores/settingsStore";
import { useDrawerStore } from "@stores/drawerStore";
import { useFileConfigStore, type FileIdentifiers, type FileConfig } from "@stores/fileConfigStore";

/**
 * Collect current state from all relevant stores and save as file config
 */
export async function saveCurrentFileConfig(): Promise<void> {
    const csvStore = useCSVStore.getState();
    const settingsStore = useSettingsStore.getState();
    const drawerStore = useDrawerStore.getState();
    const fileConfigStore = useFileConfigStore.getState();

    // Only save if we have a file open
    if (!csvStore.currentFile) {
        return;
    }

    try {
        // Get file identifiers
        const identifiers = await invoke<FileIdentifiers>("get_file_identifiers", {
            path: csvStore.currentFile,
        });

        // Collect config from all stores
        const config: FileConfig["config"] = {
            // Column display
            columnWidths: csvStore.columnWidths,
            columnOrder: csvStore.columnOrder,

            // Column summaries
            columnSummaries: csvStore.columnSummaries as Record<string, string>,

            // Filtering and sorting (from csvStore)
            filters: csvStore.columnFilters.map((filter) => ({
                field: filter.column,
                operation: filter.operation,
                value: filter.value,
            })),

            // Display settings (from settingsStore)
            rowColoringMode: settingsStore.rowColoringMode,
            rowColorFilter: settingsStore.rowColorFilter,
            wrapText: settingsStore.wrapText,
            showColumnSeparators: settingsStore.showColumnSeparators,
            autoFitColumns: settingsStore.autoFitColumns,
            hoverHighlightMode: settingsStore.hoverHighlightMode,

            // Drawer settings (from drawerStore)
            drawerPosition: drawerStore.position,
            rightDrawerSize: drawerStore.rightDrawerSize,
            bottomDrawerSize: drawerStore.bottomDrawerSize,
        };

        // Save config
        await fileConfigStore.saveConfigForFile(identifiers, config);

        console.log("Saved file config for:", csvStore.fileInfo?.name);
    } catch (error) {
        console.error("Failed to save file config:", error);
    }
}

/**
 * Debounced version of saveCurrentFileConfig
 * Useful for auto-saving when state changes frequently
 */
let saveTimeout: ReturnType<typeof setTimeout> | null = null;

export function debouncedSaveCurrentFileConfig(delayMs: number = 1000): void {
    if (saveTimeout) {
        clearTimeout(saveTimeout);
    }

    saveTimeout = setTimeout(() => {
        saveCurrentFileConfig();
        saveTimeout = null;
    }, delayMs);
}
