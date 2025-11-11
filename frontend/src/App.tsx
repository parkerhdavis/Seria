import { useState, useEffect } from "react";
import Layout from "./components/Layout";
import Editor from "./pages/Editor";
import PrintPreviewDrawer from "./components/PrintPreviewDrawer";
import SettingsModal from "./components/SettingsModal";
import { useCSVStore } from "./stores/csvStore";

/**
 * Main application component
 *
 * Manages the editor view, print preview drawer, settings modal,
 * and global keyboard shortcuts.
 */
function App() {
    const [isPrintPreviewOpen, setIsPrintPreviewOpen] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const { saveCSV } = useCSVStore();

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
            // Ctrl+\ - Toggle print preview drawer
            else if (e.ctrlKey && e.key === "\\") {
                e.preventDefault();
                setIsPrintPreviewOpen((prev) => !prev);
            }
            // Ctrl+, - Open settings modal
            else if (e.ctrlKey && e.key === ",") {
                e.preventDefault();
                setIsSettingsOpen(true);
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [saveCSV]);

    return (
        <Layout
            isPrintPreviewOpen={isPrintPreviewOpen}
            onTogglePrintPreview={() => setIsPrintPreviewOpen((prev) => !prev)}
        >
            <Editor />

            <PrintPreviewDrawer
                isOpen={isPrintPreviewOpen}
                onClose={() => setIsPrintPreviewOpen(false)}
            />

            <SettingsModal
                isOpen={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
            />
        </Layout>
    );
}

export default App;
