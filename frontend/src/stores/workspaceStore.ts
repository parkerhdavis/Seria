/**
 * Workspace Store
 *
 * Zustand store for managing workspace layouts and presets.
 * Allows users to save and quickly switch between different workspace configurations.
 */

import { create } from "zustand";
import { WorkspaceLayout } from "@/types/workspace";
import { invoke } from "@tauri-apps/api/core";
import { logger } from "@/utils/logger";

interface WorkspaceStore {
    // State
    layouts: WorkspaceLayout[];
    currentLayoutId: string | null;
    isLoading: boolean;

    // Actions
    loadLayouts: () => Promise<void>;
    saveLayout: (name: string, layout: Omit<WorkspaceLayout, "id" | "name" | "createdAt" | "lastUsed">) => Promise<void>;
    loadLayout: (id: string) => WorkspaceLayout | null;
    deleteLayout: (id: string) => Promise<void>;
    renameLayout: (id: string, newName: string) => Promise<void>;
    setDefaultLayout: (id: string) => Promise<void>;
    setCurrentLayoutId: (id: string | null) => void;
    updateLayoutUsage: (id: string) => Promise<void>;
}

export const useWorkspaceStore = create<WorkspaceStore>((set, get) => ({
    // Initial state
    layouts: [],
    currentLayoutId: null,
    isLoading: false,

    // Load all layouts from storage
    loadLayouts: async () => {
        set({ isLoading: true });

        try {
            // Try to load from backend
            const layoutsJson = await invoke<string>("load_workspace_layouts");
            const layouts: WorkspaceLayout[] = JSON.parse(layoutsJson);
            set({ layouts, isLoading: false });
        } catch (error) {
            logger.error("Failed to load workspace layouts:", error);

            // If backend fails, try localStorage as fallback
            try {
                const stored = localStorage.getItem("seria_workspace_layouts");
                if (stored) {
                    const layouts: WorkspaceLayout[] = JSON.parse(stored);
                    set({ layouts, isLoading: false });
                } else {
                    set({ layouts: [], isLoading: false });
                }
            } catch (e) {
                logger.error("Failed to load from localStorage:", e);
                set({ layouts: [], isLoading: false });
            }
        }
    },

    // Save a new layout
    saveLayout: async (name: string, layout: Omit<WorkspaceLayout, "id" | "name" | "createdAt" | "lastUsed">) => {
        const { layouts } = get();

        const newLayout: WorkspaceLayout = {
            ...layout,
            id: `layout_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            name,
            createdAt: Date.now(),
            lastUsed: Date.now(),
        };

        const updatedLayouts = [...layouts, newLayout];
        set({ layouts: updatedLayouts, currentLayoutId: newLayout.id });

        try {
            // Try to save to backend
            await invoke("save_workspace_layouts", {
                layoutsJson: JSON.stringify(updatedLayouts),
            });
        } catch (error) {
            logger.error("Failed to save to backend, using localStorage:", error);
            // Fallback to localStorage
            localStorage.setItem("seria_workspace_layouts", JSON.stringify(updatedLayouts));
        }
    },

    // Load a specific layout
    loadLayout: (id: string) => {
        const { layouts } = get();
        const layout = layouts.find((l) => l.id === id);

        if (layout) {
            set({ currentLayoutId: id });
            return layout;
        }

        return null;
    },

    // Delete a layout
    deleteLayout: async (id: string) => {
        const { layouts, currentLayoutId } = get();
        const updatedLayouts = layouts.filter((l) => l.id !== id);

        set({
            layouts: updatedLayouts,
            currentLayoutId: currentLayoutId === id ? null : currentLayoutId,
        });

        try {
            await invoke("save_workspace_layouts", {
                layoutsJson: JSON.stringify(updatedLayouts),
            });
        } catch (error) {
            logger.error("Failed to save to backend, using localStorage:", error);
            localStorage.setItem("seria_workspace_layouts", JSON.stringify(updatedLayouts));
        }
    },

    // Rename a layout
    renameLayout: async (id: string, newName: string) => {
        const { layouts } = get();
        const updatedLayouts = layouts.map((l) =>
            l.id === id ? { ...l, name: newName } : l
        );

        set({ layouts: updatedLayouts });

        try {
            await invoke("save_workspace_layouts", {
                layoutsJson: JSON.stringify(updatedLayouts),
            });
        } catch (error) {
            logger.error("Failed to save to backend, using localStorage:", error);
            localStorage.setItem("seria_workspace_layouts", JSON.stringify(updatedLayouts));
        }
    },

    // Set a layout as default
    setDefaultLayout: async (id: string) => {
        const { layouts } = get();
        const updatedLayouts = layouts.map((l) => ({
            ...l,
            isDefault: l.id === id,
        }));

        set({ layouts: updatedLayouts });

        try {
            await invoke("save_workspace_layouts", {
                layoutsJson: JSON.stringify(updatedLayouts),
            });
        } catch (error) {
            logger.error("Failed to save to backend, using localStorage:", error);
            localStorage.setItem("seria_workspace_layouts", JSON.stringify(updatedLayouts));
        }
    },

    // Set current layout ID
    setCurrentLayoutId: (id: string | null) => {
        set({ currentLayoutId: id });
    },

    // Update layout usage timestamp
    updateLayoutUsage: async (id: string) => {
        const { layouts } = get();
        const updatedLayouts = layouts.map((l) =>
            l.id === id ? { ...l, lastUsed: Date.now() } : l
        );

        set({ layouts: updatedLayouts });

        try {
            await invoke("save_workspace_layouts", {
                layoutsJson: JSON.stringify(updatedLayouts),
            });
        } catch (error) {
            logger.error("Failed to save to backend, using localStorage:", error);
            localStorage.setItem("seria_workspace_layouts", JSON.stringify(updatedLayouts));
        }
    },
}));
