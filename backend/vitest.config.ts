import { defineConfig } from "vitest/config"

export default defineConfig({
    test: {
        include: ["tests/**/*.test.ts"],
        globalSetup: ["tests/globalSetup.ts"],
        setupFiles: ["tests/setup.ts"],
        // Integration tests share one database and truncate it between tests,
        // so test files must not run at the same time.
        fileParallelism: false,
        testTimeout: 20_000,
        hookTimeout: 60_000,
    },
})
