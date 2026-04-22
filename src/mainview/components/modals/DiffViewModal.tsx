/**
 * Diff View Modal Component
 *
 * Displays a side-by-side comparison of two CSV files with color-coded
 * differences. Supports comparing the current file with another file
 * or comparing two arbitrary files.
 *
 * Opens with Ctrl+Shift+D.
 */

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useCellStore } from "@stores/cellStore";
import { open } from "@utils/dialog";
import { rpcCall } from "@utils/rpc";
import { logger } from "@utils/logger";
import { formatError } from "@utils/tauriErrorHandler";
import { toast } from "@stores/toastStore";
import { serializeCell } from "@utils/cellParser";

/** Represents a single cell modification between two files */
interface ModifiedCell {
  row: number;
  col: number;
  oldValue: string;
  newValue: string;
}

/** Column-level changes between two files */
interface ColumnChanges {
  added: string[];
  deleted: string[];
}

/** Complete diff result from the backend */
interface DiffResult {
  addedRows: number[];
  deletedRows: number[];
  modifiedCells: ModifiedCell[];
  columnChanges: ColumnChanges;
  oldHeaders: string[];
  newHeaders: string[];
  oldData: string[][];
  newData: string[][];
  oldRowCount: number;
  newRowCount: number;
}

interface DiffViewModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * DiffViewModal - Side-by-side CSV file comparison
 */
