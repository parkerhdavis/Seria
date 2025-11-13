/**
 * Settings page component
 *
 * User preferences and application settings. Includes theme selection,
 * default Print template, recent files, and other configuration options.
 */

import RecipeSettings from "@components/prints/RecipeSettings";

function Settings() {
    return (
        <div className="h-full overflow-auto p-6">
            <div className="mb-6">
                <h1 className="text-3xl font-bold text-base-content">Settings</h1>
                <p className="text-base-content/60 mt-2">
                    Configure your Seria preferences
                </p>
            </div>

            <div className="max-w-3xl space-y-6">
                {/* Appearance Settings */}
                <div className="card bg-base-200 shadow-md">
                    <div className="card-body">
                        <h2 className="card-title text-xl mb-4">Appearance</h2>

                        <div className="form-control">
                            <label className="label">
                                <span className="label-text font-semibold">Theme</span>
                            </label>
                            <select className="select select-bordered w-full max-w-xs">
                                <option>Light</option>
                                <option>Dark</option>
                                <option>Auto (System)</option>
                            </select>
                            <label className="label">
                                <span className="label-text-alt">Choose your preferred color theme</span>
                            </label>
                        </div>
                    </div>
                </div>

                {/* Editor Settings */}
                <div className="card bg-base-200 shadow-md">
                    <div className="card-body">
                        <h2 className="card-title text-xl mb-4">Editor</h2>

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
                                        Improve performance for large Cell files (1000+ rows)
                                    </span>
                                </div>
                            </label>
                        </div>
                    </div>
                </div>

                {/* Print Recipes */}
                <RecipeSettings />

                {/* Recent Files */}
                <div className="card bg-base-200 shadow-md">
                    <div className="card-body">
                        <h2 className="card-title text-xl mb-4">Recent Files</h2>

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
                        <h2 className="card-title text-xl mb-4">About</h2>

                        <div className="space-y-2 text-sm">
                            <p><span className="font-semibold">Version:</span> 0.1.0</p>
                            <p><span className="font-semibold">Build:</span> Development</p>
                            <p className="text-base-content/60">
                                Seria is a specialized Cell editor for writers and designers.
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
        </div>
    );
}

export default Settings;
