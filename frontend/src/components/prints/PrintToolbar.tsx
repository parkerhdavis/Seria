/**
 * Print Toolbar Component
 *
 * Displays recipe-specific display/edit options in the print drawer.
 * Settings are saved to the user's file config for persistence.
 */

import type { PrintRecipe } from "@/types/printRecipe";
import type { RecipeDisplaySettings } from "@/stores/fileConfigStore";

interface PrintToolbarProps {
    recipe: PrintRecipe;
    settings: RecipeDisplaySettings;
    onSettingsChange: (settings: RecipeDisplaySettings) => void;
    onMappingClick: () => void;
    onExportClick: () => void;
}

/**
 * PrintToolbar - Recipe-specific display and editing options
 */
function PrintToolbar({
    recipe,
    settings,
    onSettingsChange,
    onMappingClick,
    onExportClick,
}: PrintToolbarProps) {
    // Get settings with defaults
    const continuous = settings.continuous ?? true;
    const followCell = settings.followCell ?? true;
    const theme = settings.theme ?? "default";
    const gridSize = settings.gridSize ?? 1;

    // Render recipe-specific options
    const renderRecipeOptions = () => {
        switch (recipe.type) {
            case "screenplay":
                return (
                    <>
                        {/* Continuous toggle */}
                        <div className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                className="toggle toggle-sm toggle-primary"
                                checked={continuous}
                                onChange={(e) => {
                                    onSettingsChange({
                                        ...settings,
                                        continuous: e.target.checked,
                                    });
                                }}
                            />
                            <span className="text-sm">Continuous</span>
                        </div>

                        {/* Follow Cell toggle */}
                        <div className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                className="toggle toggle-sm toggle-primary"
                                checked={followCell}
                                onChange={(e) => {
                                    onSettingsChange({
                                        ...settings,
                                        followCell: e.target.checked,
                                    });
                                }}
                            />
                            <span className="text-sm">Follow Cell</span>
                        </div>

                        {/* Theme dropdown (disabled for now) */}
                        <div className="flex items-center gap-2">
                            <span className="text-sm">Theme:</span>
                            <select
                                className="select select-sm select-bordered w-32 opacity-50"
                                disabled
                                value={theme}
                            >
                                <option value="default">Default (coming soon)</option>
                                <option value="classic">Classic (coming soon)</option>
                                <option value="modern">Modern (coming soon)</option>
                            </select>
                        </div>
                    </>
                );

            case "corkboard":
                return (
                    <>
                        {/* Grid Size control */}
                        <div className="flex items-center gap-2">
                            <span className="text-sm">Grid:</span>
                            <input
                                type="range"
                                className="range range-sm range-primary w-20"
                                min={1}
                                max={6}
                                step={1}
                                value={gridSize}
                                onChange={(e) => {
                                    onSettingsChange({
                                        ...settings,
                                        gridSize: parseInt(e.target.value, 10),
                                    });
                                }}
                                title={`Grid size: ${gridSize}`}
                            />
                            <span className="text-sm font-mono w-4 text-center">{gridSize}</span>
                        </div>

                        {/* Follow Cell toggle */}
                        <div className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                className="toggle toggle-sm toggle-primary"
                                checked={followCell}
                                onChange={(e) => {
                                    onSettingsChange({
                                        ...settings,
                                        followCell: e.target.checked,
                                    });
                                }}
                            />
                            <span className="text-sm">Follow Cell</span>
                        </div>

                        {/* Theme dropdown (disabled for now) */}
                        <div className="flex items-center gap-2">
                            <span className="text-sm">Theme:</span>
                            <select
                                className="select select-sm select-bordered w-32 opacity-50"
                                disabled
                                value={theme}
                            >
                                <option value="default">Default (coming soon)</option>
                                <option value="cork">Cork (coming soon)</option>
                                <option value="fabric">Fabric (coming soon)</option>
                            </select>
                        </div>
                    </>
                );

            default:
                // Generic options for other recipes
                return (
                    <>
                        {/* Follow Cell toggle */}
                        <div className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                className="toggle toggle-sm toggle-primary"
                                checked={followCell}
                                onChange={(e) => {
                                    onSettingsChange({
                                        ...settings,
                                        followCell: e.target.checked,
                                    });
                                }}
                            />
                            <span className="text-sm">Follow Cell</span>
                        </div>
                    </>
                );
        }
    };

    return (
        <div className="flex items-center gap-4 px-4 py-2 border-b border-base-300 bg-base-100">
            {/* Mapping button - special/important, separated from other options */}
            <button
                className="btn btn-sm btn-outline btn-primary"
                onClick={onMappingClick}
                title="Edit field mappings"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Mapping
            </button>

            {/* Export to PDF button */}
            <button
                className="btn btn-sm btn-outline btn-secondary"
                onClick={onExportClick}
                title="Export to PDF"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Export to PDF
            </button>

            {/* Divider */}
            <div className="h-6 w-px bg-base-300"></div>

            {/* Recipe-specific options */}
            <div className="flex items-center gap-4 flex-1">
                {renderRecipeOptions()}
            </div>
        </div>
    );
}

export default PrintToolbar;
