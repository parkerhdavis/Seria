/**
 * Print Preview Drawer Component
 *
 * Drawer that displays print preview of the current Cell Data.
 * Can be positioned on the right (Ctrl+\) or bottom (Ctrl+/).
 * Opening one position automatically closes the other.
 * Supports resizing via draggable edge.
 */

import { useState, useRef, useEffect } from "react";
import { useCellStore } from "@stores/cellStore";
import { useDrag } from "@/contexts/DragContext";
import { useDrawerStore } from "@stores/drawerStore";
import { usePrintRecipeStore } from "@stores/printRecipeStore";
import { useFileConfigStore, type RecipeDisplaySettings } from "@stores/fileConfigStore";
import CardPrint from "@components/prints/CardPrint";
import ScreenplayPrint from "@components/prints/ScreenplayPrint";
import PrintToolbar from "@components/prints/PrintToolbar";
import MappingModal from "@components/prints/MappingModal";
import ExportDialog, { type ExportSettings, type ExportProgress } from "@components/prints/ExportDialog";
import { exportPrintToPDF } from "@/utils/pdfExport";
import { exportScreenplayToPDF } from "@/utils/pdfExportScreenplay";
import { logger } from "@/utils/logger";
import { toast } from "@stores/toastStore";

// Title bar height constant (matches TitleBar.tsx h-10 = 40px)
const TITLE_BAR_HEIGHT = 40;

interface PrintPreviewDrawerProps {
    isOpen: boolean;
    position: "right" | "bottom";
}

/**
 * PrintDrawer - Flexible drawer for print preview
 */
