/**
 * Context Menu Component
 *
 * Renders the right-click context menu for the cell grid with options
 * for editing, clipboard operations, fill, and clearing cells.
 */

interface ContextMenuProps {
    /** Position and target cell of the context menu */
    position: { x: number; y: number };
    /** Whether a multi-cell range is selected */
    isMultiCell: boolean;
    /** Callback dispatched when a menu action is selected */
    onAction: (action: string) => void;
}

/**
 * Cell grid right-click context menu.
 * Rendered at an absolute position with actions for edit, copy, cut, paste,
 * fill (multi-cell), and clear.
 */
function ContextMenu({ position, isMultiCell, onAction }: ContextMenuProps) {
    return (
        <div
            className="fixed z-50 bg-base-100 border border-base-300 rounded-lg shadow-lg py-1 min-w-[180px]"
            style={{
                left: `${position.x}px`,
                top: `${position.y}px`,
            }}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
        >
            {/* Single cell: Edit option */}
            {!isMultiCell && (
                <>
                    <button
                        className="w-full px-4 py-2 text-left hover:bg-base-200 text-sm flex items-center gap-2"
                        onClick={() => onAction("edit")}
                    >
                        <span className="w-4">✏️</span>
                        Edit Cell
                    </button>
                    <div className="border-t border-base-300 my-1"></div>
                </>
            )}

            {/* Multi-cell: Fill option at top */}
            {isMultiCell && (
                <>
                    <button
                        className="w-full px-4 py-2 text-left hover:bg-base-200 text-sm flex items-center gap-2"
                        onClick={() => onAction("fill")}
                    >
                        <span className="w-4">🔄</span>
                        Fill Selected Cells...
                    </button>
                    <div className="border-t border-base-300 my-1"></div>
                </>
            )}

            {/* Common: Clipboard operations */}
            <button
                className="w-full px-4 py-2 text-left hover:bg-base-200 text-sm flex items-center gap-2"
                onClick={() => onAction("copy")}
            >
                <span className="w-4">📋</span>
                Copy
                <span className="ml-auto text-xs text-base-content/50">Ctrl+C</span>
            </button>
            <button
                className="w-full px-4 py-2 text-left hover:bg-base-200 text-sm flex items-center gap-2"
                onClick={() => onAction("cut")}
            >
                <span className="w-4">✂️</span>
                Cut
                <span className="ml-auto text-xs text-base-content/50">Ctrl+X</span>
            </button>
            <button
                className="w-full px-4 py-2 text-left hover:bg-base-200 text-sm flex items-center gap-2"
                onClick={() => onAction("paste")}
            >
                <span className="w-4">📄</span>
                Paste
                <span className="ml-auto text-xs text-base-content/50">Ctrl+V</span>
            </button>

            <div className="border-t border-base-300 my-1"></div>

            {/* Common: Clear */}
            <button
                className="w-full px-4 py-2 text-left hover:bg-base-200 text-sm flex items-center gap-2"
                onClick={() => onAction("clear")}
            >
                <span className="w-4">🗑️</span>
                {isMultiCell ? "Clear Selected Cells" : "Clear"}
                <span className="ml-auto text-xs text-base-content/50">Del</span>
            </button>
        </div>
    );
}

export default ContextMenu;
