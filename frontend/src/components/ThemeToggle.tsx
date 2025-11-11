/**
 * Theme Toggle Component
 *
 * Toggles between light and dark themes and applies to the document.
 */

import { useState, useEffect } from "react";
import { useSettingsStore } from "@stores/settingsStore";

/**
 * ThemeToggle - Button to toggle between light and dark themes
 */
function ThemeToggle() {
    const { theme, setTheme } = useSettingsStore();
    const [currentTheme, setCurrentTheme] = useState<"light" | "dark">(theme === "auto" ? "dark" : theme);

    // Apply theme to document
    useEffect(() => {
        const effectiveTheme = theme === "auto" ? "dark" : theme;
        setCurrentTheme(effectiveTheme);
        document.documentElement.setAttribute("data-theme", effectiveTheme);
    }, [theme]);

    // Toggle between light and dark theme
    const toggleTheme = () => {
        const newTheme = currentTheme === "light" ? "dark" : "light";
        setTheme(newTheme);
    };

    return (
        <button
            className="btn btn-sm btn-ghost btn-circle"
            onClick={toggleTheme}
            title={`Switch to ${currentTheme === "light" ? "dark" : "light"} mode`}
        >
            {currentTheme === "light" ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
            ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
            )}
        </button>
    );
}

export default ThemeToggle;
