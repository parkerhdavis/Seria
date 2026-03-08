/**
 * useColumnWidths Hook
 *
 * Manages column width calculations for proportional column sizing.
 * Handles container resize observation, pixel/proportion conversions,
 * and auto-fit column initialization.
 *
 * Extracted from CellGridVirtualized to isolate column width logic.
 */

import { useState, useCallback, useMemo, useEffect, RefObject } from "react";

/** Width reserved for each row number gutter column (left and right) */
const ROW_NUMBER_COLUMN_WIDTH = 64;

/**
 * Computes and tracks pixel widths for proportionally-sized columns.
 *
 * @param parentRef - Ref to the scrollable container element
 * @param columnWidths - Current proportional widths keyed by column index (0-1 range)
 * @param setColumnWidths - Setter for proportional column widths
 * @param headerCount - Number of columns
 * @param autoFitColumns - Whether columns should auto-fit to container width
 * @returns Column width helpers and computed pixel widths
 */
export function useColumnWidths(
    parentRef: RefObject<HTMLDivElement | null>,
    columnWidths: Record<number, number>,
    setColumnWidths: (widths: Record<number, number> | ((prev: Record<number, number>) => Record<number, number>)) => void,
    headerCount: number,
    autoFitColumns: boolean,
): {
    containerWidth: number;
    getAvailableWidth: () => number;
    getPixelWidth: (colIndex: number) => number;
    pixelWidths: number[];
    convertPixelsToProportions: (pixelWidthsMap: Record<number, number>) => Record<number, number>;
} {
    // Track container width changes to trigger re-renders for proportional column widths
    const [containerWidth, setContainerWidth] = useState(0);

    // ===== COLUMN WIDTH HELPERS =====
    // Memoized for performance - prevents recalculation during resize/render
    const getAvailableWidth = useCallback((): number => {
        if (!parentRef.current) return 800;
        // Use the tracked containerWidth state to ensure re-renders on resize
        const currentWidth = containerWidth || parentRef.current.clientWidth;
        const rowNumberWidth = ROW_NUMBER_COLUMN_WIDTH * 2; // Row number columns (left and right side)
        // In auto-fit mode, use overlay scrollbars so they don't take up layout space
        // Note: Drawer width is handled by the container width, not here
        const available = Math.max(currentWidth - rowNumberWidth, 200);
        return available;
    }, [containerWidth, parentRef]);

    const getPixelWidth = useCallback((colIndex: number): number => {
        const availableWidth = getAvailableWidth();
        const proportion = columnWidths[colIndex];

        if (proportion === undefined || proportion === 0) {
            const equalProportion = 1 / headerCount;
            return Math.floor(equalProportion * availableWidth);
        }

        return Math.floor(proportion * availableWidth);
    }, [getAvailableWidth, columnWidths, headerCount]);

    // Get pixel widths for all columns, ensuring they sum exactly to available width
    // Memoized to prevent recalculation on every render
    const pixelWidths = useMemo((): number[] => {
        const availableWidth = getAvailableWidth();
        const widths: number[] = [];
        let totalAllocated = 0;

        // Calculate widths for all columns except the last
        for (let i = 0; i < headerCount - 1; i++) {
            const width = getPixelWidth(i);
            widths.push(width);
            totalAllocated += width;
        }

        // Last column gets remaining space to fill exactly
        const remainingWidth = Math.max(100, availableWidth - totalAllocated);
        widths.push(remainingWidth);

        return widths;
    }, [getAvailableWidth, getPixelWidth, headerCount]);

    const convertPixelsToProportions = useCallback((pixelWidthsMap: Record<number, number>): Record<number, number> => {
        const totalWidth = Object.values(pixelWidthsMap).reduce((sum: number, w: number) => sum + w, 0);
        const proportions: Record<number, number> = {};
        Object.keys(pixelWidthsMap).forEach((key) => {
            const idx = parseInt(key);
            proportions[idx] = pixelWidthsMap[idx] / totalWidth;
        });
        return proportions;
    }, []);

    // ===== CONTAINER RESIZE OBSERVER =====
    // Watch for container size changes (e.g., drawer opening/closing) and update state to trigger re-renders
    useEffect(() => {
        if (!parentRef.current) return;

        const updateContainerWidth = () => {
            if (parentRef.current) {
                const newWidth = parentRef.current.clientWidth;
                setContainerWidth(newWidth);
            }
        };

        // Set initial width
        updateContainerWidth();

        // Watch for container resize (drawer open/close, window resize, etc.)
        const resizeObserver = new ResizeObserver(() => {
            updateContainerWidth();
        });
        resizeObserver.observe(parentRef.current);

        // Also listen to window resize for good measure
        window.addEventListener("resize", updateContainerWidth);

        return () => {
            resizeObserver.disconnect();
            window.removeEventListener("resize", updateContainerWidth);
        };
    }, [parentRef]); // Run only on mount - ResizeObserver and window resize handle updates

    // ===== AUTO-FIT COLUMNS INITIALIZATION =====
    // Auto-fit columns effect - set initial equal proportions if needed
    useEffect(() => {
        if (!autoFitColumns || headerCount === 0) return;

        // Check if we already have column proportions set (e.g., from loaded config)
        const hasExistingProportions = Object.keys(columnWidths).length === headerCount &&
            Object.values(columnWidths).every(p => p > 0);

        if (!hasExistingProportions) {
            // Initialize with equal proportions
            const newProportions: Record<number, number> = {};
            const equalProportion = 1 / headerCount;
            for (let i = 0; i < headerCount; i++) {
                newProportions[i] = equalProportion;
            }
            setColumnWidths(newProportions);
        }

        // No resize listeners needed! Proportions stay constant, pixels recalculate on render
    }, [autoFitColumns, headerCount, columnWidths, setColumnWidths]);

    return {
        containerWidth,
        getAvailableWidth,
        getPixelWidth,
        pixelWidths,
        convertPixelsToProportions,
    };
}
