// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Autocomplete Utility
 *
 * Provides smart autocomplete suggestions for cell editing based on
 * existing values in the column.
 */

/**
 * Calculate string similarity score for fuzzy matching
 * Uses a simple character-based approach for performance
 */
function calculateSimilarity(search: string, target: string): number {
    const searchLower = search.toLowerCase();
    const targetLower = target.toLowerCase();

    // Exact match
    if (searchLower === targetLower) return 1000;

    // Starts with (high priority)
    if (targetLower.startsWith(searchLower)) return 100;

    // Contains (medium priority)
    if (targetLower.includes(searchLower)) return 50;

    // Fuzzy character match (lower priority)
    let score = 0;
    let searchIndex = 0;

    for (let i = 0; i < targetLower.length && searchIndex < searchLower.length; i++) {
        if (targetLower[i] === searchLower[searchIndex]) {
            score += 1;
            searchIndex++;
        }
    }

    // Only return non-zero if all search characters were found in order
    return searchIndex === searchLower.length ? score : 0;
}

/**
 * Get autocomplete suggestions for a given input value
 *
 * @param columnIndex - Index of the column being edited
 * @param inputValue - Current value being typed
 * @param columnValues - Set of unique values for this column
 * @param recentValues - Recently used values (optional, for prioritization)
 * @param maxSuggestions - Maximum number of suggestions to return
 * @returns Sorted array of suggestions (best matches first)
 */
export function getSuggestions(
    columnIndex: number,
    inputValue: string,
    columnValues: Set<string>,
    recentValues: string[] = [],
    maxSuggestions: number = 10
): string[] {
    // Empty input - return recent values or all values
    if (!inputValue || inputValue.trim() === "") {
        // Show recent values first, then others
        const recentSet = new Set(recentValues);
        const others = Array.from(columnValues).filter(v => !recentSet.has(v) && v !== "");
        return [...recentValues, ...others].slice(0, maxSuggestions);
    }

    // Calculate similarity scores for all values
    const scoredValues: Array<{ value: string; score: number; isRecent: boolean }> = [];

    for (const value of Array.from(columnValues)) {
        // Skip empty values
        if (value === "") continue;

        // Skip exact match (no need to suggest what's already typed)
        if (value === inputValue) continue;

        const score = calculateSimilarity(inputValue, value);

        if (score > 0) {
            scoredValues.push({
                value,
                score,
                isRecent: recentValues.includes(value),
            });
        }
    }

    // Sort by score (descending), then by recent usage, then alphabetically
    scoredValues.sort((a, b) => {
        // First by score
        if (b.score !== a.score) return b.score - a.score;

        // Then by recent usage
        if (a.isRecent !== b.isRecent) return a.isRecent ? -1 : 1;

        // Finally alphabetically
        return a.value.localeCompare(b.value);
    });

    // Return top N suggestions
    return scoredValues.slice(0, maxSuggestions).map(s => s.value);
}

/**
 * Build column value cache from data
 *
 * @param data - The cell data
 * @param headers - Column headers
 * @param maxValuesPerColumn - Maximum unique values to cache per column
 * @returns Map of column index to unique values
 */
export function buildColumnCache(
    data: string[][],
    headers: string[],
    maxValuesPerColumn: number = 1000
): Map<number, Set<string>> {
    const cache = new Map<number, Set<string>>();

    // Initialize sets for each column
    for (let col = 0; col < headers.length; col++) {
        cache.set(col, new Set<string>());
    }

    // Populate cache from data
    for (const row of data) {
        for (let col = 0; col < row.length && col < headers.length; col++) {
            const value = row[col];
            const columnSet = cache.get(col);

            if (columnSet && columnSet.size < maxValuesPerColumn) {
                columnSet.add(value);
            }
        }
    }

    return cache;
}

/**
 * Update column cache for a specific cell change
 *
 * @param cache - Existing column cache
 * @param columnIndex - Column that was modified
 * @param newValue - New value to add to cache
 * @param maxValuesPerColumn - Maximum unique values to cache per column
 */
export function updateColumnCache(
    cache: Map<number, Set<string>>,
    columnIndex: number,
    newValue: string,
    maxValuesPerColumn: number = 1000
): void {
    const columnSet = cache.get(columnIndex);

    if (columnSet && columnSet.size < maxValuesPerColumn) {
        columnSet.add(newValue);
    }
}
