import { ReactNode, useState, useEffect, useRef } from "react";
import Header from "./Header";
import FileTree from "./FileTree";
import ThemeToggle from "./ThemeToggle";
import { useDrag } from "@/contexts/DragContext";

interface LayoutProps {
    children: ReactNode;
    printPreviewPosition: "right" | "bottom" | null;
    isSidebarOpen: boolean;
    onTogglePrintPreview: (position: "right" | "bottom") => void;
    onToggleSidebar: () => void;
}

/**
 * Main layout component providing application structure
 *
 * Provides a consistent layout with header, file tree sidebar, and main content area.
 * Supports responsive design with drawer navigation on smaller screens.
 * Sidebar is resizable via draggable edge.
 */
function Layout({ children, printPreviewPosition, isSidebarOpen, onTogglePrintPreview, onToggleSidebar }: LayoutProps) {
    const [sidebarWidth, setSidebarWidth] = useState(256);
    const [isResizing, setIsResizing] = useState(false);
    const sidebarRef = useRef<HTMLElement>(null);
    const { startDrag, endDrag } = useDrag();

    // Handle resize
    useEffect(() => {
        if (!isResizing) return;

        const handleMouseMove = (e: MouseEvent) => {
            const newWidth = e.clientX;
            setSidebarWidth(Math.max(200, Math.min(newWidth, window.innerWidth * 0.5)));
        };

        const handleMouseUp = () => {
            setIsResizing(false);
            endDrag();
        };

        document.addEventListener("mousemove", handleMouseMove);
        document.addEventListener("mouseup", handleMouseUp);

        return () => {
            document.removeEventListener("mousemove", handleMouseMove);
            document.removeEventListener("mouseup", handleMouseUp);
        };
    }, [isResizing, endDrag]);

    return (
        <div className="flex h-screen">
            {/* Sidebar with file tree */}
            {isSidebarOpen && (
                <aside
                    ref={sidebarRef}
                    className="bg-base-200 flex flex-col border-r border-base-300 relative"
                    style={{ width: `${sidebarWidth}px` }}
                >
                    {/* Resize handle */}
                    <div
                        className="absolute right-0 top-0 bottom-0 w-1 cursor-ew-resize hover:bg-primary/50 z-10 select-none"
                        onMouseDown={() => {
                            startDrag("sidebar-resize");
                            setIsResizing(true);
                        }}
                    />
                    {/* Sidebar header with close button */}
                    <div className="p-4 border-b border-base-300 flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-bold text-primary">Juniper</h1>
                            <p className="text-sm text-base-content/60">CSV Editor</p>
                        </div>
                        <button
                            className="btn btn-sm btn-ghost btn-circle"
                            onClick={onToggleSidebar}
                            title="Toggle Sidebar (Ctrl+.)"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                        </button>
                    </div>

                    {/* File tree */}
                    <FileTree />

                    {/* Footer info with theme toggle */}
                    <div className="p-4 border-t border-base-300 flex items-center justify-between">
                        <p className="text-xs text-base-content/50">
                            Version 0.1.0
                        </p>
                        <ThemeToggle />
                    </div>
                </aside>
            )}

            {/* Main content area */}
            <div className="flex-1 flex flex-col">
                {/* Header */}
                <Header
                    onTogglePrintPreview={() => onTogglePrintPreview("right")}
                    onToggleSidebar={onToggleSidebar}
                    isSidebarOpen={isSidebarOpen}
                />

                {/* Page content */}
                <main className="flex-1 overflow-auto bg-base-100">
                    {children}
                </main>
            </div>
        </div>
    );
}

export default Layout;
