import { ReactNode } from "react";
import Header from "./Header";

interface LayoutProps {
    children: ReactNode;
    currentView: "editor" | "print" | "settings";
    onNavigate: (view: "editor" | "print" | "settings") => void;
}

/**
 * Main layout component providing application structure
 *
 * Provides a consistent layout with header, sidebar navigation, and main content area.
 * Supports responsive design with drawer navigation on smaller screens.
 */
function Layout({ children, currentView, onNavigate }: LayoutProps) {
    return (
        <div className="drawer lg:drawer-open">
            <input id="main-drawer" type="checkbox" className="drawer-toggle" />

            {/* Main content area */}
            <div className="drawer-content flex flex-col">
                {/* Header */}
                <Header currentView={currentView} />

                {/* Page content */}
                <main className="flex-1 overflow-auto bg-base-100">
                    {children}
                </main>
            </div>

            {/* Sidebar navigation */}
            <div className="drawer-side">
                <label htmlFor="main-drawer" aria-label="close sidebar" className="drawer-overlay"></label>

                <aside className="bg-base-200 w-64 min-h-full flex flex-col">
                    {/* App branding */}
                    <div className="p-4 border-b border-base-300">
                        <h1 className="text-2xl font-bold text-primary">Juniper</h1>
                        <p className="text-sm text-base-content/60">CSV Editor</p>
                    </div>

                    {/* Navigation menu */}
                    <ul className="menu p-4 flex-1">
                        <li>
                            <a
                                className={currentView === "editor" ? "active" : ""}
                                onClick={() => onNavigate("editor")}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                                Editor
                            </a>
                        </li>
                        <li>
                            <a
                                className={currentView === "print" ? "active" : ""}
                                onClick={() => onNavigate("print")}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                </svg>
                                Print Preview
                            </a>
                        </li>

                        <div className="divider"></div>

                        <li>
                            <a
                                className={currentView === "settings" ? "active" : ""}
                                onClick={() => onNavigate("settings")}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                                Settings
                            </a>
                        </li>
                    </ul>

                    {/* Footer info */}
                    <div className="p-4 border-t border-base-300">
                        <p className="text-xs text-base-content/50">
                            Version 0.1.0
                        </p>
                    </div>
                </aside>
            </div>
        </div>
    );
}

export default Layout;
