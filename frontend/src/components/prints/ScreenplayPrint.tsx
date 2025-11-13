/**
 * Screenplay Print Component
 *
 * Renders CSV data in industry-standard screenplay format.
 * Follows Hollywood screenplay formatting rules with proper margins,
 * capitalization, and element positioning.
 */

import { useState, useEffect, useRef } from "react";
import type { PrintRecipe, RecipeConfiguration, RecipeIngredient } from "@/types/printRecipe";
import { getMappedColumn } from "@/utils/printRecipeMapper";
import { useCSVStore } from "@/stores/csvStore";
import { useSettingsStore } from "@/stores/settingsStore";

interface ScreenplayPrintProps {
    data: string[][];
    headers: string[];
    recipe: PrintRecipe;
    configuration: RecipeConfiguration;
    drawerPosition?: "right" | "bottom";  // Drawer orientation
    containerWidth?: number;               // Available width in pixels
    containerHeight?: number;              // Available height in pixels
}

/**
 * Element type for screenplay formatting
 */
type ElementType = "scene_heading" | "action" | "character" | "dialogue" | "parenthetical" | "transition";

interface ScreenplayElement {
    type: ElementType;
    content: string;
    rowIndex: number;
    columnName: string;  // Which CSV column this element came from
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
        >
            {/* Optional row number indicator */}
            {showRowNumbers && (
                <span className="absolute -left-12 text-xs text-base-content/30 font-mono">
                    {element.rowIndex + 1}
                </span>
            )}

            {/* Editing cursor indicator */}
            {isBeingEdited && (
                <div className="absolute -left-6 top-0 text-primary animate-pulse">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                </div>
            )}

            {/* "Editing from CSV" overlay indicator */}
            {isBeingEdited && !isEditingFromPrint && (
                <div className="absolute -top-5 left-0 text-xs text-primary/70 italic bg-base-100/90 px-2 py-0.5 rounded shadow-sm border border-primary/20">
                    (editing from CSV)
                </div>
            )}

