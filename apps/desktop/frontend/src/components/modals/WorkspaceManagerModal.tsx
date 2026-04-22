/**
 * Workspace Manager Modal Component
 *
 * Modal dialog for managing workspace layouts and presets.
 * Allows users to save, load, rename, delete, and set default layouts.
 */

import { useState, useEffect } from "react";
import { useWorkspaceStore } from "@stores/workspaceStore";
import { useDrawerStore } from "@stores/drawerStore";
import { useCellColumnStore } from "@stores/cellColumnStore";

interface WorkspaceManagerModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentState: {
        isSidebarOpen: boolean;
        zoomLevel: number;
    };
    onApplyLayout: (layout: {
        printDrawerPosition: "right" | "bottom" | null;
        printDrawerSize: number;
        sidebarOpen: boolean;
        zoomLevel: number;
    }) => void;
}

/**
 * WorkspaceManagerModal - Modal dialog for workspace layout management
 */
export default function WorkspaceManagerModal({
    isOpen,
    onClose,
    currentState,
    onApplyLayout,
}: WorkspaceManagerModalProps) {
    const {
        layouts,
        currentLayoutId,
        loadLayouts,
        saveLayout,
        loadLayout,
        deleteLayout,
        renameLayout,
        setDefaultLayout,
        updateLayoutUsage,
    } = useWorkspaceStore();

    const drawerPosition = useDrawerStore((state) => state.position);
    const rightDrawerSize = useDrawerStore((state) => state.rightDrawerSize);
    const bottomDrawerSize = useDrawerStore((state) => state.bottomDrawerSize);
    const columnWidths = useCellColumnStore((state) => state.columnWidths);

    const [newLayoutName, setNewLayoutName] = useState("");
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editingName, setEditingName] = useState("");
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

    // Load layouts on mount
    useEffect(() => {
        if (isOpen) {
            loadLayouts();
        }
    }, [isOpen, loadLayouts]);

    // Handle save current layout
    const handleSaveCurrentLayout = async () => {
        if (!newLayoutName.trim()) {
            return;
        }

        await saveLayout(newLayoutName, {
            printDrawerPosition: drawerPosition,
            printDrawerSize: drawerPosition === "right" ? rightDrawerSize : bottomDrawerSize,
            sidebarOpen: currentState.isSidebarOpen,
            selectedPrintRecipe: null, // TODO: Get from print drawer state
            zoomLevel: currentState.zoomLevel,
            columnWidths: Object.fromEntries(
                Object.entries(columnWidths).map(([k, v]) => [k, v])
            ),
        });

        setNewLayoutName("");
    };

    // Handle load layout
    const handleLoadLayout = async (id: string) => {
        const layout = loadLayout(id);

        if (layout) {
            // Apply layout to app state
            onApplyLayout({
                printDrawerPosition: layout.printDrawerPosition,
                printDrawerSize: layout.printDrawerSize,
                sidebarOpen: layout.sidebarOpen,
                zoomLevel: layout.zoomLevel,
            });

            // Update usage timestamp
            await updateLayoutUsage(id);
        }
    };

    // Handle rename layout
    const handleRename = async (id: string) => {
        if (editingName.trim() && editingName !== layouts.find((l) => l.id === id)?.name) {
            await renameLayout(id, editingName);
        }
        setEditingId(null);
        setEditingName("");
    };

    // Handle delete layout
    const handleDelete = async (id: string) => {
        await deleteLayout(id);
        setDeleteConfirmId(null);
    };

    // Handle set default
    const handleSetDefault = async (id: string) => {
        await setDefaultLayout(id);
    };

    if (!isOpen) {
        return null;
    }

    return (
        <div className="modal modal-open">
            <div className="modal-box max-w-3xl max-h-[85vh] overflow-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h2 className="text-2xl font-bold text-base-content">Workspace Layouts</h2>
                        <p className="text-base-content/60 mt-1">
                            Save and manage your workspace presets
                        </p>
                    </div>
                    <button
                        className="btn btn-sm btn-ghost btn-circle"
                        onClick={onClose}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Save Current Layout Section */}
                <div className="card bg-base-200 shadow-md mb-6">
                    <div className="card-body">
                        <h3 className="card-title text-lg mb-3">Save Current Layout</h3>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                placeholder="Layout name (e.g., 'Editing Mode', 'Review Mode')"
                                className="input input-bordered flex-1"
                                value={newLayoutName}
                                onChange={(e) => setNewLayoutName(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                        handleSaveCurrentLayout();
                                    }
                                }}
                            />
                            <button
                                className="btn btn-primary"
                                onClick={handleSaveCurrentLayout}
                                disabled={!newLayoutName.trim()}
                            >
                                Save
                            </button>
                        </div>
                        <p className="text-sm text-base-content/60 mt-2">
                            Saves: drawer position & size, sidebar visibility, zoom level, and column widths
                        </p>
                    </div>
                </div>

                {/* Saved Layouts List */}
                <div className="card bg-base-200 shadow-md">
                    <div className="card-body">
                        <h3 className="card-title text-lg mb-3">
                            Saved Layouts ({layouts.length})
                        </h3>

                        {layouts.length === 0 ? (
                            <div className="text-center py-8 text-base-content/60">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto mb-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                                </svg>
                                <p className="font-medium">No saved layouts yet</p>
                                <p className="text-sm mt-1">Save your first layout above to get started</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {layouts
                                    .sort((a, b) => b.lastUsed - a.lastUsed)
                                    .map((layout) => (
                                        <div
                                            key={layout.id}
                                            className={`
                                                p-4 rounded-lg border
                                                ${currentLayoutId === layout.id
                                                    ? "border-primary bg-primary/10"
                                                    : "border-base-300 hover:border-base-content/20"
                                                }
                                            `}
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="flex-1">
                                                    {editingId === layout.id ? (
                                                        <input
                                                            type="text"
                                                            className="input input-sm input-bordered w-full max-w-xs"
                                                            value={editingName}
                                                            onChange={(e) => setEditingName(e.target.value)}
                                                            onKeyDown={(e) => {
                                                                if (e.key === "Enter") {
                                                                    handleRename(layout.id);
                                                                } else if (e.key === "Escape") {
                                                                    setEditingId(null);
                                                                }
                                                            }}
                                                            onBlur={() => handleRename(layout.id)}
                                                            autoFocus
                                                        />
                                                    ) : (
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-semibold text-base-content">
                                                                    {layout.name}
                                                                </span>
                                                                {layout.isDefault && (
                                                                    <span className="badge badge-primary badge-sm">
                                                                        Default
                                                                    </span>
                                                                )}
                                                                {currentLayoutId === layout.id && (
                                                                    <span className="badge badge-success badge-sm">
                                                                        Active
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div className="text-sm text-base-content/60 mt-1 flex flex-wrap gap-3">
                                                                <span>
                                                                    Drawer: {layout.printDrawerPosition || "closed"}
                                                                </span>
                                                                <span>
                                                                    Sidebar: {layout.sidebarOpen ? "open" : "closed"}
                                                                </span>
                                                                <span>
                                                                    Zoom: {layout.zoomLevel}%
                                                                </span>
                                                                <span>
                                                                    Last used: {new Date(layout.lastUsed).toLocaleDateString()}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="flex gap-2 ml-4">
                                                    <button
                                                        className="btn btn-sm btn-ghost tooltip"
                                                        data-tip="Load layout"
                                                        onClick={() => handleLoadLayout(layout.id)}
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                                                        </svg>
                                                    </button>

                                                    <button
                                                        className="btn btn-sm btn-ghost tooltip"
                                                        data-tip="Rename"
                                                        onClick={() => {
                                                            setEditingId(layout.id);
                                                            setEditingName(layout.name);
                                                        }}
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                        </svg>
                                                    </button>

                                                    {!layout.isDefault && (
                                                        <button
                                                            className="btn btn-sm btn-ghost tooltip"
                                                            data-tip="Set as default"
                                                            onClick={() => handleSetDefault(layout.id)}
                                                        >
                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                            </svg>
                                                        </button>
                                                    )}

                                                    {deleteConfirmId === layout.id ? (
                                                        <div className="flex gap-1">
                                                            <button
                                                                className="btn btn-xs btn-error"
                                                                onClick={() => handleDelete(layout.id)}
                                                            >
                                                                Confirm
                                                            </button>
                                                            <button
                                                                className="btn btn-xs btn-ghost"
                                                                onClick={() => setDeleteConfirmId(null)}
                                                            >
                                                                Cancel
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <button
                                                            className="btn btn-sm btn-ghost text-error tooltip"
                                                            data-tip="Delete"
                                                            onClick={() => setDeleteConfirmId(layout.id)}
                                                        >
                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                            </svg>
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Keyboard Shortcuts Info */}
                <div className="alert alert-info mt-4">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                    <div className="text-sm">
                        <p className="font-semibold">Quick Switch</p>
                        <p>Use Ctrl+1 through Ctrl+9 to quickly switch to layouts 1-9</p>
                    </div>
                </div>

                {/* Close Button */}
                <div className="modal-action">
                    <button className="btn" onClick={onClose}>
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}
