/**
 * Loading Screen Component
 *
 * Full-screen loading overlay displayed during app initialization
 * and file loading operations. Shows a spinner and loading message.
 */

interface LoadingScreenProps {
    message?: string;
}

/**
 * LoadingScreen - Full-screen loading overlay
 */
function LoadingScreen({ message = "Loading..." }: LoadingScreenProps) {
    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center pointer-events-none">
            {/* Loading card */}
            <div className="flex flex-col items-center gap-6 bg-base-100/90 backdrop-blur-md rounded-2xl p-12 shadow-2xl border border-base-300/50 pointer-events-auto">
                {/* Spinner */}
                <div className="relative w-16 h-16">
                    <div className="absolute inset-0 border-4 border-base-300 rounded-full"></div>
                    <div className="absolute inset-0 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                </div>

                {/* Loading message */}
                <div className="text-center">
                    <p className="text-lg font-semibold text-base-content">{message}</p>
                </div>
            </div>

            {/* Seria branding - positioned on overlay, not inside card */}
            <div className="absolute bottom-8 text-center">
                <h1 className="text-2xl font-bold text-primary drop-shadow-lg">Seria</h1>
                <p className="text-sm text-base-content/80 drop-shadow-md">Cell Editor</p>
            </div>
        </div>
    );
}

export default LoadingScreen;
