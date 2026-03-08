/**
 * Config Persistence Utilities
 *
 * Helper functions for saving and managing file configurations.
 */

import { invoke } from "@tauri-apps/api/core";
import { useCellStore } from "@stores/cellStore";
import { useCellColumnStore } from "@stores/cellColumnStore";
import { useCellFilterStore } from "@stores/cellFilterStore";
import { useSettingsStore } from "@stores/settingsStore";
import { useDrawerStore } from "@stores/drawerStore";
import { useFileConfigStore, type FileIdentifiers, type FileConfig } from "@stores/fileConfigStore";
import { logger } from "@utils/logger";

/**
 * Collect current state from all relevant stores and save as file config
 */
export async function saveCurrentFileConfig(): Promise<void> {
    const cellStore = useCellStore.getState();
    const columnStore = useCellColumnStore.getState();
    const filterStore = useCellFilterStore.getState();
    const settingsStore = useSettingsStore.getState();
    const drawerStore = useDrawerStore.getState();
    const fileConfigStore = useFileConfigStore.getState();

    // Only save if we have a file open
    if (!cellStore.currentFile) {
        return;
    }

    try {
        // Get file identifiers
        const identifiers = await invoke<FileIdentifiers>("get_file_identifiers", {
            path: cellStore.currentFile,
        });

        // Collect config from all stores
        const config: FileConfig["config"] = {
            // Column display (from cellColumnStore)
            columnWidths: columnStore.columnWidths,
            columnOrder: columnStore.columnOrder,

            // Column summaries (from cellFilterStore)
            columnSummaries: filterStore.columnSummaries as Record<string, string>,

            // Filtering and sorting (from cellFilterStore)
            filters: filterStore.columnFilters.map((filter) => ({
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

        logger.debug("Saved file config for:", cellStore.fileInfo?.name);
    } catch (error: unknown) {
        logger.error("Failed to save file config:", error);
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
