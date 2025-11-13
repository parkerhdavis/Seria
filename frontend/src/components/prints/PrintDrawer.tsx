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
import { useDrawerStore } from "@stores/drawerStore";
import { usePrintRecipeStore } from "@stores/printRecipeStore";
import CardPrint from "@components/prints/CardPrint";
import ScreenplayPrint from "@components/prints/ScreenplayPrint";

interface PrintPreviewDrawerProps {
    isOpen: boolean;
    position: "right" | "bottom";
}

/**
 * PrintDrawer - Flexible drawer for print preview
 */
function PrintDrawer({ isOpen, position }: PrintPreviewDrawerProps) {
    const { headers, data, fileInfo } = useCSVStore();
    const {
        rightDrawerSize,
        bottomDrawerSize,
        setRightDrawerSize,
        setBottomDrawerSize,
        setPosition,
    } = useDrawerStore();
    const [isResizing, setIsResizing] = useState(false);
    const drawerRef = useRef<HTMLDivElement>(null);
    const { startDrag, endDrag } = useDrag();

    // Get the current size based on position
    const size = position === "right" ? rightDrawerSize : bottomDrawerSize;

    // Recipe store
    const {
        recipes,
        selectedRecipeId,
        configurations,
        loadBundledRecipes,
        setCSVHeaders,
        selectRecipe,
    } = usePrintRecipeStore();

    // Load recipes and set CSV headers on mount/update
    useEffect(() => {
        loadBundledRecipes();
        if (headers.length > 0) {
            setCSVHeaders(headers);
        }
    }, [loadBundledRecipes, setCSVHeaders, headers]);

    // Auto-select first recipe if none selected
    useEffect(() => {
        if (!selectedRecipeId && recipes.length > 0) {
            selectRecipe(recipes[0].id);
        }
    }, [selectedRecipeId, recipes, selectRecipe]);

    // Handle resize
    useEffect(() => {
        if (!isResizing) return;

        const handleMouseMove = (e: MouseEvent) => {
            if (position === "right") {
                const newWidth = window.innerWidth - e.clientX;
                const clampedWidth = Math.max(200, Math.min(newWidth, window.innerWidth * 0.8));
                setRightDrawerSize(clampedWidth);
            } else {
                const newHeight = window.innerHeight - e.clientY;
                const clampedHeight = Math.max(150, Math.min(newHeight, window.innerHeight * 0.8));
                setBottomDrawerSize(clampedHeight);
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
    }, [isResizing, position, endDrag, setRightDrawerSize, setBottomDrawerSize]);

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
            className={`fixed bg-base-200 shadow-black shadow-md border-black/50 z-50 flex ${position === "right" ? "flex-col border-l-4" : "flex-row border-t-4"}`}
            style={positionStyles}
        >
            {/* Resize handle */}
            <div
                className={resizeHandleClasses}
                onMouseDown={(e) => {
                    e.preventDefault();
                    startDrag(`drawer-resize-${position}`);
                    setIsResizing(true);
                }}
            />
            {/* Header */}
            <div className={`flex items-center justify-between p-4 ${position === "right" ? "border-b" : "border-r"} border-base-300 ${position === "bottom" ? "min-w-[200px]" : ""}`}>
                <h2 className="text-lg font-bold">Print Recipe</h2>
                {/* Recipe selector */}
                {/*<div className="mb-6">*/}
                {/*<h3 className="text-sm font-semibold text-base-content/70 mb-2">Print Recipe</h3>*/}
                <select
                    className="select select-bordered select-sm max-w-200"
                    value={selectedRecipeId ?? ""}
                    onChange={(e) => selectRecipe(e.target.value)}
                >
                    {recipes.map((recipe) => (
                        <option key={recipe.id} value={recipe.id}>
                            {recipe.name}
                        </option>
                    ))}
                </select>
                {/*</div>*/}
                <button
                    className="btn btn-sm btn-ghost btn-circle"
                    onClick={() => setPosition(null)}
                    title={`Close Print Preview (Ctrl+${position === "right" ? "\\" : "/"})`}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto">
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
                        {/* Recipe preview */}
                        <div className="flex-1 overflow-hidden">
                            {selectedRecipeId && (() => {
                                const recipe = recipes.find(r => r.id === selectedRecipeId);
                                const config = configurations[selectedRecipeId];

                                if (!recipe || !config) {
                                    return (
                                        <div className="text-center py-8 text-base-content/50">
                                            <p>Recipe not found</p>
                                        </div>
                                    );
                                }

                                // Calculate available content dimensions
                                // Header height/width: ~56px (p-4 + content + border)
                                // Content padding: 16px (p-4)
                                const headerSize = 56;
                                const contentPadding = 0; // 16px * 2 (both sides)

                                let containerWidth: number;
                                let containerHeight: number;

                                if (position === "right") {
                                    containerWidth = size - contentPadding;
                                    containerHeight = window.innerHeight - headerSize - contentPadding;
                                } else {
                                    containerWidth = window.innerWidth - contentPadding;
                                    containerHeight = size - headerSize - contentPadding;
                                }

                                // Render based on recipe type
                                switch (recipe.type) {
                                    case "card":
                                        return (
                                            <CardPrint
                                                data={data}
                                                headers={headers}
                                                recipe={recipe}
                                                configuration={config}
                                                drawerPosition={position}
                                                containerWidth={containerWidth}
                                                containerHeight={containerHeight}
                                            />
                                        );
                                    case "screenplay":
                                        return (
                                            <ScreenplayPrint
                                                data={data}
                                                headers={headers}
                                                recipe={recipe}
                                                configuration={config}
                                                drawerPosition={position}
                                                containerWidth={containerWidth}
                                                containerHeight={containerHeight}
                                            />
                                        );
                                    default:
                                        return (
                                            <div className="text-center py-8 text-base-content/50">
                                                <p>Recipe type "{recipe.type}" not yet implemented</p>
                                            </div>
                                        );
                                }
                            })()}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default PrintDrawer;
