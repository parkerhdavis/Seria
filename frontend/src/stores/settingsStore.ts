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
    appFont: string;
    showColumnSeparators: boolean;
    wrapText: boolean;
    autoFitColumns: boolean;
    rowColoringMode: RowColoringMode;
    rowColorFilter: RowColorFilter | null;
    groupByColumn: string | null;
    collapsedGroups: Set<string>;
    printFollowsCellEdit: boolean;
    cellFollowsPrintEdit: boolean;
    hoverHighlightMode: HoverHighlightMode;
    autosaveEnabled: boolean;
    autosaveIntervalSeconds: number;
    autocompleteEnabled: boolean;
    autocompleteMinChars: number;
    autocompleteRestrictToExisting: boolean;

    // Actions
    setShowIncompatibleFiles: (show: boolean) => void;
    setTheme: (theme: "light" | "dark" | "auto") => void;
    setAppFont: (font: string) => void;
    setShowColumnSeparators: (show: boolean) => void;
    setWrapText: (wrap: boolean) => void;
    setAutoFitColumns: (autoFit: boolean) => void;
    setRowColoringMode: (mode: RowColoringMode) => void;
    setRowColorFilter: (filter: RowColorFilter | null) => void;
    setGroupByColumn: (column: string | null) => void;
    toggleGroupCollapsed: (groupValue: string) => void;
    collapseAllGroups: (groupValues: string[]) => void;
    expandAllGroups: () => void;
    setPrintFollowsCellEdit: (follow: boolean) => void;
    setCellFollowsPrintEdit: (follow: boolean) => void;
    setHoverHighlightMode: (mode: HoverHighlightMode) => void;
    setAutosaveEnabled: (enabled: boolean) => void;
    setAutosaveIntervalSeconds: (seconds: number) => void;
    setAutocompleteEnabled: (enabled: boolean) => void;
    setAutocompleteMinChars: (minChars: number) => void;
    setAutocompleteRestrictToExisting: (restrict: boolean) => void;
}

export const useSettingsStore = create<SettingsStore>((set) => ({
    // Initial state
    showIncompatibleFiles: false,
    theme: "dark",
    appFont: "system",
    showColumnSeparators: true,
    wrapText: false,
    autoFitColumns: true,
    rowColoringMode: "off",
    rowColorFilter: null,
    groupByColumn: null,
    collapsedGroups: new Set<string>(),
    printFollowsCellEdit: true,
    cellFollowsPrintEdit: true,
    hoverHighlightMode: "row-and-column",
    autosaveEnabled: true,
    autosaveIntervalSeconds: 30,
    autocompleteEnabled: true,
    autocompleteMinChars: 1,
    autocompleteRestrictToExisting: false,

    // Toggle showing non-Cell files in file tree
    setShowIncompatibleFiles: (show: boolean) => {
        set({ showIncompatibleFiles: show });
    },

    // Set theme
    setTheme: (theme: "light" | "dark" | "auto") => {
        set({ theme });
    },

    // Set app font
    setAppFont: (font: string) => {
        set({ appFont: font });
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

    // Set group by column (also clears collapsed groups when changing column)
    setGroupByColumn: (column: string | null) => {
        set({ groupByColumn: column, collapsedGroups: new Set<string>() });
    },

    // Toggle a single group collapsed/expanded
    toggleGroupCollapsed: (groupValue: string) => {
        set((state) => {
            const next = new Set(state.collapsedGroups);
            if (next.has(groupValue)) {
                next.delete(groupValue);
            } else {
                next.add(groupValue);
            }
            return { collapsedGroups: next };
        });
    },

    // Collapse all groups
    collapseAllGroups: (groupValues: string[]) => {
        set({ collapsedGroups: new Set(groupValues) });
    },

    // Expand all groups
    expandAllGroups: () => {
        set({ collapsedGroups: new Set<string>() });
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

    // Set autocomplete enabled
    setAutocompleteEnabled: (enabled: boolean) => {
        set({ autocompleteEnabled: enabled });
    },

    // Set minimum characters before showing autocomplete
    setAutocompleteMinChars: (minChars: number) => {
        set({ autocompleteMinChars: minChars });
    },

    // Set whether to restrict autocomplete to existing values
    setAutocompleteRestrictToExisting: (restrict: boolean) => {
        set({ autocompleteRestrictToExisting: restrict });
    },
}));
