/**
 * CSV Store
 *
 * Zustand store for managing CSV data state, file operations,
 * and edit history.
 */

import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { CSVData, CSVFileInfo } from "@types/csv";
import { parseCSV, serializeCSV, validateCSV } from "@utils/csvParser";

interface CSVStore {
    // State
    data: string[][];
    headers: string[];
    currentFile: string | null;
    fileInfo: CSVFileInfo | null;
    isDirty: boolean;
    isLoading: boolean;
    error: string | null;

    // Actions
    loadCSV: (path: string) => Promise<void>;
    saveCSV: () => Promise<void>;
    saveCSVAs: (path: string) => Promise<void>;
    updateCell: (row: number, col: number, value: string) => void;
    updateRow: (rowIndex: number, newRow: string[]) => void;
    addRow: (atIndex?: number) => void;
    deleteRows: (indices: number[]) => void;
    addColumn: (name: string, atIndex?: number) => void;
    deleteColumn: (index: number) => void;
    renameColumn: (index: number, newName: string) => void;
    clearData: () => void;
    setError: (error: string | null) => void;
}

export const useCSVStore = create<CSVStore>((set, get) => ({
    // Initial state
    data: [],
    headers: [],
    currentFile: null,
    fileInfo: null,
    isDirty: false,
    isLoading: false,
    error: null,

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

            // Update state
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
                isDirty: false,
                isLoading: false,
                error: null,
            });
        } catch (error) {
            set({
                error: `Failed to load CSV: ${error}`,
                isLoading: false,
            });
        }
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

        const newData = data.map((r, i) =>
            i === row ? r.map((c, j) => (j === col ? value : c)) : r
        );

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

        const newData = data.map((r, i) => (i === rowIndex ? newRow : r));

        set({ data: newData, isDirty: true });
    },

    // Add a new row
    addRow: (atIndex?: number) => {
        const { data, headers } = get();

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

        const indexSet = new Set(indices);
        const newData = data.filter((_, i) => !indexSet.has(i));

        set({ data: newData, isDirty: true });
    },

    // Add a new column
    addColumn: (name: string, atIndex?: number) => {
        const { data, headers } = get();

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
}));
