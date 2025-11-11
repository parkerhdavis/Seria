/**
 * Find and Replace Modal Component
 *
 * Modal for finding and replacing text in the current CSV file.
 * Opens with Ctrl+F (find mode) or Ctrl+R (replace mode).
 * Supports case-sensitive search, whole cell matching, and column-specific search.
 */

import { useEffect, useRef } from "react";
import { useFindReplaceStore } from "@stores/findReplaceStore";
import { useCSVStore } from "@stores/csvStore";

/**
 * FindReplaceModal - Modal for find and replace functionality
 */
function FindReplaceModal() {
    const {
        isOpen,
        mode,
        searchTerm,
        replaceTerm,
        matches,
        currentMatchIndex,
        searchOptions,
        close,
        setSearchTerm,
        setReplaceTerm,
        setMatches,
        nextMatch,
        previousMatch,
        setSearchOptions,
        clearSearch,
    } = useFindReplaceStore();

    const { headers, data, updateCell } = useCSVStore();
    const searchInputRef = useRef<HTMLInputElement>(null);

    // Focus search input when modal opens
    useEffect(() => {
        if (isOpen && searchInputRef.current) {
            searchInputRef.current.focus();
            searchInputRef.current.select();
        }
    }, [isOpen]);

    // Perform search whenever search term or options change
    useEffect(() => {
        if (!searchTerm) {
            setMatches([]);
            return;
        }

        const foundMatches: Array<{ row: number; col: number }> = [];
        const { matchCase, matchWholeCell, searchInColumn } = searchOptions;

        // Determine which columns to search
        const columnsToSearch = searchInColumn
            ? [headers.indexOf(searchInColumn)]
            : headers.map((_, idx) => idx);

        // Search through data
        data.forEach((row, rowIndex) => {
            columnsToSearch.forEach((colIndex) => {
                if (colIndex === -1) return; // Skip if column not found

                const cellValue = row[colIndex] || "";
                const searchValue = matchCase ? searchTerm : searchTerm.toLowerCase();
                const cellCompare = matchCase ? cellValue : cellValue.toLowerCase();

                let isMatch = false;
                if (matchWholeCell) {
                    isMatch = cellCompare === searchValue;
                } else {
                    isMatch = cellCompare.includes(searchValue);
                }

                if (isMatch) {
                    foundMatches.push({ row: rowIndex, col: colIndex });
                }
            });
        });

        setMatches(foundMatches);
    }, [searchTerm, searchOptions, data, headers, setMatches]);

    // Handle replace current match
    const handleReplace = () => {
        if (currentMatchIndex === -1 || matches.length === 0) return;

        const match = matches[currentMatchIndex];
        updateCell(match.row, match.col, replaceTerm);

        // Move to next match after replacing
        if (matches.length > 1) {
            nextMatch();
        }
    };

    // Handle replace all matches
    const handleReplaceAll = () => {
        if (matches.length === 0) return;

        // Replace all matches
        matches.forEach((match) => {
            updateCell(match.row, match.col, replaceTerm);
        });

        // Clear search after replace all
        clearSearch();
    };

    // Handle close
    const handleClose = () => {
        close();
    };

    // Handle keyboard shortcuts within modal
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Escape") {
            handleClose();
        } else if (e.key === "Enter") {
            if (e.shiftKey) {
                previousMatch();
            } else {
                nextMatch();
            }
            e.preventDefault();
        }
    };

    if (!isOpen) {
        return null;
    }

    const currentMatch = currentMatchIndex >= 0 && matches.length > 0 ? matches[currentMatchIndex] : null;

    return (
        <div className="modal modal-open">
            <div className="modal-box max-w-2xl" onKeyDown={handleKeyDown}>
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold">
                        {mode === "find" ? "Find" : "Find and Replace"}
                    </h2>
                    <button
                        className="btn btn-sm btn-ghost btn-circle"
                        onClick={handleClose}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Search input */}
                <div className="form-control mb-4">
                    <label className="label">
                        <span className="label-text font-semibold">Find</span>
                        {matches.length > 0 && (
                            <span className="label-text-alt font-mono">
                                {currentMatchIndex + 1} of {matches.length}
                            </span>
                        )}
                    </label>
                    <div className="flex gap-2">
                        <input
                            ref={searchInputRef}
                            type="text"
                            className="input input-bordered flex-1"
                            placeholder="Search..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        <button
                            className="btn btn-ghost"
                            onClick={previousMatch}
                            disabled={matches.length === 0}
                            title="Previous (Shift+Enter)"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                        </button>
                        <button
                            className="btn btn-ghost"
                            onClick={nextMatch}
                            disabled={matches.length === 0}
                            title="Next (Enter)"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Replace input (only in replace mode) */}
                {mode === "replace" && (
                    <div className="form-control mb-4">
                        <label className="label">
                            <span className="label-text font-semibold">Replace with</span>
                        </label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                className="input input-bordered flex-1"
                                placeholder="Replace with..."
                                value={replaceTerm}
                                onChange={(e) => setReplaceTerm(e.target.value)}
                            />
                            <button
                                className="btn btn-primary"
                                onClick={handleReplace}
                                disabled={matches.length === 0}
                            >
                                Replace
                            </button>
                            <button
                                className="btn btn-primary"
                                onClick={handleReplaceAll}
                                disabled={matches.length === 0}
                            >
                                Replace All
                            </button>
                        </div>
                    </div>
                )}

                {/* Search options */}
                <div className="form-control mb-4">
                    <label className="label">
                        <span className="label-text font-semibold">Search Options</span>
                    </label>
                    <div className="flex flex-wrap gap-4">
                        <label className="label cursor-pointer gap-2">
                            <input
                                type="checkbox"
                                className="checkbox checkbox-sm"
                                checked={searchOptions.matchCase}
                                onChange={(e) => setSearchOptions({ matchCase: e.target.checked })}
                            />
                            <span className="label-text">Match case</span>
                        </label>
                        <label className="label cursor-pointer gap-2">
                            <input
                                type="checkbox"
                                className="checkbox checkbox-sm"
                                checked={searchOptions.matchWholeCell}
                                onChange={(e) => setSearchOptions({ matchWholeCell: e.target.checked })}
                            />
                            <span className="label-text">Match whole cell</span>
                        </label>
                    </div>
                </div>

                {/* Column selector */}
                <div className="form-control mb-4">
                    <label className="label">
                        <span className="label-text font-semibold">Search in</span>
                    </label>
                    <select
                        className="select select-bordered"
                        value={searchOptions.searchInColumn || ""}
                        onChange={(e) =>
                            setSearchOptions({
                                searchInColumn: e.target.value || null,
                            })
                        }
                    >
                        <option value="">All columns</option>
                        {headers.map((header) => (
                            <option key={header} value={header}>
                                {header}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Current match info */}
                {currentMatch && (
                    <div className="alert alert-info">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 w-5 h-5">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                        </svg>
                        <div className="text-sm">
                            <p>
                                Match at <span className="font-mono">Row {currentMatch.row + 1}, Column "{headers[currentMatch.col]}"</span>
                            </p>
                        </div>
                    </div>
                )}

                {/* No matches message */}
                {searchTerm && matches.length === 0 && (
                    <div className="alert alert-warning">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 w-5 h-5">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                        </svg>
                        <span>No matches found</span>
                    </div>
                )}

                {/* Modal actions */}
                <div className="modal-action">
                    <button className="btn" onClick={handleClose}>
                        Close
                    </button>
                </div>
            </div>
            <div className="modal-backdrop" onClick={handleClose}></div>
        </div>
    );
}

export default FindReplaceModal;
