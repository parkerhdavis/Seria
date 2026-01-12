/**
 * Application Logger
 *
 * Centralized logging utility using loglevel.
 * Provides consistent logging interface with configurable log levels.
 *
 * Log Levels (from most to least verbose):
 * - trace: Very detailed debugging info
 * - debug: Debugging info for development
 * - info: General information
 * - warn: Warnings that don't prevent operation
 * - error: Errors that affect operation
 *
 * In development: Shows debug and above
 * In production: Shows warn and above
 */

import log from "loglevel";

// Set log level based on environment
// In development, show debug and above; in production, show only warnings and errors
const isDev = import.meta.env.DEV;
log.setLevel(isDev ? "debug" : "warn");

/**
 * Application logger with namespaced methods
 *
 * Usage:
 *   import { logger } from "@/utils/logger";
 *   logger.debug("Loading file:", path);
 *   logger.info("File loaded successfully");
 *   logger.warn("File size exceeds recommended limit");
 *   logger.error("Failed to load file:", error);
 */
export const logger = {
    /**
     * Log trace-level message (most verbose)
     * Use for very detailed debugging that's usually too noisy
     */
    trace: (...args: unknown[]) => log.trace(...args),

    /**
     * Log debug-level message
     * Use for development debugging info
     */
    debug: (...args: unknown[]) => log.debug(...args),

    /**
     * Log info-level message
     * Use for general operational information
     */
    info: (...args: unknown[]) => log.info(...args),

    /**
     * Log warning-level message
     * Use for non-critical issues that should be noted
     */
    warn: (...args: unknown[]) => log.warn(...args),

    /**
     * Log error-level message
     * Use for errors that affect operation
     */
    error: (...args: unknown[]) => log.error(...args),

    /**
     * Set the log level dynamically
     * Useful for enabling verbose logging at runtime
     */
    setLevel: (level: log.LogLevelDesc) => log.setLevel(level),

    /**
     * Get the current log level
     */
    getLevel: () => log.getLevel(),
};

// Export the raw loglevel instance for advanced usage
export { log };

// Type-safe log level names
export type LogLevel = "trace" | "debug" | "info" | "warn" | "error" | "silent";
