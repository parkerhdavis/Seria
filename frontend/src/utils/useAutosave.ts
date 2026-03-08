/**
 * Autosave Hook
 *
 * React hook for managing automatic saving of Cell files.
 * Provides a timer-based autosave that triggers after a configurable interval,
 * and can be manually triggered to reset the timer.
 */

import { useEffect, useRef, useCallback } from "react";
import { useCellStore } from "@/stores/cellStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { logger } from "@/utils/logger";

/**
 * Custom hook for autosave functionality
 *
 * Features:
 * - Timer-based autosave after configured interval
 * - Manual trigger function that resets the timer
 * - Only saves if there's a current file and unsaved changes
 * - Respects autosave enabled/disabled setting
 *
 * @returns Object with triggerAutosave function for manual autosave triggering
 */
export function useAutosave() {
    const { currentFile, isDirty, saveCells } = useCellStore();
    const { autosaveEnabled, autosaveIntervalSeconds } = useSettingsStore();

    // Timer ref to track the autosave timeout
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    /**
     * Clear the existing timer
     */
    const clearTimer = useCallback(() => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
    }, []);

    /**
     * Start or restart the autosave timer
     */
    const startTimer = useCallback(() => {
        // Clear any existing timer
        clearTimer();

        // Only start timer if autosave is enabled and there's something to save
        if (!autosaveEnabled || !currentFile || !isDirty) {
            return;
        }

        // Start new timer
        timerRef.current = setTimeout(async () => {
            try {
                logger.debug("[Autosave] Timer expired, saving...");
                await saveCells();
                logger.debug("[Autosave] Save completed");
            } catch (error: unknown) {
                logger.error("[Autosave] Save failed:", error);
            }
        }, autosaveIntervalSeconds * 1000);
    }, [autosaveEnabled, currentFile, isDirty, autosaveIntervalSeconds, saveCells, clearTimer]);

    /**
     * Manually trigger autosave immediately and reset timer
     * This should be called after user actions like cell edits
     */
    const triggerAutosave = useCallback(async () => {
        // Clear any pending autosave
        clearTimer();

        // Only save if enabled, there's a file, and there are changes
        if (!autosaveEnabled || !currentFile || !isDirty) {
            return;
        }

        try {
            logger.debug("[Autosave] Manual trigger, saving...");
            await saveCells();
            logger.debug("[Autosave] Save completed");
        } catch (error: unknown) {
            logger.error("[Autosave] Save failed:", error);
        }

        // Restart timer after manual save
        startTimer();
    }, [autosaveEnabled, currentFile, isDirty, saveCells, clearTimer, startTimer]);

    /**
     * Effect to manage the autosave timer
     * Restarts timer whenever dependencies change
     */
    useEffect(() => {
        // Start timer when dependencies change
        startTimer();

        // Cleanup on unmount or when dependencies change
        return () => {
            clearTimer();
        };
    }, [startTimer, clearTimer]);

    return {
        triggerAutosave,
    };
}
