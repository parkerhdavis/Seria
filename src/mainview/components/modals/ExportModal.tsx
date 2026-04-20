/**
 * Export Modal Component
 *
 * Provides a template-based export workflow for transforming CSV data
 * into various formats (JSON, YAML, XML, custom). Includes template
 * selection, live preview, and file save functionality.
 *
 * Opens with Ctrl+Shift+E.
 */

import { useState, useEffect, useMemo } from "react";
import { useCellStore } from "@stores/cellStore";
import { useExportTemplateStore } from "@stores/exportTemplateStore";
import { save } from "@utils/dialog";
import { rpcCall } from "@utils/rpc";
import { logger } from "@utils/logger";
import { formatError } from "@utils/tauriErrorHandler";
import { toast } from "@stores/toastStore";
import { TEMPLATE_CATEGORIES } from "@/data/exportTemplates";

interface ExportModalProps {
    isOpen: boolean;
    onClose: () => void;
}

/**
 * ExportModal - Template-based export with live preview
 */
export default function ExportModal({ isOpen, onClose }: ExportModalProps) {
    const { headers, data, fileInfo } = useCellStore();
    const {
        templates,
        selectedTemplateId,
        isLoaded,
        loadTemplates,
        selectTemplate,
        executeExport,
    } = useExportTemplateStore();

    const [previewContent, setPreviewContent] = useState("");
    const [isExporting, setIsExporting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [previewRowCount, setPreviewRowCount] = useState(5);
    const [activeCategory, setActiveCategory] = useState<string>("All");

    // Load templates when modal opens
    useEffect(() => {
        if (isOpen && !isLoaded) {
            loadTemplates();
        }
    }, [isOpen, isLoaded, loadTemplates]);

    // Get selected template
    const selectedTemplate = useMemo(
        () => templates.find((t) => t.id === selectedTemplateId) || null,
        [templates, selectedTemplateId]
    );

    // Generate preview when template or data changes
    useEffect(() => {
        if (!selectedTemplate || data.length === 0) {
            setPreviewContent("");
            return;
        }

        try {
            const previewData = data.slice(0, previewRowCount);
            const output = executeExport(selectedTemplate, headers, previewData);
            setPreviewContent(output);
            setError(null);
        } catch (err: unknown) {
            logger.error("Preview generation failed:", err);
            setPreviewContent("");
            setError(formatError(err));
        }
    }, [selectedTemplate, headers, data, previewRowCount, executeExport]);

    // Filter templates by category
    const filteredTemplates = useMemo(() => {
        if (activeCategory === "All") return templates;
        return templates.filter((t) => t.category === activeCategory);
    }, [templates, activeCategory]);

    // Handle export to file
    const handleExport = async () => {
        if (!selectedTemplate) return;

        setIsExporting(true);
        setError(null);

        try {
            // Generate full export
            const output = executeExport(selectedTemplate, headers, data);

            // Default filename from current file
            const baseName = fileInfo?.name
                ? fileInfo.name.replace(/\.(csv|tsv)$/i, "")
                : "export";

            // Show save dialog
            const filePath = await save({
                filters: [
                    {
                        name: `${selectedTemplate.name} Files`,
                        extensions: [selectedTemplate.options.fileExtension],
                    },
                    { name: "All Files", extensions: ["*"] },
                ],
                defaultPath: `${baseName}.${selectedTemplate.options.fileExtension}`,
                title: `Export as ${selectedTemplate.name}`,
            });

            if (filePath) {
                await rpcCall.saveCellFile({ path: filePath, content: output });
                toast.success(`Exported to ${filePath.split("/").pop() || filePath.split("\\").pop()}`);
                onClose();
            }
        } catch (err: unknown) {
            logger.error("Export failed:", err);
            setError(formatError(err));
        } finally {
            setIsExporting(false);
        }
    };

    // Copy preview to clipboard
    const handleCopyPreview = async () => {
        try {
            // Generate full export for clipboard
            const output = selectedTemplate
                ? executeExport(selectedTemplate, headers, data)
                : previewContent;
            await navigator.clipboard.writeText(output);
            toast.success("Exported content copied to clipboard");
        } catch (err: unknown) {
            logger.error("Copy to clipboard failed:", err);
            setError(formatError(err));
        }
    };

    if (!isOpen) return null;

    return (
        <div className="modal modal-open">
            <div className="modal-box max-w-[90vw] w-[90vw] max-h-[90vh] h-[85vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h2 className="text-xl font-bold">Export Data</h2>
                        <p className="text-sm text-base-content/60">
                            Transform your data into various formats using templates
                        </p>
                    </div>
                    <button className="btn btn-sm btn-ghost btn-circle" onClick={onClose}>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Main content - two columns */}
                <div className="flex flex-1 gap-4 overflow-hidden">
                    {/* Left: Template list */}
                    <div className="w-72 flex flex-col border border-base-300 rounded-lg overflow-hidden">
                        {/* Category tabs */}
                        <div className="flex flex-wrap gap-1 p-2 border-b border-base-300 bg-base-200">
                            <button
                                className={`btn btn-xs ${activeCategory === "All" ? "btn-primary" : "btn-ghost"}`}
                                onClick={() => setActiveCategory("All")}
                            >
                                All
                            </button>
                            {TEMPLATE_CATEGORIES.map((cat) => (
                                <button
                                    key={cat}
                                    className={`btn btn-xs ${activeCategory === cat ? "btn-primary" : "btn-ghost"}`}
                                    onClick={() => setActiveCategory(cat)}
                                >
                                    {cat}
                                </button>
                            ))}
                        </div>

                        {/* Template list */}
                        <div className="flex-1 overflow-auto">
                            {filteredTemplates.map((template) => (
                                <div
                                    key={template.id}
                                    className={`p-3 cursor-pointer border-b border-base-200 hover:bg-base-200 transition-colors ${
                                        selectedTemplateId === template.id
                                            ? "bg-primary/10 border-l-4 border-l-primary"
                                            : ""
                                    }`}
                                    onClick={() => selectTemplate(template.id)}
                                >
                                    <div className="flex items-center gap-2">
                                        <span className="font-semibold text-sm">{template.name}</span>
                                        {template.isBuiltIn && (
                                            <span className="badge badge-xs badge-ghost">Built-in</span>
                                        )}
                                    </div>
                                    <p className="text-xs text-base-content/60 mt-1 line-clamp-2">
                                        {template.description}
                                    </p>
                                    <div className="flex items-center gap-1 mt-1">
                                        <span className="badge badge-xs">{template.outputFormat.toUpperCase()}</span>
                                        <span className="text-xs text-base-content/40">.{template.options.fileExtension}</span>
                                    </div>
                                </div>
                            ))}

                            {filteredTemplates.length === 0 && (
                                <div className="p-4 text-center text-base-content/50 text-sm">
                                    No templates in this category
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right: Preview and details */}
                    <div className="flex-1 flex flex-col overflow-hidden">
                        {selectedTemplate ? (
                            <>
                                {/* Template info */}
                                <div className="card bg-base-200 shadow-sm mb-4">
                                    <div className="card-body p-4">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <h3 className="card-title text-base">{selectedTemplate.name}</h3>
                                                <p className="text-sm text-base-content/60">{selectedTemplate.description}</p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="badge badge-sm">{selectedTemplate.outputFormat.toUpperCase()}</span>
                                                <span className="badge badge-sm badge-ghost">{selectedTemplate.category}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Preview controls */}
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-semibold">Preview</span>
                                        <span className="text-xs text-base-content/50">
                                            (showing {Math.min(previewRowCount, data.length)} of {data.length} rows)
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <select
                                            className="select select-bordered select-xs"
                                            value={previewRowCount}
                                            onChange={(e) => setPreviewRowCount(Number(e.target.value))}
                                        >
                                            <option value={3}>3 rows</option>
                                            <option value={5}>5 rows</option>
                                            <option value={10}>10 rows</option>
                                            <option value={25}>25 rows</option>
                                            <option value={data.length}>All rows</option>
                                        </select>
                                        <button
                                            className="btn btn-xs btn-ghost"
                                            onClick={handleCopyPreview}
                                            title="Copy full export to clipboard"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                            </svg>
                                            Copy All
                                        </button>
                                    </div>
                                </div>

                                {/* Preview content */}
                                <div className="flex-1 overflow-auto bg-base-200 rounded-lg border border-base-300">
                                    <pre className="p-4 text-sm font-mono whitespace-pre-wrap break-words">
                                        {previewContent || (
                                            <span className="text-base-content/40 italic">
                                                No preview available - load some data first
                                            </span>
                                        )}
                                    </pre>
                                </div>
                            </>
                        ) : (
                            <div className="flex flex-col items-center justify-center flex-1 text-base-content/50">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                </svg>
                                <p className="font-semibold">Select a template</p>
                                <p className="text-sm">Choose an export format from the list on the left</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Error display */}
                {error && (
                    <div className="alert alert-error mt-4">
                        <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-5 w-5" fill="none" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>{error}</span>
                    </div>
                )}

                {/* Footer */}
                <div className="modal-action">
                    <div className="text-xs text-base-content/40 mr-auto flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {data.length} rows will be exported
                    </div>
                    <button className="btn" onClick={onClose}>Cancel</button>
                    <button
                        className="btn btn-primary"
                        onClick={handleExport}
                        disabled={!selectedTemplate || isExporting || data.length === 0}
                    >
                        {isExporting ? (
                            <>
                                <span className="loading loading-spinner loading-sm"></span>
                                Exporting...
                            </>
                        ) : (
                            <>
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                Export to File
                            </>
                        )}
                    </button>
                </div>
            </div>
            <div className="modal-backdrop" onClick={onClose}></div>
        </div>
    );
}
