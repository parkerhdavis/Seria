import { useState, useEffect } from "react";
import { open, save } from "@tauri-apps/plugin-dialog";
import { useCSVStore } from "@stores/csvStore";

interface HeaderProps {
    currentView: "editor" | "print" | "settings";
}

/**
 * Application header component
 *
 * Displays the current file name, provides file operation buttons,
 * and includes theme toggle and mobile menu toggle.
 */
function Header({ currentView }: HeaderProps) {
    const [theme, setTheme] = useState<"light" | "dark">("light");

    // Get CSV store state and actions
    const { fileInfo, isDirty, isLoading, loadCSV, saveCSV, clearData } = useCSVStore();

    // Apply theme to document
    useEffect(() => {
        document.documentElement.setAttribute("data-theme", theme);
    }, [theme]);

    // Toggle between light and dark theme
    const toggleTheme = () => {
        setTheme(theme === "light" ? "dark" : "light");
    };

    // Open file dialog and load selected CSV
    const handleOpen = async () => {
        try {
            const filePath = await open({
                multiple: false,
                filters: [
                    { name: "CSV Files", extensions: ["csv"] },
                    { name: "All Files", extensions: ["*"] },
                ],
                title: "Open CSV File",
            });
            if (filePath) {
                await loadCSV(filePath);
            }
        } catch (error) {
            console.error("Failed to open file:", error);
        }
    };

    // Save current file
    const handleSave = async () => {
        try {
            await saveCSV();
        } catch (error) {
            console.error("Failed to save file:", error);
        }
    };

    // Save as - show save dialog and save to new location
    const handleSaveAs = async () => {
        try {
            const fileName = fileInfo?.name || "untitled.csv";
            const filePath = await save({
                filters: [{ name: "CSV Files", extensions: ["csv"] }],
                title: "Save CSV File",
                defaultPath: fileName,
            });
            if (filePath) {
                const { saveCSVAs } = useCSVStore.getState();
                await saveCSVAs(filePath);
            }
        } catch (error) {
            console.error("Failed to save file:", error);
        }
    };

    // Close current file
    const handleClose = () => {
        if (isDirty) {
            // TODO: Show confirmation dialog for unsaved changes
            const confirmed = confirm("You have unsaved changes. Close anyway?");
            if (!confirmed) {
                return;
            }
        }
        clearData();
    };

    return (
        <header className="navbar bg-base-200 border-b border-base-300">
            {/* Mobile menu toggle */}
            <div className="flex-none lg:hidden">
                <label htmlFor="main-drawer" className="btn btn-square btn-ghost">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="inline-block w-5 h-5 stroke-current">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"></path>
                    </svg>
                </label>
            </div>

            {/* File name / title */}
            <div className="flex-1 px-4">
                <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold">
                        {fileInfo?.name || "No file open"}
                    </h2>
                    {currentView === "editor" && isDirty && (
                        <span className="badge badge-warning badge-sm">Unsaved</span>
                    )}
                    {isLoading && (
                        <span className="loading loading-spinner loading-sm"></span>
                    )}
                </div>
            </div>

            {/* File operations */}
            {currentView === "editor" && (
                <div className="flex-none gap-2">
                    <button
                        className="btn btn-sm btn-ghost"
                        onClick={handleOpen}
                        title="Open CSV file"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                        </svg>
                        Open
                    </button>

                    <button
                        className="btn btn-sm btn-primary"
                        onClick={handleSave}
                        title="Save current file"
                        disabled={!fileInfo || isLoading}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                        </svg>
                        Save
                    </button>

                    <div className="dropdown dropdown-end">
                        <label tabIndex={0} className="btn btn-sm btn-ghost">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                            </svg>
                        </label>
                        <ul tabIndex={0} className="dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-box w-52">
                            <li><a onClick={handleSaveAs}>Save As...</a></li>
                            <li><a onClick={handleClose}>Close File</a></li>
                        </ul>
                    </div>
                </div>
            )}

            {/* Theme toggle */}
            <div className="flex-none ml-4">
                <button
                    className="btn btn-square btn-ghost"
                    onClick={toggleTheme}
                    title={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
                >
                    {theme === "light" ? (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                        </svg>
                    ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                        </svg>
                    )}
                </button>
            </div>
        </header>
    );
}

export default Header;
