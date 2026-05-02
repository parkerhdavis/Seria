// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * useFilteredData Hook
 *
 * Filters tabular data based on column filter criteria.
 * Extracted from CellGridVirtualized to isolate data filtering logic.
 */

import { useMemo } from "react";
import { ColumnFilter } from "@/stores/cellFilterStore";

/**
 * Filters data rows based on active column filters.
 *
 * @param data - The raw 2D string array of cell data
 * @param headers - Column header names used to resolve filter column indices
 * @param columnFilters - Active column filters to apply
 * @returns The filtered data array (unchanged reference if no filters are active)
 */
export function useFilteredData(
    data: string[][],
    headers: string[],
    columnFilters: ColumnFilter[]
): string[][] {
    const filteredData = useMemo(() => {
        if (columnFilters.length === 0) return data;

        return data.filter((row) => {
            return columnFilters.every((filter) => {
                const colIndex = headers.indexOf(filter.column);
                if (colIndex === -1) return true;

                const cellValue = (row[colIndex] || "").toLowerCase();
                const filterValue = filter.value.toLowerCase();

                switch (filter.operation) {
                    case "contains":
                        return cellValue.includes(filterValue);
                    case "not-contains":
                        return !cellValue.includes(filterValue);
                    case "equals":
                        return cellValue === filterValue;
                    case "not-equals":
                        return cellValue !== filterValue;
                    default:
                        return true;
                }
            });
        });
    }, [data, headers, columnFilters]);

    return filteredData;
}
