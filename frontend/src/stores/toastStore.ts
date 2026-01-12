/**
 * Toast Notification Store
 *
 * Manages toast notifications across the application using Zustand.
 * Supports multiple toast types (success, error, warning, info) with
 * automatic dismissal and manual close functionality.
 */

import { create } from "zustand";

export type ToastType = "success" | "error" | "warning" | "info";

export interface Toast {
    id: string;
    type: ToastType;
    message: string;
    duration?: number; // Duration in ms, undefined = no auto-dismiss
}

interface ToastState {
    toasts: Toast[];
    addToast: (toast: Omit<Toast, "id">) => string;
    removeToast: (id: string) => void;
    clearToasts: () => void;
}

// Default durations for each toast type (in ms)
const DEFAULT_DURATIONS: Record<ToastType, number> = {
    success: 3000,
    error: 6000,
    warning: 5000,
    info: 4000,
};

// Generate unique ID for each toast
let toastCounter = 0;
const generateId = (): string => {
    toastCounter += 1;
    return `toast-${Date.now()}-${toastCounter}`;
};

export const useToastStore = create<ToastState>((set, get) => ({
    toasts: [],

    addToast: (toast) => {
        const id = generateId();
        const duration = toast.duration ?? DEFAULT_DURATIONS[toast.type];

        const newToast: Toast = {
            ...toast,
            id,
            duration,
        };

        set((state) => ({
            toasts: [...state.toasts, newToast],
        }));

        // Auto-dismiss after duration (if duration > 0)
        if (duration > 0) {
            setTimeout(() => {
                get().removeToast(id);
            }, duration);
        }

        return id;
    },

    removeToast: (id) => {
        set((state) => ({
            toasts: state.toasts.filter((toast) => toast.id !== id),
        }));
    },

    clearToasts: () => {
        set({ toasts: [] });
    },
}));

// Convenience functions for common toast types
export const toast = {
    success: (message: string, duration?: number) =>
        useToastStore.getState().addToast({ type: "success", message, duration }),

    error: (message: string, duration?: number) =>
        useToastStore.getState().addToast({ type: "error", message, duration }),

    warning: (message: string, duration?: number) =>
        useToastStore.getState().addToast({ type: "warning", message, duration }),

    info: (message: string, duration?: number) =>
        useToastStore.getState().addToast({ type: "info", message, duration }),
};
