import { useState, useEffect } from "react";
import Layout from "@components/layout/Layout";
import Editor from "./pages/Editor";
import PrintDrawer from "@components/prints/PrintDrawer";
import SettingsModal from "@components/modals/SettingsModal";
import FindReplaceModal from "@components/modals/FindReplaceModal";
import { useCellStore } from "@stores/cellStore";
import { useFindReplaceStore } from "./stores/findReplaceStore";
import { useDrawerStore } from "./stores/drawerStore";
import { useFileConfigStore } from "./stores/fileConfigStore";
import { useSettingsStore } from "./stores/settingsStore";
import { debouncedSaveCurrentFileConfig } from "./utils/configPersistence";
import { DragProvider } from "./contexts/DragContext";
import { open } from "@tauri-apps/plugin-dialog";

/**
 * Main application component
 *
 * Manages the editor view, print preview drawer, settings modal,
 * and global keyboard shortcuts.
 */
function App() {
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [zoomLevel, setZoomLevel] = useState(100);
    const { saveCells, loadCells, undo, redo, canUndo, canRedo, columnFilters, columnOrder, currentFile } = useCellStore();
    const { openFind, openReplace } = useFindReplaceStore();
    const { position: printPreviewPosition, togglePosition, rightDrawerSize, bottomDrawerSize } = useDrawerStore();
    const { loadConfigs } = useFileConfigStore();
    const {
        rowColoringMode,
        rowColorFilter,
        wrapText,
        showColumnSeparators,
        autoFitColumns,
        hoverHighlightMode,
    } = useSettingsStore();

    // Load file configs on app startup
    useEffect(() => {
        loadConfigs().catch((error) => {
            console.error("Failed to load file configs:", error);
        });
    }, [loadConfigs]);

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

    // Global keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = async (e: KeyboardEvent) => {
            // Ctrl+O - Open file
            if (e.ctrlKey && e.key === "o") {
                e.preventDefault();
                try {
                    const filePath = await open({
                        multiple: false,
                        filters: [
                            { name: "Cell Files", extensions: ["cell"] },
                            { name: "All Files", extensions: ["*"] },
                        ],
                        title: "Open Cell File",
                    });
                    if (filePath) {
                        await loadCells(filePath);
                        // Blur the active element so keyboard shortcuts continue to work
                        if (document.activeElement instanceof HTMLElement) {
                            document.activeElement.blur();
                        }
                    }
                } catch (error) {
                    console.error("Open file failed:", error);
                }
            }
            // Ctrl+S - Save file
            else if (e.ctrlKey && e.key === "s") {
                e.preventDefault();
                try {
                    await saveCells();
                } catch (error) {
                    console.error("Save failed:", error);
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
    }, [saveCells, loadCells, openFind, openReplace, undo, redo, canUndo, canRedo, togglePosition]);

    return (
        <DragProvider>
            <Layout
                printPreviewPosition={printPreviewPosition}
                isSidebarOpen={isSidebarOpen}
                onTogglePrintPreview={(position: "right" | "bottom") => {
                    togglePosition(position);
                }}
                onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
            >
                <Editor />

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
            </Layout>
        </DragProvider>
    );
}

export default App;
