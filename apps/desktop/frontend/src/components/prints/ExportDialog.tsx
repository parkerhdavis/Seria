// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Export Dialog Component
 *
 * Modal dialog for configuring PDF export settings for Print views.
 * Provides comprehensive options for customizing PDF output:
 * - Save location (with file browser)
 * - Page range selection (all/custom - only in paged mode)
 * - Text and background colors
 * - Watermarks (text, position, opacity, color)
 * - Page numbers
 * - Custom headers and footers
 *
 * The export process uses html2canvas + jsPDF to render the Print view
 * to PDF with screenplay-standard formatting (Courier 12pt, proper margins).
 *
 * Saves PDFs to user-specified location using Tauri's file system API,
 * not to browser's default downloads folder.
 */

import { useState, useEffect } from "react";
import { save } from "@tauri-apps/plugin-dialog";
import { downloadDir } from "@tauri-apps/api/path";

/**
 * Progress information passed to the onProgress callback
 */
export interface ExportProgress {
    stage: string;           // Current stage name (e.g., "Inlining styles", "Generating PDF")
    current: number;         // Current progress value
    total: number;           // Total value for this stage
    percentage: number;      // Overall percentage (0-100)
}

/**
 * Settings object passed to the PDF export function
 */
export interface ExportSettings {
    savePath: string;  // Full file path where PDF should be saved
    pageRange: "all" | "current" | "custom";
    customPageStart?: number;
    customPageEnd?: number;
    textColor: string;
    backgroundColor: string;
    watermark?: {
        text: string;
        position: "diagonal" | "header" | "footer";
        opacity: number;
        color: string;
    };
    includePageNumbers: boolean;
    includeHeaders: boolean;
    headerText?: string;
    includeFooters: boolean;
    footerText?: string;
    onProgress?: (progress: ExportProgress) => void;  // Optional progress callback
}

interface ExportDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onExport: (settings: ExportSettings) => void;
    defaultFilename: string;
    totalPages?: number;  // For page range selection (only in paged mode)
    continuous?: boolean;  // Whether the Print is in continuous mode
}

/**
 * ExportDialog - Modal for configuring PDF export settings
 */
