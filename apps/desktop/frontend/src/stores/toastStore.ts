// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Toast Notification Store
 *
 * Manages toast notifications across the application using Zustand.
 * Supports multiple toast types (success, error, warning, info) with
 * automatic dismissal, exit animations, and manual close functionality.
 */

import { create } from "zustand";

export type ToastType = "success" | "error" | "warning" | "info";

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number; // Duration in ms, undefined = no auto-dismiss
  exiting?: boolean; // Whether the toast is animating out
}

interface ToastState {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, "id" | "exiting">) => string;
  removeToast: (id: string) => void;
  clearToasts: () => void;
}

/** Default durations for each toast type (in ms) */
const DEFAULT_DURATIONS: Record<ToastType, number> = {
  success: 3000,
  error: 6000,
  warning: 5000,
  info: 4000,
};

/** Duration of the exit animation (must match CSS) */
const EXIT_ANIMATION_MS = 200;

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
      exiting: false,
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
    const { toasts } = get();
    const toast = toasts.find((t) => t.id === id);

    // Skip if already exiting or not found
    if (!toast || toast.exiting) return;

    // Mark as exiting (triggers exit animation)
    set((state) => ({
      toasts: state.toasts.map((t) =>
        t.id === id ? { ...t, exiting: true } : t,
      ),
    }));

    // Actually remove after animation completes
    setTimeout(() => {
      set((state) => ({
        toasts: state.toasts.filter((t) => t.id !== id),
      }));
    }, EXIT_ANIMATION_MS);
  },

  clearToasts: () => {
    set({ toasts: [] });
  },
}));

/**
 * Convenience functions for creating toasts from anywhere (not just React components).
 *
 * @example
 * ```ts
 * import { toast } from "@stores/toastStore";
 * toast.success("File saved!");
 * toast.error("Failed to load file");
 * toast.warning("No file open");
 * toast.info("Processing...");
 * ```
 */
export const toast = {
  success: (message: string, duration?: number): string =>
    useToastStore.getState().addToast({ type: "success", message, duration }),

  error: (message: string, duration?: number): string =>
    useToastStore.getState().addToast({ type: "error", message, duration }),

  warning: (message: string, duration?: number): string =>
    useToastStore.getState().addToast({ type: "warning", message, duration }),

  info: (message: string, duration?: number): string =>
    useToastStore.getState().addToast({ type: "info", message, duration }),
};
