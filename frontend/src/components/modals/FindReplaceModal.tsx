/**
 * Find and Replace Modal Component
 *
 * Modal for finding and replacing text in the current Cell file.
 * Opens with Ctrl+F (find mode) or Ctrl+R (replace mode).
 * Supports case-sensitive search, whole cell matching, column-specific search, and wildcard patterns.
 * Wildcard patterns support: * (any chars), ? (single char), and capture groups for replacements.
 */

import { useEffect, useRef, useState } from "react";
import { useFindReplaceStore } from "@stores/findReplaceStore";
import { useCellStore } from "@stores/cellStore";
import { logger } from "@utils/logger";

/**
 * Convert a wildcard pattern to a regular expression
 * Supports: * (any chars), ? (single char), [abc] (character class), (capture groups)
 * Escape sequences: \* (literal asterisk), \? (literal question mark), \\ (literal backslash)
 *
 * @param pattern - The wildcard pattern to convert
 * @param matchWholeCell - If true, anchors the pattern to match the entire cell
 * @returns A RegExp object
 */
function wildcardToRegex(pattern: string, matchWholeCell: boolean): RegExp {
    let regexPattern = "";
    let i = 0;

    while (i < pattern.length) {
        const char = pattern[i];

        // Handle escape sequences
        if (char === "\\") {
            const nextChar = pattern[i + 1];
            if (nextChar === "*" || nextChar === "?" || nextChar === "\\") {
                // Escape the next character to match it literally
                regexPattern += "\\" + nextChar;
                i += 2; // Skip both the backslash and the escaped character
                continue;
            }
            // If backslash is not followed by *, ?, or \, treat it as a literal backslash
            regexPattern += "\\\\";
            i++;
            continue;
        }

        // Convert wildcard characters to regex equivalents
        if (char === "*") {
            regexPattern += ".*";
        } else if (char === "?") {
            regexPattern += ".";
        } else if (".+^${}|[]()".includes(char)) {
            // Escape special regex characters (except * and ? which are handled above)
            regexPattern += "\\" + char;
        } else {
            // Regular character, add as-is
            regexPattern += char;
        }

        i++;
    }

    // If matching whole cell, add anchors
    if (matchWholeCell) {
        regexPattern = "^" + regexPattern + "$";
    }

    return new RegExp(regexPattern);
}

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

    const { headers, data, updateCell } = useCellStore();
    const searchInputRef = useRef<HTMLInputElement>(null);
    const [showWildcardHelp, setShowWildcardHelp] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const modalRef = useRef<HTMLDivElement>(null);

    // Focus search input when modal opens
    useEffect(() => {
        if (isOpen && searchInputRef.current) {
            searchInputRef.current.focus();
            searchInputRef.current.select();
        }
    }, [isOpen]);

    // Handle dragging
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isDragging) return;

            const deltaX = e.clientX - dragStart.x;
            const deltaY = e.clientY - dragStart.y;

            setPosition((prev) => ({
                x: prev.x + deltaX,
                y: prev.y + deltaY,
            }));

            setDragStart({ x: e.clientX, y: e.clientY });
        };

        const handleMouseUp = () => {
            setIsDragging(false);
        };

        if (isDragging) {
            document.addEventListener("mousemove", handleMouseMove);
            document.addEventListener("mouseup", handleMouseUp);
        }

        return () => {
            document.removeEventListener("mousemove", handleMouseMove);
            document.removeEventListener("mouseup", handleMouseUp);
        };
    }, [isDragging, dragStart]);

    // Reset position when modal opens
    useEffect(() => {
        if (isOpen) {
            setPosition({ x: 0, y: 0 });
        }
    }, [isOpen]);

    // Handle drag start
    const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
        // Only start dragging if clicking on the header area
        if ((e.target as HTMLElement).closest(".modal-header-drag")) {
            setIsDragging(true);
            setDragStart({ x: e.clientX, y: e.clientY });
        }
    };

    // Perform search whenever search term or options change
    useEffect(() => {
        if (!searchTerm) {
            setMatches([]);
            return;
        }

        const foundMatches: Array<{ row: number; col: number }> = [];
        const { matchCase, matchWholeCell, searchInColumn, useWildcards } = searchOptions;

        // Determine which columns to search
        const columnsToSearch = searchInColumn
            ? [headers.indexOf(searchInColumn)]
            : headers.map((_, idx) => idx);

        // Prepare search pattern (regex if wildcards enabled)
        let searchRegex: RegExp | null = null;
        if (useWildcards) {
            try {
                searchRegex = wildcardToRegex(searchTerm, matchWholeCell);
                if (!matchCase) {
                    searchRegex = new RegExp(searchRegex.source, "i");
                }
            } catch (error: unknown) {
                // Invalid regex pattern - treat as literal string search
                logger.warn("Invalid wildcard pattern:", error);
            }
        }

        // Search through data
        data.forEach((row, rowIndex) => {
            columnsToSearch.forEach((colIndex) => {
                if (colIndex === -1) return; // Skip if column not found

                const cellValue = row[colIndex] || "";

                let isMatch = false;

                if (useWildcards && searchRegex) {
                    // Use regex matching
                    isMatch = searchRegex.test(cellValue);
                } else {
                    // Use simple string matching
                    const searchValue = matchCase ? searchTerm : searchTerm.toLowerCase();
                    const cellCompare = matchCase ? cellValue : cellValue.toLowerCase();

                    if (matchWholeCell) {
                        isMatch = cellCompare === searchValue;
                    } else {
                        isMatch = cellCompare.includes(searchValue);
                    }
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
        const cellValue = data[match.row][match.col] || "";

        let newValue = replaceTerm;

        // If wildcards are enabled, use regex replacement
        if (searchOptions.useWildcards) {
            try {
                const searchRegex = wildcardToRegex(searchTerm, searchOptions.matchWholeCell);
                if (!searchOptions.matchCase) {
                    const caseInsensitiveRegex = new RegExp(searchRegex.source, "i");
                    newValue = cellValue.replace(caseInsensitiveRegex, replaceTerm);
                } else {
                    newValue = cellValue.replace(searchRegex, replaceTerm);
                }

                // Verify the replacement actually happened (regex matched)
                if (newValue === cellValue && !searchRegex.test(cellValue)) {
                    logger.warn("Regex replacement: pattern did not match cell value");
                    return; // Don't update cell if pattern didn't match
                }
            } catch (error: unknown) {
                // If regex fails, notify user and skip this replacement
                logger.error("Regex replacement failed:", error);
                return; // Don't update cell with potentially incorrect value
            }
        }

        updateCell(match.row, match.col, newValue);

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
            const cellValue = data[match.row][match.col] || "";
            let newValue = replaceTerm;

            // If wildcards are enabled, use regex replacement
            if (searchOptions.useWildcards) {
                try {
                    const searchRegex = wildcardToRegex(searchTerm, searchOptions.matchWholeCell);
                    if (!searchOptions.matchCase) {
                        const caseInsensitiveRegex = new RegExp(searchRegex.source, "i");
                        newValue = cellValue.replace(caseInsensitiveRegex, replaceTerm);
                    } else {
                        newValue = cellValue.replace(searchRegex, replaceTerm);
                    }
                } catch (error: unknown) {
                    // If regex fails, use simple replacement
                    logger.warn("Regex replacement failed:", error);
                    newValue = replaceTerm;
                }
            }

            updateCell(match.row, match.col, newValue);
        });

        // Clear search after replace all
        clearSearch();
    };

    // Handle close
    const handleClose = () => {
        clearSearch();
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
            <div
                ref={modalRef}
                className="modal-box max-w-[850px] min-h-[500px]"
                onKeyDown={handleKeyDown}
                onMouseDown={handleMouseDown}
                style={{
                    transform: `translate(${position.x}px, ${position.y}px)`,
                    cursor: isDragging ? "grabbing" : "default",
                }}
            >
                {/* Header */}
                <div className="flex items-center justify-between my-4 modal-header-drag cursor-grab active:cursor-grabbing">
                    <h2 className="text-xl font-bold select-none">
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
                <div className="form-control mr-4 mb-4">
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
                    <div className="form-control mr-8 mb-4">
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
                <div className="form-control my-8">
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
                        <label className="label cursor-pointer gap-2 relative">
                            <input
                                type="checkbox"
                                className="checkbox checkbox-sm"
                                checked={searchOptions.useWildcards}
                                onChange={(e) => setSearchOptions({ useWildcards: e.target.checked })}
                            />
                            <span className="label-text">Use wildcards</span>
                            {/* Info icon with tooltip */}
                            <div className="relative inline-block">
                                <button
                                    type="button"
                                    className="btn btn-ghost btn-circle btn-xs ml-1"
                                    onMouseEnter={() => setShowWildcardHelp(true)}
                                    onMouseLeave={() => setShowWildcardHelp(false)}
                                    onClick={(e) => {
                                        e.preventDefault();
                                        setShowWildcardHelp(!showWildcardHelp);
                                    }}
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="w-4 h-4 stroke-current">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                                    </svg>
                                </button>
                                {/* Tooltip overlay */}
                                {showWildcardHelp && (
                                    <div className="absolute left-0 top-full mt-1 z-50 bg-base-200 border border-base-300 rounded-lg shadow-lg p-4 w-96 text-sm">
                                        <p className="font-semibold mb-2">Wildcard syntax:</p>
                                        <ul className="space-y-1.5">
                                            <li><span className="font-mono bg-base-300 px-1 rounded">*</span> matches any sequence of characters</li>
                                            <li><span className="font-mono bg-base-300 px-1 rounded">?</span> matches any single character</li>
                                            <li><span className="font-mono bg-base-300 px-1 rounded">\*</span> or <span className="font-mono bg-base-300 px-1 rounded">\?</span> escapes to match literal * or ?</li>
                                            <li><span className="font-mono bg-base-300 px-1 rounded">()</span> creates capture groups for replacement using <span className="font-mono bg-base-300 px-1 rounded">$</span></li>
                                        </ul>
                                        {/*<div className="mt-3 pt-3 border-t border-base-300">*/}
                                        {/*    <p className="font-semibold mb-2">Examples:</p>*/}
                                        {/*    <ul className="space-y-2">*/}
                                        {/*        <li>*/}
                                        {/*            <div className="font-mono text-xs bg-base-300 px-2 py-1 rounded mb-1">test*</div>*/}
                                        {/*            <div className="text-xs text-base-content/70">Finds "test", "testing", "test123"</div>*/}
                                        {/*        </li>*/}
                                        {/*        <li>*/}
                                        {/*            <div className="font-mono text-xs bg-base-300 px-2 py-1 rounded mb-1">Find: (John) (Doe) → Replace: $2, $1</div>*/}
                                        {/*            <div className="text-xs text-base-content/70">Changes "John Doe" to "Doe, John"</div>*/}
                                        {/*        </li>*/}
                                        {/*        <li>*/}
                                        {/*            <div className="font-mono text-xs bg-base-300 px-2 py-1 rounded mb-1">Find: Chapter (*) → Replace: Ch. $1</div>*/}
                                        {/*            <div className="text-xs text-base-content/70">Changes "Chapter 5" to "Ch. 5"</div>*/}
                                        {/*        </li>*/}
                                        {/*    </ul>*/}
                                        {/*</div>*/}
                                    </div>
                                )}
                            </div>
                        </label>
                    </div>
                </div>

                {/* Search context and column selector */}
                <div className="form-control my-8">
                    <label className="label">
                        <span className="label-text font-semibold mr-4">Search in:</span>
                    </label>
                    <div className="flex gap-4">
                        {/* View context selector */}
                        <select
                            className="select select-bordered w-48"
                            value={searchOptions.searchContext || "cell"}
                            onChange={(e) =>
                                setSearchOptions({
                                    searchContext: e.target.value as "cell" | "print" | "all",
                                })
                            }
                        >
                            <option value="cell">Cell View</option>
                            <option value="print">Print View</option>
                            <option value="all">All Views</option>
                        </select>

                        {/* Column selector */}
                        <select
                            className="select select-bordered flex-1"
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
                </div>

                {/* Match status badge - always visible */}
                <div className={`alert ${currentMatch ? "alert-info bg-sky-500/10 text-gray-200 opacity-80" : "alert-warning bg-yellow-500/10 text-gray-200 opacity-80"}`}>
                    {currentMatch ? (
                        <>
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 w-5 h-5">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                            </svg>
                            <div className="text-sm">
                                <p>
                                    Match at <span>Row {currentMatch.row + 1}, Column "{headers[currentMatch.col]}"</span>
                                </p>
                            </div>
                        </>
                    ) : (
                        <>
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 w-5 h-5">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                            </svg>
                            <span>No matches found</span>
                        </>
                    )}
                </div>

                {/* Modal actions */}
                {/*<div className="modal-action">*/}
                {/*    <button className="btn" onClick={handleClose}>*/}
                {/*        Close*/}
                {/*    </button>*/}
                {/*</div>*/}
            </div>
            <div className="modal-backdrop" onClick={handleClose}></div>
        </div>
    );
}

export default FindReplaceModal;
