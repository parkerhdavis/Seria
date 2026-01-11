/**
 * Cell Store
 *
 * Zustand store for managing Cell data state, file operations,
 * and edit history with undo/redo support.
 */

import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import Papa from "papaparse";
import { CellFileInfo } from "@/types/cellData";
import { parseCells, serializeCell, validateCell, getDelimiterFromPath } from "@utils/cellParser";
import { useFileConfigStore, type FileIdentifiers } from "./fileConfigStore";
import { useSettingsStore } from "./settingsStore";
import { useDrawerStore } from "./drawerStore";
import { useGlobalConfigStore } from "./globalConfigStore";

// Snapshot of data state for undo/redo
interface DataSnapshot {
    data: string[][];
    headers: string[];
}

// Cell editing state for coordinating between Cell Grid and Print preview
interface EditingCell {
    row: number;
    col: number;
}

// Cell selection state
interface CellSelection {
    row: number;
    col: number;
}

// Range selection state
interface RangeSelection {
    startRow: number;
    startCol: number;
    endRow: number;
    endCol: number;
}

// Clipboard data
interface ClipboardData {
    data: string[][];
    isSingleCell: boolean;
}

// Column filter
interface ColumnFilter {
    column: string;
    operation: "contains" | "not-contains" | "equals" | "not-equals";
    value: string;
}

// Summary types
type SummaryType = "count" | "unique" | "mode" | "average" | "min" | "max" | "sum";

interface CellStore {
    // State
    data: string[][];
    headers: string[];
    currentFile: string | null;
    fileInfo: CellFileInfo | null;
    delimiter: string;  // Delimiter used in the current file ("," for CSV, "\t" for TSV, etc.)
    isDirty: boolean;
    isLoading: boolean;
    loadingProgress: number;  // 0-100 for progressive loading
    isFullyLoaded: boolean;  // Whether all data has been loaded (for progressive loading)
    error: string | null;
    lastSavedAt: number | null;  // Timestamp of last successful save
    isTempFile: boolean;  // Whether the current file is a temporary file

    // Cell editing state (shared between Cell Grid and Print preview)
    editingCell: EditingCell | null;
    editingValue: string;
    editingSource: "cell" | "print" | null;  // Track where the editing originated

    // Selection state
    selectedCell: CellSelection | null;
    selectedRange: RangeSelection | null;
    clipboard: ClipboardData | null;

    // Display settings
    // Column widths stored as proportions (0-1 range) of available width
    // e.g., {0: 0.3, 1: 0.5, 2: 0.2} means col 0 gets 30%, col 1 gets 50%, col 2 gets 20%
    columnWidths: Record<number, number>;
    // Column order - array of column indices indicating display order
    // e.g., [2, 0, 1] means display column 2 first, then column 0, then column 1
    columnOrder: number[];

    // Filtering and summaries
    columnFilters: ColumnFilter[];
    columnSummaries: Record<string, SummaryType>;

    // Undo/Redo history
    undoStack: DataSnapshot[];
    redoStack: DataSnapshot[];

    // Actions
    loadCells: (path: string) => Promise<void>;
    loadCellsProgressive: (path: string) => Promise<void>;  // Progressive loading with web worker
    reloadCells: () => Promise<void>;
    saveCells: () => Promise<void>;
    saveCellAs: (path: string) => Promise<void>;
    createNew: () => Promise<void>;
    importFromScreenplay: (path: string) => Promise<void>;
    exportToScreenplay: (savePath: string) => Promise<void>;
    updateCell: (row: number, col: number, value: string) => void;
    updateCells: (cells: Array<{ row: number; col: number; value: string }>) => void;
    updateRow: (rowIndex: number, newRow: string[]) => void;
    addRow: (atIndex?: number) => void;
    deleteRows: (indices: number[]) => void;
    addColumn: (name: string, atIndex?: number) => void;
    deleteColumn: (index: number) => void;
    renameColumn: (index: number, newName: string) => void;
    clearData: () => void;
    setError: (error: string | null) => void;
    setColumnWidths: (widths: Record<number, number> | ((prev: Record<number, number>) => Record<number, number>)) => void;
    undo: () => void;
    redo: () => void;
    canUndo: () => boolean;
    canRedo: () => boolean;

    // Cell editing actions
    setEditingCell: (row: number, col: number, initialValue: string, source?: "cell" | "print") => void;
    updateEditingValue: (value: string) => void;
    clearEditingCell: () => void;

    // Selection actions
    setSelectedCell: (row: number, col: number) => void;
    setSelectedRange: (startRow: number, startCol: number, endRow: number, endCol: number) => void;
    clearSelection: () => void;
    copySelection: () => void;
    pasteClipboard: () => void;
    clearCells: () => void;

    // Filtering and summary actions
    setColumnFilter: (column: string, operation: "contains" | "not-contains" | "equals" | "not-equals", value: string) => void;
    clearColumnFilter: (column: string) => void;
    setColumnSummary: (column: string, summaryType: SummaryType) => void;

