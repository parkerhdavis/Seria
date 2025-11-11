import { useCSVStore } from "@stores/csvStore";
import CSVGrid from "@components/CSVGrid";
import CSVGridVirtualized from "@components/CSVGridVirtualized";

// Threshold for enabling virtualization (rows)
const VIRTUALIZATION_THRESHOLD = 1000;

/**
 * CSV Editor page component
 *
 * Main editing interface for CSV files. Provides a spreadsheet-like grid
 * for viewing and editing CSV data with filtering, sorting, and bulk operations.
 * Toolbar controls have been moved to the Header component.
 */
function Editor() {
    const { headers, data, error } = useCSVStore();

    // Check if we have data loaded
    const hasData = headers.length > 0;

    return (
        <div className="h-full flex flex-col min-w-0">
            {/* Error display */}
            {error && (
                <div className="alert alert-error m-4">
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="stroke-current shrink-0 h-6 w-6"
                        fill="none"
                        viewBox="0 0 24 24"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                    </svg>
                    <span>{error}</span>
                </div>
            )}

            {/* Grid or empty state */}
            <div className="flex-1 overflow-hidden bg-base-100 min-w-0">
                {hasData ? (
                    data.length >= VIRTUALIZATION_THRESHOLD ? (
                        <CSVGridVirtualized />
                    ) : (
                        <CSVGrid />
                    )
                ) : (
                    <div className="h-full flex items-center justify-center">
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
                                    d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                                />
                            </svg>
                            <h2 className="text-xl font-semibold text-base-content/60 mb-2">
                                No CSV File Open
                            </h2>
                            <p className="text-base-content/50 mb-6">
                                Click "Open File" in the header to load a CSV file
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default Editor;
