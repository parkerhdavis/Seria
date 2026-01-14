/**
 * Settings Modal Component
 *
 * Modal dialog for application settings. Opens with Ctrl+, keyboard shortcut.
 * Uses daisyUI modal component.
 */

import { useSettingsStore } from "@stores/settingsStore";
import { useFileConfigStore } from "@stores/fileConfigStore";
import { useGlobalConfigStore } from "@stores/globalConfigStore";
import { useCellStore } from "@stores/cellStore";
import { save, open } from "@tauri-apps/plugin-dialog";
import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

/**
 * SettingsModal - Modal dialog for application settings
 */
function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
    const {
        showIncompatibleFiles,
        setShowIncompatibleFiles,
        theme,
        setTheme,
        appFont,
        setAppFont,
        printFollowsCellEdit,
        setPrintFollowsCellEdit,
        cellFollowsPrintEdit,
        setCellFollowsPrintEdit,
        hoverHighlightMode,
        setHoverHighlightMode,
        autosaveEnabled,
        setAutosaveEnabled,
        autosaveIntervalSeconds,
        setAutosaveIntervalSeconds,
        autocompleteEnabled,
        setAutocompleteEnabled,
        autocompleteMinChars,
        setAutocompleteMinChars,
        autocompleteRestrictToExisting,
        setAutocompleteRestrictToExisting,
    } = useSettingsStore();

    const { exportConfigs, importConfigs, cleanupOldConfigs } = useFileConfigStore();

    const { config, clearRecentFiles } = useGlobalConfigStore();
    const { loadCellsProgressive } = useCellStore();

    // Handle export configs
    const handleExportConfigs = async () => {
        try {
            const filePath = await save({
                filters: [{ name: "JSON Files", extensions: ["json"] }],
                title: "Export File Configurations",
                defaultPath: "seria-configs.json",
            });

            if (filePath) {
                const configData = exportConfigs();
                await writeTextFile(filePath, configData);
                console.log("Configs exported to:", filePath);
            }
        } catch (error) {
            console.error("Failed to export configs:", error);
        }
    };

    // Handle import configs
    const handleImportConfigs = async () => {
        try {
            const filePath = await open({
                multiple: false,
                filters: [{ name: "JSON Files", extensions: ["json"] }],
                title: "Import File Configurations",
            });

            if (filePath) {
                const configData = await readTextFile(filePath as string);
                await importConfigs(configData);
                console.log("Configs imported from:", filePath);
            }
        } catch (error) {
            console.error("Failed to import configs:", error);
        }
    };

    // Handle cleanup old configs
    const handleCleanupConfigs = async () => {
        try {
            await cleanupOldConfigs();
            console.log("Old configs cleaned up");
        } catch (error) {
            console.error("Failed to cleanup configs:", error);
        }
    };

    if (!isOpen) {
        return null;
    }

    return (
        <div className="modal modal-open">
            <div className="modal-box max-w-4xl max-h-[90vh] overflow-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h2 className="text-2xl font-bold text-base-content">Settings</h2>
                        <p className="text-base-content/60 mt-1">
                            Configure your Seria preferences
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

                <div className="space-y-6">
                    {/* Appearance Settings */}
                    <div className="card bg-base-200 shadow-md">
                        <div className="card-body">
                            <h3 className="card-title text-xl mb-4">Appearance</h3>

                            <div className="form-control">
                                <label className="label">
                                    <span className="label-text font-semibold">Theme</span>
                                </label>
                                <select
                                    className="select select-bordered w-full max-w-xs"
                                    value={theme}
                                    onChange={(e) => setTheme(e.target.value as "light" | "dark" | "auto")}
                                >
                                    <option value="light">Light</option>
                                    <option value="dark">Dark</option>
                                    <option value="auto">Auto (System)</option>
                                </select>
                                <label className="label">
                                    <span className="label-text-alt">Choose your preferred color theme</span>
                                </label>
                            </div>

                            <div className="form-control mt-4">
                                <label className="label">
                                    <span className="label-text font-semibold">App Font</span>
                                </label>
                                <select
                                    className="select select-bordered w-full max-w-xs"
                                    value={appFont}
                                    onChange={(e) => setAppFont(e.target.value)}
                                >
                                    <option value="system">System Default</option>
                                    <option value="courier-prime">Courier Prime</option>
                                </select>
                                <label className="label">
                                    <span className="label-text-alt">Font used throughout the application (not in Print views)</span>
                                </label>
                            </div>

                            <div className="alert alert-info mt-4">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 w-5 h-5">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                                </svg>
                                <div className="text-sm">
                                    <p className="font-semibold">Editor Appearance Controls</p>
                                    <p>Wrap Text, Column Lines, and Row Coloring options are available in the editor toolbar</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Editor Settings */}
                    <div className="card bg-base-200 shadow-md">
                        <div className="card-body">
                            <h3 className="card-title text-xl mb-4">Editor</h3>

                            <div className="form-control">
                                <label className="label">
                                    <span className="label-text font-semibold">Default Print Template</span>
                                </label>
                                <select className="select select-bordered w-full max-w-xs">
                                    <option>Screenplay</option>
                                    <option>Dialogue</option>
                                    <option>Game Design</option>
                                </select>
                                <label className="label">
                                    <span className="label-text-alt">Template to use when opening Cell files</span>
                                </label>
                            </div>

                            <div className="form-control mt-4">
                                <label className="label cursor-pointer justify-start gap-4">
                                    <input type="checkbox" className="checkbox checkbox-primary" defaultChecked />
                                    <div>
                                        <span className="label-text font-semibold block">Enable virtualization</span>
                                        <span className="label-text-alt block text-base-content/60">
                                            Improve performance for large Cell files (10,000+ rows)
                                        </span>
                                    </div>
                                </label>
                            </div>

                            <div className="form-control mt-4">
                                <label className="label cursor-pointer justify-start gap-4">
                                    <input
                                        type="checkbox"
                                        className="checkbox checkbox-primary"
                                        checked={showIncompatibleFiles}
                                        onChange={(e) => setShowIncompatibleFiles(e.target.checked)}
                                    />
                                    <div>
                                        <span className="label-text font-semibold block">Show non-Cell files</span>
                                        <span className="label-text-alt block text-base-content/60">
                                            Display non-Cell files in the file tree (greyed out and non-clickable)
                                        </span>
                                    </div>
                                </label>
                            </div>

                            <div className="form-control mt-4">
                                <label className="label">
                                    <span className="label-text font-semibold">Hover Highlighting</span>
                                </label>
                                <select
                                    className="select select-bordered w-full max-w-xs"
                                    value={hoverHighlightMode}
                                    onChange={(e) => setHoverHighlightMode(e.target.value as "none" | "row" | "column" | "row-and-column")}
                                >
                                    <option value="none">None</option>
                                    <option value="row">Row</option>
                                    <option value="column">Column</option>
                                    <option value="row-and-column">Row and Column</option>
                                </select>
                                <label className="label">
                                    <span className="label-text-alt">Choose which parts of the Cell Grid to highlight when hovering over a cell</span>
                                </label>
                            </div>

                            <div className="divider mt-6 mb-2">Bidirectional Editing</div>

                            <div className="form-control">
                                <label className="label cursor-pointer justify-start gap-4">
                                    <input
                                        type="checkbox"
                                        className="checkbox checkbox-primary"
                                        checked={printFollowsCellEdit}
                                        onChange={(e) => setPrintFollowsCellEdit(e.target.checked)}
                                    />
                                    <div>
                                        <span className="label-text font-semibold block">Print follows Cell edit</span>
                                        <span className="label-text-alt block text-base-content/60">
                                            Automatically scroll Print view to show the element being edited from Cell
                                        </span>
                                    </div>
                                </label>
                            </div>

                            <div className="form-control mt-4">
                                <label className="label cursor-pointer justify-start gap-4">
                                    <input
                                        type="checkbox"
                                        className="checkbox checkbox-primary"
                                        checked={cellFollowsPrintEdit}
                                        onChange={(e) => setCellFollowsPrintEdit(e.target.checked)}
                                    />
                                    <div>
                                        <span className="label-text font-semibold block">Cell follows Print edit</span>
                                        <span className="label-text-alt block text-base-content/60">
                                            Automatically scroll Cell view to show the row being edited from Print
                                        </span>
                                    </div>
                                </label>
                            </div>
                        </div>
                    </div>

                    {/* File Saving Settings */}
                    <div className="card bg-base-200 shadow-md">
                        <div className="card-body">
                            <h3 className="card-title text-xl mb-4">File Saving</h3>

                            <div className="form-control">
                                <label className="label cursor-pointer justify-start gap-4">
                                    <input
                                        type="checkbox"
                                        className="checkbox checkbox-primary"
                                        checked={autosaveEnabled}
                                        onChange={(e) => setAutosaveEnabled(e.target.checked)}
                                    />
                                    <div>
                                        <span className="label-text font-semibold block">Enable autosave</span>
                                        <span className="label-text-alt block text-base-content/60">
                                            Automatically save changes after edits
                                        </span>
                                    </div>
                                </label>
                            </div>

                            {autosaveEnabled && (
                                <div className="form-control mt-4">
                                    <label className="label">
                                        <span className="label-text font-semibold">Autosave interval</span>
                                    </label>
                                    <div className="flex items-center gap-4">
                                        <input
                                            type="range"
                                            min="5"
                                            max="300"
                                            step="5"
                                            value={autosaveIntervalSeconds}
                                            onChange={(e) => setAutosaveIntervalSeconds(Number(e.target.value))}
                                            className="range range-primary flex-1"
                                        />
                                        <div className="badge badge-primary badge-lg min-w-[80px]">
                                            {autosaveIntervalSeconds}s
                                        </div>
                                    </div>
                                    <label className="label">
                                        <span className="label-text-alt">Time to wait after last edit before autosaving (5-300 seconds)</span>
                                    </label>
                                    <div className="flex gap-2 mt-2">
                                        <button
                                            className="btn btn-xs btn-ghost"
                                            onClick={() => setAutosaveIntervalSeconds(10)}
                                        >
                                            10s
                                        </button>
                                        <button
                                            className="btn btn-xs btn-ghost"
                                            onClick={() => setAutosaveIntervalSeconds(30)}
                                        >
                                            30s
                                        </button>
                                        <button
                                            className="btn btn-xs btn-ghost"
                                            onClick={() => setAutosaveIntervalSeconds(60)}
                                        >
                                            1m
                                        </button>
                                        <button
                                            className="btn btn-xs btn-ghost"
                                            onClick={() => setAutosaveIntervalSeconds(120)}
                                        >
                                            2m
                                        </button>
                                        <button
                                            className="btn btn-xs btn-ghost"
                                            onClick={() => setAutosaveIntervalSeconds(300)}
                                        >
                                            5m
                                        </button>
                                    </div>
                                </div>
                            )}

                            <div className="alert alert-info mt-4">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 w-5 h-5">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                                </svg>
                                <div className="text-sm">
                                    <p className="font-semibold">How Autosave Works</p>
                                    <p>After you confirm a cell edit, the autosave timer starts. If you make another edit before the timer expires, it resets. When the timer reaches zero, your changes are automatically saved.</p>
                                </div>
                            </div>

                            <div className="divider mt-6 mb-2">Autocomplete</div>

                            <div className="form-control">
                                <label className="label cursor-pointer justify-start gap-4">
                                    <input
                                        type="checkbox"
                                        className="checkbox checkbox-primary"
                                        checked={autocompleteEnabled}
                                        onChange={(e) => setAutocompleteEnabled(e.target.checked)}
                                    />
                                    <div>
                                        <span className="label-text font-semibold block">Enable autocomplete</span>
                                        <span className="label-text-alt block text-base-content/60">
                                            Show suggestions based on existing values in the column
                                        </span>
                                    </div>
                                </label>
                            </div>

                            {autocompleteEnabled && (
                                <>
                                    <div className="form-control mt-4">
                                        <label className="label">
                                            <span className="label-text font-semibold">Minimum characters</span>
                                        </label>
                                        <input
                                            type="number"
                                            min="0"
                                            max="5"
                                            value={autocompleteMinChars}
                                            onChange={(e) => setAutocompleteMinChars(Number(e.target.value))}
                                            className="input input-bordered w-full max-w-xs"
                                        />
                                        <label className="label">
                                            <span className="label-text-alt">Minimum characters to type before showing suggestions (0 shows all values)</span>
                                        </label>
                                    </div>

                                    <div className="form-control mt-4">
                                        <label className="label cursor-pointer justify-start gap-4">
                                            <input
                                                type="checkbox"
                                                className="checkbox checkbox-primary"
                                                checked={autocompleteRestrictToExisting}
                                                onChange={(e) => setAutocompleteRestrictToExisting(e.target.checked)}
                                            />
                                            <div>
                                                <span className="label-text font-semibold block">Restrict to existing values</span>
                                                <span className="label-text-alt block text-base-content/60">
                                                    Only allow values that already exist in the column
                                                </span>
                                            </div>
                                        </label>
                                    </div>

                                    <div className="alert alert-info mt-4">
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 w-5 h-5">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                                        </svg>
                                        <div className="text-sm">
                                            <p className="font-semibold">How Autocomplete Works</p>
                                            <p>When editing a cell, autocomplete shows suggestions based on existing values in that column. Use Arrow Up/Down to navigate, Enter/Tab to select, or Escape to dismiss.</p>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Keyboard Shortcuts */}
                    <div className="card bg-base-200 shadow-md">
                        <div className="card-body">
                            <h3 className="card-title text-xl mb-4">Keyboard Shortcuts</h3>

                            <div className="text-sm space-y-2">
                                <div className="flex justify-between items-center py-2 border-b border-base-300">
                                    <span>Save file</span>
                                    <div><kbd className="kbd kbd-sm">Ctrl</kbd> + <kbd className="kbd kbd-sm">S</kbd></div>
                                </div>
                                <div className="flex justify-between items-center py-2 border-b border-base-300">
                                    <span>Open Settings</span>
                                    <div><kbd className="kbd kbd-sm">Ctrl</kbd> + <kbd className="kbd kbd-sm">,</kbd></div>
                                </div>
                                <div className="flex justify-between items-center py-2 border-b border-base-300">
                                    <span>Toggle Sidebar (left)</span>
                                    <div><kbd className="kbd kbd-sm">Ctrl</kbd> + <kbd className="kbd kbd-sm">.</kbd></div>
                                </div>
                                <div className="flex justify-between items-center py-2 border-b border-base-300">
                                    <span>Toggle Print Preview (right)</span>
                                    <div><kbd className="kbd kbd-sm">Ctrl</kbd> + <kbd className="kbd kbd-sm">\</kbd></div>
                                </div>
                                <div className="flex justify-between items-center py-2 border-b border-base-300">
                                    <span>Toggle Print Preview (bottom)</span>
                                    <div><kbd className="kbd kbd-sm">Ctrl</kbd> + <kbd className="kbd kbd-sm">/</kbd></div>
                                </div>
                                <div className="flex justify-between items-center py-2 border-b border-base-300">
                                    <span>Zoom in</span>
                                    <div><kbd className="kbd kbd-sm">Ctrl</kbd> + <kbd className="kbd kbd-sm">=</kbd></div>
                                </div>
                                <div className="flex justify-between items-center py-2 border-b border-base-300">
                                    <span>Zoom out</span>
                                    <div><kbd className="kbd kbd-sm">Ctrl</kbd> + <kbd className="kbd kbd-sm">-</kbd></div>
                                </div>
                                <div className="flex justify-between items-center py-2 border-b border-base-300">
                                    <span>Reset zoom</span>
                                    <div><kbd className="kbd kbd-sm">Ctrl</kbd> + <kbd className="kbd kbd-sm">0</kbd></div>
                                </div>
                                <div className="flex justify-between items-center py-2 border-b border-base-300">
                                    <span>Find</span>
                                    <div><kbd className="kbd kbd-sm">Ctrl</kbd> + <kbd className="kbd kbd-sm">F</kbd></div>
                                </div>
                                <div className="flex justify-between items-center py-2 border-b border-base-300">
                                    <span>Find and Replace</span>
                                    <div><kbd className="kbd kbd-sm">Ctrl</kbd> + <kbd className="kbd kbd-sm">R</kbd></div>
                                </div>
                                <div className="flex justify-between items-center py-2 border-b border-base-300">
                                    <span>Undo</span>
                                    <div><kbd className="kbd kbd-sm">Ctrl</kbd> + <kbd className="kbd kbd-sm">Z</kbd></div>
                                </div>
                                <div className="flex justify-between items-center py-2 border-b border-base-300">
                                    <span>Redo</span>
                                    <div>
                                        <kbd className="kbd kbd-sm">Ctrl</kbd> + <kbd className="kbd kbd-sm">Shift</kbd> + <kbd className="kbd kbd-sm">Z</kbd>
                                        <span className="mx-1">or</span>
                                        <kbd className="kbd kbd-sm">Ctrl</kbd> + <kbd className="kbd kbd-sm">Y</kbd>
                                    </div>
                                </div>

                                {/* Cell Selection & Editing */}
                                <div className="mt-4 mb-2 font-semibold text-base-content/70">Cell Selection & Editing</div>

                                <div className="flex justify-between items-center py-2 border-b border-base-300">
                                    <span>Edit selected cell</span>
                                    <div>
                                        <kbd className="kbd kbd-sm">F2</kbd>
                                        <span className="mx-1">or</span>
                                        <kbd className="kbd kbd-sm">Enter</kbd>
                                    </div>
                                </div>
                                <div className="flex justify-between items-center py-2 border-b border-base-300">
                                    <span>Copy selection</span>
                                    <div><kbd className="kbd kbd-sm">Ctrl</kbd> + <kbd className="kbd kbd-sm">C</kbd></div>
                                </div>
                                <div className="flex justify-between items-center py-2 border-b border-base-300">
                                    <span>Paste</span>
                                    <div><kbd className="kbd kbd-sm">Ctrl</kbd> + <kbd className="kbd kbd-sm">V</kbd></div>
                                </div>
                                <div className="flex justify-between items-center py-2 border-b border-base-300">
                                    <span>Add row below selection</span>
                                    <div><kbd className="kbd kbd-sm">Ctrl</kbd> + <kbd className="kbd kbd-sm">Enter</kbd></div>
                                </div>
                                <div className="flex justify-between items-center py-2 border-b border-base-300">
                                    <span>Clear selection</span>
                                    <div><kbd className="kbd kbd-sm">Esc</kbd></div>
                                </div>

                                {/* Arrow Key Navigation */}
                                <div className="mt-4 mb-2 font-semibold text-base-content/70">Arrow Key Navigation (when cell selected)</div>

                                <div className="flex justify-between items-center py-2 border-b border-base-300">
                                    <span>Move selection up/down/left/right</span>
                                    <div><kbd className="kbd kbd-sm">↑</kbd> <kbd className="kbd kbd-sm">↓</kbd> <kbd className="kbd kbd-sm">←</kbd> <kbd className="kbd kbd-sm">→</kbd></div>
                                </div>

                                {/* Cell Navigation (while editing) */}
                                <div className="mt-4 mb-2 font-semibold text-base-content/70">Cell Navigation (while editing)</div>

                                <div className="flex justify-between items-center py-2 border-b border-base-300">
                                    <span>Save & move to next row</span>
                                    <div><kbd className="kbd kbd-sm">Enter</kbd></div>
                                </div>
                                <div className="flex justify-between items-center py-2 border-b border-base-300">
                                    <span>Save & move to previous row</span>
                                    <div><kbd className="kbd kbd-sm">Shift</kbd> + <kbd className="kbd kbd-sm">Enter</kbd></div>
                                </div>
                                <div className="flex justify-between items-center py-2 border-b border-base-300">
                                    <span>Save & move to next column</span>
                                    <div><kbd className="kbd kbd-sm">Tab</kbd></div>
                                </div>
                                <div className="flex justify-between items-center py-2 border-b border-base-300">
                                    <span>Save & move to previous column</span>
                                    <div><kbd className="kbd kbd-sm">Shift</kbd> + <kbd className="kbd kbd-sm">Tab</kbd></div>
                                </div>
                                <div className="flex justify-between items-center py-2 border-b border-base-300">
                                    <span>Cancel edit</span>
                                    <div><kbd className="kbd kbd-sm">Esc</kbd></div>
                                </div>

                                {/* Column Actions */}
                                <div className="mt-4 mb-2 font-semibold text-base-content/70">Column Actions (when Auto-Fit is enabled)</div>

                                <div className="flex justify-between items-center py-2">
                                    <span>Distributed Resize</span>
                                    <div><kbd className="kbd kbd-sm">Shift</kbd> + <span className="mx-1">Drag column edge</span></div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Recent Files */}
                    <div className="card bg-base-200 shadow-md">
                        <div className="card-body">
                            <h3 className="card-title text-xl mb-4">Recent Files</h3>

                            {config?.recentFiles && config.recentFiles.length > 0 ? (
                                <div className="space-y-2">
                                    {config.recentFiles.map((filePath, index) => {
                                        const fileName = filePath.split('/').pop() || filePath.split('\\').pop() || filePath;
                                        return (
                                            <div
                                                key={filePath}
                                                className="flex items-center justify-between p-3 bg-base-300 rounded-lg hover:bg-base-100 transition-colors group"
                                            >
                                                <button
                                                    className="flex-1 text-left"
                                                    onClick={async () => {
                                                        await loadCellsProgressive(filePath);
                                                        onClose();
                                                    }}
                                                >
                                                    <div className="font-semibold text-base-content">
                                                        {fileName}
                                                    </div>
                                                    <div className="text-xs text-base-content/60 truncate mt-1" title={filePath}>
                                                        {filePath}
                                                    </div>
                                                </button>
                                                <span className="badge badge-sm ml-2">{index + 1}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="text-base-content/60">
                                    <p className="mb-4">No recent files yet</p>
                                </div>
                            )}

                            <div className="card-actions justify-end mt-4">
                                <button
                                    className="btn btn-ghost btn-sm"
                                    onClick={clearRecentFiles}
                                    disabled={!config?.recentFiles || config.recentFiles.length === 0}
                                >
                                    Clear Recent Files
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* About */}
                    <div className="card bg-base-200 shadow-md">
                        <div className="card-body">
                            <h3 className="card-title text-xl mb-4">About</h3>

                            <div className="space-y-2 text-sm">
                                <p><span className="font-semibold">Version:</span> 0.1.0</p>
                                <p><span className="font-semibold">Build:</span> Development</p>
                                <p className="text-base-content/60">
                                    Seria is a specialized Cell editor for writers and designers.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* File Configuration Management */}
                    <div className="card bg-base-200 shadow-md">
                        <div className="card-body">
                            <h3 className="card-title text-xl mb-4">File Configuration Management</h3>
                            <p className="text-base-content/70 mb-4">
                                Export, import, and manage your file-specific settings (column widths, filters, display preferences).
                            </p>

                            <div className="flex flex-wrap gap-3">
                                <button
                                    className="btn btn-primary btn-sm"
                                    onClick={handleExportConfigs}
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                                    </svg>
                                    Export Configs
                                </button>

                                <button
                                    className="btn btn-secondary btn-sm"
                                    onClick={handleImportConfigs}
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                    </svg>
                                    Import Configs
                                </button>

                                <button
                                    className="btn btn-ghost btn-sm"
                                    onClick={handleCleanupConfigs}
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                    Cleanup Old Configs
                                </button>
                            </div>

                            <div className="alert alert-info mt-4">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 w-5 h-5">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                                </svg>
                                <div className="text-sm">
                                    <p className="font-semibold">About File Configs</p>
                                    <p>Your settings are automatically saved per file. Export to back up or share with others.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Modal Actions */}
                <div className="modal-action">
                    <button className="btn btn-primary" onClick={onClose}>Close</button>
                </div>
            </div>
            <div className="modal-backdrop" onClick={onClose}></div>
        </div>
    );
}

export default SettingsModal;
