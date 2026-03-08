/**
 * useFileOperations Hook
 *
 * Centralized hook for file operations (open, save, save as, reload, new, import).
 * Eliminates duplication between TitleBar and Header components.
 */

import { open, save } from "@tauri-apps/plugin-dialog";
import { useCellStore } from "@/stores/cellStore";
import { logger } from "@/utils/logger";
import { formatError } from "@/utils/tauriErrorHandler";
import { toast } from "@/stores/toastStore";

interface UseFileOperationsOptions {
    /** Callback when file picker opens/closes */
    onFilePickerOpenChange: (isOpen: boolean) => void;
}

interface UseFileOperationsReturn {
    /** Open a file dialog and load the selected file */
    handleOpen: () => Promise<void>;
    /** Save the current file */
    handleSave: () => Promise<void>;
    /** Show save dialog and save to new location */
    handleSaveAs: () => Promise<void>;
    /** Reload the current file from disk */
    handleReload: () => Promise<void>;
    /** Create a new file (optionally saving current first) */
    handleNew: (saveFirst?: boolean) => Promise<void>;
    /** Import a screenplay file */
    handleImportScreenplay: () => Promise<void>;
    /** Export to screenplay format */
    handleExportScreenplay: () => Promise<void>;
}

/**
 * Hook providing centralized file operation handlers
 *
 * @param options - Configuration options
 * @returns Object with file operation handlers
 *
 * @example
 * const { handleOpen, handleSave, handleSaveAs } = useFileOperations({
 *     onFilePickerOpenChange: setIsPickerOpen,
 * });
 */
export function useFileOperations(
    options: UseFileOperationsOptions
): UseFileOperationsReturn {
    const { onFilePickerOpenChange } = options;

    // Get store actions
    const loadCellsProgressive = useCellStore((state) => state.loadCellsProgressive);
    const saveCells = useCellStore((state) => state.saveCells);
    const saveCellAs = useCellStore((state) => state.saveCellAs);
    const reloadCells = useCellStore((state) => state.reloadCells);
    const createNew = useCellStore((state) => state.createNew);
    const importFromScreenplay = useCellStore((state) => state.importFromScreenplay);
    const exportToScreenplay = useCellStore((state) => state.exportToScreenplay);
    const fileInfo = useCellStore((state) => state.fileInfo);

    /**
     * Open a file dialog and load the selected file
     */
    const handleOpen = async (): Promise<void> => {
        onFilePickerOpenChange(true);
        try {
            const filePath = await open({
                multiple: false,
                filters: [
                    { name: "Data Files", extensions: ["csv", "tsv", "json"] },
                    { name: "All Files", extensions: ["*"] },
                ],
                title: "Open Data File",
            });

            if (filePath) {
                await loadCellsProgressive(filePath);
                // Blur active element so keyboard shortcuts work
                if (document.activeElement instanceof HTMLElement) {
                    document.activeElement.blur();
                }
            }
        } catch (error: unknown) {
            const message = formatError(error);
            logger.error("Failed to open file:", message);
            toast.error(`Failed to open file: ${message}`);
        } finally {
            onFilePickerOpenChange(false);
        }
    };

    /**
     * Save the current file
     * If it's a temp file, redirects to handleSaveAs
     */
    const handleSave = async (): Promise<void> => {
        try {
            await saveCells();
        } catch (error: unknown) {
            // If this is a temp file, show the Save As dialog instead
            if (error instanceof Error && error.message === "TEMP_FILE_NEEDS_LOCATION") {
                await handleSaveAs();
            } else {
                const message = formatError(error);
                logger.error("Failed to save file:", message);
                toast.error(`Failed to save file: ${message}`);
            }
        }
    };

    /**
     * Show save dialog and save to new location
     */
    const handleSaveAs = async (): Promise<void> => {
        onFilePickerOpenChange(true);
        try {
            const fileName = fileInfo?.name || "untitled.csv";
            const filePath = await save({
                filters: [
                    { name: "CSV Files", extensions: ["csv"] },
                    { name: "TSV Files", extensions: ["tsv"] },
                    { name: "JSON Files", extensions: ["json"] },
                    { name: "All Files", extensions: ["*"] },
                ],
                title: "Save Data File",
                defaultPath: fileName,
            });

            if (filePath) {
                await saveCellAs(filePath);
            }
        } catch (error: unknown) {
            const message = formatError(error);
            logger.error("Failed to save file:", message);
            toast.error(`Failed to save file: ${message}`);
        } finally {
            onFilePickerOpenChange(false);
        }
    };

    /**
     * Reload the current file from disk
     */
    const handleReload = async (): Promise<void> => {
        try {
            await reloadCells();
        } catch (error: unknown) {
            const message = formatError(error);
            logger.error("Failed to reload file:", message);
            toast.error(`Failed to reload file: ${message}`);
        }
    };

    /**
     * Create a new file
     * @param saveFirst - If true, saves current file before creating new
     */
    const handleNew = async (saveFirst?: boolean): Promise<void> => {
        if (saveFirst) {
            try {
                await saveCells();
            } catch (error: unknown) {
                const message = formatError(error);
                logger.error("Failed to save file before creating new:", message);
                toast.error(`Failed to save file: ${message}`);
                return;
            }
        }
        await createNew();
    };

    /**
     * Import a screenplay file to CSV format
     */
    const handleImportScreenplay = async (): Promise<void> => {
        onFilePickerOpenChange(true);
        try {
            const filePath = await open({
                multiple: false,
                filters: [
                    { name: "Screenplay Files", extensions: ["txt"] },
                    { name: "All Files", extensions: ["*"] },
                ],
                title: "Import as Screenplay",
            });

            if (filePath && typeof filePath === "string") {
                await importFromScreenplay(filePath);
                // Blur active element so keyboard shortcuts work
                if (document.activeElement instanceof HTMLElement) {
                    document.activeElement.blur();
                }
            }
        } catch (error: unknown) {
            const message = formatError(error);
            logger.error("Failed to import screenplay:", message);
            toast.error(`Failed to import file: ${message}`);
        } finally {
            onFilePickerOpenChange(false);
        }
    };

    /**
     * Export current data to screenplay format
     */
    const handleExportScreenplay = async (): Promise<void> => {
        if (!fileInfo) {
            logger.warn("No file is currently open for export");
            toast.warning("No file is currently open");
            return;
        }

        onFilePickerOpenChange(true);
        try {
            // Generate default filename
            const defaultFilename =
                fileInfo.path
                    .split("/")
                    .pop()
                    ?.replace(/\.(csv|tsv)$/i, ".txt") || "screenplay.txt";

            const filePath = await save({
                filters: [
                    { name: "Text Files", extensions: ["txt"] },
                    { name: "All Files", extensions: ["*"] },
                ],
                title: "Export as Screenplay",
                defaultPath: defaultFilename,
            });

            if (filePath) {
                await exportToScreenplay(filePath);
                // Blur active element so keyboard shortcuts work
                if (document.activeElement instanceof HTMLElement) {
                    document.activeElement.blur();
                }
                toast.success("Screenplay exported successfully");
            }
        } catch (error: unknown) {
            const message = formatError(error);
            logger.error("Failed to export screenplay:", message);
            toast.error(`Failed to export screenplay: ${message}`);
        } finally {
            onFilePickerOpenChange(false);
        }
    };

    return {
        handleOpen,
        handleSave,
        handleSaveAs,
        handleReload,
        handleNew,
        handleImportScreenplay,
        handleExportScreenplay,
    };
}
