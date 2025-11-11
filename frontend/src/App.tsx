import { useState, useEffect } from "react";
import Layout from "./components/Layout";
import Editor from "./pages/Editor";
import PrintDrawer from "@components/PrintDrawer";
import SettingsModal from "./components/SettingsModal";
import FindReplaceModal from "./components/FindReplaceModal";
import { useCSVStore } from "./stores/csvStore";
import { useFindReplaceStore } from "./stores/findReplaceStore";
import { DragProvider } from "./contexts/DragContext";

/**
 * Main application component
 *
 * Manages the editor view, print preview drawer, settings modal,
 * and global keyboard shortcuts.
 */
function App() {
    const [printPreviewPosition, setPrintPreviewPosition] = useState<"right" | "bottom" | null>(null);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [zoomLevel, setZoomLevel] = useState(100);
    const { saveCSV, undo, redo, canUndo, canRedo } = useCSVStore();
    const { openFind, openReplace } = useFindReplaceStore();

    // Apply zoom level to document
    useEffect(() => {
        document.body.style.zoom = `${zoomLevel}%`;
    }, [zoomLevel]);

    // Global keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = async (e: KeyboardEvent) => {
            // Ctrl+S - Save file
            if (e.ctrlKey && e.key === "s") {
                e.preventDefault();
                try {
                    await saveCSV();
                } catch (error) {
                    console.error("Save failed:", error);
                }
            }
            // Ctrl+\ - Toggle right print preview drawer
            else if (e.ctrlKey && e.key === "\\") {
                e.preventDefault();
                setPrintPreviewPosition((prev) => (prev === "right" ? null : "right"));
            }
            // Ctrl+/ - Toggle bottom print preview drawer
            else if (e.ctrlKey && e.key === "/") {
                e.preventDefault();
                setPrintPreviewPosition((prev) => (prev === "bottom" ? null : "bottom"));
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
    }, [saveCSV, openFind, openReplace, undo, redo, canUndo, canRedo]);

    return (
        <DragProvider>
            <Layout
                printPreviewPosition={printPreviewPosition}
                isSidebarOpen={isSidebarOpen}
                onTogglePrintPreview={(position: "right" | "bottom") => {
                    setPrintPreviewPosition((prev) => (prev === position ? null : position));
                }}
                onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
            >
                <Editor />

                <PrintDrawer
                    isOpen={printPreviewPosition === "right"}
                    position="right"
                    onClose={() => setPrintPreviewPosition(null)}
                />

                <PrintDrawer
                    isOpen={printPreviewPosition === "bottom"}
                    position="bottom"
                    onClose={() => setPrintPreviewPosition(null)}
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
