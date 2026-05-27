import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        globals: true,
        environment: "node",
        include: ["src/__tests__/**/*.test.ts"],
        // Resolve .js extensions to .ts for ESM-style imports
        alias: {
            // vitest resolves .js → .ts automatically when using this config
        },
    },
    resolve: {
        extensions: [".ts", ".js"],
    },
});
