// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * useColumnResize Hook
 *
 * Manages interactive column resizing via mouse drag.
 * Supports zero-sum resizing (auto-fit mode) and shift+drag distributed resizing.
 *
 * Extracted from CellGridVirtualized to isolate resize interaction logic.
 */

import { useState, useEffect } from "react";

/**
 * Provides column resize state and handlers.
 *
 * @param headers - Column header names
 * @param columnWidths - Current proportional widths keyed by column index
 * @param setColumnWidths - Setter for proportional column widths
 * @param getPixelWidth - Function to convert a column index to its pixel width
 * @param convertPixelsToProportions - Converts pixel widths map to proportional widths
 * @param autoFitColumns - Whether columns auto-fit to container width
 * @returns Resize state and the handler to initiate a column resize
 */
export function useColumnResize(
    headers: string[],
    columnWidths: Record<number, number>,
    setColumnWidths: (widths: Record<number, number> | ((prev: Record<number, number>) => Record<number, number>)) => void,
    getPixelWidth: (colIndex: number) => number,
    convertPixelsToProportions: (pixelWidthsMap: Record<number, number>) => Record<number, number>,
    autoFitColumns: boolean,
): {
    resizingColumn: number | null;
    handleColumnResizeStart: (e: React.MouseEvent, colIndex: number) => void;
} {
    const [resizingColumn, setResizingColumn] = useState<number | null>(null);
    const [resizeStartX, setResizeStartX] = useState(0);
    const [resizeStartWidth, setResizeStartWidth] = useState(0);
    const [resizeNextStartWidth, setResizeNextStartWidth] = useState(0);
    const [resizeAllStartWidths, setResizeAllStartWidths] = useState<Record<number, number>>({});
    const [isShiftResize, setIsShiftResize] = useState(false);

    const handleColumnResizeStart = (e: React.MouseEvent, colIndex: number) => {
        e.preventDefault();
        e.stopPropagation();

        // Convert current proportion to pixel width for resize tracking
        const currentWidth = getPixelWidth(colIndex);
        setResizingColumn(colIndex);
        setResizeStartX(e.clientX);
        setResizeStartWidth(currentWidth);
        setIsShiftResize(e.shiftKey);

        // For zero-sum resizing, capture starting pixel widths (converted from proportions)
        if (autoFitColumns) {
            if (e.shiftKey) {
                // Distributed resize: capture all column pixel widths
                const allWidths: Record<number, number> = {};
                for (let i = 0; i < headers.length; i++) {
                    allWidths[i] = getPixelWidth(i);
                }
                setResizeAllStartWidths(allWidths);
            } else if (colIndex + 1 < headers.length) {
                // Normal zero-sum: capture next column's starting pixel width
                const nextWidth = getPixelWidth(colIndex + 1);
                setResizeNextStartWidth(nextWidth);
            }
        }
    };

    // Handle mouse move during resize
    useEffect(() => {
        if (resizingColumn === null) return;

        // Prevent text selection while resizing
        document.body.style.userSelect = "none";
        document.body.style.cursor = "col-resize";

        const handleMouseMove = (e: MouseEvent) => {
            const deltaX = e.clientX - resizeStartX;

            if (autoFitColumns) {
                if (isShiftResize) {
                    // Distributed resize: distribute delta across all other columns
                    const otherColumnCount = headers.length - 1;

                    if (otherColumnCount > 0) {
                        const deltaPerColumn = -deltaX / otherColumnCount;
                        const minWidth = 100;

                        // Calculate new pixel widths for all columns
                        const newPixelWidths: Record<number, number> = {};
                        let totalAdjustment = 0;

                        // First pass: calculate new widths and track violations
                        for (let i = 0; i < headers.length; i++) {
                            if (i === resizingColumn) {
                                newPixelWidths[i] = resizeStartWidth + deltaX;
                            } else {
                                const startWidth = resizeAllStartWidths[i];
                                newPixelWidths[i] = startWidth + deltaPerColumn;
                            }

                            // Enforce minimum width
                            if (newPixelWidths[i] < minWidth) {
                                totalAdjustment += minWidth - newPixelWidths[i];
                                newPixelWidths[i] = minWidth;
                            }
                        }

                        // Second pass: distribute the adjustment if needed
                        if (totalAdjustment > 0) {
                            newPixelWidths[resizingColumn] = Math.max(minWidth, newPixelWidths[resizingColumn] - totalAdjustment);
                        }

                        // Convert pixel widths to proportions
                        const newProportions = convertPixelsToProportions(newPixelWidths);
                        setColumnWidths(newProportions);
                    } else {
                        // Only one column - just resize normally
                        const newWidth = Math.max(100, resizeStartWidth + deltaX);
                        const currentPixelWidths: Record<number, number> = {};
                        headers.forEach((_, i) => {
                            currentPixelWidths[i] = i === resizingColumn ? newWidth : getPixelWidth(i);
                        });
                        setColumnWidths(convertPixelsToProportions(currentPixelWidths));
                    }
                } else {
                    // Zero-sum resizing: making one column larger makes the next one smaller
                    const nextColumnIndex = resizingColumn + 1;

                    if (nextColumnIndex < headers.length) {
                        // Calculate new pixel widths
                        let newCurrentWidth = resizeStartWidth + deltaX;
                        let newNextWidth = resizeNextStartWidth - deltaX;

                        // Enforce minimum widths
                        const minWidth = 100;
                        if (newCurrentWidth < minWidth) {
                            const diff = minWidth - newCurrentWidth;
                            newCurrentWidth = minWidth;
                            newNextWidth -= diff;
                        }
                        if (newNextWidth < minWidth) {
                            const diff = minWidth - newNextWidth;
                            newNextWidth = minWidth;
                            newCurrentWidth -= diff;
                        }

                        // Build full pixel widths object
                        const currentPixelWidths: Record<number, number> = {};
                        headers.forEach((_, i) => {
                            if (i === resizingColumn) {
                                currentPixelWidths[i] = newCurrentWidth;
                            } else if (i === nextColumnIndex) {
                                currentPixelWidths[i] = newNextWidth;
                            } else {
                                currentPixelWidths[i] = getPixelWidth(i);
                            }
                        });
                        setColumnWidths(convertPixelsToProportions(currentPixelWidths));
                    } else {
                        // Last column - just resize normally
                        const newWidth = Math.max(100, resizeStartWidth + deltaX);
                        const currentPixelWidths: Record<number, number> = {};
                        headers.forEach((_, i) => {
                            currentPixelWidths[i] = i === resizingColumn ? newWidth : getPixelWidth(i);
                        });
                        setColumnWidths(convertPixelsToProportions(currentPixelWidths));
                    }
                }
            } else {
                // Normal resizing (non-zero-sum)
                const newWidth = Math.max(100, resizeStartWidth + deltaX);
                const currentPixelWidths: Record<number, number> = {};
                headers.forEach((_, i) => {
                    currentPixelWidths[i] = i === resizingColumn ? newWidth : getPixelWidth(i);
                });
                setColumnWidths(convertPixelsToProportions(currentPixelWidths));
            }
        };

        const handleMouseUp = () => {
            setResizingColumn(null);
            document.body.style.userSelect = "";
            document.body.style.cursor = "";
        };

        document.addEventListener("mousemove", handleMouseMove);
        document.addEventListener("mouseup", handleMouseUp);

        return () => {
            document.removeEventListener("mousemove", handleMouseMove);
            document.removeEventListener("mouseup", handleMouseUp);
            document.body.style.userSelect = "";
            document.body.style.cursor = "";
        };
    }, [resizingColumn, resizeStartX, resizeStartWidth, resizeNextStartWidth, resizeAllStartWidths, isShiftResize, autoFitColumns, headers.length, headers, columnWidths, setColumnWidths, getPixelWidth, convertPixelsToProportions]);

    return {
        resizingColumn,
        handleColumnResizeStart,
    };
}
