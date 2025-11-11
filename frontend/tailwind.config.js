/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {},
    },
    // eslint-disable-next-line no-undef
    plugins: [require("daisyui")],
    daisyui: {
        themes: [
            "light",
            "dark",
            {
                juniper_light: {
                    "primary": "#10b981",
                    "secondary": "#3b82f6",
                    "accent": "#8b5cf6",
                    "neutral": "#1f2937",
                    "base-100": "#ffffff",
                    "base-200": "#f3f4f6",
                    "base-300": "#e5e7eb",
                    "info": "#3b82f6",
                    "success": "#10b981",
                    "warning": "#f59e0b",
                    "error": "#ef4444",
                },
                juniper_dark: {
                    "primary": "#10b981",
                    "secondary": "#3b82f6",
                    "accent": "#8b5cf6",
                    "neutral": "#1f2937",
                    "base-100": "#1f2937",
                    "base-200": "#111827",
                    "base-300": "#0f172a",
                    "info": "#3b82f6",
                    "success": "#10b981",
                    "warning": "#f59e0b",
                    "error": "#ef4444",
                },
            },
        ],
        darkTheme: "dark",
        base: true,
        styled: true,
        utils: true,
        prefix: "",
        logs: false,
    },
};
