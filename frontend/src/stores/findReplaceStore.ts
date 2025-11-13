/**
 * Find/Replace Store
 *
 * Zustand store for managing find and replace functionality.
 * Tracks search matches, current match index, and search options.
 */

import { create } from "zustand";

export interface SearchMatch {
    row: number;
    col: number;
}

export interface SearchOptions {
    matchCase: boolean;
    matchWholeCell: boolean;
    searchInColumn: string | null; // null means search all columns
    useWildcards: boolean; // Enable wildcard/regex pattern matching
}

interface FindReplaceStore {
    // State
    isOpen: boolean;
    mode: "find" | "replace";
    searchTerm: string;
    replaceTerm: string;
    matches: SearchMatch[];
    currentMatchIndex: number;
    searchOptions: SearchOptions;

    // Actions
    openFind: () => void;
    openReplace: () => void;
    close: () => void;
    setSearchTerm: (term: string) => void;
    setReplaceTerm: (term: string) => void;
    setMatches: (matches: SearchMatch[]) => void;
    setCurrentMatchIndex: (index: number) => void;
    nextMatch: () => void;
    previousMatch: () => void;
    setSearchOptions: (options: Partial<SearchOptions>) => void;
    clearSearch: () => void;
}

export const useFindReplaceStore = create<FindReplaceStore>((set, get) => ({
    // Initial state
    isOpen: false,
    mode: "find",
    searchTerm: "",
    replaceTerm: "",
    matches: [],
    currentMatchIndex: -1,
    searchOptions: {
        matchCase: false,
        matchWholeCell: false,
        searchInColumn: null,
        useWildcards: true,
    },

    // Open in find mode
    openFind: () => {
        set({ isOpen: true, mode: "find" });
    },

    // Open in replace mode
    openReplace: () => {
        set({ isOpen: true, mode: "replace" });
    },

    // Close modal
    close: () => {
        set({ isOpen: false });
    },

    // Set search term
    setSearchTerm: (term: string) => {
        set({ searchTerm: term });
    },

    // Set replace term
    setReplaceTerm: (term: string) => {
        set({ replaceTerm: term });
    },

    // Set matches array
    setMatches: (matches: SearchMatch[]) => {
        set({
            matches,
            currentMatchIndex: matches.length > 0 ? 0 : -1,
        });
    },

    // Set current match index
    setCurrentMatchIndex: (index: number) => {
        const { matches } = get();
        if (index >= 0 && index < matches.length) {
            set({ currentMatchIndex: index });
        }
    },

    // Navigate to next match
    nextMatch: () => {
        const { matches, currentMatchIndex } = get();
        if (matches.length > 0) {
            const nextIndex = (currentMatchIndex + 1) % matches.length;
            set({ currentMatchIndex: nextIndex });
        }
    },

    // Navigate to previous match
    previousMatch: () => {
        const { matches, currentMatchIndex } = get();
        if (matches.length > 0) {
            const prevIndex = currentMatchIndex - 1 < 0 ? matches.length - 1 : currentMatchIndex - 1;
            set({ currentMatchIndex: prevIndex });
        }
    },

    // Update search options
    setSearchOptions: (options: Partial<SearchOptions>) => {
        set((state) => ({
            searchOptions: { ...state.searchOptions, ...options },
        }));
    },

    // Clear search state
    clearSearch: () => {
        set({
            searchTerm: "",
            replaceTerm: "",
            matches: [],
            currentMatchIndex: -1,
        });
    },
}));
