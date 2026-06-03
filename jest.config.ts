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
    "src/validationSchema/**/*.{ts,tsx}",
    "src/store/features/**/*.{ts,tsx}",
    "src/components/common/Button/**/*.{ts,tsx}",
    "src/components/common/Alert/**/*.{ts,tsx}",
    "src/components/common/EmptyState/**/*.{ts,tsx}",
    "src/components/common/PageHeader/**/*.{ts,tsx}",
    "src/components/common/StatusBadge/**/*.{ts,tsx}",
    "src/components/common/ErrorBoundary/**/*.{ts,tsx}",
    "src/components/dashboard/ProposalSearch.tsx",
    "src/components/proposal/ProposalCard.tsx",
    "src/views/dashboard/DashboardPage.tsx",
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
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
