/**
 * Settings Modal Component
 *
 * Modal dialog for application settings. Opens with Ctrl+, keyboard shortcut.
 * Uses daisyUI modal component.
 */

import { useSettingsStore } from "@stores/settingsStore";

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

/**
 * SettingsModal - Modal dialog for application settings
 */
function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
    const {
        showNonCsvFiles,
        setShowNonCsvFiles,
        theme,
        setTheme,
    } = useSettingsStore();

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
                            Configure your Juniper preferences
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
                                    <span className="label-text-alt">Template to use when opening CSV files</span>
                                </label>
                            </div>

                            <div className="form-control mt-4">
                                <label className="label cursor-pointer justify-start gap-4">
                                    <input type="checkbox" className="checkbox checkbox-primary" defaultChecked />
                                    <div>
                                        <span className="label-text font-semibold block">Enable virtualization</span>
                                        <span className="label-text-alt block text-base-content/60">
                                            Improve performance for large CSV files (1000+ rows)
                                        </span>
                                    </div>
                                </label>
                            </div>

                            <div className="form-control mt-4">
                                <label className="label cursor-pointer justify-start gap-4">
                                    <input
                                        type="checkbox"
                                        className="checkbox checkbox-primary"
                                        checked={showNonCsvFiles}
                                        onChange={(e) => setShowNonCsvFiles(e.target.checked)}
                                    />
                                    <div>
                                        <span className="label-text font-semibold block">Show non-CSV files</span>
                                        <span className="label-text-alt block text-base-content/60">
                                            Display non-CSV files in the file tree (greyed out and non-clickable)
                                        </span>
                                    </div>
                                </label>
                            </div>
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
                                <div className="flex justify-between items-center py-2">
                                    <span>Redo</span>
                                    <div>
                                        <kbd className="kbd kbd-sm">Ctrl</kbd> + <kbd className="kbd kbd-sm">Shift</kbd> + <kbd className="kbd kbd-sm">Z</kbd>
                                        <span className="mx-1">or</span>
                                        <kbd className="kbd kbd-sm">Ctrl</kbd> + <kbd className="kbd kbd-sm">Y</kbd>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Recent Files */}
                    <div className="card bg-base-200 shadow-md">
                        <div className="card-body">
                            <h3 className="card-title text-xl mb-4">Recent Files</h3>

                            <div className="text-base-content/60">
                                <p className="mb-4">No recent files yet</p>
                            </div>

                            <div className="card-actions justify-end">
                                <button className="btn btn-ghost btn-sm" disabled>
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
                                    Juniper is a specialized CSV editor for writers and designers.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="alert alert-info">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 w-6 h-6">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                        </svg>
                        <div>
                            <p className="font-semibold">Settings Coming Soon</p>
                            <p className="text-sm">Preferences persistence will be implemented in Phase 6</p>
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
