/**
 * Card Print Component
 *
 * Renders Cell Data as draggable index cards, like a corkboard for planning.
 * Each Cell row becomes a card with Title, Subtitle, and Content.
 * Cards can be dragged to reorder them.
 */

import { useState, useEffect, useRef, memo } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { PrintRecipe, RecipeConfiguration } from "@/types/printRecipe";
import { getMappedColumn, getMappedColumns } from "@/utils/printRecipeMapper";
import { useCellStore } from "@stores/cellStore";
import { useCellSelectionStore } from "@stores/cellSelectionStore";
import { useCellEditStore } from "@stores/cellEditStore";
import { logger } from "@utils/logger";
import { usePrintSelectionSync } from "@/hooks/usePrintSelectionSync";

interface CardPrintProps {
    data: string[][];
    headers: string[];
    recipe: PrintRecipe;
    configuration: RecipeConfiguration;
    onReorder?: (fromIndex: number, toIndex: number) => void;
    drawerPosition?: "right" | "bottom";  // Drawer orientation
    containerWidth?: number;               // Available width in pixels
    containerHeight?: number;              // Available height in pixels
    followCell?: boolean;                  // If false, won't scroll when Cell is edited (default: true)
    onLoadingChange?: (isLoading: boolean) => void;  // Callback for loading state changes
}

interface CardData {
    index: number;
    title: string;
    subtitle: string;
    content: string[];
    titleColumnName?: string;
    subtitleColumnName?: string;
    contentColumnNames: string[];
}

/**
 * Represents a selected card field for editing
 */
interface SelectedCardField {
    cardIndex: number;
    fieldType: "title" | "subtitle" | "content";
    contentIndex?: number;  // For content fields only
    columnName: string;
}

/**
 * Individual card component with drag-and-drop support
 */
