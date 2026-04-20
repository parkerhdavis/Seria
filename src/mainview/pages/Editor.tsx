import { useState } from "react";
import { open } from "@utils/dialog";
import { useCellStore } from "@stores/cellStore";
import CellGridVirtualized from "@components/cell/CellGridVirtualized";
import { logger } from "@utils/logger";
import { formatError } from "@utils/tauriErrorHandler";
import { toast } from "@stores/toastStore";

interface EditorProps {
  onFilePickerOpenChange: (isOpen: boolean) => void;
}

/**
 * Cell Editor page component
 *
 * Main editing interface for Cell files. Provides a virtualized spreadsheet-like grid
 * for viewing and editing Cell Data with filtering, sorting, and bulk operations.
 * Uses CellGridVirtualized for optimal performance with files of any size.
 * Toolbar controls have been moved to the Header component.
 */
function Editor({ onFilePickerOpenChange }: EditorProps) {
  const { headers, error, loadCells } = useCellStore();
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  // Check if we have data loaded
  const hasData = headers.length > 0;

  /**
   * Handle click on empty state to open file dialog
   */
  const handleOpenFile = async () => {
    onFilePickerOpenChange(true);
    try {
      const filePath = await open({
        multiple: false,
        filters: [
          { name: "Data Files", extensions: ["csv", "tsv", "json"] },
          { name: "All Files", extensions: ["*"] },
        ],
      });

      if (filePath && typeof filePath === "string") {
        // Keep overlay visible during loading
        await loadCells(filePath);
        onFilePickerOpenChange(false);
      } else {
        // User cancelled, close overlay
        onFilePickerOpenChange(false);
      }
    } catch (error: unknown) {
      logger.error("Failed to open file:", error);
      toast.error(`Failed to open file: ${formatError(error)}`);
      onFilePickerOpenChange(false);
    }
  };

  /**
   * Handle file drag enter
   */
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(true);
  };

  /**
   * Handle file drag over
   */
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  /**
   * Handle file drag leave
   */
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
  };

  /**
   * Handle file drop
   */
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);

    // Get the dropped files from the dataTransfer
    const files = Array.from(e.dataTransfer.files);

    if (files.length > 0) {
      const file = files[0];
      // Check if it's a supported data file (csv, tsv, json)
      const validExtensions = [".csv", ".tsv", ".json"];
      const fileExtension = file.name
        .substring(file.name.lastIndexOf("."))
        .toLowerCase();
      if (validExtensions.includes(fileExtension)) {
        // Tauri adds a 'path' property to dropped files with the full file path
        const fileWithPath = file as File & { path?: string };
        const filePath = fileWithPath.path || file.name;
        try {
          await loadCells(filePath);
        } catch (error: unknown) {
          logger.error("Failed to load dropped file:", error);
          toast.error(`Failed to load file: ${formatError(error)}`);
        }
      }
    }
  };

  return (
    <div className="h-full flex flex-col min-w-0">
      {/* Error display */}
      {error && (
        <div className="alert alert-error m-4">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="stroke-current shrink-0 h-6 w-6"
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

      {/* Grid or empty state */}
      <div className="flex-1 overflow-hidden bg-base-100 min-w-0">
        {hasData ? (
          <CellGridVirtualized />
        ) : (
          <div
            className="h-full flex items-center justify-center p-8"
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div
              className={`
                                text-center p-12 rounded-lg border-2 border-dashed transition-all cursor-pointer
                                ${
                                  isDraggingOver
                                    ? "border-primary bg-primary/10 scale-105"
                                    : "border-base-300 bg-base-200/50 hover:border-primary/50 hover:bg-base-200"
                                }
                            `}
              onClick={handleOpenFile}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className={`h-24 w-24 mx-auto mb-4 transition-colors ${isDraggingOver ? "text-primary" : "text-base-content/30"}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1}
                  d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
              <h2 className="text-xl font-semibold text-base-content/60 mb-2">
                {isDraggingOver ? "Drop Cell File Here" : "No Cell File Open"}
              </h2>
              <p className="text-base-content/50">
                {isDraggingOver
                  ? "Release to open"
                  : 'Click here, drag and drop a Cell file, or use "Open File" in the header'}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Editor;
