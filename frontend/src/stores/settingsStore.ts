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

    // Actions
    setShowNonCsvFiles: (show: boolean) => void;
    setTheme: (theme: "light" | "dark" | "auto") => void;
    setShowColumnSeparators: (show: boolean) => void;
    setWrapText: (wrap: boolean) => void;
    setRowColoringMode: (mode: RowColoringMode) => void;
    setRowColorFilter: (filter: RowColorFilter | null) => void;
}

export const useSettingsStore = create<SettingsStore>((set) => ({
    // Initial state
    showNonCsvFiles: false,
    theme: "dark",
    showColumnSeparators: true,
    wrapText: false,
    rowColoringMode: "off",
    rowColorFilter: null,

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
}));
