/**
 * CSV Store
 *
 * Zustand store for managing CSV data state, file operations,
 * and edit history with undo/redo support.
 */

import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { CSVFileInfo } from "@/types/csv";
import { parseCSV, serializeCSV, validateCSV } from "@utils/csvParser";
import { useFileConfigStore, type FileIdentifiers } from "./fileConfigStore";
import { useSettingsStore } from "./settingsStore";
import { useDrawerStore } from "./drawerStore";

// Snapshot of data state for undo/redo
interface DataSnapshot {
    data: string[][];
    headers: string[];
}

// Cell editing state for coordinating between CSV grid and Print preview
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

interface CSVStore {
    // State
    data: string[][];
    headers: string[];
    currentFile: string | null;
    fileInfo: CSVFileInfo | null;
    isDirty: boolean;
    isLoading: boolean;
    error: string | null;
    lastSavedAt: number | null;  // Timestamp of last successful save

    // Cell editing state (shared between CSV grid and Print preview)
    editingCell: EditingCell | null;
    editingValue: string;
    editingSource: "csv" | "print" | null;  // Track where the editing originated

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
    loadCSV: (path: string) => Promise<void>;
    reloadCSV: () => Promise<void>;
    saveCSV: () => Promise<void>;
    saveCSVAs: (path: string) => Promise<void>;
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
    setEditingCell: (row: number, col: number, initialValue: string, source?: "csv" | "print") => void;
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
const pushToUndoStack = (get: () => CSVStore, set: (state: Partial<CSVStore>) => void) => {
    const { data, headers, undoStack } = get();
    const snapshot = createSnapshot(data, headers);

    // Limit undo stack size to 50 actions
    const newUndoStack = [...undoStack, snapshot].slice(-50);

    set({ undoStack: newUndoStack, redoStack: [] }); // Clear redo stack on new action
};

export const useCSVStore = create<CSVStore>((set, get) => ({
    // Initial state
    data: [],
    headers: [],
    currentFile: null,
    fileInfo: null,
    isDirty: false,
    isLoading: false,
    error: null,
    lastSavedAt: null,
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

    // Load CSV file from disk
    loadCSV: async (path: string) => {
        set({ isLoading: true, error: null });

        try {
            // Call Tauri command to read file
            const fileContent = await invoke<string>("open_csv_file", { path });

            // Parse CSV content
            const csvData = parseCSV(fileContent);

            // Validate CSV
            const validation = validateCSV(csvData);
            if (!validation.valid) {
                set({
                    error: `CSV validation failed: ${validation.errors.join(", ")}`,
                    isLoading: false,
                });
                return;
            }

            // Initialize column summaries with "count" for all columns
            const initialSummaries: Record<string, SummaryType> = {};
            csvData.headers.forEach((header) => {
                initialSummaries[header] = "count";
            });

            // Initialize default column order [0, 1, 2, ...]
            const defaultColumnOrder = csvData.headers.map((_, index) => index);

            // Update state (initial load before applying config)
            set({
                headers: csvData.headers,
                data: csvData.data,
                currentFile: path,
                fileInfo: {
                    path,
                    name: path.split("/").pop() || path.split("\\").pop() || "unknown.csv",
                    size: fileContent.length,
                    lastModified: new Date(),
                    rowCount: csvData.data.length,
                    columnCount: csvData.headers.length,
                },
                columnSummaries: initialSummaries,
                columnOrder: defaultColumnOrder,
                isDirty: false,
                isLoading: false,
                error: null,
            });

            // Load and apply file config
            try {
                // Get file identifiers
                const identifiers = await invoke<FileIdentifiers>("get_file_identifiers", { path });

                // Look up config in file config store
                const fileConfig = useFileConfigStore.getState().findConfigForFile(identifiers);

                if (fileConfig && fileConfig.config) {
                    // Apply config to CSV store
                    if (fileConfig.config.columnWidths) {
                        set({ columnWidths: fileConfig.config.columnWidths });
                    }

                    // Apply saved column order if it exists and is valid
                    if (fileConfig.config.columnOrder && Array.isArray(fileConfig.config.columnOrder)) {
                        const savedOrder = fileConfig.config.columnOrder;
                        // Validate that column order matches current CSV structure
                        if (savedOrder.length === csvData.headers.length) {
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
        } catch (error) {
            set({
                error: `Failed to load CSV: ${error}`,
                isLoading: false,
            });
        }
    },

    // Reload current CSV from disk
    reloadCSV: async () => {
        const { currentFile } = get();

        if (!currentFile) {
            set({ error: "No file is currently open" });
            return;
        }

        // Simply reload the current file
        await get().loadCSV(currentFile);
    },

    // Save current CSV to disk
    saveCSV: async () => {
        const { currentFile, headers, data } = get();

        if (!currentFile) {
            set({ error: "No file is currently open" });
            return;
        }

        set({ isLoading: true, error: null });

        try {
            // Serialize CSV data
            const csvContent = serializeCSV({ headers, data });

            // Call Tauri command to write file
            await invoke("save_csv_file", {
                path: currentFile,
                content: csvContent,
            });

            set({
                isDirty: false,
                isLoading: false,
                error: null,
                lastSavedAt: Date.now(),
            });
        } catch (error) {
            set({
                error: `Failed to save CSV: ${error}`,
                isLoading: false,
            });
        }
    },

    // Save CSV to a new location
    saveCSVAs: async (path: string) => {
        const { headers, data } = get();

        set({ isLoading: true, error: null });

        try {
            // Serialize CSV data
            const csvContent = serializeCSV({ headers, data });

            // Call Tauri command to write file
            await invoke("save_csv_file", {
                path,
                content: csvContent,
            });

            // Update current file path
            set({
                currentFile: path,
                fileInfo: {
                    path,
                    name: path.split("/").pop() || path.split("\\").pop() || "unknown.csv",
                    size: csvContent.length,
                    lastModified: new Date(),
                    rowCount: data.length,
                    columnCount: headers.length,
                },
                isDirty: false,
                isLoading: false,
                error: null,
                lastSavedAt: Date.now(),
            });
        } catch (error) {
            set({
                error: `Failed to save CSV: ${error}`,
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
        });
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

    // Set cell being edited (for coordinating between CSV grid and Print preview)
    setEditingCell: (row: number, col: number, initialValue: string, source: "csv" | "print" = "csv") => {
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
