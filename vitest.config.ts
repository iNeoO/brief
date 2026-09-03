import { defineConfig } from "vitest/config";

/**
 * Coverage is collected from the root so that the paths in `lcov.info` are
 * relative to the repository — that is what SonarQube resolves them against.
 * Each package keeps its own `test` script for running its suite alone.
 */
export default defineConfig({
	test: {
		projects: ["packages/services", "apps/category-worker"],
		coverage: {
			provider: "v8",
			reporter: ["text", "lcov"],
			include: ["packages/services/src/**/*.ts", "apps/category-worker/src/**/*.ts"],
			exclude: [
				"**/*.test.ts",
				"**/src/scripts/**",
				"**/src/testing/**",
				"**/src/**/index.ts",
			],
		},
	},
});
