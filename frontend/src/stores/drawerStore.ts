/**
 * Drawer Store
 *
 * Zustand store for managing Print drawer state (position, size, and visibility).
 * This allows the CSV grid to adjust its viewport based on the drawer position.
 */

import { create } from "zustand";

interface DrawerStore {
    // State
    position: "right" | "bottom" | null;
    rightDrawerSize: number;
    bottomDrawerSize: number;

    // Actions
    setPosition: (position: "right" | "bottom" | null) => void;
    togglePosition: (position: "right" | "bottom") => void;
    setRightDrawerSize: (size: number) => void;
    setBottomDrawerSize: (size: number) => void;
}

export const useDrawerStore = create<DrawerStore>((set, get) => ({
    // Initial state
    position: null, // Default to closed (drawer state persists per-file)
    rightDrawerSize: 768,
    bottomDrawerSize: 320,

    // Set drawer position
    setPosition: (position: "right" | "bottom" | null) => {
        set({ position });
    },

    // Toggle drawer position (open if closed, close if already open)
    togglePosition: (position: "right" | "bottom") => {
        const currentPosition = get().position;
        set({ position: currentPosition === position ? null : position });
    },

    // Set right drawer size
    setRightDrawerSize: (size: number) => {
        set({ rightDrawerSize: size });
    },

    // Set bottom drawer size
    setBottomDrawerSize: (size: number) => {
        set({ bottomDrawerSize: size });
    },
}));
