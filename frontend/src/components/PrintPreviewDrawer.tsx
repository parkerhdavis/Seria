/**
 * Print Preview Drawer Component
 *
 * Drawer that displays print preview of the current CSV data.
 * Can be positioned on the right (Ctrl+\) or bottom (Ctrl+/).
 * Opening one position automatically closes the other.
 * Supports resizing via draggable edge.
 */

import { useState, useRef, useEffect } from "react";
import { useCSVStore } from "@stores/csvStore";
import { useDrag } from "@/contexts/DragContext";

interface PrintPreviewDrawerProps {
    isOpen: boolean;
    position: "right" | "bottom";
    onClose: () => void;
}

/**
 * PrintPreviewDrawer - Flexible drawer for print preview
 */
function PrintPreviewDrawer({ isOpen, position, onClose }: PrintPreviewDrawerProps) {
    const { headers, data, fileInfo } = useCSVStore();
    const [size, setSize] = useState(position === "right" ? 384 : 320);
    const [isResizing, setIsResizing] = useState(false);
    const drawerRef = useRef<HTMLDivElement>(null);
    const { startDrag, endDrag } = useDrag();

    // Handle resize
    useEffect(() => {
        if (!isResizing) return;

        const handleMouseMove = (e: MouseEvent) => {
            if (position === "right") {
                const newWidth = window.innerWidth - e.clientX;
                setSize(Math.max(200, Math.min(newWidth, window.innerWidth * 0.8)));
            } else {
                const newHeight = window.innerHeight - e.clientY;
                setSize(Math.max(150, Math.min(newHeight, window.innerHeight * 0.8)));
            }
        };

        const handleMouseUp = () => {
            setIsResizing(false);
            endDrag();
        };

        document.addEventListener("mousemove", handleMouseMove);
        document.addEventListener("mouseup", handleMouseUp);

        return () => {
            document.removeEventListener("mousemove", handleMouseMove);
            document.removeEventListener("mouseup", handleMouseUp);
        };
    }, [isResizing, position, endDrag]);

    if (!isOpen) {
        return null;
    }

    const positionStyles = position === "right"
        ? { top: 0, right: 0, height: "100vh", width: `${size}px` }
        : { bottom: 0, left: 0, right: 0, height: `${size}px` };

    const resizeHandleClasses = position === "right"
        ? "absolute left-0 top-0 bottom-0 w-1 cursor-ew-resize hover:bg-primary/50 select-none"
        : "absolute left-0 right-0 top-0 h-1 cursor-ns-resize hover:bg-primary/50 select-none";

    return (
        <div
            ref={drawerRef}
            className={`fixed bg-base-200 shadow-xl border-base-300 z-50 flex ${position === "right" ? "flex-col border-l" : "flex-row border-t"}`}
            style={positionStyles}
        >
            {/* Resize handle */}
            <div
                className={resizeHandleClasses}
                onMouseDown={() => {
                    startDrag(`drawer-resize-${position}`);
                    setIsResizing(true);
                }}
            />
            {/* Header */}
            <div className={`flex items-center justify-between p-4 ${position === "right" ? "border-b" : "border-r"} border-base-300 ${position === "bottom" ? "min-w-[200px]" : ""}`}>
                <h2 className="text-lg font-bold">Print Preview</h2>
                <button
                    className="btn btn-sm btn-ghost btn-circle"
                    onClick={onClose}
                    title={`Close Print Preview (Ctrl+${position === "right" ? "\\" : "/"})`}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto p-4">
                {!fileInfo ? (
                    <div className="flex flex-col items-center justify-center h-full text-base-content/50">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                        <p className="text-center">
                            Open a CSV file in the Editor to preview it here
                        </p>
                    </div>
                ) : (
                    <div>
                        {/* File info */}
                        <div className="mb-6">
                            <h3 className="text-sm font-semibold text-base-content/70 mb-2">File Information</h3>
                            <div className="bg-base-100 p-3 rounded-lg space-y-1 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-base-content/70">Rows:</span>
                                    <span className="font-mono">{data.length}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-base-content/70">Columns:</span>
                                    <span className="font-mono">{headers.length}</span>
                                </div>
                            </div>
                        </div>

                        {/* Preview format selector (placeholder) */}
                        <div className="mb-6">
                            <h3 className="text-sm font-semibold text-base-content/70 mb-2">Preview Format</h3>
                            <select className="select select-bordered select-sm w-full">
                                {/*SCENE FORMAT presents the rows as scene cards for plotting/outlining*/}
                                <option>Scene Format</option>
                                {/*SCREENPLAY FORMAT presents the rows in tabbed screenplay format*/}
                                <option disabled>Screenplay (Coming Soon)</option>
                                {/*TBD*/}
                                <option disabled>Dialogue (Coming Soon)</option>
                                {/*TBD*/}
                                <option disabled>Game Design (Coming Soon)</option>
                            </select>
                        </div>

                        {/* Preview content (simplified for now) */}
                        <div className="mb-6">
                            <h3 className="text-sm font-semibold text-base-content/70 mb-2">Preview</h3>
                            <div className={`bg-base-100 p-4 rounded-lg overflow-auto ${position === "right" ? "max-h-96" : "max-h-48"}`}>
                                <div className={`text-sm ${position === "right" ? "space-y-4" : "flex gap-6 overflow-x-auto"}`}>
                                    {data.slice(0, 10).map((row, index) => (
                                        <div key={index} className={`${position === "right" ? "border-b border-base-300 pb-2 last:border-0" : "border-r border-base-300 pr-4 last:border-0 min-w-[200px]"}`}>
                                            {headers.map((header, colIndex) => (
                                                <div key={colIndex} className="mb-1">
                                                    <span className="font-semibold text-primary">{header}: </span>
                                                    <span>{row[colIndex]}</span>
                                                </div>
                                            ))}
                                        </div>
                                    ))}
                                    {data.length > 10 && (
                                        <div className="text-center text-base-content/50 text-xs flex items-center">
                                            ... and {data.length - 10} more rows
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default PrintPreviewDrawer;
