// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Print Preview page component
 *
 * Displays Cell Data rendered in professional page formats (Screenplay, Dialogue, etc.).
 * Allows users to select different Print templates and preview their Cell Data
 * in various formatted layouts.
 */
function PrintPreview() {
    return (
        <div className="h-full flex flex-col p-6">
            <div className="mb-4">
                <h1 className="text-3xl font-bold text-base-content">Print Preview</h1>
                <p className="text-base-content/60 mt-2">
                    View your Cell Data in professional formats
                </p>
            </div>

            {/* Placeholder content */}
            <div className="flex-1 flex items-center justify-center bg-base-200 rounded-lg border-2 border-dashed border-base-300">
                <div className="text-center p-8">
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-24 w-24 mx-auto text-base-content/30 mb-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1}
                            d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                        />
                    </svg>
                    <h2 className="text-xl font-semibold text-base-content/60 mb-2">
                        No Print to Preview
                    </h2>
                    <p className="text-base-content/50 mb-6">
                        Open a Cell file in the Editor to preview it here
                    </p>

                    <div className="alert alert-info max-w-md mx-auto">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 w-6 h-6">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                        </svg>
                        <div className="text-left">
                            <p className="font-semibold">Coming Soon</p>
                            <p className="text-sm">Print system will be implemented in Phase 5</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default PrintPreview;
