/**
 * Card Print Component
 *
 * Renders CSV data as draggable index cards, like a corkboard for planning.
 * Each CSV row becomes a card with Title, Subtitle, and Content.
 * Cards can be dragged to reorder them.
 */

import { useState, useEffect, useRef } from "react";
import type { PrintRecipe, RecipeConfiguration } from "@/types/printRecipe";
import { getMappedColumn, getMappedColumns } from "@/utils/printRecipeMapper";
import { useDrag } from "@/contexts/DragContext";
import { useCSVStore } from "@/stores/csvStore";

interface CardPrintProps {
    data: string[][];
    headers: string[];
    recipe: PrintRecipe;
    configuration: RecipeConfiguration;
    onReorder?: (fromIndex: number, toIndex: number) => void;
    drawerPosition?: "right" | "bottom";  // Drawer orientation
    containerWidth?: number;               // Available width in pixels
    containerHeight?: number;              // Available height in pixels
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
    setRef,
}: {
    card: CardData;
    onDragStart: (index: number) => void;
    onDragOver: (index: number) => void;
    onDrop: () => void;
    isDragging: boolean;
    editingCell: { row: number; col: number } | null;
    headers: string[];
    setRef?: (el: HTMLDivElement | null) => void;
}) {
    const [isHovered, setIsHovered] = useState(false);

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

    return (
        <div
            ref={setRef}
            draggable
            onDragStart={() => onDragStart(card.index)}
            onDragOver={(e) => {
                e.preventDefault();
                onDragOver(card.index);
            }}
            onDrop={onDrop}
            onDragEnd={onDrop}
            className={`
                bg-base-100 border-2 rounded-lg p-4 shadow-md
                cursor-move transition-all duration-200
                ${isDragging ? "opacity-50 scale-95" : ""}
                ${hasAnyEditing ? "border-primary ring-2 ring-primary ring-offset-2" : "border-base-300"}
                ${isHovered ? "shadow-xl border-primary" : ""}
                hover:shadow-xl hover:border-primary
            `}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            {/* Editing indicator icon */}
            {hasAnyEditing && (
                <div className="absolute top-2 left-2 text-primary animate-pulse">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                </div>
            )}

            {/* Card number badge */}
            <div className="absolute top-2 right-2">
                <span className="badge badge-sm badge-ghost">{card.index + 1}</span>
            </div>

            {/* Title */}
            {card.title && (
                <h3 className={`text-base font-bold text-base-content mb-2 pr-8 ${isTitleEditing ? "ring-2 ring-primary ring-offset-2 rounded px-1" : ""}`}>
                    {card.title}
                </h3>
            )}

            {/* Subtitle */}
            {card.subtitle && (
                <p className={`text-sm italic text-base-content/70 mb-3 ${isSubtitleEditing ? "ring-2 ring-primary ring-offset-2 rounded px-1" : ""}`}>
                    {card.subtitle}
                </p>
            )}

            {/* Content */}
            {card.content.length > 0 && (
                <div className="text-sm text-base-content/90 space-y-2">
                    {card.content.map((text, idx) => {
                        const isContentEditing = editingContentIndices.includes(idx);
                        return (
                            <p key={idx} className={`line-clamp-3 ${isContentEditing ? "ring-2 ring-primary ring-offset-2 rounded px-1" : ""}`}>
                                {text}
                            </p>
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
}: CardPrintProps) {
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
    const [hoverIndex, setHoverIndex] = useState<number | null>(null);
    const [containerRef, setContainerRef] = useState<HTMLDivElement | null>(null);
    const { isDragging: globalIsDragging } = useDrag();
    const { editingCell, editingValue } = useCSVStore();
    const cardRefs = useRef<Map<number, HTMLDivElement>>(new Map());

    // Get field mappings
    const titleColumn = getMappedColumn(configuration.fieldMappings, "title");
    const subtitleColumn = getMappedColumn(configuration.fieldMappings, "subtitle");
    const contentColumns = getMappedColumns(configuration.fieldMappings, "content");

    // Get render settings
    const cardWidth = configuration.renderSettings.cardWidth ?? recipe.renderSettings.cardWidth ?? 280;
    const cardHeight = configuration.renderSettings.cardHeight ?? recipe.renderSettings.cardHeight ?? 200;
    const cardSpacing = configuration.renderSettings.cardSpacing ?? recipe.renderSettings.cardSpacing ?? 16;

    // Calculate available space
    const availableWidth = containerWidth ?? containerRef?.clientWidth ?? 800;
    const availableHeight = containerHeight ?? containerRef?.clientHeight ?? 600;

    // Scroll to card when editing cell changes
    useEffect(() => {
        if (editingCell && containerRef) {
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
    }, [editingCell, containerRef]);

    // Helper to get cell value (either from data or editingValue if being edited)
    const getCellValue = (rowIndex: number, colIndex: number): string => {
        if (editingCell && editingCell.row === rowIndex && editingCell.col === colIndex) {
            return editingValue;
        }
        return data[rowIndex]?.[colIndex] || "";
    };

    // Transform CSV data into card data
    const cards: CardData[] = data.map((row, index) => {
        const titleIdx = titleColumn ? headers.indexOf(titleColumn) : -1;
        const subtitleIdx = subtitleColumn ? headers.indexOf(subtitleColumn) : -1;
        const contentIndices = contentColumns
            .map(col => headers.indexOf(col))
            .filter(idx => idx >= 0);

        return {
            index,
            title: titleIdx >= 0 ? getCellValue(index, titleIdx) : "",
            subtitle: subtitleIdx >= 0 ? getCellValue(index, subtitleIdx) : "",
            content: contentIndices.map(idx => getCellValue(index, idx)).filter(text => text && text.trim()),
            titleColumnName: titleColumn,
            subtitleColumnName: subtitleColumn,
            contentColumnNames: contentColumns,
        };
    });

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

    // Calculate grid layout
    const gridStyle = {
        display: "grid",
        gridTemplateColumns: `repeat(${columns}, ${cardWidth}px)`,
        gap: `${cardSpacing}px`,
        padding: `${cardSpacing}px`,
        justifyContent: drawerPosition === "right" ? "start" : "center",
        alignContent: drawerPosition === "bottom" ? "start" : "flex-start",
    };

    const cardStyle = {
        width: `${cardWidth}px`,
        minHeight: `${cardHeight}px`,
        position: "relative" as const,
    };

    // Show message if no data
    if (cards.length === 0) {
        return (
            <div className="flex items-center justify-center h-full text-base-content/50">
                <div className="text-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                    <p>No data to display</p>
                </div>
            </div>
        );
    }

    return (
        <div
            ref={setContainerRef}
            className="w-full h-full overflow-auto bg-black/30"
        >
            <div style={gridStyle}>
                {cards.map((card) => {
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
                                setRef={setRef}
                            />
                        </div>
                    );
                })}
            </div>

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
        </div>
    );
}

export default CardPrint;
