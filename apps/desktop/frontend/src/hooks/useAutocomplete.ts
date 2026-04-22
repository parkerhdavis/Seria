/**
 * Autocomplete Hook
 *
 * Manages autocomplete suggestion state for cell editing.
 * Provides functions to update suggestions based on input,
 * handle keyboard navigation within the suggestion list,
 * and accept a selected suggestion.
 */

import { useState, useCallback } from "react";
import { getSuggestions } from "@utils/autocomplete";

interface UseAutocompleteParams {
    /** Whether autocomplete is enabled in settings */
    autocompleteEnabled: boolean;
    /** Minimum characters before showing suggestions */
    autocompleteMinChars: number;
    /** Column value cache (column index -> set of unique values) */
    columnCache: Map<number, Set<string>>;
}

interface UseAutocompleteReturn {
    /** Current suggestion list */
    autocompleteSuggestions: string[];
    /** Currently highlighted suggestion index */
    autocompleteSelectedIndex: number;
    /** Whether the autocomplete dropdown is visible */
    showAutocomplete: boolean;
    /** Update suggestions based on column and current input value */
    updateAutocompleteSuggestions: (col: number, value: string) => void;
    /** Close the autocomplete dropdown */
    closeAutocomplete: () => void;
    /** Navigate suggestions (arrow keys) */
    navigateAutocomplete: (direction: "up" | "down") => void;
    /** Get the currently selected suggestion value */
    getSelectedSuggestion: () => string | null;
    /**
     * Handle autocomplete keyboard events.
     * Returns true if the event was consumed by autocomplete.
     */
    handleAutocompleteKeyDown: (e: React.KeyboardEvent) => boolean;
    /** Accept a suggestion by value (used by dropdown click) */
    acceptSuggestion: (value: string) => string;
}

export function useAutocomplete({
    autocompleteEnabled,
    autocompleteMinChars,
    columnCache,
}: UseAutocompleteParams): UseAutocompleteReturn {
    const [autocompleteSuggestions, setAutocompleteSuggestions] = useState<string[]>([]);
    const [autocompleteSelectedIndex, setAutocompleteSelectedIndex] = useState(0);
    const [showAutocomplete, setShowAutocomplete] = useState(false);

    // Update suggestions based on current input
    const updateAutocompleteSuggestions = useCallback((col: number, value: string) => {
        if (!autocompleteEnabled) {
            setShowAutocomplete(false);
            return;
        }

        if (value.length < autocompleteMinChars) {
            setShowAutocomplete(false);
            return;
        }

        const columnValues = columnCache.get(col) || new Set<string>();
        const suggestions = getSuggestions(col, value, columnValues, [], 10);

        if (suggestions.length > 0) {
            setAutocompleteSuggestions(suggestions);
            setAutocompleteSelectedIndex(0);
            setShowAutocomplete(true);
        } else {
            setShowAutocomplete(false);
        }
    }, [autocompleteEnabled, autocompleteMinChars, columnCache]);

    const closeAutocomplete = useCallback(() => {
        setShowAutocomplete(false);
        setAutocompleteSuggestions([]);
    }, []);

    const navigateAutocomplete = useCallback((direction: "up" | "down") => {
        if (direction === "down") {
            setAutocompleteSelectedIndex((prev) =>
                prev < autocompleteSuggestions.length - 1 ? prev + 1 : prev
            );
        } else {
            setAutocompleteSelectedIndex((prev) => prev > 0 ? prev - 1 : prev);
        }
    }, [autocompleteSuggestions.length]);

    const getSelectedSuggestion = useCallback((): string | null => {
        if (!showAutocomplete || autocompleteSuggestions.length === 0) return null;
        return autocompleteSuggestions[autocompleteSelectedIndex] ?? null;
    }, [showAutocomplete, autocompleteSuggestions, autocompleteSelectedIndex]);

    /**
     * Handle keyboard events for autocomplete navigation.
     * Returns true if the event was handled (consumed) by autocomplete.
     */
    const handleAutocompleteKeyDown = useCallback((e: React.KeyboardEvent): boolean => {
        if (!showAutocomplete || autocompleteSuggestions.length === 0) return false;

        if (e.key === "ArrowDown") {
            e.preventDefault();
            setAutocompleteSelectedIndex((prev) =>
                prev < autocompleteSuggestions.length - 1 ? prev + 1 : prev
            );
            return true;
        }
        if (e.key === "ArrowUp") {
            e.preventDefault();
            setAutocompleteSelectedIndex((prev) => prev > 0 ? prev - 1 : prev);
            return true;
        }
        if (e.key === "Enter" || e.key === "Tab") {
            // Don't return true — caller should still commit the edit
            // but should use the selected value
            e.preventDefault();
            setShowAutocomplete(false);
            return false; // Let the caller handle the commit with getSelectedSuggestion
        }
        if (e.key === "Escape") {
            setShowAutocomplete(false);
            return true;
        }
        return false;
    }, [showAutocomplete, autocompleteSuggestions]);

    const acceptSuggestion = useCallback((value: string): string => {
        setShowAutocomplete(false);
        return value;
    }, []);

    return {
        autocompleteSuggestions,
        autocompleteSelectedIndex,
        showAutocomplete,
        updateAutocompleteSuggestions,
        closeAutocomplete,
        navigateAutocomplete,
        getSelectedSuggestion,
        handleAutocompleteKeyDown,
        acceptSuggestion,
    };
}
