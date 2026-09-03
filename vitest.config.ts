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
			/**
			 * Set just under what the suite actually reaches, so `test:coverage`
			 * fails — locally and in CI — as soon as a change adds code nothing
			 * exercises. Raise them when the figures move up; the only deliberate
			 * hole left is `auth/auth.ts`, which wires better-auth together and is
			 * left to better-auth's own tests.
			 */
			thresholds: {
				statements: 98,
				branches: 96,
				functions: 98,
				lines: 98,
			},
		},
	},
});
