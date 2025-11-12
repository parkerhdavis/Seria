/**
 * Settings Store
 *
 * Zustand store for managing application settings and user preferences.
 */

import { create } from "zustand";

export type RowColoringMode = "off" | "alternating" | "by-field";
export type FilterOperation = "contains" | "not-contains" | "equals" | "not-equals";
export type HoverHighlightMode = "none" | "row" | "column" | "row-and-column";

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
    autoFitColumns: boolean;
    rowColoringMode: RowColoringMode;
    rowColorFilter: RowColorFilter | null;
    printFollowsCsvEdit: boolean;
    csvFollowsPrintEdit: boolean;
    hoverHighlightMode: HoverHighlightMode;

    // Actions
    setShowNonCsvFiles: (show: boolean) => void;
    setTheme: (theme: "light" | "dark" | "auto") => void;
    setShowColumnSeparators: (show: boolean) => void;
    setWrapText: (wrap: boolean) => void;
    setAutoFitColumns: (autoFit: boolean) => void;
    setRowColoringMode: (mode: RowColoringMode) => void;
    setRowColorFilter: (filter: RowColorFilter | null) => void;
    setPrintFollowsCsvEdit: (follow: boolean) => void;
    setCsvFollowsPrintEdit: (follow: boolean) => void;
    setHoverHighlightMode: (mode: HoverHighlightMode) => void;
}

export const useSettingsStore = create<SettingsStore>((set) => ({
    // Initial state
    showNonCsvFiles: false,
    theme: "dark",
    showColumnSeparators: true,
    wrapText: false,
    autoFitColumns: true,
    rowColoringMode: "off",
    rowColorFilter: null,
    printFollowsCsvEdit: true,
    csvFollowsPrintEdit: true,
    hoverHighlightMode: "row-and-column",

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

    // Toggle auto-fit columns
    setAutoFitColumns: (autoFit: boolean) => {
        set({ autoFitColumns: autoFit });
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

    // Set hover highlight mode
    setHoverHighlightMode: (mode: HoverHighlightMode) => {
        set({ hoverHighlightMode: mode });
    },
}));
