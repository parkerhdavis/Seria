/**
 * Screenplay Print Component
 *
 * Renders Cell Data in industry-standard screenplay format.
 * Follows Hollywood screenplay formatting rules with proper margins,
 * capitalization, and element positioning.
 */

import { useState, useEffect, useRef, memo } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { PrintRecipe, RecipeConfiguration } from "@/types/printRecipe";
import type {
  ScreenplayElement,
  ScreenplayElementType,
} from "@/types/workerMessages";
import { useCellStore } from "@stores/cellStore";
import { useCellSelectionStore } from "@stores/cellSelectionStore";
import { useCellEditStore } from "@stores/cellEditStore";
import { useFindReplaceStore } from "@stores/findReplaceStore";
import { writeText, readText } from "@tauri-apps/plugin-clipboard-manager";
import { logger } from "@utils/logger";
import { toast } from "@stores/toastStore";
import { getElementStyle, isMultiLineElement } from "@utils/screenplayUtils";
import { usePrintSelectionSync } from "@/hooks/usePrintSelectionSync";

interface ScreenplayPrintProps {
  data: string[][];
  headers: string[];
  recipe: PrintRecipe;
  configuration: RecipeConfiguration;
  drawerPosition?: "right" | "bottom"; // Drawer orientation
  containerWidth?: number; // Available width in pixels
  containerHeight?: number; // Available height in pixels
  continuous?: boolean; // If true, renders as single continuous page; if false, renders with page breaks (default: true)
  followCell?: boolean; // If false, won't scroll when Cell is edited (default: true)
  onLoadingChange?: (isLoading: boolean) => void; // Callback for loading state changes
}

/**
 * Represents a selected Print element for editing
 */
interface SelectedPrintElement {
  rowIndex: number;
  columnName: string;
  elementIndex: number; // Index in the elements array for navigation
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
 * Individual screenplay element renderer
 */
/**
 * Highlights search term matches within text content.
 * Splits text into alternating non-match and match segments rendered as spans.
 *
 * @param text - The text content to search within
 * @param searchTerm - The term to highlight
 * @param matchCase - Whether to perform case-sensitive matching
 * @param isCurrentMatch - Whether this element contains the current active match
 * @returns React nodes with highlighted spans, or the original text if no matches
 */
function highlightSearchText(
  text: string,
  searchTerm: string,
  matchCase: boolean,
  isCurrentMatch: boolean,
): React.ReactNode {
  if (!searchTerm || !text) return text;

  const flags = matchCase ? "g" : "gi";
  const escapedTerm = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  let regex: RegExp;
  try {
    regex = new RegExp(escapedTerm, flags);
  } catch {
    return text;
  }

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let matchIndex = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    parts.push(
      <mark
        key={matchIndex}
        className={`${isCurrentMatch && matchIndex === 0 ? "bg-warning/80 text-warning-content" : "bg-warning/40"} rounded-sm px-0`}
      >
        {match[0]}
      </mark>,
    );
    lastIndex = match.index + match[0].length;
    matchIndex++;
    if (match[0].length === 0) break; // prevent infinite loop on zero-length match
  }

  if (parts.length === 0) return text;
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return <>{parts}</>;
}

/**
 * Cursor placement strategy when editing begins.
 * - "end": place cursor at end of text
 * - "start": place cursor at start of text (for new elements)
 * - { charOffset: number }: place cursor at a specific character position
 */
