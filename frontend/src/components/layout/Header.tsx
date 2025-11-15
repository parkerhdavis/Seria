import { useState, useEffect } from "react";
import { open, save } from "@tauri-apps/plugin-dialog";
import { useCellStore } from "@stores/cellStore";
import { useFileTreeStore } from "@stores/fileTreeStore";
import { useSettingsStore } from "@stores/settingsStore";
import RowColoringDropdown from "../toolbar/RowColoringDropdown";

interface HeaderProps {
    onTogglePrintPreview?: () => void;
    onToggleSidebar?: () => void;
    isSidebarOpen?: boolean;
    onFilePickerOpenChange: (isOpen: boolean) => void;
}

/**
 * Application header component
 *
 * Displays the current file name, provides file operation buttons,
 * and includes theme toggle, print preview toggle, sidebar toggle, and mobile menu toggle.
 */
function Header({ onTogglePrintPreview, onToggleSidebar, isSidebarOpen, onFilePickerOpenChange }: HeaderProps) {
    // Local state for visual feedback
    const [showSaveSuccess, setShowSaveSuccess] = useState(false);
    const [showReloadConfirm, setShowReloadConfirm] = useState(false);
    const [showNewConfirm, setShowNewConfirm] = useState(false);

    // Get Cell Store state and actions
    const { headers, fileInfo, isDirty, isLoading, lastSavedAt, loadCells, loadCellsProgressive, reloadCells, saveCells, clearData, addRow, createNew, importFromScreenplay } = useCellStore();

    // Get settings store state and actions
    const { wrapText, setWrapText, showColumnSeparators, setShowColumnSeparators, autoFitColumns, setAutoFitColumns } = useSettingsStore();

    // Get file tree store to check if file is in tree
    const { isFileInTree } = useFileTreeStore();

    // Check if current file is outside the tree
    const isOutsideTree = fileInfo && !isFileInTree(fileInfo.path);

    // Check if we have data loaded
    const hasData = headers.length > 0;

    // Trigger save success animation when lastSavedAt changes
    useEffect(() => {
        if (lastSavedAt) {
            setShowSaveSuccess(true);
            const timer = setTimeout(() => setShowSaveSuccess(false), 1000);
            return () => clearTimeout(timer);
        }
    }, [lastSavedAt]);

    // Open file dialog and load selected file
    const handleOpen = async () => {
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
                // Use progressive loading for better UX (shows grid immediately, loads in chunks)
                await loadCellsProgressive(filePath);
                // Blur the active element (Open button) so keyboard shortcuts work
                if (document.activeElement instanceof HTMLElement) {
                    document.activeElement.blur();
                }
                onFilePickerOpenChange(false);
            } else {
                // User cancelled, close overlay
                onFilePickerOpenChange(false);
            }
        } catch (error) {
            console.error("Failed to open file:", error);
            onFilePickerOpenChange(false);
        }
    };

    // Save current file
    const handleSave = async () => {
        try {
            await saveCells();
        } catch (error) {
            // If this is a temp file, show the Save As dialog instead
            if (error instanceof Error && error.message === "TEMP_FILE_NEEDS_LOCATION") {
                await handleSaveAs();
            } else {
                console.error("Failed to save file:", error);
            }
        }
    };

    // Reload current file from disk
    const handleReload = async () => {
        setShowReloadConfirm(false);
        try {
            await reloadCells();
        } catch (error) {
            console.error("Failed to reload file:", error);
        }
    };

    // Save as - show save dialog and save to new location
    const handleSaveAs = async () => {
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
                const { saveCellAs } = useCellStore.getState();
                // Keep overlay visible during save
                await saveCellAs(filePath);
                onFilePickerOpenChange(false);
            } else {
                // User cancelled, close overlay
                onFilePickerOpenChange(false);
            }
        } catch (error) {
            console.error("Failed to save file:", error);
            onFilePickerOpenChange(false);
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

    // Create new file
    const handleNew = async () => {
        // Check if current file has unsaved changes
        if (fileInfo && isDirty) {
            setShowNewConfirm(true);
        } else {
            // No unsaved changes, create new file directly
            await createNew();
        }
    };

    // Import file (screenplay to CSV for now)
    const handleImport = async () => {
        onFilePickerOpenChange(true);
        try {
            const filePath = await open({
                multiple: false,
                filters: [
                    { name: "Screenplay Files", extensions: ["txt"] },
                    { name: "All Files", extensions: ["*"] },
                ],
                title: "Import Screenplay File",
            });

            if (filePath && typeof filePath === "string") {
                // Keep overlay visible during import
                await importFromScreenplay(filePath);
                // Blur the active element so keyboard shortcuts work
                if (document.activeElement instanceof HTMLElement) {
                    document.activeElement.blur();
                }
                onFilePickerOpenChange(false);
            } else {
                // User cancelled, close overlay
                onFilePickerOpenChange(false);
            }
        } catch (error) {
            console.error("Failed to import file:", error);
            onFilePickerOpenChange(false);
        }
    };

    // Confirm new file creation (with save option)
    const handleNewConfirm = async (saveFirst: boolean) => {
        setShowNewConfirm(false);
        if (saveFirst) {
            try {
                await saveCells();
            } catch (error) {
                console.error("Failed to save file before creating new:", error);
                return;
            }
        }
        await createNew();
    };

    return (
        <header className="bg-black/70 border-b-6 border-black/80 shadow-sm flex">
            {/* Sidebar toggle - spans full toolbar height */}
            {!isSidebarOpen && (
                <button
                    className="btn btn-ghost h-full shadow-xl shadow-black flex-shrink-0 rounded-none border-r border-base-300 hover:bg-base-300"
                    onClick={onToggleSidebar}
                    title="Toggle Sidebar (Ctrl+.)"
                    style={{ minWidth: "3rem" }}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="inline-block w-5 h-5 stroke-current">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                    </svg>
                </button>
            )}

            {/* Toolbar rows container */}
            <div className="flex-1 flex flex-col">
                {/* Row 1: File Toolbar */}
                <div className="flex items-center px-2 py-2 gap-2">

                    {/* File info section */}
                    <div className="flex items-center gap-2">
                        
                        <button
                            className="btn btn-sm btn-ghost"
                            onClick={handleNew}
                            title="Create new file (Ctrl+N)"
                            disabled={isLoading}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            New
                        </button>

                        <button
                            className="btn btn-sm btn-ghost"
                            onClick={handleImport}
                            title="Import screenplay file to CSV"
                            disabled={isLoading}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                            </svg>
                            Import
                        </button>

                        {/* File operations - Open and Save */}
                        <button
                            className="btn btn-sm btn-ghost"
                            onClick={handleOpen}
                            title="Open Cell file (Ctrl+O)"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                            </svg>
                            Open
                        </button>

                        <button
                            className={`btn btn-sm transition-all ${
                                showSaveSuccess
                                    ? "btn-success scale-105"
                                    : isDirty
                                        ? "btn-primary"
                                        : "btn-ghost"
                            }`}
                            onClick={handleSave}
                            title="Save current file (Ctrl+S)"
                            disabled={!fileInfo || isLoading}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                            </svg>
                            Save
                        </button>

                        <button
                            className="btn btn-sm btn-ghost"
                            onClick={() => setShowReloadConfirm(true)}
                            title="Reload file from disk"
                            disabled={!fileInfo || isLoading}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            Reload
                        </button>

                        {/* Divider */}
                        <div className="divider divider-horizontal mx-0"></div>

                        <button
                            className="btn btn-sm btn-ghost"
                            onClick={() => addRow()}
                            title="Add new row"
                        >
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
                                    d="M12 4v16m8-8H4"
                                />
                            </svg>
                            Add Row
                        </button>

                        {/* Wrap Text toggle */}
                        <button
                            className={`btn btn-sm ${wrapText ? "btn-primary" : "btn-ghost"}`}
                            onClick={() => setWrapText(!wrapText)}
                            title="Toggle text wrapping in cells"
                        >
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
                                    d="M4 6h16M4 12h16m-7 6h7"
                                />
                            </svg>
                            Wrap Text
                        </button>

                        {/* Column Lines toggle */}
                        <button
                            className={`btn btn-sm ${showColumnSeparators ? "btn-primary" : "btn-ghost"}`}
                            onClick={() => setShowColumnSeparators(!showColumnSeparators)}
                            title="Toggle column separator lines"
                        >
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
                                    d="M9 4v16m6-16v16M4 9h16M4 15h16"
                                />
                            </svg>
                            Column Lines
                        </button>

                        {/* Auto-Fit toggle */}
                        <button
                            className={`btn btn-sm ${autoFitColumns ? "btn-primary" : "btn-ghost"}`}
                            onClick={() => setAutoFitColumns(!autoFitColumns)}
                            title="Auto-fit columns to available width"
                        >
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
                                    d="M8 7H20m0 0l-4-4m4 4l-4 4M16 17H4m0 0l4-4m-4 4l4 4"
                                />
                            </svg>
                            Auto-Fit
                        </button>

                        {/* Row Coloring dropdown */}
                        <RowColoringDropdown />
                    </div>
                        {isLoading && (
                            <span className="loading loading-spinner loading-sm"></span>
                        )}
                    </div>

                    

                {/* Row 2: Content Toolbar (only shown when data is loaded) */}
                {/*{hasData && (*/}
                {/*    <div className="flex items-center px-2 py-2 gap-2 bg-base-100 border-t border-base-300">*/}
                {/*        /!* Toolbar label *!/*/}
                {/*        /!*<span className="text-sm font-semibold text-base-content/70 w-20">Content:</span>*!/*/}
                
                {/*        /!* Add Row button *!/*/}
                {/*    </div>*/}
                {/*)}*/}
            </div>

            {/* Print preview toggle - spans full toolbar height */}
            <button
                className="btn btn-ghost h-full shadow-xl shadow-black flex-shrink-0 rounded-none border-l border-base-300 hover:bg-base-300"
                onClick={onTogglePrintPreview}
                title="Toggle Print Preview (Ctrl+\)"
                style={{ minWidth: "3rem" }}
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
            </button>

            {/* Reload Confirmation Modal */}
            {showReloadConfirm && (
                <div className="modal modal-open">
                    <div className="modal-box">
                        <h3 className="font-bold text-lg">Reload File from Disk?</h3>
                        <p className="py-4">
                            This will discard any unsaved changes and reload the file from disk.
                            {isDirty && (
                                <span className="block mt-2 text-warning font-semibold">
                                    Warning: You have unsaved changes that will be lost!
                                </span>
                            )}
                        </p>
                        <div className="modal-action">
                            <button
                                className="btn btn-ghost"
                                onClick={() => setShowReloadConfirm(false)}
                            >
                                Cancel
                            </button>
                            <button
                                className={`btn ${isDirty ? "btn-warning" : "btn-primary"}`}
                                onClick={handleReload}
                            >
                                Reload
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* New File Confirmation Modal */}
            {showNewConfirm && (
                <div className="modal modal-open">
                    <div className="modal-box">
                        <h3 className="font-bold text-lg">Save Changes Before Creating New File?</h3>
                        <p className="py-4">
                            You have unsaved changes in the current file. Would you like to save them before creating a new file?
                        </p>
                        <div className="modal-action">
                            <button
                                className="btn btn-ghost"
                                onClick={() => setShowNewConfirm(false)}
                            >
                                Cancel
                            </button>
                            <button
                                className="btn btn-warning"
                                onClick={() => handleNewConfirm(false)}
                            >
                                Discard Changes
                            </button>
                            <button
                                className="btn btn-primary"
                                onClick={() => handleNewConfirm(true)}
                            >
                                Save &amp; New
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </header>
    );
}

export default Header;
