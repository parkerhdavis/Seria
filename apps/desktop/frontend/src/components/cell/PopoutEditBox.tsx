// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Popout Edit Box Component
 *
 * A floating textarea rendered via portal for multi-line cell editing
 * when wrap text is disabled. Positioned absolutely over the cell being
 * edited, with auto-growing height.
 */

import { createPortal } from "react-dom";

interface PopoutEditBoxProps {
    /** Position of the popout box */
    position: { top: number; left: number; width: number };
    /** Current editing value */
    editingValue: string;
    /** Currently editing cell (row, col) */
    editingCell: { row: number; col: number };
    /** Update the editing value */
    updateEditingValue: (value: string) => void;
    /** Ref callback for the textarea element */
    inputRefCallback: (el: HTMLTextAreaElement | null) => void;
    /** Key down handler */
    onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>, row: number, col: number) => void;
    /** Called when input value changes (for autocomplete) */
    onInputChange?: (col: number, value: string) => void;
}

/**
 * Floating multi-line edit textarea portaled to document.body.
 */
function PopoutEditBox({
    position,
    editingValue,
    editingCell,
    updateEditingValue,
    inputRefCallback,
    onKeyDown,
    onInputChange,
}: PopoutEditBoxProps) {
    return createPortal(
        <div
            className="fixed z-[9999] bg-base-100 shadow-2xl border-2 border-primary/50 rounded-lg"
            style={{
                top: `${position.top}px`,
                left: `${position.left}px`,
                width: `${position.width}px`,
                minWidth: "200px",
                maxWidth: "600px",
            }}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => {
                e.stopPropagation();
                e.nativeEvent.stopImmediatePropagation();
            }}
        >
            <textarea
                ref={inputRefCallback}
                className="w-full focus:outline-none border-none bg-transparent px-3 py-2 min-h-[40px] text-sm leading-tight resize-none overflow-hidden rounded-lg"
                style={{ userSelect: "text", WebkitUserSelect: "text" }}
                value={editingValue}
                onChange={(e) => {
                    updateEditingValue(e.target.value);
                    if (onInputChange) {
                        onInputChange(editingCell.col, e.target.value);
                    }
                    e.target.style.height = "auto";
                    e.target.style.height = `${e.target.scrollHeight}px`;
                }}
                onKeyDown={(e) => {
                    onKeyDown(e, editingCell.row, editingCell.col);
                }}
                onInput={(e) => {
                    const target = e.target as HTMLTextAreaElement;
                    target.style.height = "auto";
                    target.style.height = `${target.scrollHeight}px`;
                }}
                onFocus={(e) => {
                    // Position cursor at end when focused
                    const length = e.target.value.length;
                    e.target.setSelectionRange(length, length);
                    // Auto-size to fit content
                    e.target.style.height = "auto";
                    e.target.style.height = `${e.target.scrollHeight}px`;
                }}
                autoFocus
            />
        </div>,
        document.body
    );
}

export default PopoutEditBox;
