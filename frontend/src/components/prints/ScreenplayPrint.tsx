/**
 * Screenplay Print Component
 *
 * Renders CSV data in industry-standard screenplay format.
 * Follows Hollywood screenplay formatting rules with proper margins,
 * capitalization, and element positioning.
 */

import { useState, useEffect, useRef } from "react";
import type { PrintRecipe, RecipeConfiguration } from "@/types/printRecipe";
import { getMappedColumn } from "@/utils/printRecipeMapper";
import { useCSVStore } from "@/stores/csvStore";

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
 * Converts indent value (in pixels at 96dpi) to inches for rendering
 */
function pixelsToInches(pixels: number): number {
    return pixels / 96; // 96dpi is standard screen resolution
}

/**
 * Individual screenplay element renderer
 */
function ScreenplayElementView({
    element,
    marginLeft,
    showRowNumbers,
    isBeingEdited,
    isSelected,
    isEditingFromPrint,
    editingValue,
    onEditingValueChange,
    onClick,
    setRef,
}: {
    element: ScreenplayElement;
    marginLeft: number;
    showRowNumbers: boolean;
    isBeingEdited: boolean;
    isSelected: boolean;
    isEditingFromPrint: boolean;
    editingValue: string;
    onEditingValueChange: (value: string) => void;
    onClick: () => void;
    setRef?: (el: HTMLDivElement | null) => void;
}) {
    const ingredient = element.type;
    const inputRef = useRef<HTMLInputElement>(null);

    // Get styling based on element type
    let textAlign: "left" | "right" = "left";
    let indent = 0;
    let textTransform: "uppercase" | "none" = "none";
    let maxWidth = "100%";

    switch (element.type) {
        case "scene_heading":
            textTransform = "uppercase";
            break;
        case "action":
            // Standard left-aligned text
            break;
        case "character":
            textTransform = "uppercase";
            indent = pixelsToInches(148); // 3.7" from left edge = 2.2" from margin
            break;
        case "dialogue":
            indent = pixelsToInches(67); // 2.5" from left edge = 1" from margin
            maxWidth = "3.5in"; // Dialogue max width
            break;
        case "parenthetical":
            indent = pixelsToInches(107); // 3.1" from left edge = 1.6" from margin
            break;
        case "transition":
            textAlign = "right";
            textTransform = "uppercase";
            break;
    }

    const style = {
        marginLeft: indent > 0 ? `${indent}in` : undefined,
        textAlign,
        textTransform,
        maxWidth: textAlign === "left" ? maxWidth : undefined,
    };

    // Auto-focus input when editing starts from Print view
    useEffect(() => {
        if (isEditingFromPrint && inputRef.current) {
            inputRef.current.focus();
            // Place cursor at end of text
            inputRef.current.setSelectionRange(editingValue.length, editingValue.length);
        }
    }, [isEditingFromPrint, editingValue.length]);

    // Format content based on element type
    const formatContent = (content: string) => {
        if (element.type === "parenthetical") {
            return content.startsWith("(") ? content : `(${content})`;
        } else if (element.type === "transition") {
            return content.endsWith(":") ? content : `${content}:`;
        }
        return content;
    };

    return (
        <div
            ref={setRef}
            className={`screenplay-element mb-3 relative cursor-pointer ${isBeingEdited ? "editing-indicator" : ""} ${isSelected ? "selected-indicator" : ""}`}
            onClick={onClick}
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

            {/* Selection indicator */}
            {isSelected && !isEditingFromPrint && (
                <div className="absolute -left-6 top-0 text-secondary">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                </div>
            )}

            {isEditingFromPrint ? (
                <input
                    ref={inputRef}
                    type="text"
                    className="font-mono text-base leading-tight w-full bg-transparent border-none outline-none ring-2 ring-primary ring-offset-2 ring-offset-white rounded px-1"
                    style={style as React.CSSProperties}
                    value={editingValue}
                    onChange={(e) => onEditingValueChange(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                />
            ) : (
                <p
                    className={`font-mono text-base leading-tight ${isBeingEdited ? "ring-2 ring-primary ring-offset-2 ring-offset-white rounded px-1" : ""} ${isSelected ? "ring-2 ring-secondary ring-offset-2 ring-offset-white rounded px-1" : ""}`}
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
    const { editingCell, editingValue, setEditingCell, updateEditingValue, updateCell, clearEditingCell } = useCSVStore();
    const elementRefs = useRef<Map<string, HTMLDivElement>>(new Map());

    // State for Print view selection and editing
    const [selectedPrintElement, setSelectedPrintElement] = useState<SelectedPrintElement | null>(null);
    const [isEditingFromPrint, setIsEditingFromPrint] = useState(false);
    const printContainerRef = useRef<HTMLDivElement>(null);

    // Get field mappings
    const sceneHeadingColumn = getMappedColumn(configuration.fieldMappings, "scene_heading");
    const actionColumn = getMappedColumn(configuration.fieldMappings, "action");
    const characterColumn = getMappedColumn(configuration.fieldMappings, "character");
    const dialogueColumn = getMappedColumn(configuration.fieldMappings, "dialogue");
    const parentheticalColumn = getMappedColumn(configuration.fieldMappings, "parenthetical");
    const transitionColumn = getMappedColumn(configuration.fieldMappings, "transition");

    // Get render settings
    const pageWidth = configuration.renderSettings.pageWidth ?? recipe.renderSettings.pageWidth ?? 8.5;
    const pageHeight = configuration.renderSettings.pageHeight ?? recipe.renderSettings.pageHeight ?? 11;
    const marginTop = configuration.renderSettings.marginTop ?? recipe.renderSettings.marginTop ?? 1;
    const marginBottom = configuration.renderSettings.marginBottom ?? recipe.renderSettings.marginBottom ?? 1;
    const marginLeft = configuration.renderSettings.marginLeft ?? recipe.renderSettings.marginLeft ?? 1.5;
    const marginRight = configuration.renderSettings.marginRight ?? recipe.renderSettings.marginRight ?? 1;
    const showPageNumbers = configuration.renderSettings.showPageNumbers ?? recipe.renderSettings.showPageNumbers ?? true;

    // Calculate available space
    const availableWidth = containerWidth ?? containerRef?.clientWidth ?? 800;
    const availableHeight = containerHeight ?? containerRef?.clientHeight ?? 600;

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
        if (editingCell && containerRef) {
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
    }, [editingCell, headers, containerRef]);

    // Clear Print selection when editing cell from CSV grid changes
    useEffect(() => {
        if (editingCell && !isEditingFromPrint) {
            // Clear Print selection since user is editing from CSV grid
            setSelectedPrintElement(null);
        }
    }, [editingCell, isEditingFromPrint]);

    // Keyboard handlers for Print view
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Only handle if the Print container is focused or if we're not in any input
            const target = e.target as HTMLElement;
            const isInInput = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;

            // Handle F2 or Enter to start editing from Print view
            if ((e.key === "F2" || e.key === "Enter") && selectedPrintElement && !isEditingFromPrint && !isInInput) {
                e.preventDefault();
                startEditingFromPrint();
            }

            // Handle Enter or F2 to save editing from Print view
            if ((e.key === "Enter" || e.key === "F2") && isEditingFromPrint) {
                e.preventDefault();
                saveEditingFromPrint();
            }

            // Handle Escape to cancel editing
            if (e.key === "Escape") {
                if (isEditingFromPrint) {
                    e.preventDefault();
                    cancelEditingFromPrint();
                } else if (selectedPrintElement) {
                    e.preventDefault();
                    setSelectedPrintElement(null);
                }
            }

            // Arrow key navigation (when not editing)
            if (!isEditingFromPrint && selectedPrintElement && !isInInput) {
                // We'll implement arrow navigation later if needed
            }
        };

        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [selectedPrintElement, isEditingFromPrint]);

    // Start editing from Print view
    const startEditingFromPrint = () => {
        if (!selectedPrintElement) return;

        const colIndex = headers.indexOf(selectedPrintElement.columnName);
        if (colIndex === -1) return;

        const value = data[selectedPrintElement.rowIndex]?.[colIndex] || "";
        setEditingCell(selectedPrintElement.rowIndex, colIndex, value);
        setIsEditingFromPrint(true);
    };

    // Save editing from Print view
    const saveEditingFromPrint = () => {
        if (!editingCell) return;

        updateCell(editingCell.row, editingCell.col, editingValue);
        clearEditingCell();
        setIsEditingFromPrint(false);

        // Keep the element selected after editing
        // (selectedPrintElement remains unchanged)
    };

    // Cancel editing from Print view
    const cancelEditingFromPrint = () => {
        clearEditingCell();
        setIsEditingFromPrint(false);
    };

    // Handle clicking on a Print element
    const handleElementClick = (element: ScreenplayElement, elementIndex: number) => {
        setSelectedPrintElement({
            rowIndex: element.rowIndex,
            columnName: element.columnName,
            elementIndex,
        });

        // Focus the Print container so keyboard events work
        if (printContainerRef.current) {
            printContainerRef.current.focus();
        }
    };

    // Transform CSV data into screenplay elements
    // Use editingValue for real-time preview if a cell is being edited
    const elements: ScreenplayElement[] = [];

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
                elements.push({
                    type: "scene_heading",
                    content,
                    rowIndex,
                    columnName: headers[sceneHeadingIdx],
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
                printContainerRef.current = el;
            }}
            className="w-full h-full overflow-auto p-2 bg-black/20 outline-none"
            tabIndex={0}
        >
            {/* Screenplay page */}
            <div
                className={`screenplay-page text-grey-50 mb-8 relative ${drawerPosition === "bottom" ? "mx-auto" : ""}`}
                style={pageStyle}
            >
                {/* Page number (top right, only if enabled) */}
                {showPageNumbers && (
                    <div className="absolute top-2 right-8 text-sm font-mono">
                        1.
                    </div>
                )}

                {/* Screenplay elements */}
                <div className="screenplay-content relative">
                    {elements.map((element, index) => {
                        // Check if this element corresponds to the cell being edited
                        const isBeingEdited = editingCell !== null &&
                            editingCell.row === element.rowIndex &&
                            headers[editingCell.col] === element.columnName;

                        // Check if this element is selected
                        const isSelected = selectedPrintElement !== null &&
                            selectedPrintElement.rowIndex === element.rowIndex &&
                            selectedPrintElement.columnName === element.columnName;

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
                                marginLeft={marginLeft}
                                showRowNumbers={false}
                                isBeingEdited={isBeingEdited}
                                isSelected={isSelected}
                                isEditingFromPrint={isEditingThisFromPrint}
                                editingValue={editingValue}
                                onEditingValueChange={updateEditingValue}
                                onClick={() => handleElementClick(element, index)}
                                setRef={setRef}
                            />
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

export default ScreenplayPrint;