type CursorPlacement = "start" | "end" | { charOffset: number };

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
  onContextMenu,
  cursorPlacement = "end",
  onNavigateUp,
  onNavigateDown,
  setRef,
  searchTerm,
  searchMatchCase,
  isCurrentSearchMatch,
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
  onContextMenu: (e: React.MouseEvent) => void;
  cursorPlacement?: CursorPlacement;
  /** Called when cursor is at the top edge and user presses ArrowUp.
   *  Passes the column offset (chars from start of current visual line). */
  onNavigateUp?: (columnOffset: number) => void;
  /** Called when cursor is at the bottom edge and user presses ArrowDown.
   *  Passes the column offset (chars from start of current visual line). */
  onNavigateDown?: (columnOffset: number) => void;
  setRef?: (el: HTMLDivElement | null) => void;
  searchTerm?: string;
  searchMatchCase?: boolean;
  isCurrentSearchMatch?: boolean;
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
  // xMargin is applied on top of page margin (measured from page margin edge)
  const textAlign = elementConfig.textAlign || "left";
  const xMargin = elementConfig.xMargin ?? 0;

  const style = {
    fontFamily: elementConfig.fontFamily || "Courier, monospace",
    marginLeft: textAlign === "left" ? `${xMargin}in` : undefined,
    marginRight: textAlign === "right" ? `${xMargin}in` : undefined,
    textAlign: textAlign,
    textTransform: elementConfig.textTransform || "none",
    fontWeight: elementConfig.fontWeight || 400,
    fontSize: elementConfig.fontSize
      ? `${elementConfig.fontSize}pt`
      : undefined,
    lineHeight: elementConfig.lineHeight ?? 1.25, // Default to 1.25 if not specified
    maxWidth:
      textAlign !== "right"
        ? ("maxWidth" in elementConfig
            ? (elementConfig as { maxWidth?: string }).maxWidth
            : undefined) || "100%"
        : undefined,
    marginTop: elementConfig.spaceBeforeElement
      ? `${elementConfig.spaceBeforeElement}em`
      : undefined,
    marginBottom: elementConfig.spaceAfterElement
      ? `${elementConfig.spaceAfterElement}em`
      : undefined,
  };

  // Auto-focus input/textarea when editing starts from Print view
  useEffect(() => {
    if (isEditingFromPrint) {
      const setPosition = (
        el: HTMLInputElement | HTMLTextAreaElement,
      ) => {
        el.focus();
        if (cursorPlacement === "start") {
          el.setSelectionRange(0, 0);
        } else if (cursorPlacement === "end") {
          el.setSelectionRange(el.value.length, el.value.length);
        } else if (typeof cursorPlacement === "object") {
          // Place cursor at a specific character offset, clamped to valid range
          const pos = Math.min(cursorPlacement.charOffset, el.value.length);
          el.setSelectionRange(pos, pos);
        }
      };

      if (isMultiLine && textareaRef.current) {
        setPosition(textareaRef.current);
      } else if (!isMultiLine && inputRef.current) {
        setPosition(inputRef.current);
      }
    }
    // Disabled: editingValue.length and cursorPlacement dependencies removed
    // Reason: Including editingValue.length causes cursor to reset on every keystroke
    // cursorPlacement only matters at the moment editing starts
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditingFromPrint, isMultiLine]);

  /**
   * Get the column offset of the cursor within its current visual line.
   * For monospace fonts, this is the number of characters from the start
   * of the current line to the cursor position.
   */
  const getColumnOffset = (
    el: HTMLInputElement | HTMLTextAreaElement,
    pos: number,
  ): number => {
    const text = el.value;
    // Find the start of the current line by searching backwards for \n
    let lineStart = text.lastIndexOf("\n", pos - 1);
    lineStart = lineStart === -1 ? 0 : lineStart + 1;
    return pos - lineStart;
  };

  /**
   * Handle arrow key navigation at element boundaries, and left/right
   * navigation between adjacent elements.
   *
   * For Up/Down: We let the browser handle the keypress first, then check
   * in a microtask whether the cursor actually moved. If it didn't, the
   * cursor was on the first/last visual line (including soft-wrapped lines),
   * so we navigate to the adjacent element. Passes the column offset so
   * the target element can place the cursor at a similar horizontal position.
   *
   * For Left/Right: We check immediately if at position 0 (left) or at the
   * end (right) and navigate to the adjacent element.
   */
  const handleInputKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    if (e.shiftKey) return; // Don't intercept text selection

    const inputEl = e.currentTarget;
    const cursorPos = inputEl.selectionStart ?? 0;
    const selEnd = inputEl.selectionEnd ?? 0;
    const hasSelection = cursorPos !== selEnd;

    // ArrowLeft at position 0: navigate to end of previous element
    if (e.key === "ArrowLeft" && !hasSelection && cursorPos === 0) {
      if (onNavigateUp) {
        e.preventDefault();
        // Pass a large column offset so cursor goes to end of previous element's last line
        onNavigateUp(Infinity);
      }
      return;
    }

    // ArrowRight at end of text: navigate to start of next element
    if (
      e.key === "ArrowRight" &&
      !hasSelection &&
      cursorPos === inputEl.value.length
    ) {
      if (onNavigateDown) {
        e.preventDefault();
        onNavigateDown(0);
      }
      return;
    }

    if (hasSelection) return; // Don't navigate up/down if text is selected

    // For single-line inputs, ArrowUp/Down always navigate between elements
    if (inputEl instanceof HTMLInputElement) {
      if (e.key === "ArrowUp" && onNavigateUp) {
        e.preventDefault();
        onNavigateUp(getColumnOffset(inputEl, cursorPos));
      }
      if (e.key === "ArrowDown" && onNavigateDown) {
        e.preventDefault();
        onNavigateDown(getColumnOffset(inputEl, cursorPos));
      }
      return;
    }

    // For textareas: let the browser handle the arrow key, then check if
    // the cursor hit a boundary. Two cases indicate a boundary:
    // 1. Cursor didn't move at all (already at very start/end)
    // 2. Cursor moved to start (pos 0) on ArrowUp, or to end (text length)
    //    on ArrowDown -- this happens on soft-wrapped lines when the cursor
    //    is on the first/last visual line but not at position 0/end; the
    //    browser "moves" it to the boundary instead of up/down a line.
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      const posBeforeKey = cursorPos;
      const colOffset = getColumnOffset(inputEl, cursorPos);
      const direction = e.key;
      const textLength = inputEl.value.length;

      // Let the browser process the arrow key first
      requestAnimationFrame(() => {
        const posAfterKey = inputEl.selectionStart ?? 0;
        const selEndAfter = inputEl.selectionEnd ?? 0;
        if (posAfterKey !== selEndAfter) return; // Selection created, skip

        const didntMove = posAfterKey === posBeforeKey;
        // Browser moved cursor to absolute start/end -- means it couldn't
        // go up/down a visual line and snapped to the boundary instead.
        const snappedToStart =
          direction === "ArrowUp" && posAfterKey === 0 && posBeforeKey !== 0;
        const snappedToEnd =
          direction === "ArrowDown" &&
          posAfterKey === textLength &&
          posBeforeKey !== textLength;

        if (didntMove || snappedToStart || snappedToEnd) {
          if (direction === "ArrowUp" && onNavigateUp) {
            onNavigateUp(colOffset);
          } else if (direction === "ArrowDown" && onNavigateDown) {
            onNavigateDown(colOffset);
          }
        }
      });
      // Don't preventDefault -- let the textarea handle the arrow key naturally
    }
  };

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
      className="screenplay-element relative cursor-text"
      onClick={onClick}
      onContextMenu={onContextMenu}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Full-width background bar for hover, cut, and editing-from-cell states.
          Suppress hover highlight when element is selected or being edited from print. */}
      {(isCut || (isBeingEdited && !isEditingFromPrint) || (isHovered && !isSelected && !isEditingFromPrint)) && (
        <div
          className={`absolute rounded pointer-events-none transition-colors ${
            isCut
              ? "bg-warning/15"
              : isBeingEdited
                ? "bg-primary/10"
                : "bg-base-200/70"
          }`}
          style={{
            left: "calc(-1 * var(--page-padding-left, 1.5in) + 0.25in)",
            right: "calc(-1 * var(--page-padding-right, 1in) + 0.25in)",
            top: "-0.25rem",
            bottom: "-0.25rem",
          }}
        />
      )}

      {/* Left and right edge lines for selected/editing-from-print elements */}
      {(isSelected || isEditingFromPrint) && (
        <>
          <div
            className="absolute pointer-events-none z-30"
            style={{
              left: 0,
              width: "4px",
              top: 0,
              bottom: 0,
              backgroundColor: "#8b5cf6",
              borderRadius: "2px",
            }}
          />
          <div
            className="absolute pointer-events-none z-30"
            style={{
              right: 0,
              width: "4px",
              top: 0,
              bottom: 0,
              backgroundColor: "#8b5cf6",
              borderRadius: "2px",
            }}
          />
        </>
      )}

      {/* Optional row number indicator */}
      {showRowNumbers && (
        <span className="absolute -left-12 text-xs text-base-content/30 font-mono z-10">
          {element.rowIndex + 1}
        </span>
      )}

      {/* "Editing from Cell" overlay indicator */}
      {isBeingEdited && !isEditingFromPrint && (
        <div className="absolute -top-5 left-0 text-xs text-primary/70 italic bg-base-100/90 px-2 py-0.5 rounded shadow-sm border border-primary/20 z-10">
          (editing from Cell)
        </div>
      )}

      {/* Scene numbers (left and right margins for scene headings) */}
      {showSceneNumbers &&
        element.type === "scene_heading" &&
        element.sceneNumber && (
          <>
            {/* Left scene number */}
            <div
              className="absolute bottom-0 text-sm font-mono text-base-content font-bold"
              style={{ left: "0.5in" }}
            >
              {element.sceneNumber}.
            </div>
            {/* Right scene number */}
            <div
              className="absolute bottom-0 text-sm font-mono text-base-content font-bold"
              style={{ right: "0.5in" }}
            >
              {element.sceneNumber}.
            </div>
          </>
        )}

      {/* Always render the <p> for stable layout (prevents text shift) */}
      <p
        className={`font-mono text-base rounded transition-colors relative z-10 ${isCut ? "opacity-60" : ""}`}
        style={{
          ...(style as React.CSSProperties),
          visibility: isEditingFromPrint ? "hidden" : undefined,
        }}
      >
        {isEditingFromPrint
          ? (editingValue || "\u00A0") /* Keep height stable with non-breaking space when empty */
          : searchTerm
            ? highlightSearchText(
                formatContent(element.content),
                searchTerm,
                !!searchMatchCase,
                !!isCurrentSearchMatch,
              )
            : formatContent(element.content)}
      </p>

      {/* Overlay the form element on top when editing.
          Strip vertical margins — the <p> handles vertical spacing between
          elements; the overlay must not duplicate it. Keep horizontal margins
          since those are the screenplay indentation. */}
      {isEditingFromPrint && (() => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { marginTop: _mt, marginBottom: _mb, ...overlayStyle } = style;
        return isMultiLine ? (
          <textarea
            ref={textareaRef}
            className="font-mono text-base w-full bg-transparent border-0 outline-none resize-none overflow-hidden absolute z-20 p-0 m-0"
            style={{
              ...(overlayStyle as React.CSSProperties),
              top: 0,
              left: 0,
              height: "100%",
              caretColor: "white",
            }}
            value={editingValue}
            onChange={(e) => {
              onEditingValueChange(e.target.value);
            }}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={handleInputKeyDown}
            onMouseEnter={() => setIsHovered(false)}
          />
        ) : (
          <input
            ref={inputRef}
            type="text"
            className="font-mono text-base w-full bg-transparent border-0 outline-none absolute z-20 p-0 m-0"
            style={{
              ...(overlayStyle as React.CSSProperties),
              top: 0,
              left: 0,
              height: "100%",
              caretColor: "white",
            }}
            value={editingValue}
            onChange={(e) => onEditingValueChange(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={handleInputKeyDown}
            onMouseEnter={() => setIsHovered(false)}
          />
        );
      })()}
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
  onLoadingChange,
}: ScreenplayPrintProps) {
  const [containerRef, setContainerRef] = useState<HTMLDivElement | null>(null);

  // Use selectors to only subscribe to needed values - prevents re-renders on unrelated store changes
  // Editing state from cellEditStore
  const editingCell = useCellEditStore((state) => state.editingCell);
  const editingValue = useCellEditStore((state) => state.editingValue);
  const setEditingCell = useCellEditStore((state) => state.setEditingCell);
  const updateEditingValue = useCellEditStore(
    (state) => state.updateEditingValue,
  );
  const editingSource = useCellEditStore((state) => state.editingSource);
  const clearEditingCell = useCellEditStore((state) => state.clearEditingCell);
  // Data mutation from cellStore
  const updateCell = useCellStore((state) => state.updateCell);
  const updateCells = useCellStore((state) => state.updateCells);
  const addRow = useCellStore((state) => state.addRow);
  const deleteRows = useCellStore((state) => state.deleteRows);
  // Selection from cellSelectionStore
  const clearSelection = useCellSelectionStore((state) => state.clearSelection);
  // Find/Replace for print view search highlighting
  const searchTerm = useFindReplaceStore((state) => state.searchTerm);
  const searchOptions = useFindReplaceStore((state) => state.searchOptions);
  const matches = useFindReplaceStore((state) => state.matches);
  const currentMatchIndex = useFindReplaceStore(
    (state) => state.currentMatchIndex,
  );

  const elementRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // State for Print view selection and editing
  const [printSelection, setPrintSelection] = useState<PrintSelection>({
    primary: null,
    additional: [],
  });
  const [isEditingFromPrint, setIsEditingFromPrint] = useState(false);
  const [cutElements, setCutElements] = useState<SelectedPrintElement[]>([]);
  const printContainerRef = useRef<HTMLDivElement>(null);

  // Cursor placement strategy for the active editing element
  const [cursorPlacement, setCursorPlacement] = useState<CursorPlacement>("end");

  // Pending edit: when Enter creates a new row, the worker must recalculate
  // before the new element exists. This stores the target to edit once elements update.
  const pendingEditRef = useRef<{
    rowIndex: number;
    columnName: string;
  } | null>(null);

  // Worker state for background calculations
  const [isCalculating, setIsCalculating] = useState(false);
  const [elements, setElements] = useState<ScreenplayElement[]>([]);
  const [pages, setPages] = useState<
    { elements: ScreenplayElement[]; pageNumber: number }[]
  >([]);
  const workerRef = useRef<Worker | null>(null);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    rowIndex: number;
    columnName: string;
    elementIndex: number;
  } | null>(null);

  // Shared print-selection sync effects (clear on grid edit/select, context menu close, click-outside-to-save)
  usePrintSelectionSync({
    hasPrintSelection: printSelection.primary !== null,
    clearPrintSelection: () =>
      setPrintSelection({ primary: null, additional: [] }),
    isEditingFromPrint,
    setIsEditingFromPrint,
    contextMenu,
    closeContextMenu: () => setContextMenu(null),
  });

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
  const showPageNumbers = (recipe.documentSettings.showPageNumbers ??
    true) as boolean;
  const startPageNumber = (recipe.documentSettings.startPageNumber ??
    1) as number;
  const pageNumberMarginTop = (recipe.documentSettings.pageNumberMarginTop ??
    0.5) as number;
  const firstPageNumbered = (recipe.documentSettings.firstPageNumbered ??
    true) as boolean;
  const sceneNumbering = (recipe.documentSettings.sceneNumbering ??
    false) as boolean;

  // Calculate available space
  // No container padding - using full width/height
  const availableWidth = containerWidth ?? containerRef?.clientWidth ?? 800;
  const availableHeight = containerHeight ?? containerRef?.clientHeight ?? 600;

  // Calculate zoom scale to fit page width in available space
  // Page width is in inches, convert to pixels at 96dpi
  const pageWidthPx = pageWidth * 102; // NOTE: Manually edited this to taste
  const maxScaleWidth = availableWidth / pageWidthPx;

  // Also consider height if needed
  const pageHeightPx = pageHeight * 96;
  const maxScaleHeight = availableHeight / pageHeightPx;

  // For right drawer: always scale to fill width
  // For bottom drawer: scale to fit both dimensions (use smaller scale)
  const scale =
    drawerPosition === "right"
      ? maxScaleWidth // Always fill width when on the right
      : Math.min(maxScaleWidth, maxScaleHeight); // Fit both dimensions when on bottom

  // Scroll to element when a cell is edited from the cellular editor
  // (only when Follow Cell is active). Edits originating from within the
  // screenplay editor itself should never auto-scroll.
  useEffect(() => {
    if (editingCell && containerRef && followCell && editingSource === "cell") {
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
  }, [editingCell, headers, containerRef, followCell, editingSource]);

  // Resolve pending edits after worker recalculates elements
  // When Enter creates a new row, the element doesn't exist yet until the worker finishes.
  // This effect picks up the pending target and starts editing once the element appears.
  useEffect(() => {
    const pending = pendingEditRef.current;
    if (!pending) return;

    // Find the element matching the pending edit target
    const targetIndex = elements.findIndex(
      (el) =>
        el.rowIndex === pending.rowIndex &&
        el.columnName === pending.columnName,
    );

    if (targetIndex !== -1) {
      const targetElement = elements[targetIndex];
      pendingEditRef.current = null;

      const colIndex = headers.indexOf(targetElement.columnName);
      if (colIndex === -1) return;

      setPrintSelection({
        primary: {
          rowIndex: targetElement.rowIndex,
          columnName: targetElement.columnName,
          elementIndex: targetIndex,
        },
        additional: [],
      });

      setEditingCell(targetElement.rowIndex, colIndex, "", "print");
      setIsEditingFromPrint(true);
      setCursorPlacement("start");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elements]);

  // ===== SCREENPLAY FORMAT FLOW HELPERS =====

  /**
   * Determines the next element type when Enter is pressed,
   * following screenplay writing conventions.
   */
  const getNextElementType = (
    currentType: ScreenplayElementType,
  ): ScreenplayElementType => {
    switch (currentType) {
      case "scene_heading":
        return "action";
      case "action":
        return "action";
      case "character":
        return "dialogue";
      case "dialogue":
        return "action";
      case "parenthetical":
        return "dialogue";
      case "transition":
        return "scene_heading";
      default:
        return "action";
    }
  };

  /**
   * Tab cycling order for changing element type on empty/new elements.
   */
  const cycleElementType = (
    currentType: ScreenplayElementType,
    reverse: boolean = false,
  ): ScreenplayElementType => {
    const cycle: ScreenplayElementType[] = [
      "action",
      "character",
      "scene_heading",
      "transition",
      "parenthetical",
      "dialogue",
    ];
    const currentIndex = cycle.indexOf(currentType);
    if (currentIndex === -1) return "action";
    const nextIndex = reverse
      ? (currentIndex - 1 + cycle.length) % cycle.length
      : (currentIndex + 1) % cycle.length;
    return cycle[nextIndex];
  };

  /**
   * Get the column name for a given element type from the current configuration.
   */
  const getColumnForType = (
    type: ScreenplayElementType,
  ): string | null => {
    const mappings = configuration.fieldMappings;
    const mapping = mappings.find((m) => m.ingredientId === type);
    return mapping?.cellColumn ?? null;
  };

  /**
   * Start editing a specific element, setting up all the required state.
    * @param placement - Where to place the cursor: "start", "end", or { charOffset }
   */
  const startEditingElement = (
    element: ScreenplayElement,
    elementIndex: number,
    initialValue?: string,
    placement: CursorPlacement = "end",
  ) => {
    const colIndex = headers.indexOf(element.columnName);
    if (colIndex === -1) return;

    setCursorPlacement(placement);

    setPrintSelection({
      primary: {
        rowIndex: element.rowIndex,
        columnName: element.columnName,
        elementIndex,
      },
      additional: [],
    });

    const value =
      initialValue !== undefined
        ? initialValue
        : (data[element.rowIndex]?.[colIndex] || "");
    setEditingCell(element.rowIndex, colIndex, value, "print");
    setIsEditingFromPrint(true);
  };

  /**
   * Save the current editing state and commit changes to the cell store.
   */
  const commitCurrentEdit = () => {
    if (isEditingFromPrint && editingCell) {
      updateCell(editingCell.row, editingCell.col, editingValue);
      clearEditingCell();
      setIsEditingFromPrint(false);
    }
  };

  /**
   * Given a text value, find the character position at the given column offset
   * on the last line (for ArrowUp navigation into previous element).
   */
  const getPositionOnLastLine = (
    text: string,
    columnOffset: number,
  ): number => {
    const lastNewline = text.lastIndexOf("\n");
    const lastLineStart = lastNewline === -1 ? 0 : lastNewline + 1;
    const lastLineLength = text.length - lastLineStart;
    return lastLineStart + Math.min(columnOffset, lastLineLength);
  };

  /**
   * Given a text value, find the character position at the given column offset
   * on the first line (for ArrowDown navigation into next element).
   */
  const getPositionOnFirstLine = (
    text: string,
    columnOffset: number,
  ): number => {
    const firstNewline = text.indexOf("\n");
    const firstLineLength =
      firstNewline === -1 ? text.length : firstNewline;
    return Math.min(columnOffset, firstLineLength);
  };

  /**
   * Navigate to the previous element (called from ScreenplayElementView when
   * ArrowUp or ArrowLeft is pressed at the top boundary of the current element).
   * @param columnOffset - horizontal cursor position to preserve
   */
  const handleNavigateUp = (
    elementIndex: number,
    columnOffset: number,
  ) => {
    if (elementIndex <= 0) return;
    if (!editingCell) return;

    // Save current edit
    updateCell(editingCell.row, editingCell.col, editingValue);
    clearEditingCell();
    setIsEditingFromPrint(false);

    const prevElement = elements[elementIndex - 1];
    if (prevElement) {
      const prevColIndex = headers.indexOf(prevElement.columnName);
      if (prevColIndex === -1) return;
      const prevValue = data[prevElement.rowIndex]?.[prevColIndex] || "";
      const charPos = getPositionOnLastLine(prevValue, columnOffset);

      startEditingElement(
        prevElement,
        elementIndex - 1,
        undefined,
        { charOffset: charPos },
      );
    }
  };

  /**
   * Navigate to the next element (called from ScreenplayElementView when
   * ArrowDown or ArrowRight is pressed at the bottom boundary of the current element).
   * @param columnOffset - horizontal cursor position to preserve
   */
  const handleNavigateDown = (
    elementIndex: number,
    columnOffset: number,
  ) => {
    if (elementIndex >= elements.length - 1) return;
    if (!editingCell) return;

    // Save current edit
    updateCell(editingCell.row, editingCell.col, editingValue);
    clearEditingCell();
    setIsEditingFromPrint(false);

    const nextElement = elements[elementIndex + 1];
    if (nextElement) {
      const nextColIndex = headers.indexOf(nextElement.columnName);
      if (nextColIndex === -1) return;
      const nextValue = data[nextElement.rowIndex]?.[nextColIndex] || "";
      const charPos = getPositionOnFirstLine(nextValue, columnOffset);

      startEditingElement(
        nextElement,
        elementIndex + 1,
        undefined,
        { charOffset: charPos },
      );
    }
  };

  // Keyboard handlers for Print view
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      // Only handle if the Print container is focused or if we're not in any input/textarea
      const target = e.target as HTMLElement;
      const isInInput =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement;

      // Only handle input events that are within the screenplay print container
      if (isInInput) {
        const isInPrintContainer =
          printContainerRef.current?.contains(target) ?? false;
        if (!isInPrintContainer) return;
      }

      // Get all selected elements (primary + additional)
      const allSelectedElements = printSelection.primary
        ? [printSelection.primary, ...printSelection.additional]
        : [];
      const hasSelection = allSelectedElements.length > 0;

      // Handle Copy (Ctrl+C) -- works in both editing and selection modes
      if (
        e.key === "c" &&
        e.ctrlKey &&
        !e.shiftKey &&
        !e.altKey &&
        hasSelection &&
        !isInInput
      ) {
        e.preventDefault();
        setCutElements([]);

        const copiedValues = allSelectedElements.map((sel) => {
          const colIndex = headers.indexOf(sel.columnName);
          if (colIndex === -1) return "";
          return data[sel.rowIndex]?.[colIndex] || "";
        });

        try {
          await writeText(copiedValues.join("\n"));
        } catch (err: unknown) {
          logger.error("Failed to copy to system clipboard:", err);
          toast.error("Failed to copy to clipboard");
        }
        return;
      }

      // Handle Cut (Ctrl+X)
      if (
        e.key === "x" &&
        e.ctrlKey &&
        !e.shiftKey &&
        !e.altKey &&
        hasSelection &&
        !isInInput
      ) {
        e.preventDefault();

        const copiedValues = allSelectedElements.map((sel) => {
          const colIndex = headers.indexOf(sel.columnName);
          if (colIndex === -1) return "";
          return data[sel.rowIndex]?.[colIndex] || "";
        });

        try {
          await writeText(copiedValues.join("\n"));
          setCutElements([...allSelectedElements]);
        } catch (err: unknown) {
          logger.error("Failed to cut to system clipboard:", err);
          toast.error("Failed to cut to clipboard");
        }
        return;
      }

      // Handle Paste (Ctrl+V) -- only when not editing (editing input handles its own paste)
      if (
        e.key === "v" &&
        e.ctrlKey &&
        !e.shiftKey &&
        !e.altKey &&
        printSelection.primary &&
        !isInInput
      ) {
        e.preventDefault();

        try {
          const text = await readText();
          if (!text) return;

          const values = text.split("\n").filter((v) => v !== "");
          const startElementIndex = printSelection.primary.elementIndex;

          const cellUpdates: Array<{
            row: number;
            col: number;
            value: string;
          }> = [];

          for (let i = 0; i < values.length; i++) {
            const targetElement = elements[startElementIndex + i];
            if (!targetElement) break;

            const colIndex = headers.indexOf(targetElement.columnName);
            if (colIndex === -1) continue;

            cellUpdates.push({
              row: targetElement.rowIndex,
              col: colIndex,
              value: values[i],
            });
          }

          if (cellUpdates.length > 0) {
            useCellStore.getState().updateCells(cellUpdates);
          }

          if (cutElements.length > 0) {
            const clearUpdates = cutElements.map((sel) => {
              const colIndex = headers.indexOf(sel.columnName);
              return {
                row: sel.rowIndex,
                col: colIndex,
                value: "",
              };
            });
            useCellStore.getState().updateCells(clearUpdates);
            setCutElements([]);
          }
        } catch (err: unknown) {
          logger.error("Failed to paste from system clipboard:", err);
          toast.error("Failed to paste from clipboard");
        }
        return;
      }

      // ===== EDITING MODE KEYS =====
      if (isEditingFromPrint && editingCell) {
        const primary = printSelection.primary;
        if (!primary) return;

        const currentElement = elements.find(
          (el) =>
            el.rowIndex === primary.rowIndex &&
            el.columnName === primary.columnName,
        );
        const currentType = currentElement?.type || "action";
        const currentIsMultiLine = isMultiLineElement(currentType);

        // Ctrl+Enter: newline in multi-line elements
        if (e.key === "Enter" && currentIsMultiLine && e.ctrlKey) {
          return; // Let the textarea handle it naturally
        }

        // Enter: save current element and create new element below
        if (e.key === "Enter" && !e.ctrlKey) {
          e.preventDefault();

          // Save current edit
          updateCell(editingCell.row, editingCell.col, editingValue);
          clearEditingCell();
          setIsEditingFromPrint(false);

          // Determine next element type per screenplay conventions
          const nextType = getNextElementType(currentType);
          const nextColumnName = getColumnForType(nextType);
          if (!nextColumnName) return;

          // Insert new row after the current element's row
          const newRowIndex = primary.rowIndex + 1;
          addRow(newRowIndex);

          // Store the pending edit target -- the new element doesn't exist yet
          // because the worker hasn't recalculated. The pendingEditRef effect
          // will pick this up once elements are updated.
          pendingEditRef.current = {
            rowIndex: newRowIndex,
            columnName: nextColumnName,
          };

          return;
        }

        // Tab: cycle element type (only on empty/new elements)
        if (e.key === "Tab") {
          e.preventDefault();

          const nextType = cycleElementType(currentType, e.shiftKey);
          const nextColumnName = getColumnForType(nextType);
          if (!nextColumnName) return;

          const currentContent = editingValue;

          // Clear the current cell
          updateCell(editingCell.row, editingCell.col, "");

          // Move content to the new column
          const nextColIndex = headers.indexOf(nextColumnName);
          if (nextColIndex === -1) return;

          // Set the content in the new column
          updateCell(editingCell.row, nextColIndex, currentContent);

          // Start editing the new column
          setCursorPlacement("end");
          setEditingCell(editingCell.row, nextColIndex, currentContent, "print");
          setIsEditingFromPrint(true);

          // Update selection to match new column
          setPrintSelection({
            primary: {
              rowIndex: editingCell.row,
              columnName: nextColumnName,
              elementIndex: primary.elementIndex,
            },
            additional: [],
          });

          return;
        }

        // Escape: cancel editing (discard changes)
        if (e.key === "Escape") {
          e.preventDefault();
          clearEditingCell();
          setIsEditingFromPrint(false);
          // Keep the element selected but not editing
          return;
        }

        // Arrow keys while editing are handled by ScreenplayElementView's onKeyDown
        // via onNavigateUp/onNavigateDown callbacks. No document-level handling needed.

        // Backspace on empty element: delete the element and its row if empty
        if (e.key === "Backspace" && editingValue === "" && isInInput) {
          e.preventDefault();

          const rowIndex = editingCell.row;
          const row = data[rowIndex];

          // Check if the entire row is empty (all cells blank)
          const isRowEmpty = row?.every((cell) => cell === "");

          // Clear editing state first
          clearEditingCell();
          setIsEditingFromPrint(false);

          if (isRowEmpty && data.length > 1) {
            // Delete the entire row
            deleteRows([rowIndex]);

            // Move to the end of the previous element
            if (primary.elementIndex > 0) {
              // We need to find the element that will be at the previous position
              // after the row is deleted. Elements will be recalculated,
              // so we find the previous element by looking at elements before deletion
              const prevElement = elements[primary.elementIndex - 1];
              if (prevElement) {
                // Adjust row index if the previous element was below the deleted row
                const adjustedRowIndex =
                  prevElement.rowIndex >= rowIndex
                    ? prevElement.rowIndex - 1
                    : prevElement.rowIndex;
                const prevColIndex = headers.indexOf(prevElement.columnName);
                if (prevColIndex === -1) return;
                const prevValue =
                  data[adjustedRowIndex]?.[prevColIndex] || "";

                setEditingCell(adjustedRowIndex, prevColIndex, prevValue, "print");
                setIsEditingFromPrint(true);
                setPrintSelection({
                  primary: {
                    rowIndex: adjustedRowIndex,
                    columnName: prevElement.columnName,
                    elementIndex: primary.elementIndex - 1,
                  },
                  additional: [],
                });
              }
            } else {
              // No previous element, just clear selection
              setPrintSelection({ primary: null, additional: [] });
            }
          } else if (!isRowEmpty) {
            // Just clear the current cell (not the whole row)
            updateCell(rowIndex, editingCell.col, "");

            // Move to end of previous element
            if (primary.elementIndex > 0) {
              const prevElement = elements[primary.elementIndex - 1];
              if (prevElement) {
                const prevColIndex = headers.indexOf(prevElement.columnName);
                if (prevColIndex === -1) return;
                const prevValue =
                  data[prevElement.rowIndex]?.[prevColIndex] || "";

                startEditingElement(
                  prevElement,
                  primary.elementIndex - 1,
                  prevValue,
                );
              }
            } else {
              setPrintSelection({ primary: null, additional: [] });
            }
          }
          return;
        }

        // All other keys while editing: let the input/textarea handle them
        return;
      }

      // ===== NON-EDITING MODE KEYS =====

      // Delete/Backspace to clear selected elements (non-editing mode)
      if (
        (e.key === "Delete" || e.key === "Backspace") &&
        hasSelection &&
        !isInInput
      ) {
        e.preventDefault();

        const clearUpdates = allSelectedElements.map((sel) => {
          const colIndex = headers.indexOf(sel.columnName);
          return {
            row: sel.rowIndex,
            col: colIndex,
            value: "",
          };
        });

        useCellStore.getState().updateCells(clearUpdates);
        return;
      }

      // Type-to-overwrite: if a printable character is typed, start editing with that character
      if (printSelection.primary && !isEditingFromPrint && !isInInput) {
        const isPrintableChar =
          e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey;

        if (isPrintableChar) {
          e.preventDefault();
          const colIndex = headers.indexOf(printSelection.primary.columnName);
          if (colIndex === -1) return;

          setCursorPlacement("end");
          setEditingCell(
            printSelection.primary.rowIndex,
            colIndex,
            e.key,
            "print",
          );
          setIsEditingFromPrint(true);
          return;
        }
      }

      // Arrow key navigation (non-editing mode)
      if (printSelection.primary && !isEditingFromPrint && !isInInput) {
        if (e.key === "ArrowUp" || e.key === "ArrowDown") {
          e.preventDefault();
          const currentIndex = printSelection.primary.elementIndex;
          const newIndex =
            e.key === "ArrowUp" ? currentIndex - 1 : currentIndex + 1;

          if (newIndex >= 0 && newIndex < elements.length) {
            const newElement = elements[newIndex];
            const newSelection: SelectedPrintElement = {
              rowIndex: newElement.rowIndex,
              columnName: newElement.columnName,
              elementIndex: newIndex,
            };

            if (e.shiftKey) {
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
              setPrintSelection({
                primary: newSelection,
                additional: [],
              });
            }

          }
          return;
        }
      }

      // F2 or Enter to start editing from selection (non-editing mode)
      if (
        (e.key === "F2" || e.key === "Enter") &&
        printSelection.primary &&
        !isEditingFromPrint &&
        !isInInput
      ) {
        e.preventDefault();
        const colIndex = headers.indexOf(printSelection.primary.columnName);
        if (colIndex === -1) return;

        const value = data[printSelection.primary.rowIndex]?.[colIndex] || "";
        setCursorPlacement("end");
        setEditingCell(
          printSelection.primary.rowIndex,
          colIndex,
          value,
          "print",
        );
        setIsEditingFromPrint(true);
        return;
      }

      // Escape: clear selection (non-editing mode)
      if (e.key === "Escape" && hasSelection && !isInInput) {
        e.preventDefault();
        setPrintSelection({ primary: null, additional: [] });
        setCutElements([]);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    printSelection,
    isEditingFromPrint,
    headers,
    data,
    editingCell,
    editingValue,
    setEditingCell,
    updateCell,
    updateCells,
    addRow,
    deleteRows,
    clearEditingCell,
    cutElements,
    configuration,
  ]);

  // Handle clicking on a Print element -- single click starts editing
  const handleElementClick = (
    e: React.MouseEvent,
    element: ScreenplayElement,
    elementIndex: number,
  ) => {
    // Ctrl+click for multi-select (non-editing selection mode)
    if (e.ctrlKey || e.metaKey) {
      // If currently editing, save first
      commitCurrentEdit();

      const newSelection: SelectedPrintElement = {
        rowIndex: element.rowIndex,
        columnName: element.columnName,
        elementIndex,
      };

      const isAlreadySelected =
        printSelection.primary?.elementIndex === elementIndex ||
        printSelection.additional.some(
          (sel) => sel.elementIndex === elementIndex,
        );

      if (isAlreadySelected) {
        if (printSelection.primary?.elementIndex === elementIndex) {
          if (printSelection.additional.length > 0) {
            setPrintSelection({
              primary: printSelection.additional[0],
              additional: printSelection.additional.slice(1),
            });
          } else {
            setPrintSelection({ primary: null, additional: [] });
          }
        } else {
          setPrintSelection({
            primary: printSelection.primary,
            additional: printSelection.additional.filter(
              (sel) => sel.elementIndex !== elementIndex,
            ),
          });
        }
      } else {
        if (!printSelection.primary) {
          setPrintSelection({ primary: newSelection, additional: [] });
        } else {
          setPrintSelection({
            primary: printSelection.primary,
            additional: [...printSelection.additional, newSelection],
          });
        }
      }

      clearSelection();
      if (printContainerRef.current) {
        printContainerRef.current.focus();
      }
      return;
    }

    // If clicking the element we're already editing, let the input handle cursor positioning
    if (
      isEditingFromPrint &&
      editingCell &&
      editingCell.row === element.rowIndex &&
      headers[editingCell.col] === element.columnName
    ) {
      return;
    }

    // Save any current edit before switching elements
    commitCurrentEdit();

    // Determine cursor position from click coordinates.
    // Use caretRangeFromPoint on the <p> element to find which character was clicked.
    let clickCharOffset: number | undefined;
    if (document.caretRangeFromPoint) {
      const range = document.caretRangeFromPoint(e.clientX, e.clientY);
      if (range) {
        clickCharOffset = range.startOffset;
      }
    }

    // Single click: select and immediately start editing at the clicked position
    startEditingElement(
      element,
      elementIndex,
      undefined,
      clickCharOffset !== undefined
        ? { charOffset: clickCharOffset }
        : "start",
    );

    // Clear Cell selection so Cell Grid doesn't compete for keyboard input
    clearSelection();
  };

  // Handle right-clicking on a Print element to show context menu
  const handleElementContextMenu = (
    e: React.MouseEvent,
    element: ScreenplayElement,
    elementIndex: number,
  ) => {
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
      printSelection.primary?.elementIndex === elementIndex ||
      printSelection.additional.some(
        (sel) => sel.elementIndex === elementIndex,
      );

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
    const worker = new Worker(
      new URL("@/utils/screenplayPrint.worker.ts", import.meta.url),
      {
        type: "module",
      },
    );
    workerRef.current = worker;

    // Listen for results
    worker.addEventListener("message", (e) => {
      const message = e.data;
      if (message.type === "result") {
        setElements(message.elements);
        setPages(message.pages);
        setIsCalculating(false);
      } else if (message.type === "error") {
        logger.error("ScreenplayPrint worker error:", message.message);
        setElements([]);
        setPages([{ elements: [], pageNumber: 1 }]);
        setIsCalculating(false);
      }
    });

    // Listen for worker errors
    worker.addEventListener("error", (e) => {
      logger.error("ScreenplayPrint worker error event:", e);
      setElements([]);
      setPages([{ elements: [], pageNumber: 1 }]);
      setIsCalculating(false);
    });

    // Send calculation request
    worker.postMessage({
      type: "calculate",
      data,
      headers,
      configuration,
      recipe,
      editingCell,
      editingValue,
      continuous,
    });

    // Cleanup on unmount
    return () => {
      worker.terminate();
    };
  }, [
    data,
    headers,
    configuration,
    recipe,
    editingCell,
    editingValue,
    continuous,
  ]);

  // ===== PAGE VIRTUALIZATION =====
  /**
   * Performance optimization: Only render visible pages
   * For large files (50k+ rows), this can be hundreds of pages
   * Virtualization prevents rendering all pages at once, which blocks UI
   */
  const pageVirtualizer = useVirtualizer({
    count: pages.length,
    getScrollElement: () => printContainerRef.current,
    estimateSize: () => {
      // Estimate full page height including gap between pages
      // Pages are absolutely positioned, so we just need the visual height after scaling plus the gap
      // Gap between pages: 0.5" converted to pixels and scaled
      const pageGapInches = 0.5; // 0.5" vertical gap between pages in paged mode
      const pageGapPx = pageGapInches * 96; // Convert inches to pixels (96 DPI)
      const scaledGap = continuous ? 0 : pageGapPx * scale; // Scale the gap with the page
      const scaledHeight = pageHeightPx * scale;
      return scaledHeight + scaledGap;
    },
    overscan: 2, // Pre-render 2 pages above/below for smooth scrolling
  });

  // Recalculate virtualizer measurements when scale changes
  // This ensures page positions update when drawer is resized
  useEffect(() => {
    pageVirtualizer.measure();
  }, [scale, pageVirtualizer]);

  const virtualPages = pageVirtualizer.getVirtualItems();
  const totalSize = pageVirtualizer.getTotalSize();

  // Calculate page dimensions and transform
  // For right drawer, align left; for bottom drawer, center
  const transformOrigin =
    drawerPosition === "right" ? "top left" : "top center";

  // Page style differs between continuous and paged modes
  // Continuous: minHeight allows page to grow with content
  // Paged: fixed height ensures consistent virtualizer calculations
  const pageStyle = {
    width: `${pageWidth}in`,
    ...(continuous
      ? { minHeight: `${pageHeight}in` }
      : { height: `${pageHeight}in` }),
    paddingTop: `${marginTop}in`,
    paddingBottom: `${marginBottom}in`,
    paddingLeft: `${marginLeft}in`,
    paddingRight: `${marginRight}in`,
    transform: `scale(${scale})`,
    transformOrigin,
  };

  return (
    <div
      ref={(el) => {
        setContainerRef(el);
        if (printContainerRef.current !== el) {
          (
            printContainerRef as React.MutableRefObject<HTMLDivElement | null>
          ).current = el;
        }
      }}
      className="screenplay-print-container w-full h-full overflow-auto outline-none"
      tabIndex={0}
      onClick={(e) => {
        // Clicking empty space on the page: save any active edit and deselect
        const clickedElement = (e.target as HTMLElement).closest(
          ".screenplay-element",
        );
        if (!clickedElement) {
          commitCurrentEdit();
          setPrintSelection({ primary: null, additional: [] });
          clearSelection();
          if (printContainerRef.current) {
            printContainerRef.current.focus();
          }
        }
      }}
    >
      {/* Show empty state if no elements */}
      {elements.length === 0 ? (
        /* Show empty state if no elements */
        <div className="flex items-center justify-center h-full text-base-content/50">
          <div className="text-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-16 w-16 mx-auto mb-4 opacity-50"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <p className="mb-2">No screenplay elements to display</p>
            <p className="text-xs">
              Make sure your Cell columns are mapped to screenplay elements
            </p>
          </div>
        </div>
      ) : continuous ? (
        /* Continuous mode: single page with all elements */
        <div
          className={`screenplay-page ${backgroundColor} text-grey-50 border-2 border-white/30 ${drawerPosition === "bottom" ? "mx-auto" : ""}`}
          style={pageStyle}
        >
          {/* Screenplay elements - all on one continuous page */}
          <div className="screenplay-content relative">
            {elements.map((element, index) => {
              // Check if this element corresponds to the cell being edited
              const isBeingEdited =
                editingCell !== null &&
                editingCell.row === element.rowIndex &&
                headers[editingCell.col] === element.columnName;

              // Check if this element is selected (in primary or additional selection)
              const isSelected =
                (printSelection.primary !== null &&
                  printSelection.primary.rowIndex === element.rowIndex &&
                  printSelection.primary.columnName === element.columnName) ||
                printSelection.additional.some(
                  (sel) =>
                    sel.rowIndex === element.rowIndex &&
                    sel.columnName === element.columnName,
                );

              // Check if this element is cut
              const isCut = cutElements.some(
                (sel) =>
                  sel.rowIndex === element.rowIndex &&
                  sel.columnName === element.columnName,
              );

              // Check if this element is being edited from Print view
              const isEditingThisFromPrint =
                isEditingFromPrint &&
                editingCell !== null &&
                editingCell.row === element.rowIndex &&
                headers[editingCell.col] === element.columnName;

              // Create a unique key for this element
              // Include splitIndex for split dialogue elements
              const elementKey = `${element.rowIndex}-${element.columnName}${element.splitIndex !== undefined ? `-split${element.splitIndex}` : ""}`;

              // Create ref callback to store element ref
              const setRef = (el: HTMLDivElement | null) => {
                if (el) {
                  elementRefs.current.set(elementKey, el);
                } else {
                  elementRefs.current.delete(elementKey);
                }
              };

              // Determine if this element is the current search match
              const colIndex = headers.indexOf(element.columnName);
              const isPrintSearch =
                searchOptions.searchContext === "print" ||
                searchOptions.searchContext === "all";
              const isCurrentSearchMatch =
                isPrintSearch &&
                currentMatchIndex >= 0 &&
                matches[currentMatchIndex]?.row === element.rowIndex &&
                matches[currentMatchIndex]?.col === colIndex;

              return (
                <ScreenplayElementView
                  key={`continuous-${index}`}
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
                  onContextMenu={(e) =>
                    handleElementContextMenu(e, element, index)
                  }
                  cursorPlacement={
                    isEditingThisFromPrint ? cursorPlacement : undefined
                  }
                  onNavigateUp={(col) => handleNavigateUp(index, col)}
                  onNavigateDown={(col) => handleNavigateDown(index, col)}
                  setRef={setRef}
                  searchTerm={isPrintSearch ? searchTerm : undefined}
                  searchMatchCase={searchOptions.matchCase}
                  isCurrentSearchMatch={isCurrentSearchMatch}
                />
              );
            })}
          </div>
        </div>
      ) : (
        /* Paged mode: virtualized pages container */
        <div
          style={{
            height: `${totalSize}px`,
            width: "100%",
            position: "relative",
          }}
        >
          {/* Render only visible pages (virtualized) */}
          {virtualPages.map((virtualPage) => {
            const page = pages[virtualPage.index];
            // Calculate page number to display (accounting for startPageNumber offset)
            const displayPageNumber = startPageNumber + page.pageNumber - 1;
            // Determine if this page should show page number
            const shouldShowPageNumber =
              showPageNumbers && (firstPageNumbered || page.pageNumber > 1);

            return (
              <div
                key={virtualPage.key}
                data-index={virtualPage.index}
                className={`screenplay-page ${backgroundColor} border-2 border-white/30 text-grey-50`}
                style={{
                  ...pageStyle,
                  position: "absolute",
                  top: `${virtualPage.start}px`,
                  left: drawerPosition === "bottom" ? "50%" : 0,
                  width: `${pageWidth}in`,
                  transform:
                    drawerPosition === "bottom"
                      ? `translateX(-50%) scale(${scale})`
                      : `scale(${scale})`,
                }}
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
                    // For split dialogue, we need to match splitIndex too
                    const globalIndex = elements.findIndex(
                      (e) =>
                        e.rowIndex === element.rowIndex &&
                        e.columnName === element.columnName &&
                        (e.splitIndex ?? -1) === (element.splitIndex ?? -1),
                    );

                    // Check if this element corresponds to the cell being edited
                    const isBeingEdited =
                      editingCell !== null &&
                      editingCell.row === element.rowIndex &&
                      headers[editingCell.col] === element.columnName;

                    // Check if this element is selected (in primary or additional selection)
                    const isSelected =
                      (printSelection.primary !== null &&
                        printSelection.primary.rowIndex === element.rowIndex &&
                        printSelection.primary.columnName ===
                          element.columnName) ||
                      printSelection.additional.some(
                        (sel) =>
                          sel.rowIndex === element.rowIndex &&
                          sel.columnName === element.columnName,
                      );

                    // Check if this element is cut
                    const isCut = cutElements.some(
                      (sel) =>
                        sel.rowIndex === element.rowIndex &&
                        sel.columnName === element.columnName,
                    );

                    // Check if this element is being edited from Print view
                    const isEditingThisFromPrint =
                      isEditingFromPrint &&
                      editingCell !== null &&
                      editingCell.row === element.rowIndex &&
                      headers[editingCell.col] === element.columnName;

                    // Create a unique key for this element
                    // Include splitIndex for split dialogue elements
                    const elementKey = `${element.rowIndex}-${element.columnName}${element.splitIndex !== undefined ? `-split${element.splitIndex}` : ""}`;

                    // Create ref callback to store element ref
                    const setRef = (el: HTMLDivElement | null) => {
                      if (el) {
                        elementRefs.current.set(elementKey, el);
                      } else {
                        elementRefs.current.delete(elementKey);
                      }
                    };

                    // Determine if this element is the current search match
                    const colIndex = headers.indexOf(element.columnName);
                    const isPrintSearch =
                      searchOptions.searchContext === "print" ||
                      searchOptions.searchContext === "all";
                    const isCurrentSearchMatch =
                      isPrintSearch &&
                      currentMatchIndex >= 0 &&
                      matches[currentMatchIndex]?.row === element.rowIndex &&
                      matches[currentMatchIndex]?.col === colIndex;

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
                        onClick={(e) =>
                          handleElementClick(e, element, globalIndex)
                        }
                        onContextMenu={(e) =>
                          handleElementContextMenu(e, element, globalIndex)
                        }
                        cursorPlacement={
                          isEditingThisFromPrint ? cursorPlacement : undefined
                        }
                        onNavigateUp={(col) => handleNavigateUp(globalIndex, col)}
                        onNavigateDown={(col) => handleNavigateDown(globalIndex, col)}
                        setRef={setRef}
                        searchTerm={isPrintSearch ? searchTerm : undefined}
                        searchMatchCase={searchOptions.matchCase}
                        isCurrentSearchMatch={isCurrentSearchMatch}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
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
                  const value = data[contextMenu.rowIndex]?.[colIndex] || "";
                  setEditingCell(
                    contextMenu.rowIndex,
                    colIndex,
                    value,
                    "print",
                  );
                  setIsEditingFromPrint(true);
                  setContextMenu(null);
                }}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                  />
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
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                  />
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
                  } catch (err: unknown) {
                    logger.error("Failed to paste:", err);
                  }
                }}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                  />
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

// Custom comparison function for memo to handle object/array props properly
// PERFORMANCE: Prevents expensive reconciliation of thousands of elements on every cell selection
function arePropsEqual(
  prevProps: ScreenplayPrintProps,
  nextProps: ScreenplayPrintProps,
): boolean {
  // Check primitive props first (fast)
  if (
    prevProps.drawerPosition !== nextProps.drawerPosition ||
    prevProps.containerWidth !== nextProps.containerWidth ||
    prevProps.containerHeight !== nextProps.containerHeight ||
    prevProps.continuous !== nextProps.continuous ||
    prevProps.followCell !== nextProps.followCell
  ) {
    return false;
  }

  // Check array lengths (fast fail)
  if (prevProps.data.length !== nextProps.data.length) {
    return false;
  }
  if (prevProps.headers.length !== nextProps.headers.length) {
    return false;
  }

  // Check headers (usually small array)
  for (let i = 0; i < prevProps.headers.length; i++) {
    if (prevProps.headers[i] !== nextProps.headers[i]) {
      return false;
    }
  }

  // Check data rows - use reference equality first, then deep check if needed
  if (prevProps.data !== nextProps.data) {
    for (let i = 0; i < prevProps.data.length; i++) {
      const prevRow = prevProps.data[i];
      const nextRow = nextProps.data[i];
      if (prevRow !== nextRow) {
        if (prevRow.length !== nextRow.length) {
          return false;
        }
        for (let j = 0; j < prevRow.length; j++) {
          if (prevRow[j] !== nextRow[j]) {
            return false;
          }
        }
      }
    }
  }

  // Check recipe by reference (usually stable from parent)
  if (prevProps.recipe !== nextProps.recipe) {
    // Deep compare recipe if references differ
    if (JSON.stringify(prevProps.recipe) !== JSON.stringify(nextProps.recipe)) {
      return false;
    }
  }

  // Check configuration by reference (usually stable from parent)
  if (prevProps.configuration !== nextProps.configuration) {
    if (
      JSON.stringify(prevProps.configuration) !==
      JSON.stringify(nextProps.configuration)
    ) {
      return false;
    }
  }

  return true;
}

// Memoize to prevent re-renders when only selectedCell changes (not data/editingCell/etc)
export default memo(ScreenplayPrint, arePropsEqual);
