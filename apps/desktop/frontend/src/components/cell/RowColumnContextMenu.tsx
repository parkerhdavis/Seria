/**
 * Row/Column Context Menu Component
 *
 * Renders the right-click context menu for row and column handles
 * with options for inserting, duplicating, and deleting rows/columns.
 */

interface RowColumnContextMenuProps {
    /** Position of the context menu */
    position: { x: number; y: number };
    /** Whether this is a row or column context menu */
    type: "row" | "column";
    /** Callback dispatched when a menu action is selected */
    onAction: (action: string) => void;
}

/**
 * Row/column handle right-click context menu.
 * Rendered at an absolute position with actions for inserting,
 * duplicating, and deleting rows or columns.
 */
function RowColumnContextMenu({ position, type, onAction }: RowColumnContextMenuProps) {
    const isRow = type === "row";
    const label = isRow ? "Row" : "Column";

    return (
        <div
            className="fixed z-50 bg-base-100 border border-base-300 rounded-lg shadow-lg py-1 min-w-[200px]"
            style={{
                left: `${position.x}px`,
                top: `${position.y}px`,
            }}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
        >
            {/* Insert above/before */}
            <button
                className="w-full px-4 py-2 text-left hover:bg-base-200 text-sm flex items-center gap-2"
                onClick={() => onAction("insertBefore")}
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-base-content/60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                </svg>
                Insert {isRow ? "Row Above" : "Column Before"}
            </button>

            {/* Insert below/after */}
            <button
                className="w-full px-4 py-2 text-left hover:bg-base-200 text-sm flex items-center gap-2"
                onClick={() => onAction("insertAfter")}
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-base-content/60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
                Insert {isRow ? "Row Below" : "Column After"}
            </button>

            <div className="border-t border-base-300 my-1"></div>

            {/* Duplicate */}
            <button
                className="w-full px-4 py-2 text-left hover:bg-base-200 text-sm flex items-center gap-2"
                onClick={() => onAction("duplicate")}
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-base-content/60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Duplicate {label}
            </button>

            <div className="border-t border-base-300 my-1"></div>

            {/* Delete */}
            <button
                className="w-full px-4 py-2 text-left hover:bg-base-200 text-sm flex items-center gap-2 text-error"
                onClick={() => onAction("delete")}
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Delete {label}
            </button>
        </div>
    );
}

export default RowColumnContextMenu;
