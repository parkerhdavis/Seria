/**
 * Group By Dropdown Component
 *
 * Toolbar dropdown that allows users to select a column to group rows by.
 * When a column is selected, visual divider rows are inserted before each
 * row where the grouped column's value changes, effectively splitting the
 * display into sections (e.g., scenes in a screenplay).
 *
 * Also includes a collapse-all / expand-all toggle button that appears
 * when a Group By column is active.
 */

import { useMemo } from "react";
import { useCellStore } from "@stores/cellStore";
import { useSettingsStore } from "@stores/settingsStore";

/**
 * GroupByDropdown - Renders a dropdown button in the toolbar for selecting
 * a column to group the grid display by, plus a collapse/expand all toggle.
 */
function GroupByDropdown() {
    const headers = useCellStore((state) => state.headers);
    const data = useCellStore((state) => state.data);
    const groupByColumn = useSettingsStore((state) => state.groupByColumn);
    const setGroupByColumn = useSettingsStore((state) => state.setGroupByColumn);
    const collapsedGroups = useSettingsStore((state) => state.collapsedGroups);
    const collapseAllGroups = useSettingsStore((state) => state.collapseAllGroups);
    const expandAllGroups = useSettingsStore((state) => state.expandAllGroups);

    const isActive = groupByColumn !== null;

    // Compute all unique non-empty group values for collapse-all
    const allGroupValues = useMemo(() => {
        if (!groupByColumn) return [];
        const colIndex = headers.indexOf(groupByColumn);
        if (colIndex === -1) return [];

        const seen = new Set<string>();
        const values: string[] = [];
        for (const row of data) {
            const val = row[colIndex] || "";
            if (val !== "" && !seen.has(val)) {
                seen.add(val);
                values.push(val);
            }
        }
        return values;
    }, [data, headers, groupByColumn]);

    const allCollapsed = isActive && allGroupValues.length > 0 && collapsedGroups.size >= allGroupValues.length;

    const handleToggleCollapseAll = () => {
        if (allCollapsed) {
            expandAllGroups();
        } else {
            collapseAllGroups(allGroupValues);
        }
    };

    return (
        <div className="flex items-center gap-1">
            {/* Group By dropdown */}
            <div className="dropdown dropdown-bottom">
                <button
                    tabIndex={0}
                    className={`btn btn-sm ${isActive ? "btn-primary" : "btn-ghost"}`}
                    title={isActive ? `Grouped by: ${groupByColumn}` : "Group rows by column value"}
                >
                    {/* Group By icon - layers/stack icon */}
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                        />
                    </svg>
                    <span className="text-xs">
                        {isActive ? groupByColumn : "Group By"}
                    </span>
                </button>
                <ul
                    tabIndex={0}
                    className="dropdown-content z-[100] menu p-2 shadow-xl bg-base-200 rounded-box w-56 max-h-80 overflow-y-auto"
                >
                    {/* Off option */}
                    <li>
                        <button
                            onClick={() => {
                                setGroupByColumn(null);
                                if (document.activeElement instanceof HTMLElement) {
                                    document.activeElement.blur();
                                }
                            }}
                            className={`${!isActive ? "active" : ""}`}
                        >
                            <span className="text-base-content/60">Off</span>
                        </button>
                    </li>
                    {headers.length > 0 && <li className="menu-title text-xs">Columns</li>}
                    {headers.map((header) => (
                        <li key={header}>
                            <button
                                onClick={() => {
                                    setGroupByColumn(header);
                                    if (document.activeElement instanceof HTMLElement) {
                                        document.activeElement.blur();
                                    }
                                }}
                                className={`${groupByColumn === header ? "active" : ""}`}
                            >
                                {header}
                            </button>
                        </li>
                    ))}
                </ul>
            </div>

            {/* Collapse all / Expand all toggle — only visible when Group By is active */}
            {isActive && allGroupValues.length > 0 && (
                <button
                    className={`btn btn-sm ${allCollapsed ? "btn-primary" : "btn-ghost"}`}
                    onClick={handleToggleCollapseAll}
                    title={allCollapsed ? "Expand all groups" : "Collapse all groups"}
                >
                    {allCollapsed ? (
                        /* Expand icon — bars-arrow-down */
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h18M3 8h18M3 12h18m-7 4l4 4m0 0l4-4m-4 4V12" />
                        </svg>
                    ) : (
                        /* Collapse icon — bars-arrow-up */
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h18M3 8h18M3 12h18m-7 8l4-4m0 0l4 4m-4-4v8" />
                        </svg>
                    )}
                </button>
            )}
        </div>
    );
}

export default GroupByDropdown;
