module.exports = {
    root: true,
    env: { browser: true, es2020: true },
    extends: [
        "eslint:recommended",
        "plugin:@typescript-eslint/recommended",
        "plugin:react-hooks/recommended",
    ],
    ignorePatterns: ["dist", ".eslintrc.cjs"],
    parser: "@typescript-eslint/parser",
    plugins: ["react-refresh"],
    rules: {
        "react-refresh/only-export-components": [
            "warn",
            { allowConstantExport: true },
        ],
        // Prefer double quotes
        "quotes": ["error", "double", { "avoidEscape": true }],
        // 4-space indentation
        "indent": ["error", 4, { "SwitchCase": 1 }],
        // Allow console in development
        "no-console": process.env.NODE_ENV === "production" ? "warn" : "off",
    },
};
