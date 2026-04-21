/**
 * TitleBar Component
 *
 * Custom window title bar with window controls (minimize, maximize, close),
 * File menu, and dynamic title based on currently open file.
 *
 * Requires native window decorations to be disabled in tauri.conf.json.
 */

import { getCurrentWindow } from "@utils/window";
import { useCellStore } from "@/stores/cellStore";
import { useState, useEffect } from "react";
import { logger } from "@/utils/logger";
import { useFileOperations } from "@/hooks/useFileOperations";

const appWindow = getCurrentWindow();

interface TitleBarProps {
    onFilePickerOpenChange: (isOpen: boolean) => void;
}

export function TitleBar({ onFilePickerOpenChange }: TitleBarProps) {
    const fileInfo = useCellStore((state) => state.fileInfo);
    const isDirty = useCellStore((state) => state.isDirty);
    const isLoading = useCellStore((state) => state.isLoading);
    const createNew = useCellStore((state) => state.createNew);

    const {
        handleOpen,
        handleSave,
        handleSaveAs,
        handleReload,
        handleNew: handleNewFromHook,
        handleCloseFile: handleCloseFileFromHook,
        handleImportScreenplay: handleImportAsScreenplay,
        handleExportScreenplay: handleExportAsScreenplay,
    } = useFileOperations({ onFilePickerOpenChange });

    const [isMaximized, setIsMaximized] = useState(false);
    const [showReloadConfirm, setShowReloadConfirm] = useState(false);
    const [showNewConfirm, setShowNewConfirm] = useState(false);
    const [showCloseConfirm, setShowCloseConfirm] = useState(false);

    // Get the display title based on whether a file is open
    const getTitle = () => {
        if (fileInfo && fileInfo.name) {
            return `Seria - ${fileInfo.name}`;
        }
        return "Seria - Data for Writers";
    };

    // Check if window is maximized on mount and when it changes
    useEffect(() => {
        const checkMaximized = async () => {
            const maximized = await appWindow.isMaximized();
            setIsMaximized(maximized);
        };

        checkMaximized();

        // Listen for window resize events to update maximized state
        const unlisten = appWindow.onResized(() => {
            checkMaximized();
        });

        // Debug logging
        logger.debug("TitleBar mounted - Tauri window API available:", !!appWindow);
        logger.debug("Window label:", appWindow.label);
        logger.debug("Running in Tauri:", "__TAURI__" in window);
        logger.debug("User agent:", navigator.userAgent);

        return () => {
            unlisten.then((fn) => fn());
        };
    }, []);

    // Window control handlers
    const handleMinimize = () => {
        appWindow.minimize();
    };

    const handleMaximize = async () => {
        await appWindow.toggleMaximize();
        const maximized = await appWindow.isMaximized();
        setIsMaximized(maximized);
    };

    const handleClose = () => {
        appWindow.close();
    };

    // Wrap reload to dismiss confirmation modal first
    const handleReloadWithConfirm = async () => {
        setShowReloadConfirm(false);
        await handleReload();
    };

    // New file with unsaved changes check
    const handleNew = async () => {
        if (fileInfo && isDirty) {
            setShowNewConfirm(true);
        } else {
            await createNew();
        }
    };

    const handleNewConfirm = async (saveFirst: boolean) => {
        setShowNewConfirm(false);
        await handleNewFromHook(saveFirst);
    };

    // Close file with unsaved changes check
    const handleCloseFile = async () => {
        if (fileInfo && isDirty) {
            setShowCloseConfirm(true);
        } else {
            await handleCloseFileFromHook();
        }
    };

    const handleCloseConfirm = async (saveFirst: boolean) => {
        setShowCloseConfirm(false);
        await handleCloseFileFromHook(saveFirst);
    };

    // Placeholder handlers for future import formats
    const handleImportAsFountain = async () => {
        // TODO: Implement Fountain import
        logger.debug("Fountain import coming soon");
    };

    const handleImportAsPDF = async () => {
        // TODO: Implement PDF screenplay import
        logger.debug("PDF import coming soon");
    };

    // Placeholder handlers for future export formats
    const handleExportAsFountain = async () => {
        // TODO: Implement Fountain export
        logger.debug("Fountain export coming soon");
    };

    return (
        <>
            <div
                data-tauri-drag-region
                className="relative flex flex-row items-center h-10 titlebar-bg border-b-4 text-gray-100 select-none"
                onMouseDown={(e) => {
                    logger.debug("Title bar mousedown:", {
                        target: e.target,
                        currentTarget: e.currentTarget,
                        button: e.button,
                        hasAttribute: e.currentTarget.hasAttribute('data-tauri-drag-region')
                    });
                }}
                onDoubleClick={handleMaximize}
            >
                {/* Left section - File Menu */}
                <div className="flex items-center h-full flex-1" style={{ pointerEvents: 'none' }}>
                    <div className="dropdown" style={{ pointerEvents: 'auto', WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
                        <label
                            tabIndex={0}
                            className="btn btn-ghost btn-sm h-full rounded-none px-3 text-xs font-medium hover:bg-white/10"
                        >
                            File
                        </label>
                        <ul
                            tabIndex={0}
                            className="dropdown-content z-[100] menu p-1 shadow-lg bg-base-100 rounded-box w-48 border border-base-300"
                        >
                            <li>
                                <a onClick={handleNew} className="text-sm">
                                    New
                                    <span className="ml-auto text-xs opacity-60">Ctrl+N</span>
                                </a>
                            </li>
                            <li>
                                <a onClick={handleOpen} className="text-sm">
                                    Open
                                    <span className="ml-auto text-xs opacity-60">Ctrl+O</span>
                                </a>
                            </li>
                            <li>
                                <a
                                    onClick={handleSave}
                                    className={`text-sm ${!fileInfo || isLoading ? "disabled opacity-50" : ""}`}
                                >
                                    Save
                                    <span className="ml-auto text-xs opacity-60">Ctrl+S</span>
                                </a>
                            </li>
                            <li>
                                <a
                                    onClick={handleSaveAs}
                                    className={`text-sm ${!fileInfo || isLoading ? "disabled opacity-50" : ""}`}
                                >
                                    Save As...
                                </a>
                            </li>
                            <li>
                                <a
                                    onClick={handleCloseFile}
                                    className={`text-sm ${!fileInfo || isLoading ? "disabled opacity-50" : ""}`}
                                >
                                    Close File
                                </a>
                            </li>
                            <li className="menu-title">
                                <span className="text-xs"></span>
                            </li>
                            <li>
                                <a
                                    onClick={() => setShowReloadConfirm(true)}
                                    className={`text-sm ${!fileInfo || isLoading ? "disabled opacity-50" : ""}`}
                                >
                                    Reload
                                </a>
                            </li>
                            <li>
                                <details>
                                    <summary className="text-sm">Import...</summary>
                                    <ul className="p-1 bg-base-100 rounded-box shadow-lg border border-base-300">
                                        <li>
                                            <a onClick={handleImportAsScreenplay} className="text-sm">
                                                as Screenplay
                                            </a>
                                        </li>
                                        <li>
                                            <a onClick={handleImportAsFountain} className="text-sm opacity-50">
                                                as Fountain
                                                <span className="ml-auto text-xs opacity-60">Soon</span>
                                            </a>
                                        </li>
                                        <li>
                                            <a onClick={handleImportAsPDF} className="text-sm opacity-50">
                                                as PDF Screenplay
                                                <span className="ml-auto text-xs opacity-60">Soon</span>
                                            </a>
                                        </li>
                                    </ul>
                                </details>
                            </li>
                            <li>
                                <details>
                                    <summary className={`text-sm ${!fileInfo || isLoading ? "disabled opacity-50" : ""}`}>
                                        Export...
                                    </summary>
                                    <ul className="p-1 bg-base-100 rounded-box shadow-lg border border-base-300">
                                        <li>
                                            <a onClick={handleExportAsScreenplay} className={`text-sm ${!fileInfo || isLoading ? "disabled opacity-50 pointer-events-none" : ""}`}>
                                                as Screenplay
                                            </a>
                                        </li>
                                        <li>
                                            <a onClick={handleExportAsFountain} className="text-sm opacity-50">
                                                as Fountain
                                                <span className="ml-auto text-xs opacity-60">Soon</span>
                                            </a>
                                        </li>
                                    </ul>
                                </details>
                            </li>
                        </ul>
                    </div>
                </div>

                {/* Center section - Title and status badge - draggable */}
                <div className="absolute left-1/2 transform -translate-x-1/2 h-full flex items-center gap-4 cursor-default" style={{ pointerEvents: 'none' }}>
                    <span className="text-sm font-medium text-base-content">
                        {getTitle()}
                    </span>
                    {fileInfo && (
                        isDirty ? (
                            <span className="badge badge-warning badge-xs gap-1">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                                Unsaved
                            </span>
                        ) : (
                            <span className="badge badge-success badge-xs gap-1">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                Saved
                            </span>
                        )
                    )}
                </div>

                {/* Right section - Window controls */}
                <div className="flex flex-row h-full" style={{ pointerEvents: 'auto', WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
                    {/* Minimize button */}
                    <button
                        onClick={handleMinimize}
                        className="flex items-center justify-center w-12 h-full hover:bg-white/10 transition-colors"
                        aria-label="Minimize window"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                        </svg>
                    </button>

                    {/* Maximize/Restore button */}
                    <button
                        onClick={handleMaximize}
                        className="flex items-center justify-center w-12 h-full hover:bg-white/10 transition-colors"
                        aria-label={isMaximized ? "Restore window" : "Maximize window"}
                    >
                        {isMaximized ? (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                        ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                            </svg>
                        )}
                    </button>

                    {/* Close button */}
                    <button
                        onClick={handleClose}
                        className="flex items-center justify-center w-12 h-full hover:bg-error hover:text-error-content transition-colors"
                        aria-label="Close window"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            </div>

        {/* Reload Confirmation Modal */}
        {showReloadConfirm && (
            <div className="modal modal-open">
                <div className="modal-box">
                    <h3 className="font-bold text-lg">Reload File from Disk?</h3>
                    <p className="py-4">
                        This will discard any unsaved changes and reload the file from disk.
                        {isDirty && (
                            <span className="block mt-2 text-warning font-semibold">
                                Warning: You have unsaved changes that will be lost.
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
                            onClick={handleReloadWithConfirm}
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

        {/* Close File Confirmation Modal */}
        {showCloseConfirm && (
            <div className="modal modal-open">
                <div className="modal-box">
                    <h3 className="font-bold text-lg">Save Changes Before Closing?</h3>
                    <p className="py-4">
                        You have unsaved changes in the current file. Would you like to save them before closing?
                    </p>
                    <div className="modal-action">
                        <button
                            className="btn btn-ghost"
                            onClick={() => setShowCloseConfirm(false)}
                        >
                            Cancel
                        </button>
                        <button
                            className="btn btn-warning"
                            onClick={() => handleCloseConfirm(false)}
                        >
                            Discard Changes
                        </button>
                        <button
                            className="btn btn-primary"
                            onClick={() => handleCloseConfirm(true)}
                        >
                            Save &amp; Close
                        </button>
                    </div>
                </div>
            </div>
        )}
        </>
    );
}
