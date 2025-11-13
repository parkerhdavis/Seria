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
    showIncompatibleFiles: boolean;
    theme: "light" | "dark" | "auto";
    showColumnSeparators: boolean;
    wrapText: boolean;
    autoFitColumns: boolean;
    rowColoringMode: RowColoringMode;
    rowColorFilter: RowColorFilter | null;
    printFollowsCellEdit: boolean;
    cellFollowsPrintEdit: boolean;
    hoverHighlightMode: HoverHighlightMode;
    autosaveEnabled: boolean;
    autosaveIntervalSeconds: number;

    // Actions
    setShowIncompatibleFiles: (show: boolean) => void;
    setTheme: (theme: "light" | "dark" | "auto") => void;
    setShowColumnSeparators: (show: boolean) => void;
    setWrapText: (wrap: boolean) => void;
    setAutoFitColumns: (autoFit: boolean) => void;
    setRowColoringMode: (mode: RowColoringMode) => void;
    setRowColorFilter: (filter: RowColorFilter | null) => void;
    setPrintFollowsCellEdit: (follow: boolean) => void;
    setCellFollowsPrintEdit: (follow: boolean) => void;
    setHoverHighlightMode: (mode: HoverHighlightMode) => void;
    setAutosaveEnabled: (enabled: boolean) => void;
    setAutosaveIntervalSeconds: (seconds: number) => void;
}

export const useSettingsStore = create<SettingsStore>((set) => ({
    // Initial state
    showIncompatibleFiles: false,
    theme: "dark",
    showColumnSeparators: true,
    wrapText: false,
    autoFitColumns: true,
    rowColoringMode: "off",
    rowColorFilter: null,
    printFollowsCellEdit: true,
    cellFollowsPrintEdit: true,
    hoverHighlightMode: "row-and-column",
    autosaveEnabled: true,
    autosaveIntervalSeconds: 30,

    // Toggle showing non-Cell files in file tree
    setShowIncompatibleFiles: (show: boolean) => {
        set({ showIncompatibleFiles: show });
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

    // Toggle Print follows Cell edit
    setPrintFollowsCellEdit: (follow: boolean) => {
        set({ printFollowsCellEdit: follow });
    },

    // Toggle Cell follows Print edit
    setCellFollowsPrintEdit: (follow: boolean) => {
        set({ cellFollowsPrintEdit: follow });
    },

    // Set hover highlight mode
    setHoverHighlightMode: (mode: HoverHighlightMode) => {
        set({ hoverHighlightMode: mode });
    },

    // Set autosave enabled
    setAutosaveEnabled: (enabled: boolean) => {
        set({ autosaveEnabled: enabled });
    },

    // Set autosave interval in seconds
    setAutosaveIntervalSeconds: (seconds: number) => {
        set({ autosaveIntervalSeconds: seconds });
    },
}));
