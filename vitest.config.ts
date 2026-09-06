import path from "path"
import { defineConfig } from "vitest/config"

const jsdomOnlyTsFiles = [
  "src/components/cmdk/use-key-sequence.test.ts",
  "src/components/cmdk/use-command-palette.test.ts",
  "src/components/cmdk/use-command-search.test.ts",
  "src/components/tasks/use-tasks-selection.test.ts",
  "src/features/quotes/use-quote-form.test.ts",
]

const nodeOnlyTsxFiles = ["src/components/suivi/suivi-view.test.tsx"]

const integrationTestGlob = "src/**/*.integration.test.ts"

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "server-only": path.resolve(__dirname, "vitest.server-only-shim.ts"),
    },
  },
  test: {
    globals: true,
    projects: [
      {
        extends: true,
        test: {
          name: { label: "node", color: "cyan" },
          environment: "node",
          include: ["src/**/*.test.ts", ...nodeOnlyTsxFiles],
          exclude: [...jsdomOnlyTsFiles, integrationTestGlob],
          sequence: { groupOrder: 0 },
        },
      },
      {
        extends: true,
        test: {
          name: { label: "jsdom", color: "magenta" },
          environment: "jsdom",
          setupFiles: ["./vitest.setup.ts"],
          include: ["src/**/*.test.tsx", ...jsdomOnlyTsFiles],
          exclude: nodeOnlyTsxFiles,
          testTimeout: 15000,
          sequence: { groupOrder: 1 },
        },
      },
      {
        extends: true,
        test: {
          name: { label: "integration", color: "yellow" },
          environment: "node",
          include: [integrationTestGlob],
          setupFiles: ["./vitest.integration.setup.ts"],
          globalSetup: ["./vitest.integration.global-setup.ts"],
          testTimeout: 30000,
          hookTimeout: 60000,
          sequence: { groupOrder: 2 },
        },
      },
    ],
  },
})
