/**
 * Summary Row Component
 *
 * Fixed bottom row in the cell grid that displays column summaries
 * (count, unique, mode, average, min, max, sum). Synchronizes
 * horizontal scroll position with the main grid container.
 */

import { useEffect, useRef, useMemo } from "react";
import { calculateSummary } from "@utils/summaryCalculations";

type SummaryType = "count" | "unique" | "mode" | "average" | "min" | "max" | "sum";

interface SummaryRowProps {
    /** Reference to the main grid scroll container for scroll sync */
    parentRef: React.RefObject<HTMLDivElement | null>;
    /** Column header names */
    headers: string[];
    /** Filtered data rows (2D array) */
    filteredData: string[][];
    /** Pixel widths for each column */
    pixelWidths: number[];
    /** Summary type per column (keyed by column name) */
    columnSummaries: Record<string, SummaryType>;
    /** Callback to change a column's summary type */
    setColumnSummary: (columnName: string, summaryType: SummaryType) => void;
    /** Currently hovered column index (for highlighting) */
    hoveredColumn: number | null;
    /** Whether column separators are visible */
    showColumnSeparators: boolean;
    /** Whether columns auto-fit to container width */
    autoFitColumns: boolean;
    /** Position of the drawer panel */
    drawerPosition: "right" | "bottom" | null;
    /** Size of the right drawer in pixels */
    rightDrawerSize: number;
}

/**
 * Fixed summary row pinned to the bottom of the cell grid.
 * Shows a selectable summary function (count, unique, etc.) and its
 * computed value for each column.
 */
function SummaryRow({
    parentRef,
    headers,
    filteredData,
    pixelWidths,
    columnSummaries,
    setColumnSummary,
    hoveredColumn,
    showColumnSeparators,
    autoFitColumns,
    drawerPosition,
    rightDrawerSize,
}: SummaryRowProps) {
    // Summary row scroll sync — direct DOM update via RAF, bypasses React state
    const summaryRowContentRef = useRef<HTMLDivElement>(null);

    // Memoize summary values to avoid recalculating on every render
    const memoizedSummaryValues = useMemo(() => {
        const summaries: Record<string, string> = {};
        headers.forEach((columnName, colIndex) => {
            const summaryType = columnSummaries[columnName] || "count";
            const columnData = filteredData.map((row) => row[colIndex] || "");
            summaries[columnName] = calculateSummary(columnData, summaryType);
        });
        return summaries;
    }, [headers, filteredData, columnSummaries]);

    // Sync summary row horizontal scroll with main grid scroll via direct DOM manipulation
    useEffect(() => {
        let frame: number | null = null;
        const handleScroll = () => {
            if (frame) return;
            frame = requestAnimationFrame(() => {
                if (parentRef.current && summaryRowContentRef.current) {
                    summaryRowContentRef.current.scrollLeft = parentRef.current.scrollLeft;
                }
                frame = null;
            });
        };

        const container = parentRef.current;
        if (container) {
            container.addEventListener("scroll", handleScroll, { passive: true });
            return () => {
                container.removeEventListener("scroll", handleScroll);
                if (frame) cancelAnimationFrame(frame);
            };
        }
    }, [parentRef]);

    return (
        <div
            className="fixed bg-base-300 border-t-2 border-base-300 shadow-lg z-40"
            style={{
                left: 0,
                right: drawerPosition === "right" ? `${rightDrawerSize}px` : 0,
                bottom: 0,
                height: "60px",
                overflow: "hidden"
            }}
        >
            {/* Row number column placeholder (left) - sticky */}
            <div className="absolute left-0 h-full bg-base-300 border-r-2 border-base-300 z-10" style={{ width: "64px" }}></div>

            {/* Row number column placeholder (right) - sticky */}
            <div className="absolute right-0 h-full bg-base-300 border-l-2 border-base-300 z-10" style={{ width: "64px" }}></div>

            <div
                ref={summaryRowContentRef}
                className="h-full summary-row-scroll"
                style={{
                    overflowX: autoFitColumns ? "hidden" : "scroll",
                    overflowY: "hidden",
                    scrollbarWidth: "none",
                    msOverflowStyle: "none",
                    paddingLeft: "64px",
                    paddingRight: "64px",
                }}
            >
                <div className="flex items-center h-full" style={{ width: `${pixelWidths.reduce((sum: number, w: number) => sum + w, 0)}px` }}>
                    {/* Summary dropdowns for each column */}
                    {headers.map((columnName, colIndex) => {
                        const summaryType = columnSummaries[columnName] || "count";
                        // Use memoized summary values instead of recalculating on every render
                        const summaryValue = memoizedSummaryValues[columnName] || "";
                        const columnWidth = pixelWidths[colIndex];

                        // Apply hover highlight to summary row as well
                        const summaryClass = `flex-shrink-0 h-full flex items-center border-r-2 ${hoveredColumn === colIndex ? "bg-base-200/70" : ""} ${showColumnSeparators ? "border-base-300" : "border-transparent"}`;

                        return (
                            <div
                                key={colIndex}
                                className={summaryClass}
                                style={{ width: `${columnWidth}px`, minWidth: `${columnWidth}px`, maxWidth: `${columnWidth}px` }}
                            >
                                <div className="flex flex-col-reverse gap-1 p-2">
                                    {/* Summary value (displayed above dropdown) */}
                                    <div className="text-sm font-semibold text-primary truncate min-h-[20px]" title={summaryValue}>
                                        {summaryValue || "\u00A0"}
                                    </div>

                                    {/* Summary type selector (opens upward) */}
                                    <div className="relative">
                                        <select
                                            className="select select-xs select-bordered w-full bg-base-100"
                                            value={summaryType}
                                            onChange={(e) => setColumnSummary(columnName, e.target.value as SummaryType)}
                                            style={{
                                                appearance: "none",
                                                backgroundImage: 'url("data:image/svg+xml,%3csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 20 20\'%3e%3cpath stroke=\'%236b7280\' stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'1.5\' d=\'M6 8l4-4 4 4\'/%3e%3c/svg%3e")',
                                                backgroundPosition: "right 0.5rem center",
                                                backgroundRepeat: "no-repeat",
                                                backgroundSize: "1.5em 1.5em",
                                                paddingRight: "2.5rem"
                                            }}
                                        >
                                            <option value="count">Count</option>
                                            <option value="unique">Unique</option>
                                            <option value="mode">Mode</option>
                                            <option value="average">Average</option>
                                            <option value="min">Min</option>
                                            <option value="max">Max</option>
                                            <option value="sum">Sum</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

export default SummaryRow;
