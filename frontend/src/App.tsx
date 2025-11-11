import { useState } from "react";
import Layout from "./components/Layout";
import Editor from "./pages/Editor";
import PrintPreview from "./pages/PrintPreview";
import Settings from "./pages/Settings";

/**
 * Main application component
 *
 * Manages routing between different views (Editor, Print Preview, Settings)
 * and provides the overall application layout.
 */
function App() {
    // Current active view
    const [currentView, setCurrentView] = useState<"editor" | "print" | "settings">("editor");

    // Render the appropriate page based on current view
    const renderPage = () => {
        switch (currentView) {
            case "editor":
                return <Editor />;
            case "print":
                return <PrintPreview />;
            case "settings":
                return <Settings />;
            default:
                return <Editor />;
        }
    };

    return (
        <Layout currentView={currentView} onNavigate={setCurrentView}>
            {renderPage()}
        </Layout>
    );
}

export default App;
