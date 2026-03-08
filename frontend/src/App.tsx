import { useState, useEffect, useRef, useCallback } from "react";
import Layout from "@components/layout/Layout";
import LoadingScreen from "@components/layout/LoadingScreen";
import ToastContainer from "@components/Toast";
import Editor from "./pages/Editor";
import PrintDrawer from "@components/prints/PrintDrawer";
import SettingsModal from "@components/modals/SettingsModal";
import FindReplaceModal from "@components/modals/FindReplaceModal";
import GoToModal from "@components/modals/GoToModal";
import ColumnManagerModal from "@components/modals/ColumnManagerModal";
import WorkspaceManagerModal from "@components/modals/WorkspaceManagerModal";
import { useCellStore } from "@stores/cellStore";
import { useCellColumnStore } from "@stores/cellColumnStore";
import { useCellFilterStore } from "@stores/cellFilterStore";
import { useWorkspaceStore } from "@stores/workspaceStore";
import { useFindReplaceStore } from "@/stores/findReplaceStore";
import { useDrawerStore } from "@/stores/drawerStore";
import { useFileConfigStore } from "@/stores/fileConfigStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useGlobalConfigStore } from "@/stores/globalConfigStore";
import { debouncedSaveCurrentFileConfig } from "@/utils/configPersistence";
import { DragProvider } from "./contexts/DragContext";
import { open, save } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { serializeCell } from "@utils/cellParser";
import { logger } from "@/utils/logger";
import { isErrorWithMessage } from "@/utils/tauriErrorHandler";

/**
 * Main application component
 *
 * Manages the editor view, print preview drawer, settings modal,
 * and global keyboard shortcuts.
 */
