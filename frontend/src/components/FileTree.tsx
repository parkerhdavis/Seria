/**
 * File Tree Component
 *
 * Displays a directory tree in the left sidebar.
 * Allows users to open a directory and browse/open Cell files within it.
 */

import { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { readDir } from "@tauri-apps/plugin-fs";
import { useCellStore } from "@stores/cellStore";
import { useFileTreeStore } from "@stores/fileTreeStore";
import { useSettingsStore } from "@stores/settingsStore";
import { logger } from "@/utils/logger";

interface FileEntry {
    name: string;
    path: string;
    isDirectory: boolean;
}

/**
 * FileTree - Directory browser for Cell files
 */
function FileTree() {
    const [files, setFiles] = useState<FileEntry[]>([]);
    const { loadCells, fileInfo } = useCellStore();
    const { rootDirectory, setRootDirectory } = useFileTreeStore();
    const { showIncompatibleFiles } = useSettingsStore();

    // Handle opening a directory
    const handleOpenDirectory = async () => {
        try {
            const selectedDir = await open({
                directory: true,
                multiple: false,
                title: "Select Directory",
            });

            if (selectedDir) {
                setRootDirectory(selectedDir);
                await loadDirectoryContents(selectedDir);
            }
        } catch (error) {
            logger.error("Failed to open directory:", error);
        }
    };

    // Load directory contents
    const loadDirectoryContents = async (dirPath: string) => {
        try {
            logger.debug("Reading directory:", dirPath);
            const entries = await readDir(dirPath);
            logger.debug("Directory entries:", entries);

            if (!entries || entries.length === 0) {
                logger.debug("No entries found in directory");
                setFiles([]);
                return;
            }

            const fileList: FileEntry[] = entries
                .map((entry) => {
                    // Handle both possible path formats
                    const separator = dirPath.includes("\\") ? "\\" : "/";
                    return {
                        name: entry.name || "",
                        path: `${dirPath}${separator}${entry.name}`,
                        isDirectory: entry.isDirectory || false,
                    };
                })
                .filter((entry) => entry.name) // Filter out entries without names
                .sort((a, b) => {
                    // Directories first, then files
                    if (a.isDirectory && !b.isDirectory) return -1;
                    if (!a.isDirectory && b.isDirectory) return 1;
                    return a.name.localeCompare(b.name);
                });

            logger.debug("Processed file list:", fileList);
            setFiles(fileList);
        } catch (error) {
            logger.error("Failed to read directory:", error);
            logger.error("Error details:", JSON.stringify(error));
            setFiles([]);
        }
    };

    // Check if file is Cell
    const isCellFile = (fileName: string) => {
        return fileName.toLowerCase().endsWith(".cell");
    };

    // Handle file click
    const handleFileClick = async (file: FileEntry) => {
        // Don't allow clicking non-Cell files
        if (!file.isDirectory && !isCellFile(file.name)) {
            return;
        }

        if (file.isDirectory) {
            // Navigate into directory
            await loadDirectoryContents(file.path);
        } else if (isCellFile(file.name)) {
            // Open Cell file
            try {
                await loadCells(file.path);
            } catch (error) {
                logger.error("Failed to open file:", error);
            }
        }
    };

    // Check if current file is in the tree
    const isCurrentFile = (filePath: string) => {
        return fileInfo?.path === filePath;
    };

    return (
        <div className="flex-1 flex flex-col overflow-hidden">
            {/* Open Directory button */}
            <div className="p-4 border-b border-base-300">
                <button
                    className="btn btn-sm btn-primary w-full"
                    onClick={handleOpenDirectory}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                    </svg>
                    Open Directory
                </button>
            </div>

            {/* File tree */}
            <div className="flex-1 overflow-auto">
                {!rootDirectory ? (
                    <div className="p-4 text-center text-base-content/50 text-sm">
                        <p>No directory selected</p>
                        <p className="mt-2 text-xs">Click "Open Directory" to browse files</p>
                    </div>
                ) : files.length === 0 ? (
                    <div className="p-4 text-center text-base-content/50 text-sm">
                        <p>No files found</p>
                    </div>
                ) : (
                    <ul className="menu p-2 text-sm">
                        {files
                            .filter((file) => {
                                // Always show directories
                                if (file.isDirectory) return true;
                                // Always show Cell files
                                if (isCellFile(file.name)) return true;
                                // Show non-Cell files only if setting is enabled
                                return showIncompatibleFiles;
                            })
                            .map((file) => {
                                const isNonCellFile = !file.isDirectory && !isCellFile(file.name);
                                const isClickable = file.isDirectory || isCellFile(file.name);

                                return (
                                    <li key={file.path}>
                                        <a
                                            onClick={() => isClickable && handleFileClick(file)}
                                            className={`flex items-center gap-2 ${
                                                isCurrentFile(file.path)
                                                    ? "active bg-primary text-primary-content"
                                                    : isNonCellFile
                                                        ? "opacity-40 cursor-default"
                                                        : ""
                                            } ${isClickable ? "" : "pointer-events-none"}`}
                                        >
                                            {file.isDirectory ? (
                                                <>
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                                                    </svg>
                                                    <span className="truncate">{file.name}</span>
                                                </>
                                            ) : (
                                                <>
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                    </svg>
                                                    <span className="truncate">{file.name}</span>
                                                </>
                                            )}
                                        </a>
                                    </li>
                                );
                            })}
                    </ul>
                )}
            </div>
        </div>
    );
}

export default FileTree;
