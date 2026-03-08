/**
 * Fill Dialog Component
 *
 * Modal dialog for filling a selected range of cells with a single value.
 * Supports Enter to confirm, Escape to cancel, and a Fill button.
 */

interface FillDialogProps {
    /** The selected range to fill */
    selectedRange: {
        startRow: number;
        startCol: number;
        endRow: number;
        endCol: number;
    };
    /** Batch-update multiple cells (cellStore action) */
    updateCells: (updates: Array<{ row: number; col: number; value: string }>) => void;
    /** Trigger autosave after fill operation */
    triggerAutosave: () => void;
    /** Close the dialog */
    onClose: () => void;
}

/**
 * Builds the array of cell updates for a given range and fill value.
 */
function buildFillUpdates(
    selectedRange: FillDialogProps["selectedRange"],
    value: string,
): Array<{ row: number; col: number; value: string }> {
    const { startRow, startCol, endRow, endCol } = selectedRange;
    const minRow = Math.min(startRow, endRow);
    const maxRow = Math.max(startRow, endRow);
    const minCol = Math.min(startCol, endCol);
    const maxCol = Math.max(startCol, endCol);

    const cellUpdates: Array<{ row: number; col: number; value: string }> = [];
    for (let r = minRow; r <= maxRow; r++) {
        for (let c = minCol; c <= maxCol; c++) {
            cellUpdates.push({ row: r, col: c, value });
        }
    }
    return cellUpdates;
}

/**
 * Multi-cell fill dialog rendered as a modal overlay.
 */
function FillDialog({ selectedRange, updateCells, triggerAutosave, onClose }: FillDialogProps) {
    const handleFill = (value: string) => {
        const cellUpdates = buildFillUpdates(selectedRange, value);
        updateCells(cellUpdates);
        triggerAutosave();
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-base-100 rounded-lg shadow-xl p-6 w-96">
                <h3 className="text-lg font-bold mb-4">Fill Selected Cells</h3>
                <p className="text-sm text-base-content/70 mb-4">
                    Enter a value to fill all selected cells:
                </p>
                <input
                    type="text"
                    className="input input-bordered w-full mb-4"
                    placeholder="Enter value..."
                    autoFocus
                    onKeyDown={(e) => {
                        if (e.key === "Enter") {
                            handleFill((e.target as HTMLInputElement).value);
                        } else if (e.key === "Escape") {
                            onClose();
                        }
                    }}
                />
                <div className="flex gap-2 justify-end">
                    <button
                        className="btn btn-ghost"
                        onClick={onClose}
                    >
                        Cancel
                    </button>
                    <button
                        className="btn btn-primary"
                        onClick={(e) => {
                            const input = (e.target as HTMLElement)
                                .closest(".bg-base-100")
                                ?.querySelector("input") as HTMLInputElement;
                            if (input) {
                                handleFill(input.value);
                            } else {
                                onClose();
                            }
                        }}
                    >
                        Fill
                    </button>
                </div>
            </div>
        </div>
    );
}

export default FillDialog;
