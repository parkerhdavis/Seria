/**
 * Screenplay Print Component
 *
 * Renders Cell Data in industry-standard screenplay format.
 * Follows Hollywood screenplay formatting rules with proper margins,
 * capitalization, and element positioning.
 */

import { useState, useEffect, useRef } from "react";
import type { PrintRecipe, RecipeConfiguration, RecipeIngredient } from "@/types/printRecipe";
import { getMappedColumn } from "@/utils/printRecipeMapper";
import { useCellStore } from "@stores/cellStore";

interface ScreenplayPrintProps {
    data: string[][];
    headers: string[];
    recipe: PrintRecipe;
    configuration: RecipeConfiguration;
    drawerPosition?: "right" | "bottom";  // Drawer orientation
    containerWidth?: number;               // Available width in pixels
    containerHeight?: number;              // Available height in pixels
    continuous?: boolean;                  // If false, shows gaps between pages (default: true)
    followCell?: boolean;                  // If false, won't scroll when Cell is edited (default: true)
}

/**
 * Element type for screenplay formatting
 */
type ElementType = "scene_heading" | "action" | "character" | "dialogue" | "parenthetical" | "transition";

interface ScreenplayElement {
    type: ElementType;
    content: string;
    rowIndex: number;
    columnName: string;  // Which Cell column this element came from
    sceneNumber?: number; // Scene number (only for scene_heading elements)
}

/**
 * Determines if an element type should support multi-line editing
 */
function isMultiLineElement(type: ElementType): boolean {
    return type === "action" || type === "dialogue";
}

/**
 * Represents a selected Print element for editing
 */
interface SelectedPrintElement {
    rowIndex: number;
    columnName: string;
    elementIndex: number;  // Index in the elements array for navigation
}

/**
 * Represents multiple selected Print elements
 * Supports both contiguous ranges and non-contiguous multi-selection
 */
interface PrintSelection {
    // Primary selection (for keyboard navigation and editing)
    primary: SelectedPrintElement | null;
    // Additional selected elements (for multi-select with Ctrl+click)
    additional: SelectedPrintElement[];
}

/**
 * Gets the style configuration for a screenplay element type from the recipe
 */
function getElementStyle(recipe: PrintRecipe, elementType: ElementType): RecipeIngredient["style"] {
    // Get ingredient from recipe, or return default style if not found
    const ingredient = recipe.ingredients?.[elementType];
    return ingredient?.style || {
        fontFamily: "Courier",
        fontSize: 12,
        textAlign: "left",
        leftMargin: 0,
        lineSpaceBefore: 0,
        lineSpaceAfter: 0,
    };
}

/**
 * Individual screenplay element renderer
 */
