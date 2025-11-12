/**
 * Settings Store
 *
 * Zustand store for managing application settings and user preferences.
 */

import { create } from "zustand";

export type RowColoringMode = "off" | "alternating" | "by-field";
export type FilterOperation = "contains" | "not-contains" | "equals" | "not-equals";

export interface RowColorFilter {
    field: string;
    operation: FilterOperation;
    value: string;
    color: string;
}

interface SettingsStore {
    // State
    showNonCsvFiles: boolean;
    theme: "light" | "dark" | "auto";
    showColumnSeparators: boolean;
    wrapText: boolean;
    rowColoringMode: RowColoringMode;
    rowColorFilter: RowColorFilter | null;
    printFollowsCsvEdit: boolean;
    csvFollowsPrintEdit: boolean;

    // Actions
    setShowNonCsvFiles: (show: boolean) => void;
    setTheme: (theme: "light" | "dark" | "auto") => void;
    setShowColumnSeparators: (show: boolean) => void;
    setWrapText: (wrap: boolean) => void;
    setRowColoringMode: (mode: RowColoringMode) => void;
    setRowColorFilter: (filter: RowColorFilter | null) => void;
    setPrintFollowsCsvEdit: (follow: boolean) => void;
    setCsvFollowsPrintEdit: (follow: boolean) => void;
}

export const useSettingsStore = create<SettingsStore>((set) => ({
    // Initial state
    showNonCsvFiles: false,
    theme: "dark",
    showColumnSeparators: true,
    wrapText: false,
    rowColoringMode: "off",
    rowColorFilter: null,
    printFollowsCsvEdit: true,
    csvFollowsPrintEdit: true,

    // Toggle showing non-CSV files in file tree
    setShowNonCsvFiles: (show: boolean) => {
        set({ showNonCsvFiles: show });
    },

    // Set theme
    setTheme: (theme: "light" | "dark" | "auto") => {
        set({ theme });
    },

    // Toggle column separators
    setShowColumnSeparators: (show: boolean) => {
        set({ showColumnSeparators: show });
    },

    // Toggle text wrapping
    setWrapText: (wrap: boolean) => {
        set({ wrapText: wrap });
    },

    // Set row coloring mode
    setRowColoringMode: (mode: RowColoringMode) => {
        set({ rowColoringMode: mode });
    },

    // Set row color filter
    setRowColorFilter: (filter: RowColorFilter | null) => {
        set({ rowColorFilter: filter });
    },

    // Toggle Print follows CSV edit
    setPrintFollowsCsvEdit: (follow: boolean) => {
        set({ printFollowsCsvEdit: follow });
    },

    // Toggle CSV follows Print edit
    setCsvFollowsPrintEdit: (follow: boolean) => {
        set({ csvFollowsPrintEdit: follow });
    },
}));