function ExportDialog({
    isOpen,
    onClose,
    onExport,
    defaultFilename,
    totalPages,
    continuous = true,
}: ExportDialogProps) {
    // Default export settings
    const [settings, setSettings] = useState<ExportSettings>({
        savePath: "",
        pageRange: "all",
        textColor: "#000000",
        backgroundColor: "#ffffff",
        includePageNumbers: false,
        includeHeaders: false,
        includeFooters: false,
    });

    // Watermark enabled state (separate from settings for cleaner UI)
    const [watermarkEnabled, setWatermarkEnabled] = useState(false);

    // Initialize default save path when dialog opens
    // Defaults to Downloads folder + the current file's name with .pdf extension
    useEffect(() => {
        const initializePath = async () => {
            const downloadsPath = await downloadDir();
            const filename = defaultFilename.endsWith(".pdf")
                ? defaultFilename
                : `${defaultFilename}.pdf`;
            // Ensure proper path separator (downloadsPath may or may not end with /)
            const separator = downloadsPath.endsWith("/") ? "" : "/";
            const fullPath = `${downloadsPath}${separator}${filename}`;
            setSettings((prev) => ({ ...prev, savePath: fullPath }));
        };
        if (isOpen && !settings.savePath) {
            initializePath();
        }
    }, [isOpen, defaultFilename, settings.savePath]);

    // Handle browse button click to select save location
    // Opens Tauri's native file save dialog
    const handleBrowse = async () => {
        const filePath = await save({
            defaultPath: settings.savePath || defaultFilename,
            filters: [{ name: "PDF Files", extensions: ["pdf"] }],
            title: "Save PDF As",
        });

        if (filePath) {
            updateSettings({ savePath: filePath });
        }
    };

    // Handle export button click
    const handleExport = () => {
        // Remove watermark from settings if not enabled
        const finalSettings = watermarkEnabled
            ? settings
            : { ...settings, watermark: undefined };

        onExport(finalSettings);
        onClose();
    };

    // Update settings helper
    const updateSettings = (updates: Partial<ExportSettings>) => {
        setSettings((prev) => ({ ...prev, ...updates }));
    };

    if (!isOpen) {
        return null;
    }

    return (
        <div className="modal modal-open">
            <div className="modal-box max-w-3xl max-h-[90vh] overflow-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h2 className="text-2xl font-bold text-base-content">Export to PDF</h2>
                        <p className="text-base-content/60 mt-1">
                            Configure export settings for your screenplay
                        </p>
                    </div>
                    <button
                        className="btn btn-sm btn-circle btn-ghost"
                        onClick={onClose}
                        aria-label="Close"
                    >
                        ✕
                    </button>
                </div>

                {/* Settings Form */}
                <div className="space-y-6">
                    {/* Save Path */}
                    <div className="form-control">
                        <label className="label">
                            <span className="label-text font-semibold">Save Location</span>
                        </label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                className="input input-bordered flex-1 font-mono text-sm"
                                value={settings.savePath}
                                onChange={(e) => updateSettings({ savePath: e.target.value })}
                                placeholder="/path/to/screenplay.pdf"
                            />
                            <button
                                type="button"
                                className="btn btn-outline btn-primary"
                                onClick={handleBrowse}
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
                                        d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z"
                                    />
                                </svg>
                                Browse
                            </button>
                        </div>
                    </div>

                    {/* Page Range (only show in paged mode) */}
                    {!continuous && totalPages && (
                        <div className="form-control">
                            <label className="label">
                                <span className="label-text font-semibold">Page Range</span>
                            </label>
                            <div className="space-y-2">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="radio"
                                        className="radio radio-primary radio-sm"
                                        checked={settings.pageRange === "all"}
                                        onChange={() => updateSettings({ pageRange: "all" })}
                                    />
                                    <span>All pages ({totalPages} total)</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="radio"
                                        className="radio radio-primary radio-sm"
                                        checked={settings.pageRange === "custom"}
                                        onChange={() => updateSettings({ pageRange: "custom" })}
                                    />
                                    <span>Custom range:</span>
                                    <input
                                        type="number"
                                        className="input input-bordered input-sm w-20"
                                        min={1}
                                        max={totalPages}
                                        value={settings.customPageStart || 1}
                                        onChange={(e) =>
                                            updateSettings({
                                                customPageStart: parseInt(e.target.value),
                                            })
                                        }
                                        disabled={settings.pageRange !== "custom"}
                                    />
                                    <span>to</span>
                                    <input
                                        type="number"
                                        className="input input-bordered input-sm w-20"
                                        min={settings.customPageStart || 1}
                                        max={totalPages}
                                        value={settings.customPageEnd || totalPages}
                                        onChange={(e) =>
                                            updateSettings({
                                                customPageEnd: parseInt(e.target.value),
                                            })
                                        }
                                        disabled={settings.pageRange !== "custom"}
                                    />
                                </label>
                            </div>
                        </div>
                    )}

                    {/* Colors */}
                    <div className="form-control">
                        <label className="label">
                            <span className="label-text font-semibold">Colors</span>
                        </label>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="label">
                                    <span className="label-text">Text Color</span>
                                </label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="color"
                                        className="w-12 h-10 border-2 border-base-300 rounded cursor-pointer"
                                        value={settings.textColor}
                                        onChange={(e) =>
                                            updateSettings({ textColor: e.target.value })
                                        }
                                    />
                                    <input
                                        type="text"
                                        className="input input-bordered input-sm flex-1"
                                        value={settings.textColor}
                                        onChange={(e) =>
                                            updateSettings({ textColor: e.target.value })
                                        }
                                        placeholder="#000000"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="label">
                                    <span className="label-text">Background Color</span>
                                </label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="color"
                                        className="w-12 h-10 border-2 border-base-300 rounded cursor-pointer"
                                        value={settings.backgroundColor}
                                        onChange={(e) =>
                                            updateSettings({ backgroundColor: e.target.value })
                                        }
                                    />
                                    <input
                                        type="text"
                                        className="input input-bordered input-sm flex-1"
                                        value={settings.backgroundColor}
                                        onChange={(e) =>
                                            updateSettings({ backgroundColor: e.target.value })
                                        }
                                        placeholder="#ffffff"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Watermark */}
                    <div className="form-control">
                        <label className="label cursor-pointer justify-start gap-2">
                            <input
                                type="checkbox"
                                className="checkbox checkbox-primary"
                                checked={watermarkEnabled}
                                onChange={(e) => {
                                    setWatermarkEnabled(e.target.checked);
                                    if (e.target.checked && !settings.watermark) {
                                        updateSettings({
                                            watermark: {
                                                text: "DRAFT",
                                                position: "diagonal",
                                                opacity: 0.2,
                                                color: "#888888",
                                            },
                                        });
                                    }
                                }}
                            />
                            <span className="label-text font-semibold">Add Watermark</span>
                        </label>

                        {watermarkEnabled && (
                            <div className="ml-8 mt-2 space-y-3">
                                <div>
                                    <label className="label">
                                        <span className="label-text">Watermark Text</span>
                                    </label>
                                    <input
                                        type="text"
                                        className="input input-bordered input-sm w-full"
                                        value={settings.watermark?.text || ""}
                                        onChange={(e) =>
                                            updateSettings({
                                                watermark: {
                                                    ...settings.watermark!,
                                                    text: e.target.value,
                                                },
                                            })
                                        }
                                        placeholder="DRAFT"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="label">
                                            <span className="label-text">Position</span>
                                        </label>
                                        <select
                                            className="select select-bordered select-sm w-full"
                                            value={settings.watermark?.position || "diagonal"}
                                            onChange={(e) =>
                                                updateSettings({
                                                    watermark: {
                                                        ...settings.watermark!,
                                                        position: e.target.value as
                                                            | "diagonal"
                                                            | "header"
                                                            | "footer",
                                                    },
                                                })
                                            }
                                        >
                                            <option value="diagonal">Diagonal</option>
                                            <option value="header">Header</option>
                                            <option value="footer">Footer</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="label">
                                            <span className="label-text">
                                                Opacity: {settings.watermark?.opacity || 0.2}
                                            </span>
                                        </label>
                                        <input
                                            type="range"
                                            className="range range-sm range-primary"
                                            min="0.1"
                                            max="1"
                                            step="0.1"
                                            value={settings.watermark?.opacity || 0.2}
                                            onChange={(e) =>
                                                updateSettings({
                                                    watermark: {
                                                        ...settings.watermark!,
                                                        opacity: parseFloat(e.target.value),
                                                    },
                                                })
                                            }
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="label">
                                        <span className="label-text">Watermark Color</span>
                                    </label>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="color"
                                            className="w-12 h-10 border-2 border-base-300 rounded cursor-pointer"
                                            value={settings.watermark?.color || "#888888"}
                                            onChange={(e) =>
                                                updateSettings({
                                                    watermark: {
                                                        ...settings.watermark!,
                                                        color: e.target.value,
                                                    },
                                                })
                                            }
                                        />
                                        <input
                                            type="text"
                                            className="input input-bordered input-sm flex-1"
                                            value={settings.watermark?.color || "#888888"}
                                            onChange={(e) =>
                                                updateSettings({
                                                    watermark: {
                                                        ...settings.watermark!,
                                                        color: e.target.value,
                                                    },
                                                })
                                            }
                                            placeholder="#888888"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Page Numbers */}
                    <div className="form-control">
                        <label className="label cursor-pointer justify-start gap-2">
                            <input
                                type="checkbox"
                                className="checkbox checkbox-primary"
                                checked={settings.includePageNumbers}
                                onChange={(e) =>
                                    updateSettings({ includePageNumbers: e.target.checked })
                                }
                            />
                            <span className="label-text font-semibold">Include Page Numbers</span>
                        </label>
                        <p className="text-sm text-base-content/60 ml-8">
                            Page numbers will appear in the top-right corner (screenplay standard)
                        </p>
                    </div>

                    {/* Headers */}
                    <div className="form-control">
                        <label className="label cursor-pointer justify-start gap-2">
                            <input
                                type="checkbox"
                                className="checkbox checkbox-primary"
                                checked={settings.includeHeaders}
                                onChange={(e) => {
                                    updateSettings({ includeHeaders: e.target.checked });
                                    if (e.target.checked && !settings.headerText) {
                                        updateSettings({ headerText: "" });
                                    }
                                }}
                            />
                            <span className="label-text font-semibold">Include Header</span>
                        </label>

                        {settings.includeHeaders && (
                            <div className="ml-8 mt-2">
                                <label className="label">
                                    <span className="label-text">Header Text</span>
                                </label>
                                <input
                                    type="text"
                                    className="input input-bordered input-sm w-full"
                                    value={settings.headerText || ""}
                                    onChange={(e) =>
                                        updateSettings({ headerText: e.target.value })
                                    }
                                    placeholder="My Screenplay - Draft 1"
                                />
                            </div>
                        )}
                    </div>

                    {/* Footers */}
                    <div className="form-control">
                        <label className="label cursor-pointer justify-start gap-2">
                            <input
                                type="checkbox"
                                className="checkbox checkbox-primary"
                                checked={settings.includeFooters}
                                onChange={(e) => {
                                    updateSettings({ includeFooters: e.target.checked });
                                    if (e.target.checked && !settings.footerText) {
                                        updateSettings({ footerText: "" });
                                    }
                                }}
                            />
                            <span className="label-text font-semibold">Include Footer</span>
                        </label>

                        {settings.includeFooters && (
                            <div className="ml-8 mt-2">
                                <label className="label">
                                    <span className="label-text">Footer Text</span>
                                </label>
                                <input
                                    type="text"
                                    className="input input-bordered input-sm w-full"
                                    value={settings.footerText || ""}
                                    onChange={(e) =>
                                        updateSettings({ footerText: e.target.value })
                                    }
                                    placeholder="© 2025"
                                />
                            </div>
                        )}
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="modal-action mt-8">
                    <button className="btn btn-ghost" onClick={onClose}>
                        Cancel
                    </button>
                    <button
                        className="btn btn-primary"
                        onClick={handleExport}
                        disabled={!settings.savePath.trim()}
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
                                d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                            />
                        </svg>
                        Export to PDF
                    </button>
                </div>
            </div>
        </div>
    );
}

export default ExportDialog;
