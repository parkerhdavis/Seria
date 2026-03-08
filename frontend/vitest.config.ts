/**
 * Vitest Configuration
 *
 * Test runner configuration for the Seria frontend.
 * Uses the same path aliases as vite.config.ts.
 */

import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
    test: {
        globals: true,
        environment: "node",
        include: ["src/**/*.test.{ts,tsx}"],
        exclude: ["node_modules", "dist"],
    },
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