    // Row and column reordering
    reorderRows: (fromIndex: number, toIndex: number) => void;
    reorderColumns: (fromIndex: number, toIndex: number) => void;
}

// Helper function to create a snapshot of current data
const createSnapshot = (data: string[][], headers: string[]): DataSnapshot => ({
    data: data.map((row) => [...row]), // Deep copy rows
    headers: [...headers], // Copy headers
});

// Helper function to push current state to undo stack before mutation
const pushToUndoStack = (get: () => CellStore, set: (state: Partial<CellStore>) => void) => {
    const { data, headers, undoStack } = get();
    const snapshot = createSnapshot(data, headers);

    // Limit undo stack size to 50 actions
    const newUndoStack = [...undoStack, snapshot].slice(-50);

    set({ undoStack: newUndoStack, redoStack: [] }); // Clear redo stack on new action
};

// Load operation counter for cancelling stale load operations
let currentLoadId = 0;

export const useCellStore = create<CellStore>((set, get) => ({
    // Initial state
    data: [],
    headers: [],
    currentFile: null,
    fileInfo: null,
    delimiter: ",",  // Default to comma-separated (CSV)
    isDirty: false,
    isLoading: false,
    loadingProgress: 0,
    isFullyLoaded: true,
    error: null,
    lastSavedAt: null,
    isTempFile: false,
    editingCell: null,
    editingValue: "",
    editingSource: null,
    selectedCell: null,
    selectedRange: null,
    clipboard: null,
    columnWidths: {},
    columnOrder: [],
    columnFilters: [],
    columnSummaries: {},
    undoStack: [],
    redoStack: [],

    // Load Cell file from disk
    loadCells: async (path: string) => {
        set({ isLoading: true, error: null });

        try {
            // Call Tauri command to read file
            const fileContent = await invoke<string>("open_cell_file", { path });

            // Parse Cell content
            const cellData = parseCells(fileContent);

            // Validate Cell
            const validation = validateCell(cellData);
            if (!validation.valid) {
                set({
                    error: `Cell validation failed: ${validation.errors.join(", ")}`,
                    isLoading: false,
                });
                return;
            }

            // Initialize column summaries with "count" for all columns
            const initialSummaries: Record<string, SummaryType> = {};
            cellData.headers.forEach((header) => {
                initialSummaries[header] = "count";
            });

            // Initialize default column order [0, 1, 2, ...]
            const defaultColumnOrder = cellData.headers.map((_, index) => index);

            // Update state (initial load before applying config)
            set({
                headers: cellData.headers,
                data: cellData.data,
                delimiter: cellData.delimiter,  // Store the detected delimiter
                currentFile: path,
                fileInfo: {
                    path,
                    name: path.split("/").pop() || path.split("\\").pop() || "unknown.cell",
                    size: fileContent.length,
                    lastModified: new Date(),
                    rowCount: cellData.data.length,
                    columnCount: cellData.headers.length,
                },
                columnSummaries: initialSummaries,
                columnOrder: defaultColumnOrder,
                isDirty: false,
                isLoading: false,
                error: null,
                isTempFile: false,  // Reset temp file flag when loading a file from disk
            });

            // Load and apply file config
            try {
                // Get file identifiers
                const identifiers = await invoke<FileIdentifiers>("get_file_identifiers", { path });

                // Look up config in file config store
                const fileConfig = useFileConfigStore.getState().findConfigForFile(identifiers);

                if (fileConfig && fileConfig.config) {
                    // Apply config to Cell Store
                    if (fileConfig.config.columnWidths) {
                        set({ columnWidths: fileConfig.config.columnWidths });
                    }

                    // Apply saved column order if it exists and is valid
                    if (fileConfig.config.columnOrder && Array.isArray(fileConfig.config.columnOrder)) {
                        const savedOrder = fileConfig.config.columnOrder;
                        // Validate that column order matches current Cell structure
                        if (savedOrder.length === cellData.headers.length) {
                            set({ columnOrder: savedOrder });
                        }
                    }

                    if (fileConfig.config.filters) {
                        // Map 'field' to 'column' for ColumnFilter compatibility
                        const filters: ColumnFilter[] = fileConfig.config.filters.map(f => ({
                            column: f.field,
                            operation: f.operation as "contains" | "not-contains" | "equals" | "not-equals",
                            value: f.value
                        }));
                        set({ columnFilters: filters });
                    }

                    if (fileConfig.config.columnSummaries) {
                        // Cast string values to SummaryType (validation happens in store)
                        const summaries = fileConfig.config.columnSummaries as Record<string, SummaryType>;
                        set({ columnSummaries: summaries });
                    }

                    // Apply config to settings store
                    const settingsStore = useSettingsStore.getState();

                    if (fileConfig.config.rowColoringMode !== undefined) {
                        settingsStore.setRowColoringMode(fileConfig.config.rowColoringMode as "off" | "alternating" | "by-field");
                    }

                    if (fileConfig.config.rowColorFilter !== undefined) {
                        // Cast to proper RowColorFilter type
                        const filter = fileConfig.config.rowColorFilter ? {
                            field: fileConfig.config.rowColorFilter.field,
                            operation: fileConfig.config.rowColorFilter.operation as "contains" | "not-contains" | "equals" | "not-equals",
                            value: fileConfig.config.rowColorFilter.value,
                            color: fileConfig.config.rowColorFilter.color
                        } : null;
                        settingsStore.setRowColorFilter(filter);
                    }

                    if (fileConfig.config.wrapText !== undefined) {
                        settingsStore.setWrapText(fileConfig.config.wrapText);
                    }

                    if (fileConfig.config.showColumnSeparators !== undefined) {
                        settingsStore.setShowColumnSeparators(fileConfig.config.showColumnSeparators);
                    }

                    if (fileConfig.config.autoFitColumns !== undefined) {
                        settingsStore.setAutoFitColumns(fileConfig.config.autoFitColumns);
                    }

                    if (fileConfig.config.hoverHighlightMode !== undefined) {
                        settingsStore.setHoverHighlightMode(fileConfig.config.hoverHighlightMode as "none" | "row" | "column" | "row-and-column");
                    }

                    // Apply config to drawer store
                    const drawerStore = useDrawerStore.getState();

                    if (fileConfig.config.drawerPosition !== undefined) {
                        drawerStore.setPosition(fileConfig.config.drawerPosition);
                    }

                    if (fileConfig.config.rightDrawerSize !== undefined) {
                        drawerStore.setRightDrawerSize(fileConfig.config.rightDrawerSize);
                    }

                    if (fileConfig.config.bottomDrawerSize !== undefined) {
                        drawerStore.setBottomDrawerSize(fileConfig.config.bottomDrawerSize);
                    }

                    // Update config's last seen timestamp
                    await useFileConfigStore.getState().saveConfigForFile(identifiers, fileConfig.config);

                    console.log("Applied file config:", fileConfig.id);
                } else {
                    console.log("No existing config for file, using defaults");
                }
            } catch (error) {
                console.error("Failed to load file config:", error);
                // Continue without config - not a fatal error
            }

            // Update global config with last opened file
            try {
                const globalConfigStore = useGlobalConfigStore.getState();
                await globalConfigStore.setLastOpenedFile(path);
                await globalConfigStore.addRecentFile(path);
            } catch (error) {
                console.error("Failed to update global config:", error);
                // Non-fatal error, continue
            }
        } catch (error) {
            set({
                error: `Failed to load Cell: ${error}`,
                isLoading: false,
            });
        }
    },

    /**
     * Load Cell file from disk using progressive/chunked parsing (for large files)
     *
     * This uses a Web Worker to parse CSV in chunks, providing:
     * - Non-blocking UI (parsing runs in background thread)
     * - Progress updates during load
     * - Immediate header/grid skeleton display
     * - Incremental row loading
     *
     * Recommended for files > 5MB or > 5000 rows.
     */
    loadCellsProgressive: async (path: string) => {
        // Increment load ID to cancel any in-progress loads
        const loadId = ++currentLoadId;

        set({ isLoading: true, loadingProgress: 0, isFullyLoaded: false, error: null });

        try {
            // Call Tauri command to read file
            const fileContent = await invoke<string>("open_cell_file", { path });

            // Check if this load was cancelled (a newer load started)
            if (loadId !== currentLoadId) {
                return;
            }

            // Use the parseCellsProgressive import
            const { parseCellsProgressive } = await import("@utils/cellParser");

            let allData: string[][] = [];
            let headers: string[] = [];
            let delimiter: string = ",";

            // Start progressive parsing with callbacks
            parseCellsProgressive(fileContent, {
                // Phase 1: Metadata received - show empty grid with headers
                onMetadata: (parsedHeaders, estimatedRowCount, detectedDelimiter) => {
                    // Check if this load was cancelled
                    if (loadId !== currentLoadId) {
                        return;
                    }

                    headers = parsedHeaders;
                    delimiter = detectedDelimiter;

                    // Initialize column summaries
                    const initialSummaries: Record<string, SummaryType> = {};
                    headers.forEach((header) => {
                        initialSummaries[header] = "count";
                    });

                    // Initialize default column order
                    const defaultColumnOrder = headers.map((_, index) => index);

                    // Set initial state with empty data array (skeleton grid)
                    set({
                        headers: headers,
                        data: [], // Will be populated incrementally
                        delimiter: delimiter,
                        currentFile: path,
                        fileInfo: {
                            path,
                            name: path.split("/").pop() || path.split("\\").pop() || "unknown.cell",
                            size: fileContent.length,
                            lastModified: new Date(),
                            rowCount: estimatedRowCount,
                            columnCount: headers.length,
                        },
                        columnSummaries: initialSummaries,
                        columnOrder: defaultColumnOrder,
                        isDirty: false,
                        loadingProgress: 5, // Small initial progress to show activity
                        isFullyLoaded: false,
                        isTempFile: false,
                    });
                },

                // Phase 2: Chunks received - progressively update data
                onChunk: (chunkData, progress) => {
                    // Check if this load was cancelled
                    if (loadId !== currentLoadId) {
                        return;
                    }

                    // Append chunk to accumulated data
                    allData = allData.concat(chunkData);

                    // Update state with new data and progress
                    set({
                        data: allData,
                        loadingProgress: progress,
                        fileInfo: {
                            path,
                            name: path.split("/").pop() || path.split("\\").pop() || "unknown.cell",
                            size: fileContent.length,
                            lastModified: new Date(),
                            rowCount: allData.length,
                            columnCount: headers.length,
                        },
                    });
                },

                // Phase 3: Parsing complete
                onComplete: async () => {
                    // Check if this load was cancelled
                    if (loadId !== currentLoadId) {
                        return;
                    }

                    // Validate final data
                    const { validateCell } = await import("@utils/cellParser");
                    const validation = validateCell({ headers, data: allData });

                    if (!validation.valid) {
                        set({
                            error: `Cell validation failed: ${validation.errors.join(", ")}`,
                            isLoading: false,
                            isFullyLoaded: false,
                            loadingProgress: 0,
                        });
                        return;
                    }

                    // Mark as fully loaded
                    set({
                        isLoading: false,
                        isFullyLoaded: true,
                        loadingProgress: 100,
                    });

                    // Load and apply file config (same as synchronous loading)
                    try {
                        const identifiers = await invoke<FileIdentifiers>("get_file_identifiers", { path });
                        const fileConfig = useFileConfigStore.getState().findConfigForFile(identifiers);

                        if (fileConfig && fileConfig.config) {
                            // Apply config (same logic as loadCells)
                            if (fileConfig.config.columnWidths) {
                                set({ columnWidths: fileConfig.config.columnWidths });
                            }

                            if (fileConfig.config.columnOrder && Array.isArray(fileConfig.config.columnOrder)) {
                                const savedOrder = fileConfig.config.columnOrder;
                                if (savedOrder.length === headers.length) {
                                    set({ columnOrder: savedOrder });
                                }
                            }

                            if (fileConfig.config.filters) {
                                const filters: ColumnFilter[] = fileConfig.config.filters.map(f => ({
                                    column: f.field,
                                    operation: f.operation as "contains" | "not-contains" | "equals" | "not-equals",
                                    value: f.value
                                }));
                                set({ columnFilters: filters });
                            }

                            if (fileConfig.config.columnSummaries) {
                                const summaries = fileConfig.config.columnSummaries as Record<string, SummaryType>;
                                set({ columnSummaries: summaries });
                            }

                            // Apply settings store config
                            const settingsStore = useSettingsStore.getState();

                            if (fileConfig.config.rowColoringMode !== undefined) {
                                settingsStore.setRowColoringMode(fileConfig.config.rowColoringMode as "off" | "alternating" | "by-field");
                            }

                            if (fileConfig.config.rowColorFilter !== undefined) {
                                const filter = fileConfig.config.rowColorFilter ? {
                                    field: fileConfig.config.rowColorFilter.field,
                                    operation: fileConfig.config.rowColorFilter.operation as "contains" | "not-contains" | "equals" | "not-equals",
                                    value: fileConfig.config.rowColorFilter.value,
                                    color: fileConfig.config.rowColorFilter.color
                                } : null;
                                settingsStore.setRowColorFilter(filter);
                            }

                            if (fileConfig.config.wrapText !== undefined) {
                                settingsStore.setWrapText(fileConfig.config.wrapText);
                            }

                            // Update last seen timestamp
                            await useFileConfigStore.getState().saveConfigForFile(identifiers, fileConfig.config);
                        }
                    } catch (error) {
                        console.error("Failed to load file config:", error);
                        // Continue without config - not a fatal error
                    }

                    // Update global config
                    try {
                        const globalConfigStore = useGlobalConfigStore.getState();
                        await globalConfigStore.setLastOpenedFile(path);
                        await globalConfigStore.addRecentFile(path);
                    } catch (error) {
                        console.error("Failed to update global config:", error);
                    }
                },

                // Error handling
                onError: (errorMessage) => {
                    // Check if this load was cancelled
                    if (loadId !== currentLoadId) {
                        return;
                    }

                    set({
                        error: `Failed to parse Cell: ${errorMessage}`,
                        isLoading: false,
                        isFullyLoaded: false,
                        loadingProgress: 0,
                    });
                },
            });
        } catch (error) {
            // Check if this load was cancelled
            if (loadId !== currentLoadId) {
                return;
            }

            set({
                error: `Failed to load Cell: ${error}`,
                isLoading: false,
                isFullyLoaded: false,
                loadingProgress: 0,
            });
        }
    },

    // Reload current Cell from disk
    reloadCells: async () => {
        const { currentFile } = get();

        if (!currentFile) {
            set({ error: "No file is currently open" });
            return;
        }

        // Simply reload the current file
        await get().loadCells(currentFile);
    },

    // Save current Cell to disk
    saveCells: async () => {
        const { currentFile, headers, data, delimiter, isTempFile } = get();

        if (!currentFile) {
            set({ error: "No file is currently open" });
            return;
        }

        // If this is a temp file, redirect to "Save As" to let user choose permanent location
        if (isTempFile) {
            // This will be handled by the UI showing the save dialog
            // The saveCellAs function will be called from the UI
            throw new Error("TEMP_FILE_NEEDS_LOCATION");
        }

        set({ isLoading: true, error: null });

        try {
            // Serialize Cell Data using the original delimiter
            const cellContent = serializeCell({ headers, data }, delimiter);

            // Call Tauri command to write file
            await invoke("save_cell_file", {
                path: currentFile,
                content: cellContent,
            });

            set({
                isDirty: false,
                isLoading: false,
                error: null,
                lastSavedAt: Date.now(),
            });
        } catch (error) {
            set({
                error: `Failed to save Cell: ${error}`,
                isLoading: false,
            });
        }
    },

    // Save Cell to a new location
    saveCellAs: async (path: string) => {
        const { headers, data } = get();

        set({ isLoading: true, error: null });

        try {
            // Determine delimiter based on file extension
            const newDelimiter = getDelimiterFromPath(path);

            // Serialize Cell Data using the appropriate delimiter for the file type
            const cellContent = serializeCell({ headers, data }, newDelimiter);

            // Call Tauri command to write file
            await invoke("save_cell_file", {
                path,
                content: cellContent,
            });

            // Update current file path and delimiter
            set({
                currentFile: path,
                delimiter: newDelimiter,  // Update delimiter to match the new file type
                fileInfo: {
                    path,
                    name: path.split("/").pop() || path.split("\\").pop() || "unknown.cell",
                    size: cellContent.length,
                    lastModified: new Date(),
                    rowCount: data.length,
                    columnCount: headers.length,
                },
                isDirty: false,
                isLoading: false,
                error: null,
                lastSavedAt: Date.now(),
                isTempFile: false,  // Clear temp file flag when saving to permanent location
            });

            // Update global config with new file path
            try {
                const globalConfigStore = useGlobalConfigStore.getState();
                await globalConfigStore.setLastOpenedFile(path);
                await globalConfigStore.addRecentFile(path);
            } catch (error) {
                console.error("Failed to update global config:", error);
            }
        } catch (error) {
            set({
                error: `Failed to save Cell: ${error}`,
                isLoading: false,
            });
        }
    },

    // Create a new temporary file
    createNew: async () => {
        set({ isLoading: true, error: null });

        try {
            // Call Tauri command to create temp file
            const tempFilePath = await invoke<string>("create_temp_file");

            // Load the temp file (it comes with default headers)
            await get().loadCells(tempFilePath);

            // Mark as temp file and set as dirty (so it prompts to save)
            set({
                isTempFile: true,
                isDirty: true,
            });
        } catch (error) {
            set({
                error: `Failed to create new file: ${error}`,
                isLoading: false,
            });
        }
    },

    // Import screenplay file and convert to CSV
    importFromScreenplay: async (path: string) => {
        set({ isLoading: true, error: null });

        try {
            // Read the screenplay file
            const screenplayContent = await invoke<string>("open_cell_file", { path });

            // Convert screenplay to CSV using the converter
            const csvContent = await invoke<string>("convert_screenplay_to_csv", {
                content: screenplayContent
            });

            // Create a temp file
            const tempFilePath = await invoke<string>("create_temp_file");

            // Save the converted CSV to the temp file
            await invoke("save_cell_file", {
                path: tempFilePath,
                content: csvContent
            });

            // Load the temp file
            await get().loadCells(tempFilePath);

            // Mark as temp file and set as dirty (so it prompts to save)
            set({
                isTempFile: true,
                isDirty: true,
            });
        } catch (error) {
            set({
                error: `Failed to import screenplay: ${error}`,
                isLoading: false,
            });
        }
    },

    // Export current CSV data as screenplay text file
    exportToScreenplay: async (savePath: string) => {
        set({ isLoading: true, error: null });

        try {
            const { data, headers } = get();

            // Convert data to CSV string format
            const csvContent = Papa.unparse({
                fields: headers,
                data: data,
            });

            // Convert CSV to screenplay format using the converter
            const screenplayContent = await invoke<string>("convert_csv_to_screenplay", {
                csvContent: csvContent
            });

            // Save the screenplay file
            await invoke("save_cell_file", {
                path: savePath,
                content: screenplayContent
            });

            set({ isLoading: false });
        } catch (error) {
            set({
                error: `Failed to export screenplay: ${error}`,
                isLoading: false,
            });
        }
    },

    // Update a single cell
    updateCell: (row: number, col: number, value: string) => {
        const { data } = get();

        if (row < 0 || row >= data.length || col < 0 || col >= data[row].length) {
            return;
        }

        // Push current state to undo stack
        pushToUndoStack(get, set);

        const newData = data.map((r, i) =>
            i === row ? r.map((c, j) => (j === col ? value : c)) : r
        );

        set({ data: newData, isDirty: true });
    },

    // Update multiple cells at once (creates single undo snapshot)
    updateCells: (cells: Array<{ row: number; col: number; value: string }>) => {
        const { data } = get();

        if (cells.length === 0) return;

        // Push current state to undo stack (once for all updates)
        pushToUndoStack(get, set);

        const newData = data.map((row) => [...row]);

        // Apply all updates
        cells.forEach(({ row, col, value }) => {
            if (row >= 0 && row < newData.length && col >= 0 && col < newData[row].length) {
                newData[row][col] = value;
            }
        });

        set({ data: newData, isDirty: true });
    },

    // Update an entire row
    updateRow: (rowIndex: number, newRow: string[]) => {
        const { data, headers } = get();

        if (rowIndex < 0 || rowIndex >= data.length) {
            return;
        }

        if (newRow.length !== headers.length) {
            set({ error: `Row must have ${headers.length} columns` });
            return;
        }

        // Push current state to undo stack
        pushToUndoStack(get, set);

        const newData = data.map((r, i) => (i === rowIndex ? newRow : r));

        set({ data: newData, isDirty: true });
    },

    // Add a new row
    addRow: (atIndex?: number) => {
        const { data, headers } = get();

        // Push current state to undo stack
        pushToUndoStack(get, set);

        // Create empty row with correct number of columns
        const newRow = new Array(headers.length).fill("");

        let newData: string[][];
        if (atIndex === undefined || atIndex >= data.length) {
            // Add at end
            newData = [...data, newRow];
        } else {
            // Insert at specific index
            newData = [...data.slice(0, atIndex), newRow, ...data.slice(atIndex)];
        }

        set({ data: newData, isDirty: true });
    },

    // Delete rows by indices
    deleteRows: (indices: number[]) => {
        const { data } = get();

        // Push current state to undo stack
        pushToUndoStack(get, set);

        const indexSet = new Set(indices);
        const newData = data.filter((_, i) => !indexSet.has(i));

        set({ data: newData, isDirty: true });
    },

    // Add a new column
    addColumn: (name: string, atIndex?: number) => {
        const { data, headers } = get();

        // Push current state to undo stack
        pushToUndoStack(get, set);

        let newHeaders: string[];
        if (atIndex === undefined || atIndex >= headers.length) {
            // Add at end
            newHeaders = [...headers, name];
        } else {
            // Insert at specific index
            newHeaders = [...headers.slice(0, atIndex), name, ...headers.slice(atIndex)];
        }

        // Add empty cell to each row
        const newData = data.map((row) => {
            if (atIndex === undefined || atIndex >= row.length) {
                return [...row, ""];
            } else {
                return [...row.slice(0, atIndex), "", ...row.slice(atIndex)];
            }
        });

        set({ headers: newHeaders, data: newData, isDirty: true });
    },

    // Delete a column
    deleteColumn: (index: number) => {
        const { data, headers } = get();

        if (index < 0 || index >= headers.length) {
            return;
        }

        // Push current state to undo stack
        pushToUndoStack(get, set);

        const newHeaders = headers.filter((_, i) => i !== index);
        const newData = data.map((row) => row.filter((_, i) => i !== index));

        set({ headers: newHeaders, data: newData, isDirty: true });
    },

    // Rename a column
    renameColumn: (index: number, newName: string) => {
        const { headers } = get();

        if (index < 0 || index >= headers.length) {
            return;
        }

        // Push current state to undo stack
        pushToUndoStack(get, set);

        const newHeaders = headers.map((h, i) => (i === index ? newName : h));

        set({ headers: newHeaders, isDirty: true });
    },

    // Clear all data
    clearData: () => {
        set({
            data: [],
            headers: [],
            currentFile: null,
            fileInfo: null,
            isDirty: false,
            error: null,
            isTempFile: false,
        });

        // Clear last opened file from global config
        try {
            const globalConfigStore = useGlobalConfigStore.getState();
            globalConfigStore.setLastOpenedFile(null);
        } catch (error) {
            console.error("Failed to clear last opened file from global config:", error);
        }
    },

    // Set error message
    setError: (error: string | null) => {
        set({ error });
    },

    // Set column widths
    setColumnWidths: (widths: Record<number, number> | ((prev: Record<number, number>) => Record<number, number>)) => {
        if (typeof widths === "function") {
            const currentWidths = get().columnWidths;
            const newWidths = widths(currentWidths);
            set({ columnWidths: newWidths });
        } else {
            set({ columnWidths: widths });
        }
    },

    // Undo last action
    undo: () => {
        const { undoStack, data, headers, redoStack } = get();

        if (undoStack.length === 0) {
            return;
        }

        // Get the previous state from undo stack
        const previousState = undoStack[undoStack.length - 1];
        const newUndoStack = undoStack.slice(0, -1);

        // Push current state to redo stack
        const currentSnapshot = createSnapshot(data, headers);
        const newRedoStack = [...redoStack, currentSnapshot];

        // Restore previous state
        set({
            data: previousState.data,
            headers: previousState.headers,
            undoStack: newUndoStack,
            redoStack: newRedoStack,
            isDirty: true,
        });
    },

    // Redo last undone action
    redo: () => {
        const { redoStack, data, headers, undoStack } = get();

        if (redoStack.length === 0) {
            return;
        }

        // Get the next state from redo stack
        const nextState = redoStack[redoStack.length - 1];
        const newRedoStack = redoStack.slice(0, -1);

        // Push current state to undo stack
        const currentSnapshot = createSnapshot(data, headers);
        const newUndoStack = [...undoStack, currentSnapshot];

        // Restore next state
        set({
            data: nextState.data,
            headers: nextState.headers,
            undoStack: newUndoStack,
            redoStack: newRedoStack,
            isDirty: true,
        });
    },

    // Check if undo is available
    canUndo: () => {
        return get().undoStack.length > 0;
    },

    // Check if redo is available
    canRedo: () => {
        return get().redoStack.length > 0;
    },

    // Set cell being edited (for coordinating between Cell Grid and Print preview)
    setEditingCell: (row: number, col: number, initialValue: string, source: "cell" | "print" = "cell") => {
        set({
            editingCell: { row, col },
            editingValue: initialValue,
            editingSource: source,
        });
    },

    // Update the value being edited (for real-time Print preview updates)
    updateEditingValue: (value: string) => {
        set({ editingValue: value });
    },

    // Clear editing state
    clearEditingCell: () => {
        set({
            editingCell: null,
            editingValue: "",
            editingSource: null,
        });
    },

    // Selection actions
    setSelectedCell: (row: number, col: number) => {
        set({
            selectedCell: { row, col },
            selectedRange: null,
        });
    },

    setSelectedRange: (startRow: number, startCol: number, endRow: number, endCol: number) => {
        set({
            selectedRange: { startRow, startCol, endRow, endCol },
            selectedCell: null,
        });
    },

    clearSelection: () => {
        set({
            selectedCell: null,
            selectedRange: null,
        });
    },

    copySelection: () => {
        const { selectedCell, selectedRange, data } = get();

        if (selectedRange) {
            // Copy range
            const { startRow, startCol, endRow, endCol } = selectedRange;
            const minRow = Math.min(startRow, endRow);
            const maxRow = Math.max(startRow, endRow);
            const minCol = Math.min(startCol, endCol);
            const maxCol = Math.max(startCol, endCol);

            const copiedData: string[][] = [];
            for (let r = minRow; r <= maxRow; r++) {
                const row: string[] = [];
                for (let c = minCol; c <= maxCol; c++) {
                    row.push(data[r]?.[c] || "");
                }
                copiedData.push(row);
            }

            set({
                clipboard: {
                    data: copiedData,
                    isSingleCell: false,
                },
            });
        } else if (selectedCell) {
            // Copy single cell
            const value = data[selectedCell.row]?.[selectedCell.col] || "";
            set({
                clipboard: {
                    data: [[value]],
                    isSingleCell: true,
                },
            });
        }
    },

    pasteClipboard: () => {
        const { selectedCell, selectedRange, clipboard, data } = get();

        if (!clipboard) return;

        // Push current state to undo stack
        pushToUndoStack(get, set);

        const newData = data.map((row) => [...row]);

        if (selectedRange) {
            // Paste into range
            const { startRow, startCol, endRow, endCol } = selectedRange;
            const minRow = Math.min(startRow, endRow);
            const maxRow = Math.max(startRow, endRow);
            const minCol = Math.min(startCol, endCol);
            const maxCol = Math.max(startCol, endCol);

            if (clipboard.isSingleCell) {
                // Fill all selected cells with single value
                const value = clipboard.data[0][0];
                for (let r = minRow; r <= maxRow; r++) {
                    for (let c = minCol; c <= maxCol; c++) {
                        if (r < newData.length && c < newData[r].length) {
                            newData[r][c] = value;
                        }
                    }
                }
            } else {
                // Paste with tiling/iterative logic
                const clipRows = clipboard.data.length;
                const clipCols = clipboard.data[0]?.length || 0;
                const selRows = maxRow - minRow + 1;
                const selCols = maxCol - minCol + 1;

                // Check if we're pasting a row into a column or vice versa (iterative paste)
                if (clipRows === 1 && selCols === 1 && selRows > 1) {
                    // Pasting a row into a column - paste iteratively down
                    for (let r = minRow; r <= maxRow; r++) {
                        for (let c = 0; c < clipCols && minCol + c <= maxCol; c++) {
                            if (r < newData.length && minCol + c < newData[r].length) {
                                newData[r][minCol + c] = clipboard.data[0][c];
                            }
                        }
                    }
                } else if (clipCols === 1 && selRows === 1 && selCols > 1) {
                    // Pasting a column into a row - paste iteratively across
                    for (let c = minCol; c <= maxCol; c++) {
                        for (let r = 0; r < clipRows && minRow + r <= maxRow; r++) {
                            if (minRow + r < newData.length && c < newData[minRow + r].length) {
                                newData[minRow + r][c] = clipboard.data[r][0];
                            }
                        }
                    }
                } else {
                    // Tile the clipboard data across the selection
                    for (let r = minRow; r <= maxRow; r++) {
                        for (let c = minCol; c <= maxCol; c++) {
                            const clipR = (r - minRow) % clipRows;
                            const clipC = (c - minCol) % clipCols;
                            if (r < newData.length && c < newData[r].length) {
                                newData[r][c] = clipboard.data[clipR][clipC] || "";
                            }
                        }
                    }
                }
            }
        } else if (selectedCell) {
            // Paste starting at selected cell
            const { row, col } = selectedCell;

            for (let r = 0; r < clipboard.data.length; r++) {
                for (let c = 0; c < clipboard.data[r].length; c++) {
                    const targetRow = row + r;
                    const targetCol = col + c;
                    if (targetRow < newData.length && targetCol < newData[targetRow].length) {
                        newData[targetRow][targetCol] = clipboard.data[r][c];
                    }
                }
            }
        }

        set({ data: newData, isDirty: true });
    },

    clearCells: () => {
        const { selectedCell, selectedRange, data } = get();

        if (!selectedCell && !selectedRange) return;

        // Push current state to undo stack
        pushToUndoStack(get, set);

        const newData = data.map((row) => [...row]);

        if (selectedRange) {
            // Clear range
            const { startRow, startCol, endRow, endCol } = selectedRange;
            const minRow = Math.min(startRow, endRow);
            const maxRow = Math.max(startRow, endRow);
            const minCol = Math.min(startCol, endCol);
            const maxCol = Math.max(startCol, endCol);

            for (let r = minRow; r <= maxRow; r++) {
                for (let c = minCol; c <= maxCol; c++) {
                    if (r < newData.length && c < newData[r].length) {
                        newData[r][c] = "";
                    }
                }
            }
        } else if (selectedCell) {
            // Clear single cell
            const { row, col } = selectedCell;
            if (row < newData.length && col < newData[row].length) {
                newData[row][col] = "";
            }
        }

        set({ data: newData, isDirty: true });
    },

    // Filtering actions
    setColumnFilter: (column: string, operation: "contains" | "not-contains" | "equals" | "not-equals", value: string) => {
        const { columnFilters } = get();

        // Remove existing filter for this column
        const newFilters = columnFilters.filter((f) => f.column !== column);

        // Add new filter
        newFilters.push({ column, operation, value });

        set({ columnFilters: newFilters });
    },

    clearColumnFilter: (column: string) => {
        const { columnFilters } = get();
        set({ columnFilters: columnFilters.filter((f) => f.column !== column) });
    },

    setColumnSummary: (column: string, summaryType: SummaryType) => {
        const { columnSummaries } = get();
        set({
            columnSummaries: {
                ...columnSummaries,
                [column]: summaryType,
            },
        });
    },

    // Row and column reordering
    reorderRows: (fromIndex: number, toIndex: number) => {
        const { data } = get();

        if (fromIndex === toIndex) return;
        if (fromIndex < 0 || fromIndex >= data.length) return;
        if (toIndex < 0 || toIndex >= data.length) return;

        // Push current state to undo stack
        pushToUndoStack(get, set);

        const newData = [...data];
        const [movedRow] = newData.splice(fromIndex, 1);
        newData.splice(toIndex, 0, movedRow);

        set({ data: newData, isDirty: true });
    },

    reorderColumns: (fromIndex: number, toIndex: number) => {
        const { headers, data, columnOrder } = get();

        if (fromIndex === toIndex) return;
        if (fromIndex < 0 || fromIndex >= headers.length) return;
        if (toIndex < 0 || toIndex >= headers.length) return;

        // Push current state to undo stack
        pushToUndoStack(get, set);

        // Reorder headers
        const newHeaders = [...headers];
        const [movedHeader] = newHeaders.splice(fromIndex, 1);
        newHeaders.splice(toIndex, 0, movedHeader);

        // Reorder data columns
        const newData = data.map((row) => {
            const newRow = [...row];
            const [movedCell] = newRow.splice(fromIndex, 1);
            newRow.splice(toIndex, 0, movedCell);
            return newRow;
        });

        // Reorder columnOrder array
        const newColumnOrder = [...columnOrder];
        const [movedOrderIndex] = newColumnOrder.splice(fromIndex, 1);
        newColumnOrder.splice(toIndex, 0, movedOrderIndex);

        set({ headers: newHeaders, data: newData, columnOrder: newColumnOrder, isDirty: true });

        // Trigger debounced save of column order to file config
        // This is handled by configPersistence utility which watches for changes
    },
}));