            {/* Selection indicator */}
            {isSelected && !isEditingFromPrint && (
                <div className="absolute -left-6 top-0 text-secondary">
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
                        className="font-mono text-base leading-tight w-full bg-transparent border-none outline-none ring-2 ring-primary/40 ring-offset-2 ring-offset-white rounded px-2 py-1 resize-none overflow-hidden"
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
                    />
                ) : (
                    <input
                        ref={inputRef}
                        type="text"
                        className="font-mono text-base leading-tight w-full bg-transparent border-none outline-none ring-2 ring-primary/40 ring-offset-2 ring-offset-white rounded px-2 py-1"
                        style={style as React.CSSProperties}
                        value={editingValue}
                        onChange={(e) => onEditingValueChange(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                    />
                )
            ) : (
                <p
                    className={`font-mono text-base leading-tight ${isBeingEdited ? "ring-2 ring-primary/40 ring-offset-2 ring-offset-white rounded px-2 py-1" : ""} ${isSelected ? "ring-2 ring-secondary ring-offset-2 ring-offset-white rounded px-2 py-1" : ""} ${isCut ? "ring-2 ring-dashed ring-warning/50 ring-offset-2 ring-offset-white rounded px-2 py-1 opacity-60" : ""}`}
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
}: ScreenplayPrintProps) {
    const [containerRef, setContainerRef] = useState<HTMLDivElement | null>(null);
    const { editingCell, editingValue, setEditingCell, updateEditingValue, updateCell, clearEditingCell, clearSelection } = useCSVStore();
    const { printFollowsCsvEdit } = useSettingsStore();
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
    const marginBottom = recipe.documentSettings.marginBottom ?? 1;
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
        if (editingCell && containerRef && printFollowsCsvEdit) {
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
    }, [editingCell, headers, containerRef, printFollowsCsvEdit]);

    // Clear Print selection when editing cell from CSV grid changes
    useEffect(() => {
        if (editingCell && !isEditingFromPrint) {
            // Clear Print selection since user is editing from CSV grid
            setPrintSelection({ primary: null, additional: [] });
        }
    }, [editingCell, isEditingFromPrint]);

    // Clear Print selection when CSV cell is selected
    const { selectedCell, selectedRange } = useCSVStore();
    useEffect(() => {
        if ((selectedCell || selectedRange) && printSelection.primary && !isEditingFromPrint) {
            // User clicked in CSV grid, clear Print selection
            setPrintSelection({ primary: null, additional: [] });
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Missing isEditingFromPrint, printSelection dependencies. Adding these would create an infinite loop - the effect clears printSelection, which would trigger the effect again, clearing it again, etc. Alternative: Restructure logic to use a ref for tracking state or separate the concerns.
    }, [selectedCell, selectedRange]);

    // Clear Print selection when clicking anywhere in CSV grid area (including background)
    useEffect(() => {
        const handleDocumentClick = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            // Check if click is within CSV grid container
            const csvGrid = document.querySelector(".csv-grid-container");
            if (csvGrid && csvGrid.contains(target) && printSelection.primary && !isEditingFromPrint) {
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
                        useCSVStore.getState().updateCells(cellUpdates);
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
                        useCSVStore.getState().updateCells(clearUpdates);
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

                useCSVStore.getState().updateCells(clearUpdates);
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

        // Clear CSV selection so CSV grid doesn't compete for keyboard input
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

    // Transform CSV data into screenplay elements
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
                    <p className="text-xs">Make sure your CSV columns are mapped to screenplay elements</p>
                </div>
            </div>
        );
    }

    // Calculate page dimensions and transform
    // For right drawer, align left; for bottom drawer, center
    const transformOrigin = drawerPosition === "right" ? "top left" : "top center";

    const pageStyle = {
        width: `${pageWidth}in`,
        minHeight: `${pageHeight}in`,
        paddingTop: `${marginTop}in`,
        paddingBottom: `${marginBottom}in`,
        paddingLeft: `${marginLeft}in`,
        paddingRight: `${marginRight}in`,
        transform: `scale(${scale})`,
        transformOrigin,
        marginBottom: `${(1 - scale) * pageHeightPx}px`, // Adjust for scaled height
    };

    return (
        <div
            ref={(el) => {
                setContainerRef(el);
                if (printContainerRef.current !== el) {
                    (printContainerRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
                }
            }}
            className="screenplay-print-container w-full h-full overflow-scroll p-2 outline-none"
            tabIndex={0}
            onClick={(e) => {
                // Clear CSV selection when clicking anywhere in Print view
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
            {/* Force scrollbars to always be visible */}
            <style>{`
                .screenplay-print-container {
                    overflow: scroll !important;
                    scrollbar-width: thin; /* Firefox - always show */
                    -webkit-overflow-scrolling: touch;
                }

                /* Force scrollbar to always be visible in Webkit browsers */
                .screenplay-print-container::-webkit-scrollbar {
                    -webkit-appearance: none;
                    width: 14px;
                    height: 14px;
                }

                .screenplay-print-container::-webkit-scrollbar-track {
                    background: oklch(var(--b3));
                    border: 1px solid oklch(var(--bc) / 0.1);
                }

                .screenplay-print-container::-webkit-scrollbar-thumb {
                    background: oklch(var(--bc) / 0.4);
                    border-radius: 7px;
                    border: 2px solid oklch(var(--b3));
                    min-height: 30px;
                    min-width: 30px;
                }

                .screenplay-print-container::-webkit-scrollbar-thumb:hover {
                    background: oklch(var(--bc) / 0.6);
                }

                .screenplay-print-container::-webkit-scrollbar-thumb:active {
                    background: oklch(var(--bc) / 0.7);
                }

                .screenplay-print-container::-webkit-scrollbar-corner {
                    background: oklch(var(--b3));
                }
            `}</style>

            {/* Screenplay page */}
            <div
                className={`screenplay-page ${backgroundColor} text-grey-50 mb-8 relative ${drawerPosition === "bottom" ? "mx-auto" : ""}`}
                style={pageStyle}
            >
                {/* Page number (top right, only if enabled) */}
                {showPageNumbers && firstPageNumbered && (
                    <div
                        className="absolute right-10 text-sm font-mono"
                        style={{ top: `${pageNumberMarginTop}in` }}
                    >
                        {startPageNumber}.
                    </div>
                )}

                {/* Screenplay elements */}
                <div className="screenplay-content relative">
                    {elements.map((element, index) => {
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
                                key={index}
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
                                onClick={(e) => handleElementClick(e, element, index)}
                                onDoubleClick={() => handleElementDoubleClick(element, index)}
                                onContextMenu={(e) => handleElementContextMenu(e, element, index)}
                                setRef={setRef}
                            />
                        );
                    })}
                </div>
            </div>

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
