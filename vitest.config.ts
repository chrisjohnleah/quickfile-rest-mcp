import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      exclude: [
        "src/generated/**",
        "src/index.ts",
        "scripts/**",
        "tests/**",
      ],
      provider: "v8",
      reporter: ["text", "json-summary"],
      thresholds: {
        branches: 65,
        functions: 75,
        lines: 75,
        statements: 75,
      },
    },
    include: ["tests/**/*.test.ts"],
  },
});
