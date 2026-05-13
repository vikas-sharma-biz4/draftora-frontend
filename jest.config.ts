import type { Config } from "jest";

const config: Config = {
  preset: "ts-jest",
  testEnvironment: "jest-environment-jsdom",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts", "<rootDir>/src/tests/setup.ts"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    "\\.scss$": "<rootDir>/src/tests/__mocks__/styleMock.js",
    "\\.css$": "<rootDir>/src/tests/__mocks__/styleMock.js",
  },
  testMatch: ["<rootDir>/src/**/*.test.(ts|tsx)"],
  collectCoverageFrom: [
    "src/services/**/*.{ts,tsx}",
    "src/context/**/*.{ts,tsx}",
    "src/hooks/**/*.{ts,tsx}",
    "src/utils/**/*.{ts,tsx}",
    "src/components/**/*.{ts,tsx}",
    "src/views/**/*.{ts,tsx}",
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
    // Staged rollout for UI layers - incremental thresholds to avoid CI collapse
    // Components: Starting at 40% with expectation to increase quarterly
    "./src/components/**/*.{ts,tsx}": {
      branches: 40,
      functions: 40,
      lines: 40,
      statements: 40,
    },
    // Views: Optional staged rollout - currently near-zero, no enforced threshold
    // Uncomment when view test coverage reaches measurable levels
    // "./src/views/**/*.{ts,tsx}": {
    //   branches: 30,
    //   functions: 30,
    //   lines: 30,
    //   statements: 30,
    // },
  },
  transform: {
    "^.+\\.(ts|tsx)$": [
      "ts-jest",
      {
        tsconfig: {
          jsx: "react-jsx",
        },
      },
    ],
  },
};

export default config;
