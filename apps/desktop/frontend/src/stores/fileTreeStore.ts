// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * File Tree Store
 *
 * Zustand store for managing file tree state,
 * including the current root directory.
 */

import { create } from "zustand";

interface FileTreeStore {
    // State
    rootDirectory: string | null;

    // Actions
    setRootDirectory: (path: string | null) => void;
    isFileInTree: (filePath: string) => boolean;
}

export const useFileTreeStore = create<FileTreeStore>((set, get) => ({
    // Initial state
    rootDirectory: null,

    // Set the root directory
    setRootDirectory: (path: string | null) => {
        set({ rootDirectory: path });
    },

    // Check if a file path is within the root directory
    isFileInTree: (filePath: string) => {
        const { rootDirectory } = get();
        if (!rootDirectory || !filePath) {
            return false;
        }
        // Normalize paths for comparison
        const normalizedRoot = rootDirectory.replace(/\\/g, "/");
        const normalizedFile = filePath.replace(/\\/g, "/");
        return normalizedFile.startsWith(normalizedRoot);
    },
}));