function App() {
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isGoToOpen, setIsGoToOpen] = useState(false);
    const [isColumnManagerOpen, setIsColumnManagerOpen] = useState(false);
    const [isWorkspaceManagerOpen, setIsWorkspaceManagerOpen] = useState(false);
    const [zoomLevel, setZoomLevel] = useState(100);
    const [isInitializing, setIsInitializing] = useState(true);
    const [isFilePickerOpen, setIsFilePickerOpen] = useState(false);

    // Save lock to prevent concurrent saves
    const isSavingRef = useRef(false);

    // Use Zustand selectors to reduce subscription scope and prevent unnecessary re-renders
    const saveCells = useCellStore((state) => state.saveCells);
    const loadCells = useCellStore((state) => state.loadCells);
    const loadCellsProgressive = useCellStore((state) => state.loadCellsProgressive);
    const undo = useCellStore((state) => state.undo);
    const redo = useCellStore((state) => state.redo);
    const canUndo = useCellStore((state) => state.canUndo);
    const canRedo = useCellStore((state) => state.canRedo);
    const columnFilters = useCellFilterStore((state) => state.columnFilters);
    const columnOrder = useCellColumnStore((state) => state.columnOrder);
    const currentFile = useCellStore((state) => state.currentFile);
    const isTempFile = useCellStore((state) => state.isTempFile);
    const isDirty = useCellStore((state) => state.isDirty);
    const data = useCellStore((state) => state.data);
    const headers = useCellStore((state) => state.headers);

    const openFind = useFindReplaceStore((state) => state.openFind);
    const openReplace = useFindReplaceStore((state) => state.openReplace);

    const printPreviewPosition = useDrawerStore((state) => state.position);
    const togglePosition = useDrawerStore((state) => state.togglePosition);
    const setPosition = useDrawerStore((state) => state.setPosition);
    const setRightDrawerSize = useDrawerStore((state) => state.setRightDrawerSize);
    const setBottomDrawerSize = useDrawerStore((state) => state.setBottomDrawerSize);
    const rightDrawerSize = useDrawerStore((state) => state.rightDrawerSize);
    const bottomDrawerSize = useDrawerStore((state) => state.bottomDrawerSize);

    const loadConfigs = useFileConfigStore((state) => state.loadConfigs);
    const loadConfig = useGlobalConfigStore((state) => state.loadConfig);
    const config = useGlobalConfigStore((state) => state.config);

    const theme = useSettingsStore((state) => state.theme);
    const rowColoringMode = useSettingsStore((state) => state.rowColoringMode);
    const rowColorFilter = useSettingsStore((state) => state.rowColorFilter);
    const wrapText = useSettingsStore((state) => state.wrapText);
    const showColumnSeparators = useSettingsStore((state) => state.showColumnSeparators);
    const autoFitColumns = useSettingsStore((state) => state.autoFitColumns);
    const hoverHighlightMode = useSettingsStore((state) => state.hoverHighlightMode);
    const appFont = useSettingsStore((state) => state.appFont);

    // Apply theme to document whenever theme setting changes
    useEffect(() => {
        const effectiveTheme = theme === "auto" ? "dark" : theme;
        document.documentElement.setAttribute("data-theme", effectiveTheme);
    }, [theme]);

    // Load global config and file configs on app startup
    useEffect(() => {
        const initializeApp = async () => {
            try {
                // Load file configs first
                await loadConfigs();

                // Load global config
                await loadConfig();
            } catch (error: unknown) {
                logger.error("Failed to initialize app:", error);
            } finally {
                // Mark initialization as complete
                setIsInitializing(false);
            }
        };

        initializeApp();
    }, [loadConfigs, loadConfig]);

    // Auto-reopen last file if enabled
    useEffect(() => {
        // Only run once config is loaded
        if (!config) return;

        // Only auto-open if enabled and there's a last file and no file is currently open
        if (config.autoReopenLastFile && config.lastOpenedFile && !currentFile) {
            loadCellsProgressive(config.lastOpenedFile).catch((error: unknown) => {
                logger.error("Failed to auto-reopen last file:", error);
            });
        }
    }, [config, loadCellsProgressive, currentFile]);

    // Save config when settings, filters, or drawer state change
    useEffect(() => {
        // Only save if we have a file open
        if (currentFile) {
            debouncedSaveCurrentFileConfig(1000);
        }
    }, [
        rowColoringMode,
        rowColorFilter,
        wrapText,
        showColumnSeparators,
        autoFitColumns,
        hoverHighlightMode,
        columnFilters,
        columnOrder,
        printPreviewPosition,
        rightDrawerSize,
        bottomDrawerSize,
        currentFile,
    ]);

    // Apply zoom level to document
    useEffect(() => {
        document.body.style.zoom = `${zoomLevel}%`;
    }, [zoomLevel]);

    // Apply app font to document
    useEffect(() => {
        const fontMap: Record<string, string> = {
            system: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, sans-serif",
            "courier-prime": "\"Courier Prime\", \"Courier New\", Courier, monospace",
        };

        const fontFamily = fontMap[appFont] || fontMap.system;
        document.documentElement.style.setProperty("--font-app", fontFamily);
    }, [appFont]);

    // Autosave for temp files
    useEffect(() => {
        // Only autosave if this is a temp file and it's dirty
        if (!isTempFile || !isDirty || !currentFile) {
            return;
        }

        // Set up autosave timer (save every 2 seconds)
        const autosaveTimer = setTimeout(async () => {
            // Skip if another save is in progress
            if (isSavingRef.current) {
                return;
            }

            isSavingRef.current = true;
            try {
                // Use the invoke command directly to bypass the temp file check in saveCells
                const state = useCellStore.getState();
                const cellContent = serializeCell(
                    { headers: state.headers, data: state.data },
                    state.delimiter
                );

                await invoke("save_cell_file", {
                    path: currentFile,
                    content: cellContent,
                });

                // Update the store to mark as saved (without changing lastSavedAt to avoid UI flash)
                useCellStore.setState({ isDirty: false });

                logger.debug("Autosaved temp file");
            } catch (error: unknown) {
                logger.error("Autosave failed:", error);
            } finally {
                isSavingRef.current = false;
            }
        }, 2000);

        return () => clearTimeout(autosaveTimer);
    }, [isTempFile, isDirty, currentFile, data, headers]);

    // Apply workspace layout
    const applyWorkspaceLayout = useCallback((layout: {
        printDrawerPosition: "right" | "bottom" | null;
        printDrawerSize: number;
        sidebarOpen: boolean;
        zoomLevel: number;
    }) => {
        // Apply drawer position and size
        setPosition(layout.printDrawerPosition);
        if (layout.printDrawerPosition === "right") {
            setRightDrawerSize(layout.printDrawerSize);
        } else if (layout.printDrawerPosition === "bottom") {
            setBottomDrawerSize(layout.printDrawerSize);
        }

        // Apply sidebar state
        setIsSidebarOpen(layout.sidebarOpen);

        // Apply zoom level
        setZoomLevel(layout.zoomLevel);
    }, [setPosition, setRightDrawerSize, setBottomDrawerSize]);

    // Global keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = async (e: KeyboardEvent) => {
            // Ctrl+O - Open file
            if (e.ctrlKey && e.key === "o") {
                e.preventDefault();
                setIsFilePickerOpen(true);
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
                        // Keep overlay visible during loading
                        await loadCells(filePath);
                        // Blur the active element so keyboard shortcuts continue to work
                        if (document.activeElement instanceof HTMLElement) {
                            document.activeElement.blur();
                        }
                        setIsFilePickerOpen(false);
                    } else {
                        // User cancelled, close overlay
                        setIsFilePickerOpen(false);
                    }
                } catch (error: unknown) {
                    logger.error("Open file failed:", error);
                    setIsFilePickerOpen(false);
                }
            }
            // Ctrl+S - Save file
            else if (e.ctrlKey && e.key === "s") {
                e.preventDefault();
                // Skip if another save is in progress
                if (isSavingRef.current) {
                    return;
                }
                isSavingRef.current = true;
                try {
                    await saveCells();
                } catch (error: unknown) {
                    // If this is a temp file, show Save As dialog
                    if (isErrorWithMessage(error, "TEMP_FILE_NEEDS_LOCATION")) {
                        setIsFilePickerOpen(true);
                        try {
                            const fileInfo = useCellStore.getState().fileInfo;
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
                                const { saveCellAs } = useCellStore.getState();
                                // Keep overlay visible during save
                                await saveCellAs(filePath);
                                setIsFilePickerOpen(false);
                            } else {
                                // User cancelled, close overlay
                                setIsFilePickerOpen(false);
                            }
                        } catch (saveError: unknown) {
                            logger.error("Save As failed:", saveError);
                            setIsFilePickerOpen(false);
                        }
                    } else {
                        logger.error("Save failed:", error);
                    }
                } finally {
                    isSavingRef.current = false;
                }
            }
            // Ctrl+\ - Toggle right print preview drawer
            else if (e.ctrlKey && e.key === "\\") {
                e.preventDefault();
                togglePosition("right");
            }
            // Ctrl+/ - Toggle bottom print preview drawer
            else if (e.ctrlKey && e.key === "/") {
                e.preventDefault();
                togglePosition("bottom");
            }
            // Ctrl+. - Toggle left sidebar
            else if (e.ctrlKey && e.key === ".") {
                e.preventDefault();
                setIsSidebarOpen((prev) => !prev);
            }
            // Ctrl+, - Open settings modal
            else if (e.ctrlKey && e.key === ",") {
                e.preventDefault();
                setIsSettingsOpen(true);
            }
            // Ctrl+= - Zoom in
            else if (e.ctrlKey && (e.key === "=" || e.key === "+")) {
                e.preventDefault();
                setZoomLevel((prev) => Math.min(prev + 10, 200));
            }
            // Ctrl+- - Zoom out
            else if (e.ctrlKey && e.key === "-") {
                e.preventDefault();
                setZoomLevel((prev) => Math.max(prev - 10, 50));
            }
            // Ctrl+0 - Reset zoom
            else if (e.ctrlKey && e.key === "0") {
                e.preventDefault();
                setZoomLevel(100);
            }
            // Ctrl+F - Open find
            else if (e.ctrlKey && e.key === "f") {
                e.preventDefault();
                openFind();
            }
            // Ctrl+R - Open find and replace
            else if (e.ctrlKey && e.key === "r") {
                e.preventDefault();
                openReplace();
            }
            // Ctrl+G - Open go to
            else if (e.ctrlKey && e.key === "g") {
                e.preventDefault();
                setIsGoToOpen(true);
            }
            // Ctrl+M - Open column manager
            else if (e.ctrlKey && e.key === "m") {
                e.preventDefault();
                setIsColumnManagerOpen(true);
            }
            // Ctrl+Shift+W - Open workspace manager
            else if (e.ctrlKey && e.shiftKey && e.key === "W") {
                e.preventDefault();
                setIsWorkspaceManagerOpen(true);
            }
            // Ctrl+1 through Ctrl+9 - Quick switch to layout presets
            else if (e.ctrlKey && e.key >= "1" && e.key <= "9" && !e.shiftKey && !e.altKey) {
                e.preventDefault();
                const layoutIndex = parseInt(e.key) - 1;
                const layouts = useWorkspaceStore.getState().layouts
                    .sort((a, b) => b.lastUsed - a.lastUsed);

                if (layouts[layoutIndex]) {
                    const layout = useWorkspaceStore.getState().loadLayout(layouts[layoutIndex].id);
                    if (layout) {
                        applyWorkspaceLayout(layout);
                        useWorkspaceStore.getState().updateLayoutUsage(layouts[layoutIndex].id);
                    }
                }
            }
            // Ctrl+Z - Undo
            else if (e.ctrlKey && !e.shiftKey && e.key === "z") {
                e.preventDefault();
                if (canUndo()) {
                    undo();
                }
            }
            // Ctrl+Shift+Z or Ctrl+Y - Redo
            else if ((e.ctrlKey && e.shiftKey && e.key === "Z") || (e.ctrlKey && e.key === "y")) {
                e.preventDefault();
                if (canRedo()) {
                    redo();
                }
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [saveCells, loadCells, openFind, openReplace, undo, redo, canUndo, canRedo, togglePosition, applyWorkspaceLayout]);

    // Determine loading state and message
    // Only show blocking LoadingScreen during initialization, not file loading
    // (file loading uses non-blocking progress banner in CellGridVirtualized)
    const showLoading = isInitializing;
    const showBlurOverlay = isFilePickerOpen || showLoading;
    const loadingMessage = isInitializing ? "Initializing Seria..." : "Loading...";

    return (
        <DragProvider>
            {/* Toast notifications */}
            <ToastContainer />

            {/* Blur overlay - shown when file picker is open OR when loading */}
            {showBlurOverlay && (
                <div className="fixed inset-0 z-[9998] bg-base-100/20 backdrop-blur-sm" />
            )}

            {/* Loading screen card - shown only during initialization */}
            {showLoading && <LoadingScreen message={loadingMessage} />}

            <Layout
                printPreviewPosition={printPreviewPosition}
                isSidebarOpen={isSidebarOpen}
                onTogglePrintPreview={(position: "right" | "bottom") => {
                    togglePosition(position);
                }}
                onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
                onFilePickerOpenChange={setIsFilePickerOpen}
            >
                <Editor onFilePickerOpenChange={setIsFilePickerOpen} />

                <PrintDrawer
                    isOpen={printPreviewPosition === "right"}
                    position="right"
                />

                <PrintDrawer
                    isOpen={printPreviewPosition === "bottom"}
                    position="bottom"
                />

                <SettingsModal
                    isOpen={isSettingsOpen}
                    onClose={() => setIsSettingsOpen(false)}
                />

                <FindReplaceModal />

                <GoToModal
                    isOpen={isGoToOpen}
                    onClose={() => setIsGoToOpen(false)}
                />

                <ColumnManagerModal
                    isOpen={isColumnManagerOpen}
                    onClose={() => setIsColumnManagerOpen(false)}
                />

                {/* Workspace Manager Modal */}
                <WorkspaceManagerModal
                    isOpen={isWorkspaceManagerOpen}
                    onClose={() => setIsWorkspaceManagerOpen(false)}
                    currentState={{
                        isSidebarOpen,
                        zoomLevel,
                    }}
                    onApplyLayout={applyWorkspaceLayout}
                />
            </Layout>
        </DragProvider>
    );
}

export default App;