function ScreenplayElementView({
    element,
    recipe,
    showRowNumbers,
    showSceneNumbers,
    isBeingEdited,
    isSelected,
    isCut,
    isEditingFromPrint,
    editingValue,
    onEditingValueChange,
    onClick,
    onDoubleClick,
    onContextMenu,
    setRef,
}: {
    element: ScreenplayElement;
    recipe: PrintRecipe;
    showRowNumbers: boolean;
    showSceneNumbers: boolean;
    isBeingEdited: boolean;
    isSelected: boolean;
    isCut: boolean;
    isEditingFromPrint: boolean;
    editingValue: string;
    onEditingValueChange: (value: string) => void;
    onClick: (e: React.MouseEvent) => void;
    onDoubleClick: () => void;
    onContextMenu: (e: React.MouseEvent) => void;
    setRef?: (el: HTMLDivElement | null) => void;
}) {
    const inputRef = useRef<HTMLInputElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Hover state for element highlighting
    const [isHovered, setIsHovered] = useState(false);

    // Check if this element should be multi-line
    const isMultiLine = isMultiLineElement(element.type);

    // Get styling from recipe configuration
    const elementConfig = getElementStyle(recipe, element.type);

    // Build style object from recipe configuration with sensible defaults
    const style = {
        marginLeft: elementConfig.leftMargin ? `${elementConfig.leftMargin}in` : undefined,
        marginRight: elementConfig.rightMargin ? `${elementConfig.rightMargin}in` : undefined,
        textAlign: elementConfig.textAlign || "left",
        textTransform: elementConfig.textTransform || "none",
        fontWeight: elementConfig.fontWeight || 400,
        fontSize: elementConfig.fontSize ? `${elementConfig.fontSize}pt` : undefined,
        maxWidth: elementConfig.textAlign !== "right" ?
            (("maxWidth" in elementConfig ? (elementConfig as {maxWidth?: string}).maxWidth : undefined) || "100%") :
            undefined,
        marginTop: elementConfig.lineSpaceBefore ? `${elementConfig.lineSpaceBefore}em` : undefined,
        marginBottom: elementConfig.lineSpaceAfter ? `${elementConfig.lineSpaceAfter}em` : undefined,
    };

    // Auto-focus input/textarea when editing starts from Print view
    useEffect(() => {
        if (isEditingFromPrint) {
            if (isMultiLine && textareaRef.current) {
                textareaRef.current.focus();
                // Place cursor at end of text
                textareaRef.current.setSelectionRange(editingValue.length, editingValue.length);
                // Auto-resize textarea to fit initial content
                textareaRef.current.style.height = "auto";
                textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
            } else if (!isMultiLine && inputRef.current) {
                inputRef.current.focus();
                // Place cursor at end of text
                inputRef.current.setSelectionRange(editingValue.length, editingValue.length);
            }
        }
    // Reason: Including editingValue.length causes cursor to reset on every keystroke
    // Alternative: Only run when editing starts (isEditingFromPrint changes) or field type changes (isMultiLine)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Missing editingValue.length dependency
    }, [isEditingFromPrint, isMultiLine]);

    // Format content based on element type
    const formatContent = (content: string) => {
        if (element.type === "parenthetical") {
            return content.startsWith("(") ? content : `(${content})`;
        } else if (element.type === "transition") {
            // return content.endsWith(":") ? content : `${content}:`;  // alt below; don't add ":"
            return content;
        }
        return content;
    };

    return (
        <div
            ref={setRef}
            className={`screenplay-element mb-3 relative cursor-pointer ${isBeingEdited ? "editing-indicator" : ""} ${isSelected ? "selected-indicator" : ""} ${isCut ? "cut-indicator" : ""}`}
            onClick={onClick}
            onDoubleClick={onDoubleClick}
            onContextMenu={onContextMenu}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            {/* Full-width hover background */}
            {isHovered && !isBeingEdited && !isSelected && !isCut && (
                <div
                    className="absolute inset-y-0 bg-base-200/70 rounded pointer-events-none transition-colors"
                    style={{
                        left: "calc(-1 * var(--page-padding-left, 1.5in) + 0.25in)",
                        right: "calc(-1 * var(--page-padding-right, 1in) + 0.25in)",
                        top: "-0.25rem",
                        bottom: "-0.25rem"
                    }}
                />
            )}

            {/* Optional row number indicator */}
            {showRowNumbers && (
                <span className="absolute -left-12 text-xs text-base-content/30 font-mono z-10">
                    {element.rowIndex + 1}
                </span>
            )}

            {/* Editing cursor indicator */}
            {isBeingEdited && (
                <div className="absolute -left-6 top-0 text-primary animate-pulse z-10">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                </div>
            )}

            {/* "Editing from Cell" overlay indicator */}
            {isBeingEdited && !isEditingFromPrint && (
                <div className="absolute -top-5 left-0 text-xs text-primary/70 italic bg-base-100/90 px-2 py-0.5 rounded shadow-sm border border-primary/20 z-10">
                    (editing from Cell)
                </div>
            )}

            {/* Selection indicator */}
            {isSelected && !isEditingFromPrint && (
                <div className="absolute -left-6 top-0 text-secondary z-10">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                </div>
            )}

            {/* Scene numbers (left and right margins for scene headings) */}
            {showSceneNumbers && element.type === "scene_heading" && element.sceneNumber && (
                <>
                    {/* Left scene number */}
                    <div className="absolute top-0 text-sm font-mono text-base-content font-bold" style={{ left: "-0.7in" }}>
                        {element.sceneNumber}.
                    </div>
                    {/* Right scene number */}
                    <div className="absolute top-0 text-sm font-mono text-base-content font-bold" style={{ right: "-0.7in" }}>
                        {element.sceneNumber}.
                    </div>
                </>
            )}

            {isEditingFromPrint ? (
                isMultiLine ? (
                    <textarea
                        ref={textareaRef}
                        className="font-mono text-base leading-tight w-full bg-transparent border-none outline-none ring-2 ring-primary ring-inset rounded px-2 py-1 resize-none overflow-hidden relative z-10"
                        style={{
                            ...style as React.CSSProperties,
                            minHeight: "1.5rem",
                            height: "auto",
                        }}
                        value={editingValue}
                        onChange={(e) => {
                            onEditingValueChange(e.target.value);
                            // Auto-resize textarea to fit content
                            e.target.style.height = "auto";
                            e.target.style.height = `${e.target.scrollHeight}px`;
                        }}
                        onClick={(e) => e.stopPropagation()}
                        onInput={(e) => {
                            // Auto-resize on input as well
                            const target = e.target as HTMLTextAreaElement;
                            target.style.height = "auto";
                            target.style.height = `${target.scrollHeight}px`;
                        }}
                        onMouseEnter={() => setIsHovered(false)}
                    />
                ) : (
                    <input
                        ref={inputRef}
                        type="text"
                        className="font-mono text-base leading-tight w-full bg-transparent border-none outline-none ring-2 ring-primary ring-inset rounded px-2 py-1 relative z-10"
                        style={style as React.CSSProperties}
                        value={editingValue}
                        onChange={(e) => onEditingValueChange(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        onMouseEnter={() => setIsHovered(false)}
                    />
                )
            ) : (
                <p
                    className={`font-mono text-base leading-tight rounded px-2 py-1 transition-colors relative z-10 ${isBeingEdited ? "ring-2 ring-primary ring-inset bg-primary/10" : ""} ${isSelected ? "bg-primary/20" : ""} ${isCut ? "ring-2 ring-dashed ring-primary ring-inset opacity-60" : ""}`}
                    style={style as React.CSSProperties}
                >
                    {formatContent(element.content)}
                </p>
            )}
        </div>
    );
}

/**
 * Screenplay Print Renderer
 */
function ScreenplayPrint({
    data,
    headers,
    recipe,
    configuration,
    drawerPosition = "right",
    containerWidth,
    containerHeight,
    continuous = true,
    followCell = true,
}: ScreenplayPrintProps) {
    const [containerRef, setContainerRef] = useState<HTMLDivElement | null>(null);
    const { editingCell, editingValue, setEditingCell, updateEditingValue, updateCell, clearEditingCell, clearSelection } = useCellStore();
    const elementRefs = useRef<Map<string, HTMLDivElement>>(new Map());

    // State for Print view selection and editing
    const [printSelection, setPrintSelection] = useState<PrintSelection>({
        primary: null,
        additional: [],
    });
    const [isEditingFromPrint, setIsEditingFromPrint] = useState(false);
    const [cutElements, setCutElements] = useState<SelectedPrintElement[]>([]);
    const printContainerRef = useRef<HTMLDivElement>(null);

    // Context menu state
    const [contextMenu, setContextMenu] = useState<{
        x: number;
        y: number;
        rowIndex: number;
        columnName: string;
        elementIndex: number;
    } | null>(null);

    // Get field mappings
    const sceneHeadingColumn = getMappedColumn(configuration.fieldMappings, "scene_heading");
    const actionColumn = getMappedColumn(configuration.fieldMappings, "action");
    const characterColumn = getMappedColumn(configuration.fieldMappings, "character");
    const dialogueColumn = getMappedColumn(configuration.fieldMappings, "dialogue");
    const parentheticalColumn = getMappedColumn(configuration.fieldMappings, "parenthetical");
    const transitionColumn = getMappedColumn(configuration.fieldMappings, "transition");

    // Get render settings
    // Note: pageWidth and pageHeight are used as intended aspect ratio for drawer scaling
    // (absolute values will be used for PDF export in the future)
    const pageWidth = recipe.documentSettings.pageWidth ?? 8.5;
    const pageHeight = recipe.documentSettings.pageHeight ?? 11;
    const marginTop = recipe.documentSettings.marginTop ?? 1;
    // In continuous mode, use 0 bottom margin so content flows seamlessly
    const marginBottom = continuous ? 0 : (recipe.documentSettings.marginBottom ?? 1);
    const marginLeft = recipe.documentSettings.marginLeft ?? 1.5;
    const marginRight = recipe.documentSettings.marginRight ?? 1;
    const backgroundColor = recipe.documentSettings.backgroundColor ?? "bg-white";

    // Screenplay-specific settings
    // Type assertions needed due to index signature in RecipeDocumentSettings
    const showPageNumbers = (recipe.documentSettings.showPageNumbers ?? true) as boolean;
    const startPageNumber = (recipe.documentSettings.startPageNumber ?? 1) as number;
    const pageNumberMarginTop = (recipe.documentSettings.pageNumberMarginTop ?? 0.5) as number;
    const firstPageNumbered = (recipe.documentSettings.firstPageNumbered ?? true) as boolean;
    const sceneNumbering = (recipe.documentSettings.sceneNumbering ?? false) as boolean;

    // Calculate available space
    // Account for p-2 padding (0.5rem = 8px per side = 16px total horizontal padding)
    const paddingX = 16;
    const paddingY = 16;
    const availableWidth = (containerWidth ?? containerRef?.clientWidth ?? 800) - paddingX;
    const availableHeight = (containerHeight ?? containerRef?.clientHeight ?? 600) - paddingY;

    // Calculate zoom scale to fit page width in available space
    // Page width is in inches, convert to pixels at 96dpi
    const pageWidthPx = pageWidth * 96;
    const maxScaleWidth = availableWidth / pageWidthPx;

    // Also consider height if needed
    const pageHeightPx = pageHeight * 96;
    const maxScaleHeight = availableHeight / pageHeightPx;

    // For right drawer: always scale to fill width
    // For bottom drawer: scale to fit both dimensions (use smaller scale)
    const scale = drawerPosition === "right"
        ? maxScaleWidth  // Always fill width when on the right
        : Math.min(maxScaleWidth, maxScaleHeight); // Fit both dimensions when on bottom

    // Scroll to element when editing cell changes
    useEffect(() => {
        if (editingCell && containerRef && followCell) {
            // Create a unique key for the editing cell
            const editingKey = `${editingCell.row}-${headers[editingCell.col]}`;
            const element = elementRefs.current.get(editingKey);

            if (element) {
                // Scroll to the element smoothly and center it
                element.scrollIntoView({
                    behavior: "smooth",
                    block: "center",
                    inline: "nearest",
                });
            }
        }
    }, [editingCell, headers, containerRef, followCell]);

    // Clear Print selection when editing cell from Cell Grid changes
    useEffect(() => {
        if (editingCell && !isEditingFromPrint) {
            // Clear Print selection since user is editing from Cell Grid
            setPrintSelection({ primary: null, additional: [] });
        }
    }, [editingCell, isEditingFromPrint]);

    // Clear Print selection when Cell cell is selected
    const { selectedCell, selectedRange } = useCellStore();
    useEffect(() => {
        if ((selectedCell || selectedRange) && printSelection.primary && !isEditingFromPrint) {
            // User clicked in Cell Grid, clear Print selection
            setPrintSelection({ primary: null, additional: [] });
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Missing isEditingFromPrint, printSelection dependencies. Adding these would create an infinite loop - the effect clears printSelection, which would trigger the effect again, clearing it again, etc. Alternative: Restructure logic to use a ref for tracking state or separate the concerns.
    }, [selectedCell, selectedRange]);

    // Clear Print selection when clicking anywhere in Cell Grid area (including background)
    useEffect(() => {
        const handleDocumentClick = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            // Check if click is within Cell Grid container
            const cellGrid = document.querySelector(".cell-grid-container");
            if (cellGrid && cellGrid.contains(target) && printSelection.primary && !isEditingFromPrint) {
                setPrintSelection({ primary: null, additional: [] });
            }
        };

        document.addEventListener("click", handleDocumentClick);
        return () => document.removeEventListener("click", handleDocumentClick);
    }, [printSelection, isEditingFromPrint]);

    // Handle global click to close context menu
    useEffect(() => {
        const handleClick = () => setContextMenu(null);
        if (contextMenu) {
            document.addEventListener("click", handleClick);
            return () => document.removeEventListener("click", handleClick);
        }
    }, [contextMenu]);

    // Handle clicking outside editing element to save changes
    useEffect(() => {
        if (!isEditingFromPrint || !editingCell) return;

        const handleMouseDown = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            // Check if click is outside the editing input/textarea
            if (!target.closest("input[type='text']") && !target.closest("textarea")) {
                // Save the edit
                updateCell(editingCell.row, editingCell.col, editingValue);
                clearEditingCell();
                setIsEditingFromPrint(false);
            }
        };

        document.addEventListener("mousedown", handleMouseDown);
        return () => document.removeEventListener("mousedown", handleMouseDown);
    }, [isEditingFromPrint, editingCell, editingValue, updateCell, clearEditingCell]);

    // Keyboard handlers for Print view
    useEffect(() => {
        const handleKeyDown = async (e: KeyboardEvent) => {
            // Only handle if the Print container is focused or if we're not in any input/textarea
            const target = e.target as HTMLElement;
            const isInInput = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;

            // Import clipboard utilities (dynamically to avoid top-level await issues)
            const { writeText, readText } = await import("@tauri-apps/plugin-clipboard-manager");

            // Get all selected elements (primary + additional)
            const allSelectedElements = printSelection.primary
                ? [printSelection.primary, ...printSelection.additional]
                : [];
            const hasSelection = allSelectedElements.length > 0;

            // Handle Copy (Ctrl+C)
            if (e.key === "c" && e.ctrlKey && !e.shiftKey && !e.altKey && hasSelection && !isInInput) {
                e.preventDefault();
                // Cancel any pending cut operation
                setCutElements([]);

                // Copy selected elements to clipboard
                const copiedValues = allSelectedElements.map(sel => {
                    const colIndex = headers.indexOf(sel.columnName);
                    if (colIndex === -1) return "";
                    return data[sel.rowIndex]?.[colIndex] || "";
                });

                try {
                    await writeText(copiedValues.join("\n"));
                } catch (err) {
                    console.error("Failed to copy to system clipboard:", err);
                }
                return;
            }

            // Handle Cut (Ctrl+X)
            if (e.key === "x" && e.ctrlKey && !e.shiftKey && !e.altKey && hasSelection && !isInInput) {
                e.preventDefault();

                // First copy to clipboard
                const copiedValues = allSelectedElements.map(sel => {
                    const colIndex = headers.indexOf(sel.columnName);
                    if (colIndex === -1) return "";
                    return data[sel.rowIndex]?.[colIndex] || "";
                });

                try {
                    await writeText(copiedValues.join("\n"));
                    // Mark elements as cut (they'll be cleared on paste)
                    setCutElements([...allSelectedElements]);
                } catch (err) {
                    console.error("Failed to cut to system clipboard:", err);
                }
                return;
            }

            // Handle Paste (Ctrl+V)
            if (e.key === "v" && e.ctrlKey && !e.shiftKey && !e.altKey && printSelection.primary && !isInInput) {
                e.preventDefault();

                try {
                    const text = await readText();
                    if (!text) return;

                    // Parse clipboard text - split by newlines
                    const values = text.split("\n").filter(v => v !== "");

                    // Paste starting at primary selection
                    const startElementIndex = printSelection.primary.elementIndex;

                    // Build array of cell updates
                    const cellUpdates: Array<{ row: number; col: number; value: string }> = [];

                    for (let i = 0; i < values.length; i++) {
                        const targetElement = elements[startElementIndex + i];
                        if (!targetElement) break;

                        const colIndex = headers.indexOf(targetElement.columnName);
                        if (colIndex === -1) continue;

                        cellUpdates.push({
                            row: targetElement.rowIndex,
                            col: colIndex,
                            value: values[i]
                        });
                    }

                    // Update all cells at once
                    if (cellUpdates.length > 0) {
                        useCellStore.getState().updateCells(cellUpdates);
                    }

                    // Clear cut elements if there were any
                    if (cutElements.length > 0) {
                        const clearUpdates = cutElements.map(sel => {
                            const colIndex = headers.indexOf(sel.columnName);
                            return {
                                row: sel.rowIndex,
                                col: colIndex,
                                value: ""
                            };
                        });
                        useCellStore.getState().updateCells(clearUpdates);
                        setCutElements([]);
                    }
                } catch (err) {
                    console.error("Failed to paste from system clipboard:", err);
                }
                return;
            }

            // Handle Delete/Backspace to clear selected elements
            if ((e.key === "Delete" || e.key === "Backspace") && hasSelection && !isInInput) {
                e.preventDefault();

                const clearUpdates = allSelectedElements.map(sel => {
                    const colIndex = headers.indexOf(sel.columnName);
                    return {
                        row: sel.rowIndex,
                        col: colIndex,
                        value: ""
                    };
                });

                useCellStore.getState().updateCells(clearUpdates);
                return;
            }

            // Handle type-to-overwrite: if a printable character is typed, clear element and start editing
            if (printSelection.primary && !isEditingFromPrint && !isInInput) {
                const isPrintableChar = e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey;

                if (isPrintableChar) {
                    e.preventDefault();
                    // Start editing with the typed character as the initial value
                    const colIndex = headers.indexOf(printSelection.primary.columnName);
                    if (colIndex === -1) return;

                    setEditingCell(printSelection.primary.rowIndex, colIndex, e.key, "print");
                    setIsEditingFromPrint(true);
                    return;
                }
            }

            // Handle arrow key navigation
            if (printSelection.primary && !isEditingFromPrint && !isInInput) {
                if (e.key === "ArrowUp" || e.key === "ArrowDown") {
                    e.preventDefault();
                    const currentIndex = printSelection.primary.elementIndex;
                    const newIndex = e.key === "ArrowUp" ? currentIndex - 1 : currentIndex + 1;

                    if (newIndex >= 0 && newIndex < elements.length) {
                        const newElement = elements[newIndex];
                        const newSelection: SelectedPrintElement = {
                            rowIndex: newElement.rowIndex,
                            columnName: newElement.columnName,
                            elementIndex: newIndex,
                        };

                        // If Shift is held, extend selection
                        if (e.shiftKey) {
                            // Add to selection range
                            const minIndex = Math.min(currentIndex, newIndex);
                            const maxIndex = Math.max(currentIndex, newIndex);
                            const rangeElements: SelectedPrintElement[] = [];

                            for (let i = minIndex; i <= maxIndex; i++) {
                                if (i !== printSelection.primary.elementIndex) {
                                    const el = elements[i];
                                    rangeElements.push({
                                        rowIndex: el.rowIndex,
                                        columnName: el.columnName,
                                        elementIndex: i,
                                    });
                                }
                            }

                            setPrintSelection({
                                primary: printSelection.primary,
                                additional: rangeElements,
                            });
                        } else {
                            // Normal navigation - clear selection and move
                            setPrintSelection({
                                primary: newSelection,
                                additional: [],
                            });
                        }

                        // Scroll to the new element
                        const elementKey = `${newElement.rowIndex}-${newElement.columnName}`;
                        const element = elementRefs.current.get(elementKey);
                        if (element) {
                            element.scrollIntoView({
                                behavior: "smooth",
                                block: "center",
                                inline: "nearest",
                            });
                        }
                    }
                    return;
                }
            }

            // Handle F2 or Enter to start editing from Print view
            if ((e.key === "F2" || e.key === "Enter") && printSelection.primary && !isEditingFromPrint && !isInInput) {
                e.preventDefault();
                // Start editing from Print view
                const colIndex = headers.indexOf(printSelection.primary.columnName);
                if (colIndex === -1) return;

                const value = data[printSelection.primary.rowIndex]?.[colIndex] || "";
                setEditingCell(printSelection.primary.rowIndex, colIndex, value, "print");
                setIsEditingFromPrint(true);
            }

            // Handle Enter or F2 to save editing from Print view
            // For multi-line elements, Ctrl+Enter creates newlines; Enter or F2 saves
            if (isEditingFromPrint && editingCell) {
                const primary = printSelection.primary;
                const isMultiLine = primary &&
                    isMultiLineElement(
                        elements.find(el =>
                            el.rowIndex === primary.rowIndex &&
                            el.columnName === primary.columnName
                        )?.type || "action"
                    );

                // Allow Ctrl+Enter to create newlines in multi-line elements
                if (e.key === "Enter" && isMultiLine && e.ctrlKey) {
                    return;
                }

                if ((e.key === "F2") || (e.key === "Enter")) {
                    e.preventDefault();
                    // Save editing from Print view
                    updateCell(editingCell.row, editingCell.col, editingValue);
                    clearEditingCell();
                    setIsEditingFromPrint(false);
                }
            }

            // Handle Escape to cancel editing or clear selection
            if (e.key === "Escape") {
                if (isEditingFromPrint) {
                    e.preventDefault();
                    clearEditingCell();
                    setIsEditingFromPrint(false);
                } else if (hasSelection) {
                    e.preventDefault();
                    setPrintSelection({ primary: null, additional: [] });
                    setCutElements([]);
                }
            }
        };

        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Missing elements dependency. elements is derived from data and is recalculated on every render. Adding it would cause the keyboard handler to constantly detach/reattach, causing performance issues. The effect already depends on data, which is sufficient. Alternative: Memoize elements array with useMemo, then add to dependencies.
    }, [printSelection, isEditingFromPrint, headers, data, editingCell, editingValue, setEditingCell, updateCell, clearEditingCell, cutElements]);

    // Handle clicking on a Print element
    const handleElementClick = (e: React.MouseEvent, element: ScreenplayElement, elementIndex: number) => {
        const newSelection: SelectedPrintElement = {
            rowIndex: element.rowIndex,
            columnName: element.columnName,
            elementIndex,
        };

        // Ctrl+click for multi-select (add to selection)
        if (e.ctrlKey || e.metaKey) {
            // Check if this element is already selected
            const isAlreadySelected =
                (printSelection.primary?.elementIndex === elementIndex) ||
                printSelection.additional.some(sel => sel.elementIndex === elementIndex);

            if (isAlreadySelected) {
                // Remove from selection
                if (printSelection.primary?.elementIndex === elementIndex) {
                    // Removing primary - promote first additional to primary
                    if (printSelection.additional.length > 0) {
                        setPrintSelection({
                            primary: printSelection.additional[0],
                            additional: printSelection.additional.slice(1),
                        });
                    } else {
                        setPrintSelection({ primary: null, additional: [] });
                    }
                } else {
                    // Remove from additional
                    setPrintSelection({
                        primary: printSelection.primary,
                        additional: printSelection.additional.filter(sel => sel.elementIndex !== elementIndex),
                    });
                }
            } else {
                // Add to selection
                if (!printSelection.primary) {
                    setPrintSelection({ primary: newSelection, additional: [] });
                } else {
                    setPrintSelection({
                        primary: printSelection.primary,
                        additional: [...printSelection.additional, newSelection],
                    });
                }
            }
        } else {
            // Normal click - replace selection
            setPrintSelection({
                primary: newSelection,
                additional: [],
            });
        }

        // Clear Cell selection so Cell Grid doesn't compete for keyboard input
        clearSelection();

        // Focus the Print container so keyboard events work
        if (printContainerRef.current) {
            printContainerRef.current.focus();
        }
    };

    // Handle double-clicking on a Print element to start editing
    const handleElementDoubleClick = (element: ScreenplayElement, elementIndex: number) => {
        // Set selected element
        setPrintSelection({
            primary: {
                rowIndex: element.rowIndex,
                columnName: element.columnName,
                elementIndex,
            },
            additional: [],
        });

        // Start editing immediately
        const colIndex = headers.indexOf(element.columnName);
        if (colIndex === -1) return;

        const value = data[element.rowIndex]?.[colIndex] || "";
        setEditingCell(element.rowIndex, colIndex, value, "print");
        setIsEditingFromPrint(true);
    };

    // Handle right-clicking on a Print element to show context menu
    const handleElementContextMenu = (e: React.MouseEvent, element: ScreenplayElement, elementIndex: number) => {
        e.preventDefault();
        e.stopPropagation();

        setContextMenu({
            x: e.clientX,
            y: e.clientY,
            rowIndex: element.rowIndex,
            columnName: element.columnName,
            elementIndex,
        });

        // If element is not already in selection, select it
        const isInSelection =
            (printSelection.primary?.elementIndex === elementIndex) ||
            printSelection.additional.some(sel => sel.elementIndex === elementIndex);

        if (!isInSelection) {
            setPrintSelection({
                primary: {
                    rowIndex: element.rowIndex,
                    columnName: element.columnName,
                    elementIndex,
                },
                additional: [],
            });
        }
    };

    // Transform Cell Data into screenplay elements
    // Use editingValue for real-time preview if a cell is being edited
    const elements: ScreenplayElement[] = [];
    let sceneCounter = 0; // Counter for scene numbering

    // Helper to get cell value (either from data or editingValue if being edited)
    const getCellValue = (rowIndex: number, colIndex: number): string => {
        if (editingCell && editingCell.row === rowIndex && editingCell.col === colIndex) {
            return editingValue;
        }
        return data[rowIndex]?.[colIndex] || "";
    };

    data.forEach((row, rowIndex) => {
        // Determine element type and content based on which columns have data
        // Priority order: transition > scene_heading > character > parenthetical > dialogue > action

        const sceneHeadingIdx = sceneHeadingColumn ? headers.indexOf(sceneHeadingColumn) : -1;
        const actionIdx = actionColumn ? headers.indexOf(actionColumn) : -1;
        const characterIdx = characterColumn ? headers.indexOf(characterColumn) : -1;
        const dialogueIdx = dialogueColumn ? headers.indexOf(dialogueColumn) : -1;
        const parentheticalIdx = parentheticalColumn ? headers.indexOf(parentheticalColumn) : -1;
        const transitionIdx = transitionColumn ? headers.indexOf(transitionColumn) : -1;

        // Check for transition (appears before scene heading)
        if (transitionIdx >= 0) {
            const content = getCellValue(rowIndex, transitionIdx);
            if (content.trim()) {
                elements.push({
                    type: "transition",
                    content,
                    rowIndex,
                    columnName: headers[transitionIdx],
                });
            }
        }

        // Check for scene heading
        if (sceneHeadingIdx >= 0) {
            const content = getCellValue(rowIndex, sceneHeadingIdx);
            if (content.trim()) {
                sceneCounter++; // Increment scene number
                elements.push({
                    type: "scene_heading",
                    content,
                    rowIndex,
                    columnName: headers[sceneHeadingIdx],
                    sceneNumber: sceneCounter,
                });
            }
        }

        // Check for character (if we have dialogue, we need a character)
        if (characterIdx >= 0 && dialogueIdx >= 0) {
            const characterContent = getCellValue(rowIndex, characterIdx);
            const dialogueContent = getCellValue(rowIndex, dialogueIdx);

            if (characterContent.trim() && dialogueContent.trim()) {
                elements.push({
                    type: "character",
                    content: characterContent,
                    rowIndex,
                    columnName: headers[characterIdx],
                });

                // Check for parenthetical
                if (parentheticalIdx >= 0) {
                    const parentheticalContent = getCellValue(rowIndex, parentheticalIdx);
                    if (parentheticalContent.trim()) {
                        elements.push({
                            type: "parenthetical",
                            content: parentheticalContent,
                            rowIndex,
                            columnName: headers[parentheticalIdx],
                        });
                    }
                }

                // Add dialogue
                elements.push({
                    type: "dialogue",
                    content: dialogueContent,
                    rowIndex,
                    columnName: headers[dialogueIdx],
                });
            }
        }

        // Check for action
        if (actionIdx >= 0) {
            const content = getCellValue(rowIndex, actionIdx);
            if (content.trim()) {
                elements.push({
                    type: "action",
                    content,
                    rowIndex,
                    columnName: headers[actionIdx],
                });
            }
        }
    });

    // Show message if no elements
    if (elements.length === 0) {
        return (
            <div className="flex items-center justify-center h-full text-base-content/50">
                <div className="text-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <p className="mb-2">No screenplay elements to display</p>
                    <p className="text-xs">Make sure your Cell columns are mapped to screenplay elements</p>
                </div>
            </div>
        );
    }

    /**
     * Calculate approximate height of a screenplay element in inches
     * Based on font size, line spacing, and content length
     */
    const calculateElementHeight = (element: ScreenplayElement): number => {
        const elementConfig = getElementStyle(recipe, element.type);
        const fontSize = elementConfig.fontSize || 12; // in points
        const lineSpaceBefore = elementConfig.lineSpaceBefore || 0;
        const lineSpaceAfter = elementConfig.lineSpaceAfter || 0;

        // Calculate base line height
        // Courier 12pt has ~6 lines per inch in screenplay format
        const lineHeightInches = (fontSize / 72) * 1.2; // Convert points to inches with 1.2 line height multiplier

        // Estimate number of lines based on content length and element type
        // For multi-line elements (action, dialogue), estimate based on character width
        let numLines = 1;
        if (isMultiLineElement(element.type)) {
            // Courier 12pt at 6in width = ~60 characters per line
            const maxWidth = ("maxWidth" in elementConfig ? (elementConfig as {maxWidth?: string}).maxWidth : undefined) || "6in";
            const widthInches = parseFloat(maxWidth.replace("in", ""));
            const charsPerLine = Math.floor(widthInches * 10); // Approximation: ~10 chars per inch in Courier 12pt
            numLines = Math.max(1, Math.ceil(element.content.length / charsPerLine));
        }

        // Total height = spacing before + (lines * line height) + spacing after
        const spacingBeforeInches = lineSpaceBefore * lineHeightInches;
        const spacingAfterInches = lineSpaceAfter * lineHeightInches;
        const contentHeight = numLines * lineHeightInches;

        return spacingBeforeInches + contentHeight + spacingAfterInches;
    };

    /**
     * Group elements into blocks that should stay together across page breaks
     * Dialogue blocks (Character + Parenthetical + Dialogue from same row) must not be split
     */
    interface ElementBlock {
        elements: ScreenplayElement[];
        totalHeight: number;
    }

    const groupIntoBlocks = (): ElementBlock[] => {
        const blocks: ElementBlock[] = [];
        let i = 0;

        while (i < elements.length) {
            const element = elements[i];

            // Check if this is the start of a dialogue block (Character element)
            if (element.type === "character") {
                // Collect all elements from this dialogue block (same rowIndex)
                const blockElements: ScreenplayElement[] = [element];
                let blockHeight = calculateElementHeight(element);
                let j = i + 1;

                // Look ahead for Parenthetical and/or Dialogue from same row
                while (j < elements.length && elements[j].rowIndex === element.rowIndex) {
                    const nextElement = elements[j];
                    if (nextElement.type === "parenthetical" || nextElement.type === "dialogue") {
                        blockElements.push(nextElement);
                        blockHeight += calculateElementHeight(nextElement);
                        j++;
                    } else {
                        break;
                    }
                }

                blocks.push({
                    elements: blockElements,
                    totalHeight: blockHeight,
                });

                // Skip past the elements we just added to the block
                i = j;
            } else {
                // Non-dialogue element - create a single-element block
                blocks.push({
                    elements: [element],
                    totalHeight: calculateElementHeight(element),
                });
                i++;
            }
        }

        return blocks;
    };

    /**
     * Split screenplay element blocks into pages based on pageHeight
     * Returns array of pages, each containing elements that fit within the page
     */
    interface PageWithElements {
        elements: ScreenplayElement[];
        pageNumber: number;
    }

    const splitIntoPages = (): PageWithElements[] => {
        const pages: PageWithElements[] = [];
        const usableHeight = pageHeight - marginTop - marginBottom;
        const blocks = groupIntoBlocks();

        let currentPage: ScreenplayElement[] = [];
        let currentPageHeight = 0;
        let pageNumber = 1;

        blocks.forEach((block, index) => {
            // Check if adding this block would exceed page height
            if (currentPageHeight + block.totalHeight > usableHeight && currentPage.length > 0) {
                // Save current page and start new one
                pages.push({
                    elements: currentPage,
                    pageNumber: pageNumber,
                });
                pageNumber++;
                currentPage = [];
                currentPageHeight = 0;
            }

            // Add all elements from this block to current page
            currentPage.push(...block.elements);
            currentPageHeight += block.totalHeight;

            // If this is the last block, save the current page
            if (index === blocks.length - 1) {
                pages.push({
                    elements: currentPage,
                    pageNumber: pageNumber,
                });
            }
        });

        // Handle edge case: if no pages were created, create one empty page
        if (pages.length === 0) {
            pages.push({
                elements: [],
                pageNumber: 1,
            });
        }

        return pages;
    };

    // Split elements into pages
    const pages = splitIntoPages();

    // Calculate page dimensions and transform
    // For right drawer, align left; for bottom drawer, center
    const transformOrigin = drawerPosition === "right" ? "top left" : "top center";

    // Calculate margin bottom based on continuous mode
    // When using transform: scale(), the element shrinks visually but still occupies its original layout space.
    // We need negative margin to compensate. The formula subtracts the "wasted" space from the desired gap.
    const pageGap = continuous ? 0 : 32; // 32px gap when not continuous

    const pageStyle = {
        width: `${pageWidth}in`,
        minHeight: `${pageHeight}in`,
        paddingTop: `${marginTop}in`,
        paddingBottom: `${marginBottom}in`,
        paddingLeft: `${marginLeft}in`,
        paddingRight: `${marginRight}in`,
        transform: `scale(${scale})`,
        transformOrigin,
        // Negative margin compensates for scaled element's layout space
        // pageGap adds the desired visual gap between pages
        marginBottom: `${pageGap - (1 - scale) * pageHeightPx}px`,
    };

    return (
        <div
            ref={(el) => {
                setContainerRef(el);
                if (printContainerRef.current !== el) {
                    (printContainerRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
                }
            }}
            className="screenplay-print-container w-full h-full p-2 outline-none"
            tabIndex={0}
            onClick={(e) => {
                // Clear Cell selection when clicking anywhere in Print view
                // Only if we didn't click on an element (which handles its own selection)
                if (e.target === e.currentTarget || (e.target as HTMLElement).closest(".screenplay-page")) {
                    clearSelection();
                    // Focus the Print container
                    if (printContainerRef.current) {
                        printContainerRef.current.focus();
                    }
                }
            }}
        >
            {/* Render all pages */}
            {pages.map((page) => {
                // Calculate page number to display (accounting for startPageNumber offset)
                const displayPageNumber = startPageNumber + page.pageNumber - 1;
                // Determine if this page should show page number
                const shouldShowPageNumber = !continuous && showPageNumbers && (firstPageNumbered || page.pageNumber > 1);

                return (
                    <div
                        key={page.pageNumber}
                        className={`screenplay-page ${backgroundColor} text-grey-50 relative ${drawerPosition === "bottom" ? "mx-auto" : ""}`}
                        style={pageStyle}
                    >
                        {/* Page number (top right, only if enabled) */}
                        {shouldShowPageNumber && (
                            <div
                                className="absolute right-10 text-sm font-mono"
                                style={{ top: `${pageNumberMarginTop}in` }}
                            >
                                {displayPageNumber}
                            </div>
                        )}

                        {/* Screenplay elements for this page */}
                        <div className="screenplay-content relative">
                            {page.elements.map((element) => {
                                // Find the global index of this element in the full elements array
                                const globalIndex = elements.findIndex(
                                    (e) => e.rowIndex === element.rowIndex && e.columnName === element.columnName
                                );

                                // Check if this element corresponds to the cell being edited
                                const isBeingEdited = editingCell !== null &&
                                    editingCell.row === element.rowIndex &&
                                    headers[editingCell.col] === element.columnName;

                                // Check if this element is selected (in primary or additional selection)
                                const isSelected =
                                    (printSelection.primary !== null &&
                                        printSelection.primary.rowIndex === element.rowIndex &&
                                        printSelection.primary.columnName === element.columnName) ||
                                    printSelection.additional.some(sel =>
                                        sel.rowIndex === element.rowIndex &&
                                        sel.columnName === element.columnName
                                    );

                                // Check if this element is cut
                                const isCut = cutElements.some(sel =>
                                    sel.rowIndex === element.rowIndex &&
                                    sel.columnName === element.columnName
                                );

                                // Check if this element is being edited from Print view
                                const isEditingThisFromPrint = isEditingFromPrint &&
                                    editingCell !== null &&
                                    editingCell.row === element.rowIndex &&
                                    headers[editingCell.col] === element.columnName;

                                // Create a unique key for this element
                                const elementKey = `${element.rowIndex}-${element.columnName}`;

                                // Create ref callback to store element ref
                                const setRef = (el: HTMLDivElement | null) => {
                                    if (el) {
                                        elementRefs.current.set(elementKey, el);
                                    } else {
                                        elementRefs.current.delete(elementKey);
                                    }
                                };

                                return (
                                    <ScreenplayElementView
                                        key={`${page.pageNumber}-${globalIndex}`}
                                        element={element}
                                        recipe={recipe}
                                        showRowNumbers={false}
                                        showSceneNumbers={sceneNumbering}
                                        isBeingEdited={isBeingEdited}
                                        isSelected={isSelected}
                                        isCut={isCut}
                                        isEditingFromPrint={isEditingThisFromPrint}
                                        editingValue={editingValue}
                                        onEditingValueChange={updateEditingValue}
                                        onClick={(e) => handleElementClick(e, element, globalIndex)}
                                        onDoubleClick={() => handleElementDoubleClick(element, globalIndex)}
                                        onContextMenu={(e) => handleElementContextMenu(e, element, globalIndex)}
                                        setRef={setRef}
                                    />
                                );
                            })}
                        </div>
                    </div>
                );
            })}

            {/* Context menu */}
            {contextMenu && (
                <div
                    className="fixed bg-base-100 border border-base-300 rounded-lg shadow-lg z-50 min-w-[160px]"
                    style={{ top: contextMenu.y, left: contextMenu.x }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <ul className="menu menu-sm p-2">
                        <li>
                            <a
                                onClick={() => {
                                    const colIndex = headers.indexOf(contextMenu.columnName);
                                    if (colIndex === -1) return;
                                    const value = data[contextMenu.rowIndex]?.[colIndex] || "";
                                    setEditingCell(contextMenu.rowIndex, colIndex, value, "print");
                                    setIsEditingFromPrint(true);
                                    setContextMenu(null);
                                }}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                                Edit
                            </a>
                        </li>
                        <div className="divider my-1"></div>
                        <li>
                            <a
                                onClick={() => {
                                    const colIndex = headers.indexOf(contextMenu.columnName);
                                    if (colIndex === -1) return;
                                    const value = data[contextMenu.rowIndex]?.[colIndex] || "";
                                    navigator.clipboard.writeText(value);
                                    setContextMenu(null);
                                }}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                                Copy
                            </a>
                        </li>
                        <li>
                            <a
                                onClick={async () => {
                                    try {
                                        const text = await navigator.clipboard.readText();
                                        const colIndex = headers.indexOf(contextMenu.columnName);
                                        if (colIndex === -1) return;
                                        updateCell(contextMenu.rowIndex, colIndex, text);
                                        setContextMenu(null);
                                    } catch (err) {
                                        console.error("Failed to paste:", err);
                                    }
                                }}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                </svg>
                                Paste
                            </a>
                        </li>
                    </ul>
                </div>
            )}
        </div>
    );
}

export default ScreenplayPrint;