export default function DiffViewModal({ isOpen, onClose }: DiffViewModalProps) {
  const { headers, data, fileInfo, currentFile } = useCellStore();

  const [diffResult, setDiffResult] = useState<DiffResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [compareFilePath, setCompareFilePath] = useState<string | null>(null);
  const [currentChangeIndex, setCurrentChangeIndex] = useState(0);
  const leftPanelRef = useRef<HTMLDivElement>(null);
  const rightPanelRef = useRef<HTMLDivElement>(null);

  // Synchronized scrolling
  const isSyncingScroll = useRef(false);

  const handleScroll = useCallback((source: "left" | "right") => {
    if (isSyncingScroll.current) return;
    isSyncingScroll.current = true;

    const sourceRef = source === "left" ? leftPanelRef : rightPanelRef;
    const targetRef = source === "left" ? rightPanelRef : leftPanelRef;

    if (sourceRef.current && targetRef.current) {
      targetRef.current.scrollTop = sourceRef.current.scrollTop;
      targetRef.current.scrollLeft = sourceRef.current.scrollLeft;
    }

    requestAnimationFrame(() => {
      isSyncingScroll.current = false;
    });
  }, []);

  // Count all changes for navigation
  const allChanges = useMemo(() => {
    if (!diffResult) return [];
    const changes: Array<{
      type: "added" | "deleted" | "modified";
      row: number;
      side: "left" | "right";
    }> = [];

    for (const row of diffResult.deletedRows) {
      changes.push({ type: "deleted", row, side: "left" });
    }
    for (const row of diffResult.addedRows) {
      changes.push({ type: "added", row, side: "right" });
    }
    // Deduplicate modified rows
    const modifiedRows = new Set(diffResult.modifiedCells.map((c) => c.row));
    for (const row of modifiedRows) {
      changes.push({ type: "modified", row, side: "right" });
    }

    return changes.sort((a, b) => a.row - b.row);
  }, [diffResult]);

  // Pick comparison file
  const handlePickFile = async () => {
    try {
      const filePath = await open({
        multiple: false,
        filters: [
          { name: "Data Files", extensions: ["csv", "tsv", "json"] },
          { name: "All Files", extensions: ["*"] },
        ],
        title: "Select file to compare",
      });

      if (filePath) {
        setCompareFilePath(filePath);
        await performDiff(filePath);
      }
    } catch (err: unknown) {
      logger.error("Failed to open comparison file:", err);
      setError(formatError(err));
      toast.error(`Failed to open comparison file: ${formatError(err)}`);
    }
  };

  // Perform the diff comparison
  const performDiff = async (compareWith: string) => {
    setIsLoading(true);
    setError(null);
    setDiffResult(null);

    try {
      // Get current file content
      const currentContent = serializeCell({ headers, data }, ",");

      // Load comparison file content
      const compareContent = await rpcCall.openCellFile({
        path: compareWith,
      });

      // Run diff comparison
      const result = await rpcCall.compareCsvFiles({
        oldContent: compareContent,
        newContent: currentContent,
      });

      setDiffResult(result);
      setCurrentChangeIndex(0);
    } catch (err: unknown) {
      logger.error("Diff comparison failed:", err);
      setError(formatError(err));
      toast.error(`Diff comparison failed: ${formatError(err)}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Navigate between changes
  const goToChange = (index: number) => {
    if (index < 0 || index >= allChanges.length) return;
    setCurrentChangeIndex(index);

    // Scroll to the change
    const change = allChanges[index];
    const rowEl = document.querySelector(
      `[data-diff-row="${change.side}-${change.row}"]`,
    );
    if (rowEl) {
      rowEl.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  const nextChange = () => goToChange(currentChangeIndex + 1);
  const prevChange = () => goToChange(currentChangeIndex - 1);

  // Handle keyboard shortcuts within modal
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose();
    } else if (e.key === "ArrowDown" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      nextChange();
    } else if (e.key === "ArrowUp" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      prevChange();
    }
  };

  // Compute summary stats
  const summary = useMemo(() => {
    if (!diffResult) return null;
    return {
      added: diffResult.addedRows.length,
      deleted: diffResult.deletedRows.length,
      modified: new Set(diffResult.modifiedCells.map((c) => c.row)).size,
      columnsAdded: diffResult.columnChanges.added.length,
      columnsDeleted: diffResult.columnChanges.deleted.length,
    };
  }, [diffResult]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setDiffResult(null);
      setError(null);
      setCompareFilePath(null);
      setCurrentChangeIndex(0);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Build sets for fast lookup
  const addedRowSet = new Set(diffResult?.addedRows ?? []);
  const deletedRowSet = new Set(diffResult?.deletedRows ?? []);
  const modifiedCellMap = new Map<string, ModifiedCell>();
  for (const cell of diffResult?.modifiedCells ?? []) {
    modifiedCellMap.set(`${cell.row}:${cell.col}`, cell);
  }

  return (
    <div className="modal modal-open" onKeyDown={handleKeyDown}>
      <div className="modal-box max-w-[95vw] w-[95vw] max-h-[90vh] h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold">Compare Files</h2>
            <p className="text-sm text-base-content/60">
              {compareFilePath
                ? `Comparing with: ${compareFilePath.split("/").pop() || compareFilePath.split("\\").pop()}`
                : "Select a file to compare against the current file"}
            </p>
          </div>
          <button className="btn btn-sm btn-ghost btn-circle" onClick={onClose}>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-4 mb-4">
          <button
            className="btn btn-sm btn-primary"
            onClick={handlePickFile}
            disabled={isLoading}
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
                d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
              />
            </svg>
            {compareFilePath ? "Change File" : "Select File to Compare"}
          </button>

          {diffResult && (
            <>
              <div className="h-6 w-px bg-base-300"></div>

              {/* Change navigation */}
              <div className="flex items-center gap-2">
                <button
                  className="btn btn-sm btn-ghost"
                  onClick={prevChange}
                  disabled={currentChangeIndex <= 0}
                  title="Previous change (Ctrl+Up)"
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
                      d="M15 19l-7-7 7-7"
                    />
                  </svg>
                </button>
                <span className="text-sm font-mono">
                  {allChanges.length > 0
                    ? `${currentChangeIndex + 1} / ${allChanges.length}`
                    : "0 changes"}
                </span>
                <button
                  className="btn btn-sm btn-ghost"
                  onClick={nextChange}
                  disabled={currentChangeIndex >= allChanges.length - 1}
                  title="Next change (Ctrl+Down)"
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
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </button>
              </div>

              <div className="h-6 w-px bg-base-300"></div>

              {/* Summary badges */}
              {summary && (
                <div className="flex items-center gap-2">
                  {summary.added > 0 && (
                    <span className="badge badge-sm bg-success/20 text-success border-success/30">
                      +{summary.added} rows
                    </span>
                  )}
                  {summary.deleted > 0 && (
                    <span className="badge badge-sm bg-error/20 text-error border-error/30">
                      -{summary.deleted} rows
                    </span>
                  )}
                  {summary.modified > 0 && (
                    <span className="badge badge-sm bg-warning/20 text-warning border-warning/30">
                      ~{summary.modified} rows modified
                    </span>
                  )}
                  {summary.columnsAdded > 0 && (
                    <span className="badge badge-sm bg-info/20 text-info border-info/30">
                      +{summary.columnsAdded} cols
                    </span>
                  )}
                  {summary.columnsDeleted > 0 && (
                    <span className="badge badge-sm bg-info/20 text-info border-info/30">
                      -{summary.columnsDeleted} cols
                    </span>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Error display */}
        {error && (
          <div className="alert alert-error mb-4">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="stroke-current shrink-0 h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {/* Loading state */}
        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <span className="loading loading-spinner loading-lg"></span>
            <span className="ml-4">Computing differences...</span>
          </div>
        )}

        {/* No file selected placeholder */}
        {!diffResult && !isLoading && !error && (
          <div className="flex flex-col items-center justify-center flex-1 text-base-content/50">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-16 w-16 mb-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2"
              />
            </svg>
            <p className="text-lg font-semibold mb-2">Compare CSV Files</p>
            <p className="text-center mb-4">
              Select a file to compare against{" "}
              <span className="font-semibold">
                {fileInfo?.name ||
                  currentFile?.split("/").pop() ||
                  "the current file"}
              </span>
            </p>
            <p className="text-xs text-base-content/40">
              The selected file will be shown on the left (old), current file on
              the right (new)
            </p>
          </div>
        )}

        {/* Diff display */}
        {diffResult && !isLoading && (
          <div className="flex flex-1 gap-1 overflow-hidden">
            {/* Left panel - Old file */}
            <div className="flex-1 flex flex-col overflow-hidden border border-base-300 rounded-lg">
              <div className="px-3 py-2 bg-base-200 border-b border-base-300 text-sm font-semibold flex items-center gap-2">
                <span className="badge badge-sm">Old</span>
                {compareFilePath?.split("/").pop() ||
                  compareFilePath?.split("\\").pop() ||
                  "Previous"}
                <span className="text-base-content/50 font-normal">
                  ({diffResult.oldRowCount} rows, {diffResult.oldHeaders.length}{" "}
                  cols)
                </span>
              </div>
              <div
                ref={leftPanelRef}
                className="flex-1 overflow-auto font-mono text-sm"
                onScroll={() => handleScroll("left")}
              >
                <table className="table table-xs w-full">
                  <thead className="sticky top-0 bg-base-200 z-10">
                    <tr>
                      <th className="w-10 text-center">#</th>
                      {diffResult.oldHeaders.map((h, i) => (
                        <th
                          key={i}
                          className={
                            diffResult.columnChanges.deleted.includes(h)
                              ? "bg-error/20 text-error"
                              : ""
                          }
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {diffResult.oldData.map((row, rowIdx) => {
                      const isDeleted = deletedRowSet.has(rowIdx);
                      return (
                        <tr
                          key={rowIdx}
                          data-diff-row={`left-${rowIdx}`}
                          className={isDeleted ? "bg-error/15" : ""}
                        >
                          <td className="text-center text-base-content/40 w-10">
                            {rowIdx + 1}
                            {isDeleted && (
                              <span className="ml-1 text-error font-bold">
                                -
                              </span>
                            )}
                          </td>
                          {row.map((cell, colIdx) => (
                            <td
                              key={colIdx}
                              className={
                                isDeleted
                                  ? "bg-error/10 text-error line-through"
                                  : diffResult.columnChanges.deleted.includes(
                                        diffResult.oldHeaders[colIdx],
                                      )
                                    ? "bg-error/5"
                                    : ""
                              }
                            >
                              <span className="max-w-[200px] truncate block">
                                {cell}
                              </span>
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Right panel - New file (current) */}
            <div className="flex-1 flex flex-col overflow-hidden border border-base-300 rounded-lg">
              <div className="px-3 py-2 bg-base-200 border-b border-base-300 text-sm font-semibold flex items-center gap-2">
                <span className="badge badge-sm badge-primary">New</span>
                {fileInfo?.name || currentFile?.split("/").pop() || "Current"}
                <span className="text-base-content/50 font-normal">
                  ({diffResult.newRowCount} rows, {diffResult.newHeaders.length}{" "}
                  cols)
                </span>
              </div>
              <div
                ref={rightPanelRef}
                className="flex-1 overflow-auto font-mono text-sm"
                onScroll={() => handleScroll("right")}
              >
                <table className="table table-xs w-full">
                  <thead className="sticky top-0 bg-base-200 z-10">
                    <tr>
                      <th className="w-10 text-center">#</th>
                      {diffResult.newHeaders.map((h, i) => (
                        <th
                          key={i}
                          className={
                            diffResult.columnChanges.added.includes(h)
                              ? "bg-success/20 text-success"
                              : ""
                          }
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {diffResult.newData.map((row, rowIdx) => {
                      const isAdded = addedRowSet.has(rowIdx);
                      return (
                        <tr
                          key={rowIdx}
                          data-diff-row={`right-${rowIdx}`}
                          className={isAdded ? "bg-success/15" : ""}
                        >
                          <td className="text-center text-base-content/40 w-10">
                            {rowIdx + 1}
                            {isAdded && (
                              <span className="ml-1 text-success font-bold">
                                +
                              </span>
                            )}
                          </td>
                          {row.map((cell, colIdx) => {
                            const modKey = `${rowIdx}:${colIdx}`;
                            const mod = modifiedCellMap.get(modKey);
                            return (
                              <td
                                key={colIdx}
                                className={
                                  isAdded
                                    ? "bg-success/10 text-success"
                                    : mod
                                      ? "bg-warning/20"
                                      : diffResult.columnChanges.added.includes(
                                            diffResult.newHeaders[colIdx],
                                          )
                                        ? "bg-success/5"
                                        : ""
                                }
                                title={
                                  mod ? `Was: "${mod.oldValue}"` : undefined
                                }
                              >
                                <span className="max-w-[200px] truncate block">
                                  {mod ? (
                                    <span className="relative">
                                      <span className="bg-warning/30 rounded px-0.5">
                                        {cell}
                                      </span>
                                    </span>
                                  ) : (
                                    cell
                                  )}
                                </span>
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="modal-action">
          <div className="flex items-center gap-2 text-xs text-base-content/40 mr-auto">
            <span className="inline-block w-3 h-3 bg-success/20 border border-success/30 rounded"></span>{" "}
            Added
            <span className="inline-block w-3 h-3 bg-error/20 border border-error/30 rounded ml-2"></span>{" "}
            Deleted
            <span className="inline-block w-3 h-3 bg-warning/20 border border-warning/30 rounded ml-2"></span>{" "}
            Modified
          </div>
          <button className="btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
      <div className="modal-backdrop" onClick={onClose}></div>
    </div>
  );
}