function PrintDrawer({ isOpen, position }: PrintPreviewDrawerProps) {
    const { headers, data, fileInfo } = useCellStore();
    const {
        rightDrawerSize,
        bottomDrawerSize,
        setRightDrawerSize,
        setBottomDrawerSize,
        setPosition,
    } = useDrawerStore();
    const { findConfigForFile, saveConfigForFile } = useFileConfigStore();
    const [isResizing, setIsResizing] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [isMappingModalOpen, setIsMappingModalOpen] = useState(false);
    const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
    const [isPrintLoading, setIsPrintLoading] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [exportProgress, setExportProgress] = useState<ExportProgress | null>(null);
    const drawerRef = useRef<HTMLDivElement>(null);
    const printContainerRef = useRef<HTMLDivElement>(null);
    const { startDrag, endDrag } = useDrag();

    // Get the current size based on position
    const size = position === "right" ? rightDrawerSize : bottomDrawerSize;

    // Recipe store
    const {
        recipes,
        selectedRecipeId,
        configurations,
        loadBundledRecipes,
        setCellHeaders,
        selectRecipe,
        updateMapping,
    } = usePrintRecipeStore();

    // Get recipe display settings from file config
    const getRecipeSettings = (): RecipeDisplaySettings => {
        if (!fileInfo || !selectedRecipeId) {
            return { continuous: true, followCell: true };
        }

        // Build file identifiers
        const identifiers = {
            absolutePath: fileInfo.path,
            filename: fileInfo.path.split("/").pop() || "",
            parentDir: fileInfo.path.substring(0, fileInfo.path.lastIndexOf("/")),
            fileSize: 0, // TODO: Get actual file size if needed
        };

        const fileConfig = findConfigForFile(identifiers);
        const recipeSettings = fileConfig?.config.recipeSettings?.[selectedRecipeId];

        return {
            continuous: recipeSettings?.continuous ?? true,
            followCell: recipeSettings?.followCell ?? true,
            theme: recipeSettings?.theme,
        };
    };

    // Save recipe display settings to file config
    const saveRecipeSettings = async (settings: RecipeDisplaySettings) => {
        if (!fileInfo || !selectedRecipeId) return;

        // Build file identifiers
        const identifiers = {
            absolutePath: fileInfo.path,
            filename: fileInfo.path.split("/").pop() || "",
            parentDir: fileInfo.path.substring(0, fileInfo.path.lastIndexOf("/")),
            fileSize: 0, // TODO: Get actual file size if needed
        };

        const fileConfig = findConfigForFile(identifiers);
        const currentConfig = fileConfig?.config || {};
        const currentRecipeSettings = currentConfig.recipeSettings || {};

        // Update recipe settings
        const updatedRecipeSettings = {
            ...currentRecipeSettings,
            [selectedRecipeId]: settings,
        };

        // Save to file config
        await saveConfigForFile(identifiers, {
            ...currentConfig,
            selectedRecipeId,
            recipeSettings: updatedRecipeSettings,
        });
    };

    const recipeSettings = getRecipeSettings();

    // Handle PDF export with progress tracking
    const handleExport = async (settings: ExportSettings) => {
        try {
            // Show export progress modal
            setIsExporting(true);
            setExportProgress({
                stage: "Starting export",
                current: 0,
                total: 100,
                percentage: 0,
            });

            // Get the current recipe
            const recipe = recipes.find((r) => r.id === selectedRecipeId);
            const config = selectedRecipeId ? configurations[selectedRecipeId] : null;

            if (!recipe || !config) {
                logger.error("Recipe or configuration not found");
                setIsExporting(false);
                return;
            }

            // Use text-based export for screenplay format
            if (recipe.type === "screenplay") {
                await exportScreenplayToPDF(data, headers, recipe, config, {
                    ...settings,
                    onProgress: (progress) => {
                        setExportProgress(progress);
                    },
                });
            } else {
                // Fall back to image-based export for other print types
                if (!printContainerRef.current) {
                    logger.error("Print container not found");
                    setIsExporting(false);
                    return;
                }

                const printElement = printContainerRef.current.querySelector(
                    ".screenplay-print-container, .print-content"
                ) as HTMLElement;

                if (!printElement) {
                    logger.error("Print element not found");
                    setIsExporting(false);
                    return;
                }

                await exportPrintToPDF(printElement, {
                    ...settings,
                    onProgress: (progress) => {
                        setExportProgress(progress);
                    },
                });
            }

            // Wait briefly to show completion message before closing modal
            // This gives users visual confirmation that the export finished successfully
            await new Promise((resolve) => setTimeout(resolve, 800));

            // Export complete - close modals and show success toast
            setIsExporting(false);
            setExportProgress(null);
            setIsExportDialogOpen(false);
            toast.success("PDF exported successfully");
        } catch (error) {
            logger.error("Export failed:", error);
            setIsExporting(false);
            setExportProgress(null);

            // Show error toast to user
            const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
            toast.error(`Export failed: ${errorMessage}`);
        }
    };

    // Load recipes and set Cell headers on mount/update
    useEffect(() => {
        loadBundledRecipes();
        if (headers.length > 0) {
            setCellHeaders(headers);
        }
    }, [loadBundledRecipes, setCellHeaders, headers]);

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

    // Handle F11 to toggle fullscreen
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "F11") {
                e.preventDefault();
                setIsFullscreen(prev => !prev);
            }
        };

        if (isOpen) {
            window.addEventListener("keydown", handleKeyDown);
            return () => window.removeEventListener("keydown", handleKeyDown);
        }
    }, [isOpen]);

    if (!isOpen) {
        return null;
    }

    const positionStyles = position === "right"
        ? { top: `${TITLE_BAR_HEIGHT}px`, right: 0, height: `calc(100vh - ${TITLE_BAR_HEIGHT}px)`, width: `${size}px` }
        : { bottom: 0, left: 0, right: 0, height: `${size}px` };

    const resizeHandleClasses = position === "right"
        ? "absolute left-0 top-0 bottom-0 w-1 cursor-ew-resize hover:bg-primary/50 select-none"
        : "absolute left-0 right-0 top-0 h-1 cursor-ns-resize hover:bg-primary/50 select-none";

    // Render fullscreen mode
    if (isFullscreen) {
        return (
            <div className="fixed inset-0 bg-base-200 z-[9999] flex flex-col">
                {/* Fullscreen exit button */}
                <div className="absolute top-4 right-4 z-10">
                    <button
                        className="btn btn-sm btn-ghost btn-circle bg-base-100/80 hover:bg-base-100"
                        onClick={() => setIsFullscreen(false)}
                        title="Exit Fullscreen (F11)"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" />
                        </svg>
                    </button>
                </div>

                {/* Fullscreen content */}
                <div className="flex-1 overflow-auto">
                    {!fileInfo ? (
                        <div className="flex flex-col items-center justify-center h-full text-base-content/50">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                            </svg>
                            <p className="text-center">
                                Open a Cell file in the Editor to preview it here
                            </p>
                        </div>
                    ) : (
                        <>
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

                                // Fullscreen uses entire viewport
                                const containerWidth = window.innerWidth;
                                const containerHeight = window.innerHeight;

                                // Render based on recipe type
                                switch (recipe.type) {
                                    case "corkboard":
                                        return (
                                            <CardPrint
                                                data={data}
                                                headers={headers}
                                                recipe={recipe}
                                                configuration={config}
                                                drawerPosition="bottom"
                                                containerWidth={containerWidth}
                                                containerHeight={containerHeight}
                                                followCell={recipeSettings.followCell}
                                                onLoadingChange={setIsPrintLoading}
                                            />
                                        );
                                    case "screenplay":
                                        return (
                                            <ScreenplayPrint
                                                data={data}
                                                headers={headers}
                                                recipe={recipe}
                                                configuration={config}
                                                drawerPosition="bottom"
                                                containerWidth={containerWidth}
                                                containerHeight={containerHeight}
                                                continuous={recipeSettings.continuous}
                                                followCell={recipeSettings.followCell}
                                                onLoadingChange={setIsPrintLoading}
                                            />
                                        );
                                    case "graph":
                                    case "record":
                                    case "custom":
                                        return (
                                            <div className="flex flex-col items-center justify-center h-full text-base-content/50">
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                </svg>
                                                <p className="text-lg font-semibold mb-2">{recipe.name} Print</p>
                                                <p className="text-center">Coming soon</p>
                                            </div>
                                        );
                                    default:
                                        return (
                                            <div className="text-center py-8 text-base-content/50">
                                                <p>Recipe type "{recipe.type}" not yet implemented</p>
                                            </div>
                                        );
                                }
                            })()}
                        </>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div
            ref={drawerRef}
            className={`fixed bg-base-300 shadow-black shadow-md border-black/50 z-50 flex ${position === "right" ? "flex-col border-l-4" : "flex-row border-t-4"}`}
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
            <div className={`flex flex-col ${position === "right" ? "border-b" : "border-r"} border-base-300`}>
                {/* Top row: Close, Recipe Selector, Fullscreen */}
                <div className={`flex items-center gap-4 p-4 ${position === "bottom" ? "min-w-[200px]" : ""}`}>
                    {/* Close button (left) */}
                    <button
                        className="btn btn-sm btn-ghost btn-circle"
                        onClick={() => setPosition(null)}
                        title={`Close Print Preview (Ctrl+${position === "right" ? "\\" : "/"})`}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>

                    {/* Recipe selector (center) */}
                    <div className="flex items-center justify-center flex-1 gap-2">
                        <select
                            className="select select-bordered select-md"
                            style={{ textAlign: "center", textAlignLast: "center", minWidth: "200px" }}
                            value={selectedRecipeId ?? ""}
                            onChange={(e) => selectRecipe(e.target.value)}
                        >
                            {recipes.map((recipe) => (
                                <option key={recipe.id} value={recipe.id}>
                                    {recipe.name}
                                </option>
                            ))}
                        </select>
                        {isPrintLoading && (
                            <div className="loading loading-spinner loading-sm text-primary"></div>
                        )}
                    </div>

                    {/* Fullscreen button (right) */}
                    <button
                        className="btn btn-sm btn-ghost btn-circle"
                        onClick={() => setIsFullscreen(true)}
                        title="Fullscreen (F11)"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                        </svg>
                    </button>
                </div>

                {/* Print Toolbar */}
                {selectedRecipeId && (() => {
                    const recipe = recipes.find(r => r.id === selectedRecipeId);
                    if (!recipe) return null;

                    return (
                        <PrintToolbar
                            recipe={recipe}
                            settings={recipeSettings}
                            onSettingsChange={saveRecipeSettings}
                            onMappingClick={() => setIsMappingModalOpen(true)}
                            onExportClick={() => setIsExportDialogOpen(true)}
                        />
                    );
                })()}
            </div>

            {/* Content */}
            <div ref={printContainerRef} className="print-drawer-content p-4 flex-1 overflow-auto">
                {!fileInfo ? (
                    <div className="flex flex-col items-center justify-center h-full text-base-content/50">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                        <p className="text-center">
                            Open a Cell file in the Editor to preview it here
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
                                    containerHeight = window.innerHeight - TITLE_BAR_HEIGHT - headerSize - contentPadding;
                                } else {
                                    containerWidth = window.innerWidth - contentPadding;
                                    containerHeight = size - headerSize - contentPadding;
                                }

                                // Render based on recipe type
                                switch (recipe.type) {
                                    case "corkboard":
                                        return (
                                            <CardPrint
                                                data={data}
                                                headers={headers}
                                                recipe={recipe}
                                                configuration={config}
                                                drawerPosition={position}
                                                containerWidth={containerWidth}
                                                containerHeight={containerHeight}
                                                followCell={recipeSettings.followCell}
                                                onLoadingChange={setIsPrintLoading}
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
                                                continuous={recipeSettings.continuous}
                                                followCell={recipeSettings.followCell}
                                                onLoadingChange={setIsPrintLoading}
                                            />
                                        );
                                    case "graph":
                                    case "record":
                                    case "custom":
                                        return (
                                            <div className="flex flex-col items-center justify-center h-full text-base-content/50">
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                </svg>
                                                <p className="text-lg font-semibold mb-2">{recipe.name} Print</p>
                                                <p className="text-center">Coming soon</p>
                                            </div>
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

            {/* Mapping Modal */}
            {selectedRecipeId && (() => {
                const recipe = recipes.find(r => r.id === selectedRecipeId);
                const config = configurations[selectedRecipeId];
                if (!recipe || !config) return null;

                return (
                    <MappingModal
                        isOpen={isMappingModalOpen}
                        onClose={() => setIsMappingModalOpen(false)}
                        recipe={recipe}
                        cellHeaders={headers}
                        fieldMappings={config.fieldMappings}
                        onUpdateMapping={(ingredientId, cellColumn) => {
                            updateMapping(selectedRecipeId, ingredientId, cellColumn);
                        }}
                    />
                );
            })()}

            {/* Export Dialog */}
            {selectedRecipeId && (() => {
                const recipe = recipes.find(r => r.id === selectedRecipeId);
                if (!recipe) return null;

                // Generate default filename from file info
                const defaultFilename = fileInfo?.path
                    ? fileInfo.path.split("/").pop()?.replace(/\.(csv|tsv)$/i, "") || "screenplay"
                    : "screenplay";

                // Count total pages if in paged mode (for page range selection)
                // This would need to be passed from the Print component in a real implementation
                // For now, we'll just set it to undefined
                const totalPages = undefined; // TODO: Pass from Print component if needed

                return (
                    <ExportDialog
                        isOpen={isExportDialogOpen}
                        onClose={() => setIsExportDialogOpen(false)}
                        onExport={handleExport}
                        defaultFilename={defaultFilename}
                        totalPages={totalPages}
                        continuous={recipeSettings.continuous}
                    />
                );
            })()}

            {/* Export Progress Modal */}
            {isExporting && exportProgress && (
                <div className="modal modal-open">
                    <div className="modal-box">
                        <h3 className="font-bold text-lg mb-4">Exporting to PDF</h3>

                        {/* Progress bar */}
                        <div className="mb-4">
                            <progress
                                className="progress progress-primary w-full h-4"
                                value={exportProgress.percentage}
                                max="100"
                            ></progress>
                        </div>

                        {/* Progress text */}
                        <div className="text-center space-y-2">
                            <p className="text-base-content font-semibold">
                                {exportProgress.stage}
                            </p>
                            <p className="text-base-content/60 text-sm">
                                {exportProgress.current} of {exportProgress.total} elements processed
                            </p>
                            <p className="text-base-content/60 text-sm">
                                {Math.round(exportProgress.percentage)}%
                            </p>
                        </div>

                        {/* Note: No cancel button - export process can't be safely interrupted */}
                    </div>
                </div>
            )}

            {/* Scrollbar styling - matches Cell grid */}
            <style>{`
                .print-drawer-content {
                    scrollbar-width: thin;
                    scrollbar-gutter: stable both-edges;
                    -webkit-overflow-scrolling: touch;
                }

                .print-drawer-content::-webkit-scrollbar {
                    -webkit-appearance: none;
                    width: 14px;
                    height: 14px;
                }

                .print-drawer-content::-webkit-scrollbar-track {
                    background: oklch(var(--b2));
                    border: 1px solid oklch(var(--bc) / 0.1);
                }

                .print-drawer-content::-webkit-scrollbar-thumb {
                    background: oklch(var(--bc) / 0.4);
                    border-radius: 7px;
                    border: 2px solid oklch(var(--b2));
                    min-height: 30px;
                    min-width: 30px;
                }

                .print-drawer-content::-webkit-scrollbar-thumb:hover {
                    background: oklch(var(--bc) / 0.6);
                }

                .print-drawer-content::-webkit-scrollbar-thumb:active {
                    background: oklch(var(--bc) / 0.7);
                }

                .print-drawer-content::-webkit-scrollbar-corner {
                    background: oklch(var(--b2));
                }
            `}</style>
        </div>
    );
}

export default PrintDrawer;
