import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],

    // Vite options tailored for Tauri development
    clearScreen: false,

    // Tauri expects a fixed port, fail if that port is not available
    server: {
        port: 5173,
        strictPort: true,
        host: "localhost",
        watch: {
            // Tell vite to ignore watching `backend`
            ignored: ["**/backend/**"],
        },
    },

    // Tauri uses a non-standard environment variable for the dev server URL
    envPrefix: ["VITE_", "TAURI_"],

    // Build configuration
    build: {
        // Tauri uses Chromium on Windows and WebKit on macOS and Linux
        target: process.env.TAURI_PLATFORM === "windows" ? "chrome105" : "safari13",
        // Don't minify for debug builds
        minify: !process.env.TAURI_DEBUG ? "esbuild" : false,
        // Produce sourcemaps for debug builds
        sourcemap: !!process.env.TAURI_DEBUG,
        rollupOptions: {
            output: {
                // Split vendor chunks for better caching and smaller initial load
                manualChunks: {
                    // React ecosystem - core framework always needed
                    "vendor-react": ["react", "react-dom", "zustand"],
                    // PDF generation - only used for export features
                    "vendor-pdf": ["jspdf", "html2pdf.js", "html2canvas"],
                    // Table virtualization - core data display
                    "vendor-table": ["@tanstack/react-table", "@tanstack/react-virtual"],
                    // CSV parsing - core data handling
                    "vendor-csv": ["papaparse"],
                },
            },
        },
    },

    // Path aliases
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
            "@components": path.resolve(__dirname, "./src/components"),
            "@stores": path.resolve(__dirname, "./src/stores"),
            "@types": path.resolve(__dirname, "./src/types"),
            "@utils": path.resolve(__dirname, "./src/utils"),
        },
    },
});