function Card({
    card,
    onDragStart,
    onDragOver,
    onDrop,
    isDragging,
    editingCell,
    headers,
    selectedField,
    isEditingFromPrint,
    editingValue,
    onEditingValueChange,
    onFieldClick,
    onFieldDoubleClick,
    onFieldContextMenu,
    setRef,
}: {
    card: CardData;
    onDragStart: (index: number) => void;
    onDragOver: (index: number) => void;
    onDrop: () => void;
    isDragging: boolean;
    editingCell: { row: number; col: number } | null;
    headers: string[];
    selectedField: SelectedCardField | null;
    isEditingFromPrint: boolean;
    editingValue: string;
    onEditingValueChange: (value: string) => void;
    onFieldClick: (fieldType: "title" | "subtitle" | "content", contentIndex?: number) => void;
    onFieldDoubleClick: (fieldType: "title" | "subtitle" | "content", contentIndex?: number) => void;
    onFieldContextMenu: (e: React.MouseEvent, fieldType: "title" | "subtitle" | "content", contentIndex?: number) => void;
    setRef?: (el: HTMLDivElement | null) => void;
}) {
    const [isHovered, setIsHovered] = useState(false);
    const [hoveredField, setHoveredField] = useState<{ type: "title" | "subtitle" | "content"; index?: number } | null>(null);
    const titleInputRef = useRef<HTMLInputElement>(null);
    const subtitleInputRef = useRef<HTMLInputElement>(null);
    const contentTextareaRefs = useRef<Map<number, HTMLTextAreaElement>>(new Map());

    // Check which fields are being edited
    const isTitleEditing = editingCell !== null &&
        editingCell.row === card.index &&
        card.titleColumnName &&
        headers[editingCell.col] === card.titleColumnName;

    const isSubtitleEditing = editingCell !== null &&
        editingCell.row === card.index &&
        card.subtitleColumnName &&
        headers[editingCell.col] === card.subtitleColumnName;

    const editingContentIndices = card.contentColumnNames
        .map((colName, idx) => ({
            idx,
            isEditing: editingCell !== null &&
                editingCell.row === card.index &&
                headers[editingCell.col] === colName
        }))
        .filter(item => item.isEditing)
        .map(item => item.idx);

    const hasAnyEditing = isTitleEditing || isSubtitleEditing || editingContentIndices.length > 0;

    // Check which fields are selected
    const isTitleSelected = selectedField !== null &&
        selectedField.cardIndex === card.index &&
        selectedField.fieldType === "title";

    const isSubtitleSelected = selectedField !== null &&
        selectedField.cardIndex === card.index &&
        selectedField.fieldType === "subtitle";

    // Check which fields are being edited from Print view
    const isTitleEditingFromPrint = isEditingFromPrint &&
        editingCell !== null &&
        editingCell.row === card.index &&
        card.titleColumnName &&
        headers[editingCell.col] === card.titleColumnName;

    const isSubtitleEditingFromPrint = isEditingFromPrint &&
        editingCell !== null &&
        editingCell.row === card.index &&
        card.subtitleColumnName &&
        headers[editingCell.col] === card.subtitleColumnName;

    // Auto-focus inputs/textareas when editing starts from Print view
    useEffect(() => {
        if (isTitleEditingFromPrint && titleInputRef.current) {
            titleInputRef.current.focus();
            titleInputRef.current.setSelectionRange(editingValue.length, editingValue.length);
        }
    // Disabled: editingValue.length dependency removed
    // Reason: Including editingValue.length causes cursor to reset on every keystroke
    // Alternative: Only run when editing starts (isTitleEditingFromPrint changes)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isTitleEditingFromPrint]);

    useEffect(() => {
        if (isSubtitleEditingFromPrint && subtitleInputRef.current) {
            subtitleInputRef.current.focus();
            subtitleInputRef.current.setSelectionRange(editingValue.length, editingValue.length);
        }
    // Disabled: editingValue.length dependency removed
    // Reason: Including editingValue.length causes cursor to reset on every keystroke
    // Alternative: Only run when editing starts (isSubtitleEditingFromPrint changes)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isSubtitleEditingFromPrint]);

    // Auto-resize content textareas when editing
    useEffect(() => {
        if (isEditingFromPrint && selectedField?.fieldType === "content" && selectedField.contentIndex !== undefined) {
            const textarea = contentTextareaRefs.current.get(selectedField.contentIndex);
            if (textarea) {
                textarea.focus();
                textarea.setSelectionRange(editingValue.length, editingValue.length);
                // Auto-resize textarea to fit initial content
                textarea.style.height = "auto";
                textarea.style.height = `${textarea.scrollHeight}px`;
            }
        }
    // Disabled: editingValue.length dependency removed
    // Reason: Including editingValue.length causes cursor to reset on every keystroke
    // Alternative: Only run when editing starts (isEditingFromPrint/selectedField changes)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isEditingFromPrint, selectedField]);

    const hasAnySelection = isTitleSelected || isSubtitleSelected ||
        (selectedField?.cardIndex === card.index && selectedField?.fieldType === "content");

    return (
        <div
            ref={setRef}
            draggable={!isEditingFromPrint}
            onMouseDown={(e) => {
                // Only allow left-click to initiate drag
                if (e.button !== 0) {
                    e.preventDefault();
                    return;
                }
            }}
            onDragStart={(e) => {
                // Only allow left-click drag (button 0)
                if (e.button && e.button !== 0) {
                    e.preventDefault();
                    return;
                }
                if (!isEditingFromPrint) {
                    onDragStart(card.index);
                }
            }}
            onDragOver={(e) => {
                e.preventDefault();
                if (!isEditingFromPrint) {
                    onDragOver(card.index);
                }
            }}
            onDrop={onDrop}
            onDragEnd={onDrop}
            className={`
                bg-base-100 border-2 rounded-lg p-4 shadow-md
                ${!isEditingFromPrint ? "cursor-move" : ""}
                transition-all duration-200
                ${isDragging ? "opacity-50 scale-95" : ""}
                ${hasAnyEditing ? "border-primary" : hasAnySelection ? "border-base-300" : "border-base-300"}
                ${isHovered && !hasAnyEditing && !hasAnySelection ? "shadow-lg border-base-content/20" : ""}
                ${!isEditingFromPrint ? "hover:shadow-lg hover:border-base-content/20" : ""}
            `}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => { setIsHovered(false); setHoveredField(null); }}
        >
            {/* Editing indicator icon */}
            {hasAnyEditing && (
                <div className="absolute top-2 left-2 text-primary animate-pulse">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                </div>
            )}

            {/* "Editing from Cell" overlay indicator */}
            {hasAnyEditing && !isEditingFromPrint && (
                <div className="absolute -top-6 left-4 text-xs text-primary/70 italic bg-base-100/90 px-2 py-0.5 rounded shadow-sm border border-primary/20">
                    (editing from Cell)
                </div>
            )}

            {/* Card number badge */}
            <div className="absolute top-2 right-2">
                <span className="badge badge-sm badge-ghost">{card.index + 1}</span>
            </div>

            {/* Title */}
            {(card.title || isTitleSelected || isTitleEditingFromPrint) && (
                <div
                    onClick={(e) => { e.stopPropagation(); onFieldClick("title"); }}
                    onDoubleClick={(e) => { e.stopPropagation(); onFieldDoubleClick("title"); }}
                    onContextMenu={(e) => { e.stopPropagation(); onFieldContextMenu(e, "title"); }}
                    onMouseEnter={() => setHoveredField({ type: "title" })}
                    onMouseLeave={() => setHoveredField(null)}
                    className="cursor-text relative -mx-4 px-4"
                >
                    {/* Full-width hover background */}
                    {hoveredField?.type === "title" && !isTitleEditing && !isTitleSelected && (
                        <div className="absolute bg-base-200/70 rounded pointer-events-none transition-colors" style={{ inset: "0 0.5rem" }} />
                    )}

                    {isTitleEditingFromPrint ? (
                        <input
                            ref={titleInputRef}
                            type="text"
                            className="text-base font-bold text-base-content mb-2 pr-8 w-full bg-transparent border-none outline-none ring-2 ring-primary ring-inset rounded px-2 py-1 relative z-10"
                            value={editingValue}
                            onChange={(e) => onEditingValueChange(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            onMouseEnter={() => setHoveredField(null)}
                        />
                    ) : (
                        <h3 className={`text-base font-bold text-base-content mb-2 pr-8 rounded px-2 py-1 transition-colors relative z-10 ${isTitleEditing ? "ring-2 ring-primary ring-inset bg-primary/10" : isTitleSelected ? "bg-primary/20" : ""}`}>
                            {card.title || <span className="text-base-content/30 italic">Click to add title</span>}
                        </h3>
                    )}
                </div>
            )}

            {/* Subtitle */}
            {(card.subtitle || isSubtitleSelected || isSubtitleEditingFromPrint) && (
                <div
                    onClick={(e) => { e.stopPropagation(); onFieldClick("subtitle"); }}
                    onDoubleClick={(e) => { e.stopPropagation(); onFieldDoubleClick("subtitle"); }}
                    onContextMenu={(e) => { e.stopPropagation(); onFieldContextMenu(e, "subtitle"); }}
                    onMouseEnter={() => setHoveredField({ type: "subtitle" })}
                    onMouseLeave={() => setHoveredField(null)}
                    className="cursor-text relative -mx-4 px-4"
                >
                    {/* Full-width hover background */}
                    {hoveredField?.type === "subtitle" && !isSubtitleEditing && !isSubtitleSelected && (
                        <div className="absolute bg-base-200/70 rounded pointer-events-none transition-colors" style={{ inset: "0 0.5rem" }} />
                    )}

                    {isSubtitleEditingFromPrint ? (
                        <input
                            ref={subtitleInputRef}
                            type="text"
                            className="text-sm italic text-base-content/70 mb-3 w-full bg-transparent border-none outline-none ring-2 ring-primary ring-inset rounded px-2 py-1 relative z-10"
                            value={editingValue}
                            onChange={(e) => onEditingValueChange(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            onMouseEnter={() => setHoveredField(null)}
                        />
                    ) : (
                        <p className={`text-sm italic text-base-content/70 mb-3 rounded px-2 py-1 transition-colors relative z-10 ${isSubtitleEditing ? "ring-2 ring-primary ring-inset bg-primary/10" : isSubtitleSelected ? "bg-primary/20" : ""}`}>
                            {card.subtitle || <span className="text-base-content/30">Click to add subtitle</span>}
                        </p>
                    )}
                </div>
            )}

            {/* Content */}
            {card.content.length > 0 && (
                <div className="text-sm text-base-content/90 space-y-2">
                    {card.content.map((text, idx) => {
                        const isContentEditing = editingContentIndices.includes(idx);
                        const isContentSelected = selectedField !== null &&
                            selectedField.cardIndex === card.index &&
                            selectedField.fieldType === "content" &&
                            selectedField.contentIndex === idx;
                        const isContentEditingFromPrint = isEditingFromPrint &&
                            editingCell !== null &&
                            editingCell.row === card.index &&
                            headers[editingCell.col] === card.contentColumnNames[idx];

                        return (
                            <div
                                key={idx}
                                onClick={(e) => { e.stopPropagation(); onFieldClick("content", idx); }}
                                onDoubleClick={(e) => { e.stopPropagation(); onFieldDoubleClick("content", idx); }}
                                onContextMenu={(e) => { e.stopPropagation(); onFieldContextMenu(e, "content", idx); }}
                                onMouseEnter={() => setHoveredField({ type: "content", index: idx })}
                                onMouseLeave={() => setHoveredField(null)}
                                className="cursor-text relative -mx-4 px-4"
                            >
                                {/* Full-width hover background */}
                                {hoveredField?.type === "content" && hoveredField?.index === idx && !isContentEditing && !isContentSelected && (
                                    <div className="absolute bg-base-200/70 rounded pointer-events-none transition-colors" style={{ inset: "0 0.5rem" }} />
                                )}

                                {isContentEditingFromPrint ? (
                                    <textarea
                                        ref={(el) => {
                                            if (el) {
                                                contentTextareaRefs.current.set(idx, el);
                                            }
                                        }}
                                        className="w-full bg-transparent border-none outline-none ring-2 ring-primary ring-inset rounded px-2 py-1 resize-none overflow-hidden relative z-10"
                                        style={{
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
                                        onMouseEnter={() => setHoveredField(null)}
                                    />
                                ) : (
                                    <p className={`line-clamp-3 rounded px-2 py-1 transition-colors relative z-10 ${isContentEditing ? "ring-2 ring-primary ring-inset bg-primary/10" : isContentSelected ? "bg-primary/20" : ""}`}>
                                        {text}
                                    </p>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Drag handle indicator */}
            <div className="absolute bottom-2 left-2 opacity-30">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                </svg>
            </div>
        </div>
    );
}

/**
 * Card Print Renderer
 */
function CardPrint({
    data,
    headers,
    recipe,
    configuration,
    onReorder,
    drawerPosition = "right",
    containerWidth,
    containerHeight,
    followCell = true,
    onLoadingChange,
}: CardPrintProps) {
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
    const [hoverIndex, setHoverIndex] = useState<number | null>(null);
    const [containerRef, setContainerRef] = useState<HTMLDivElement | null>(null);

    // Use selectors to only subscribe to needed values - prevents re-renders on unrelated store changes
    // Editing state from cellEditStore
    const editingCell = useCellEditStore(state => state.editingCell);
    const editingValue = useCellEditStore(state => state.editingValue);
    const setEditingCell = useCellEditStore(state => state.setEditingCell);
    const updateEditingValue = useCellEditStore(state => state.updateEditingValue);
    const clearEditingCell = useCellEditStore(state => state.clearEditingCell);
    // Data mutation from cellStore
    const updateCell = useCellStore(state => state.updateCell);
    // Selection from cellSelectionStore
    const clearSelection = useCellSelectionStore(state => state.clearSelection);

    const cardRefs = useRef<Map<number, HTMLDivElement>>(new Map());

    // State for Print view selection and editing
    const [selectedField, setSelectedField] = useState<SelectedCardField | null>(null);
    const [isEditingFromPrint, setIsEditingFromPrint] = useState(false);
    const printContainerRef = useRef<HTMLDivElement>(null);

    // Context menu state
    const [contextMenu, setContextMenu] = useState<{
        x: number;
        y: number;
        cardIndex: number;
        fieldType: "title" | "subtitle" | "content";
        contentIndex?: number;
        columnName: string;
    } | null>(null);

    // Shared print-selection sync effects (clear on grid edit/select, context menu close, click-outside-to-save)
    usePrintSelectionSync({
        hasPrintSelection: selectedField !== null,
        clearPrintSelection: () => setSelectedField(null),
        isEditingFromPrint,
        setIsEditingFromPrint,
        contextMenu,
        closeContextMenu: () => setContextMenu(null),
    });

    // Worker state for background calculations
    const [isCalculating, setIsCalculating] = useState(false);
    const [cards, setCards] = useState<CardData[]>([]);
    const workerRef = useRef<Worker | null>(null);

    // Get field mappings
    const titleColumn = getMappedColumn(configuration.fieldMappings, "title");
    const subtitleColumn = getMappedColumn(configuration.fieldMappings, "subtitle");
    const contentColumns = getMappedColumns(configuration.fieldMappings, "content");

    // Get render settings
    const cardWidth = configuration.renderSettings.cardWidth ?? recipe.documentSettings.cardWidth ?? 280;
    const cardHeight = configuration.renderSettings.cardHeight ?? recipe.documentSettings.cardHeight ?? 200;
    const cardSpacing = configuration.renderSettings.cardSpacing ?? recipe.documentSettings.cardSpacing ?? 16;

    // Calculate available space
    const availableWidth = containerWidth ?? containerRef?.clientWidth ?? 800;
    const availableHeight = containerHeight ?? containerRef?.clientHeight ?? 600;

    // Scroll to card when editing cell changes
    useEffect(() => {
        if (editingCell && containerRef && followCell) {
            // Find the card that contains the editing cell
            const card = cardRefs.current.get(editingCell.row);

            if (card) {
                // Scroll to the card smoothly and center it
                card.scrollIntoView({
                    behavior: "smooth",
                    block: "center",
                    inline: "center",
                });
            }
        }
    }, [editingCell, containerRef, followCell]);

    // Keyboard handlers for Print view
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement;
            const isInInput = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;

            // Handle F2 or Enter to start editing from Print view
            if ((e.key === "F2" || e.key === "Enter") && selectedField && !isEditingFromPrint && !isInInput) {
                e.preventDefault();
                // Start editing from Print view
                const colIndex = headers.indexOf(selectedField.columnName);
                if (colIndex === -1) return;

                const value = data[selectedField.cardIndex]?.[colIndex] || "";
                setEditingCell(selectedField.cardIndex, colIndex, value, "print");
                setIsEditingFromPrint(true);
            }

            // Handle Enter or F2 to save editing from Print view
            // For multi-line fields (content), Ctrl+Enter creates newlines; Enter or F2 saves
            if (isEditingFromPrint && editingCell) {
                const isMultiLine = selectedField?.fieldType === "content";

                // Allow Ctrl+Enter to create newlines in multi-line fields
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

            // Handle Escape to cancel editing
            if (e.key === "Escape") {
                if (isEditingFromPrint) {
                    e.preventDefault();
                    clearEditingCell();
                    setIsEditingFromPrint(false);
                } else if (selectedField) {
                    e.preventDefault();
                    setSelectedField(null);
                }
            }
        };

        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [selectedField, isEditingFromPrint, headers, data, editingCell, editingValue, setEditingCell, updateCell, clearEditingCell]);

    // Handle clicking on a card field
    const handleFieldClick = (cardIndex: number, fieldType: "title" | "subtitle" | "content", contentIndex?: number) => {
        let columnName: string | undefined;

        if (fieldType === "title") {
            columnName = titleColumn ?? undefined;
        } else if (fieldType === "subtitle") {
            columnName = subtitleColumn ?? undefined;
        } else if (fieldType === "content" && contentIndex !== undefined) {
            columnName = contentColumns[contentIndex];
        }

        if (!columnName) return;

        setSelectedField({
            cardIndex,
            fieldType,
            contentIndex: fieldType === "content" ? contentIndex : undefined,
            columnName,
        });

        // Clear Cell selection so Cell Grid doesn't compete for keyboard input
        clearSelection();

        // Focus the Print container so keyboard events work
        if (printContainerRef.current) {
            printContainerRef.current.focus();
        }
    };

    // Handle double-clicking on a card field to start editing
    const handleFieldDoubleClick = (cardIndex: number, fieldType: "title" | "subtitle" | "content", contentIndex?: number) => {
        let columnName: string | undefined;

        if (fieldType === "title") {
            columnName = titleColumn ?? undefined;
        } else if (fieldType === "subtitle") {
            columnName = subtitleColumn ?? undefined;
        } else if (fieldType === "content" && contentIndex !== undefined) {
            columnName = contentColumns[contentIndex];
        }

        if (!columnName) return;

        // Set selected field
        setSelectedField({
            cardIndex,
            fieldType,
            contentIndex: fieldType === "content" ? contentIndex : undefined,
            columnName,
        });

        // Start editing immediately
        const colIndex = headers.indexOf(columnName);
        if (colIndex === -1) return;

        const value = data[cardIndex]?.[colIndex] || "";
        setEditingCell(cardIndex, colIndex, value, "print");
        setIsEditingFromPrint(true);
    };

    // Handle right-clicking on a card field to show context menu
    const handleFieldContextMenu = (e: React.MouseEvent, cardIndex: number, fieldType: "title" | "subtitle" | "content", contentIndex?: number) => {
        e.preventDefault();
        e.stopPropagation();

        let columnName: string | undefined;

        if (fieldType === "title") {
            columnName = titleColumn ?? undefined;
        } else if (fieldType === "subtitle") {
            columnName = subtitleColumn ?? undefined;
        } else if (fieldType === "content" && contentIndex !== undefined) {
            columnName = contentColumns[contentIndex];
        }

        if (!columnName) return;

        setContextMenu({
            x: e.clientX,
            y: e.clientY,
            cardIndex,
            fieldType,
            contentIndex,
            columnName,
        });

        // Also select the field
        setSelectedField({
            cardIndex,
            fieldType,
            contentIndex: fieldType === "content" ? contentIndex : undefined,
            columnName,
        });
    };

    // Notify parent of loading state changes
    useEffect(() => {
        onLoadingChange?.(isCalculating);
    }, [isCalculating, onLoadingChange]);

    // Use web worker for expensive calculations
    // PERFORMANCE: Offload to background thread to keep UI responsive with large files
    useEffect(() => {
        // Clean up previous worker if it exists
        if (workerRef.current) {
            workerRef.current.terminate();
        }

        setIsCalculating(true);

        // Create new worker
        const worker = new Worker(new URL("@/utils/cardPrint.worker.ts", import.meta.url), {
            type: "module",
        });
        workerRef.current = worker;

        // Listen for results
        worker.addEventListener("message", (e) => {
            const message = e.data;
            if (message.type === "result") {
                setCards(message.cards);
                setIsCalculating(false);
            } else if (message.type === "error") {
                logger.error("CardPrint worker error:", message.message);
                setCards([]);
                setIsCalculating(false);
            }
        });

        // Send calculation request
        worker.postMessage({
            type: "calculate",
            data,
            headers,
            configuration,
            editingCell,
            editingValue,
        });

        // Cleanup on unmount
        return () => {
            worker.terminate();
        };
    }, [data, headers, configuration, editingCell, editingValue]);

    // Calculate how many cards fit based on drawer orientation
    let columns: number;
    let rows: number;

    if (drawerPosition === "right") {
        // Vertical drawer: maximize columns, let rows grow
        columns = Math.floor((availableWidth - cardSpacing) / (cardWidth + cardSpacing));
        columns = Math.max(1, columns); // At least 1 column
        rows = Math.ceil(cards.length / columns);
    } else {
        // Horizontal drawer: maximize rows, let columns grow
        rows = Math.floor((availableHeight - cardSpacing) / (cardHeight + cardSpacing));
        rows = Math.max(1, rows); // At least 1 row
        columns = Math.ceil(cards.length / rows);
    }

    // Handle drag and drop
    const handleDragStart = (index: number) => {
        setDraggedIndex(index);
    };

    const handleDragOver = (index: number) => {
        setHoverIndex(index);
    };

    const handleDrop = () => {
        if (draggedIndex !== null && hoverIndex !== null && draggedIndex !== hoverIndex) {
            onReorder?.(draggedIndex, hoverIndex);
        }
        setDraggedIndex(null);
        setHoverIndex(null);
    };

    // ===== CARD VIRTUALIZATION =====
    /**
     * Performance optimization: Virtualize cards in grid layout
     * For large files (50k+ rows = 50k+ cards), rendering all at once blocks UI
     * We virtualize by rows (each row contains `columns` cards)
     */
    const rowCount = Math.ceil(cards.length / columns);
    const rowHeight = cardHeight + cardSpacing;

    const cardVirtualizer = useVirtualizer({
        count: rowCount,
        getScrollElement: () => printContainerRef.current,
        estimateSize: () => rowHeight,
        overscan: 2, // Pre-render 2 rows above/below
    });

    const virtualRows = cardVirtualizer.getVirtualItems();
    const totalSize = cardVirtualizer.getTotalSize();

    const cardStyle = {
        width: `${cardWidth}px`,
        minHeight: `${cardHeight}px`,
        position: "relative" as const,
    };

    return (
        <div
            ref={(el) => {
                setContainerRef(el);
                if (printContainerRef.current !== el) {
                    (printContainerRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
                }
            }}
            className="card-print-container w-full h-full overflow-auto bg-black/30 outline-none"
            tabIndex={0}
            onClick={(e) => {
                // Clear Cell selection when clicking anywhere in Print view
                // Only if we didn't click on a card (which handles its own selection)
                const target = e.target as HTMLElement;
                if (!target.closest(".bg-base-100")) {  // Cards have bg-base-100
                    clearSelection();
                    // Focus the Print container
                    if (printContainerRef.current) {
                        printContainerRef.current.focus();
                    }
                }
            }}
        >
            {/* Show empty state if no cards */}
            {cards.length === 0 ? (
                /* Show empty state if no cards */
                <div className="flex items-center justify-center h-full text-base-content/50">
                    <div className="text-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                        <p>No data to display</p>
                    </div>
                </div>
            ) : (
                /* Virtualized container */
                <div
                    style={{
                        height: `${totalSize + (cardSpacing * 2)}px`,
                        width: "100%",
                        position: "relative",
                        padding: `${cardSpacing}px`,
                    }}
                >
                    {/* Render only visible rows */}
                    {virtualRows.map((virtualRow) => {
                    const startCardIndex = virtualRow.index * columns;
                    const endCardIndex = Math.min(startCardIndex + columns, cards.length);
                    const rowCards = cards.slice(startCardIndex, endCardIndex);

                    return (
                        <div
                            key={virtualRow.key}
                            data-index={virtualRow.index}
                            style={{
                                position: "absolute",
                                top: 0,
                                left: 0,
                                width: "100%",
                                transform: `translateY(${virtualRow.start}px)`,
                                display: "grid",
                                gridTemplateColumns: `repeat(${columns}, ${cardWidth}px)`,
                                gap: `${cardSpacing}px`,
                                justifyContent: drawerPosition === "right" ? "start" : "center",
                            }}
                        >
                            {rowCards.map((card) => {
                                // Create ref callback to store card ref
                                const setRef = (el: HTMLDivElement | null) => {
                                    if (el) {
                                        cardRefs.current.set(card.index, el);
                                    } else {
                                        cardRefs.current.delete(card.index);
                                    }
                                };

                                return (
                                    <div key={card.index} style={cardStyle}>
                                        <Card
                                            card={card}
                                            onDragStart={handleDragStart}
                                            onDragOver={handleDragOver}
                                            onDrop={handleDrop}
                                            isDragging={draggedIndex === card.index}
                                            editingCell={editingCell}
                                            headers={headers}
                                            selectedField={selectedField}
                                            isEditingFromPrint={isEditingFromPrint}
                                            editingValue={editingValue}
                                            onEditingValueChange={updateEditingValue}
                                            onFieldClick={(fieldType, contentIndex) => handleFieldClick(card.index, fieldType, contentIndex)}
                                            onFieldDoubleClick={(fieldType, contentIndex) => handleFieldDoubleClick(card.index, fieldType, contentIndex)}
                                            onFieldContextMenu={(e, fieldType, contentIndex) => handleFieldContextMenu(e, card.index, fieldType, contentIndex)}
                                            setRef={setRef}
                                        />
                                    </div>
                                );
                            })}
                        </div>
                    );
                })}
                </div>
            )}

            {/* Instructions */}
            {cards.length > 1 && (
                <div className="fixed bottom-4 right-4 bg-base-100 border border-base-300 rounded-lg p-3 shadow-lg text-xs opacity-80">
                    <p className="flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Drag cards to reorder them
                    </p>
                </div>
            )}

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
                                    const value = data[contextMenu.cardIndex]?.[colIndex] || "";
                                    setEditingCell(contextMenu.cardIndex, colIndex, value, "print");
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
                                    const value = data[contextMenu.cardIndex]?.[colIndex] || "";
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
                                        updateCell(contextMenu.cardIndex, colIndex, text);
                                        setContextMenu(null);
                                    } catch (err: unknown) {
                                        logger.error("Failed to paste:", err);
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

// Memoize to prevent re-renders when only selectedCell changes (not data/editingCell/etc)
// PERFORMANCE: Prevents expensive reconciliation of thousands of cards on every cell selection
export default memo(CardPrint);
