# TypeScript RPA Candidate Starter Shell Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Scaffold a minimal TypeScript RPA starter repo (`candidate-starter-one`) under the `jpfulton-lockboxai` GitHub org, using Playwright as a production dependency and Jest for unit testing.

**Architecture:** Yarn 4 monorepo with strict TypeScript (ES2022/NodeNext). `src/automation/example.ts` exports a stub `run()` function using the Playwright browser API; `src/index.ts` wires it up as the entry point. Tests live in `test/` and mock Playwright via Jest. GitHub Actions run CI (lint/build/test) plus release-please for automated changelogs.

**Tech Stack:** TypeScript ~5.9, Playwright (latest, production dep), Jest + ts-jest, ESLint flat config + typescript-eslint, Prettier, Yarn 4, release-please-action v4

---

## MIT License Header

Every `.ts` file must begin with this exact block (enforced by ESLint — see Task 5):

```
// Copyright 2025-2026 Lockbox AI, Inc.
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.
```

---

## Task 1: Tooling config files

**Files:**

- Create: `.gitignore`
- Create: `.editorconfig`
- Create: `.prettierrc`
- Create: `.prettierignore`
- Create: `.yarnrc.yml`

**Step 1: Create `.gitignore`**

```
# Build output
dist/
*.d.ts
*.js
!jest.config.js

# Yarn
.yarn/cache
.yarn/install-state.gz

# Node
node_modules/

# Playwright
/playwright/.auth/
playwright-report/
test-results/

# IDE
.DS_Store
.idea/
.vscode/
*.swp
```

**Step 2: Create `.editorconfig`**

```ini
# EditorConfig — https://editorconfig.org
root = true

[*]
charset = utf-8
end_of_line = lf
indent_style = space
indent_size = 4
trim_trailing_whitespace = true
insert_final_newline = true

[*.{ts,js,mjs,cjs,json,yml,yaml}]
indent_size = 2

[*.md]
trim_trailing_whitespace = false

[Makefile]
indent_style = tab
```

**Step 3: Create `.prettierrc`**

```json
{
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false,
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "bracketSpacing": true,
  "arrowParens": "avoid",
  "endOfLine": "lf"
}
```

**Step 4: Create `.prettierignore`**

```
# Build output
dist/
*.d.ts
*.js
!jest.config.js

# Yarn
.yarn/

# Dependencies
node_modules/
```

**Step 5: Create `.yarnrc.yml`**

```yaml
nodeLinker: node-modules
```

**Step 6: Commit**

```bash
git add .gitignore .editorconfig .prettierrc .prettierignore .yarnrc.yml
git commit -m "chore: add tooling config files"
```

---

## Task 2: `package.json` and `tsconfig.json`

**Files:**

- Create: `package.json`
- Create: `tsconfig.json`

**Step 1: Create `package.json`**

```json
{
  "name": "candidate-starter-one",
  "version": "0.1.0",
  "description": "TypeScript RPA starter scaffold for interview candidates",
  "main": "dist/index.js",
  "license": "MIT",
  "private": false,
  "repository": {
    "type": "git",
    "url": "https://github.com/jpfulton-lockboxai/candidate-starter-one.git"
  },
  "homepage": "https://github.com/jpfulton-lockboxai/candidate-starter-one#readme",
  "bugs": {
    "url": "https://github.com/jpfulton-lockboxai/candidate-starter-one/issues"
  },
  "packageManager": "yarn@4.7.0",
  "scripts": {
    "build": "tsc",
    "clean": "rm -rf dist",
    "start": "node dist/index.js",
    "dev": "ts-node src/index.ts",
    "test": "jest",
    "lint": "eslint .",
    "lint:fix": "eslint . --fix",
    "format": "prettier --write .",
    "format:check": "prettier --check ."
  },
  "dependencies": {},
  "devDependencies": {
    "@eslint/js": "^10.0.0",
    "@types/jest": "^30.0.0",
    "@types/node": "^22.0.0",
    "eslint": "^10.0.0",
    "eslint-config-prettier": "^10.0.0",
    "jest": "^30.0.0",
    "prettier": "^3.0.0",
    "ts-jest": "^29.0.0",
    "ts-node": "^10.9.0",
    "typescript": "~5.9.0",
    "typescript-eslint": "^8.0.0"
  }
}
```

Note: `playwright` is intentionally absent here — it is added via `yarn add` in Task 3 so yarn resolves and pins the latest stable version.

**Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["es2022"],
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "declaration": false,
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noImplicitThis": true,
    "alwaysStrict": true,
    "inlineSourceMap": true,
    "inlineSources": true,
    "experimentalDecorators": true,
    "strictPropertyInitialization": false,
    "typeRoots": ["./node_modules/@types"],
    "resolveJsonModule": true,
    "isolatedModules": true
  },
  "exclude": ["node_modules", "dist", "test"]
}
```

**Step 3: Commit**

```bash
git add package.json tsconfig.json
git commit -m "chore: add package.json and tsconfig.json"
```

---

## Task 3: Install dependencies and add Playwright

**Files:**

- Modified by yarn: `package.json` (playwright range added), `yarn.lock`

**Step 1: Enable corepack and install Yarn 4**

```bash
corepack enable && corepack prepare yarn@4.7.0 --activate
```

**Step 2: Install base devDependencies**

```bash
yarn install
```

Expected: `node_modules/` created, `yarn.lock` generated.

**Step 3: Add Playwright as a production dependency**

```bash
yarn add playwright
```

Expected: `package.json` `dependencies` now contains `"playwright": "^X.Y.Z"` (latest stable version). `yarn.lock` updated.

**Step 4: Verify playwright was added to `dependencies` (not `devDependencies`)**

```bash
node -e "const p = require('./package.json'); console.log(p.dependencies)"
```

Expected: Output includes `playwright`.

**Step 5: Commit**

```bash
git add package.json yarn.lock
git commit -m "chore: install dependencies and add playwright"
```

---

## Task 4: `jest.config.js`

**Files:**

- Create: `jest.config.js`

**Step 1: Create `jest.config.js`**

```javascript
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/test'],
  testMatch: ['**/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
  },
  moduleNameMapper: {
    // Strip .js extensions from relative imports so Jest resolves .ts files
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
};
```

The `moduleNameMapper` entry is necessary because TypeScript with `NodeNext` module resolution requires `.js` extensions in import paths (e.g. `import { run } from './automation/example.js'`), but Jest needs to find the `.ts` source files during test execution.

**Step 2: Commit**

```bash
git add jest.config.js
git commit -m "chore: add jest config"
```

---

## Task 5: ESLint config

**Files:**

- Create: `eslint.config.mjs`

**Step 1: Create `eslint.config.mjs`**

```javascript
import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import tseslint from 'typescript-eslint';
import prettierConfig from 'eslint-config-prettier';

// ---------------------------------------------------------------------------
// MIT license header enforced on all TypeScript source files
// ---------------------------------------------------------------------------

const MIT_HEADER = `// Copyright 2025-2026 Lockbox AI, Inc.
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.`;

const licenseHeaderPlugin = {
  rules: {
    'license-header': {
      meta: {
        type: 'problem',
        fixable: 'code',
        schema: [],
        messages: {
          missing: 'File must begin with the MIT license header.',
        },
      },
      create(context) {
        return {
          Program() {
            const src = context.sourceCode.getText();
            if (!src.startsWith(MIT_HEADER)) {
              context.report({
                loc: { line: 1, column: 0 },
                messageId: 'missing',
                fix(fixer) {
                  return fixer.insertTextBeforeRange([0, 0], MIT_HEADER + '\n\n');
                },
              });
            }
          },
        };
      },
    },
  },
};

export default defineConfig(
  js.configs.recommended,
  tseslint.configs.recommended,
  prettierConfig,

  globalIgnores(['node_modules/**', 'dist/**', '**/*.js', '**/*.d.ts', '!eslint.config.mjs']),

  {
    files: ['**/*.ts'],
    plugins: {
      'local-rules': licenseHeaderPlugin,
    },
    rules: {
      'local-rules/license-header': 'error',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
);
```

**Step 2: Commit**

```bash
git add eslint.config.mjs
git commit -m "chore: add ESLint flat config with MIT header rule"
```

---

## Task 6: LICENSE file

**Files:**

- Create: `LICENSE`

**Step 1: Create `LICENSE`**

```
MIT License

Copyright (c) 2025-2026 Lockbox AI, Inc.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

**Step 2: Commit**

```bash
git add LICENSE
git commit -m "chore: add MIT license"
```

---

## Task 7: Source stubs (TDD order — test first)

**Files:**

- Create: `test/automation/example.test.ts`
- Create: `src/automation/example.ts`
- Create: `src/index.ts`

**Step 1: Create the test directory**

```bash
mkdir -p test/automation src/automation
```

**Step 2: Write the failing test**

Create `test/automation/example.test.ts`:

```typescript
// Copyright 2025-2026 Lockbox AI, Inc.
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.

jest.mock('playwright');

import { chromium } from 'playwright';
import { run } from '../../src/automation/example';

describe('run', () => {
  let mockPage: { goto: jest.Mock };
  let mockBrowser: { newPage: jest.Mock; close: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();
    mockPage = { goto: jest.fn().mockResolvedValue(null) };
    mockBrowser = {
      newPage: jest.fn().mockResolvedValue(mockPage),
      close: jest.fn().mockResolvedValue(undefined),
    };
    (chromium.launch as jest.Mock).mockResolvedValue(mockBrowser);
  });

  it('launches chromium in headless mode', async () => {
    await run();
    expect(chromium.launch).toHaveBeenCalledWith({ headless: true });
  });

  it('opens a new page', async () => {
    await run();
    expect(mockBrowser.newPage).toHaveBeenCalled();
  });

  it('closes the browser after automation completes', async () => {
    await run();
    expect(mockBrowser.close).toHaveBeenCalled();
  });
});
```

**Step 3: Run the test — verify it fails**

```bash
yarn test
```

Expected: FAIL — `Cannot find module '../../src/automation/example'`

**Step 4: Create `src/automation/example.ts`**

```typescript
// Copyright 2025-2026 Lockbox AI, Inc.
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.

import { chromium } from 'playwright';

export async function run(): Promise<void> {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // TODO: replace with your target URL
  await page.goto('https://example.com');

  // TODO: implement your automation logic here

  await browser.close();
}
```

**Step 5: Create `src/index.ts`**

```typescript
// Copyright 2025-2026 Lockbox AI, Inc.
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.

import { run } from './automation/example.js';

run().catch(console.error);
```

Note: `.js` extension is required in the import here (not in the test) because `src/index.ts` is compiled by `tsc` with `NodeNext` module resolution, which emits runtime `.js` paths. Tests use ts-jest which handles resolution separately via `moduleNameMapper`.

**Step 6: Run the tests — verify all pass**

```bash
yarn test
```

Expected: 3 tests pass (`launches chromium in headless mode`, `opens a new page`, `closes the browser after automation completes`).

**Step 7: Run lint — verify it passes**

```bash
yarn lint
```

Expected: No errors. All three `.ts` files have the MIT header.

**Step 8: Run build — verify it passes**

```bash
yarn build
```

Expected: `dist/` directory created with compiled output. No TypeScript errors.

**Step 9: Commit**

```bash
git add src/ test/
git commit -m "feat: add RPA automation stub with jest unit tests"
```

---

## Task 8: GitHub community files

**Files:**

- Create: `.github/CODEOWNERS`
- Create: `.github/dependabot.yml`
- Create: `.github/PULL_REQUEST_TEMPLATE.md`

**Step 1: Create `.github/CODEOWNERS`**

```
# Default owners for all files in the repository.
# See: https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners
* @jpfulton-lockboxai
```

**Step 2: Create `.github/dependabot.yml`**

```yaml
version: 2
updates:
  - package-ecosystem: 'npm'
    directory: '/'
    schedule:
      interval: 'weekly'
      day: 'monday'
    open-pull-requests-limit: 10
    labels:
      - 'dependencies'

  - package-ecosystem: 'github-actions'
    directory: '/'
    schedule:
      interval: 'weekly'
      day: 'monday'
    open-pull-requests-limit: 10
    labels:
      - 'dependencies'
      - 'github-actions'
```

**Step 3: Create `.github/PULL_REQUEST_TEMPLATE.md`**

```markdown
## Summary

<!-- A concise description of what this PR does and why. -->

## Related Issues

<!-- Link any related issues: "Closes #123", "Fixes #456", "Related to #789" -->

## Type of Change

<!-- Check all that apply -->

- [ ] Bug fix (non-breaking change that fixes an issue)
- [ ] New feature (non-breaking change that adds functionality)
- [ ] Breaking change (fix or feature that changes existing behavior)
- [ ] Refactor (no functional change)
- [ ] Documentation update
- [ ] CI/CD or tooling change
- [ ] Dependency update

## Testing

<!-- Describe how you tested this change. -->

- [ ] `yarn build` passes
- [ ] `yarn test` passes with no regressions
- [ ] `yarn lint` passes
- [ ] `yarn format:check` passes

## Checklist

- [ ] My commits follow the [Conventional Commits](https://www.conventionalcommits.org/) format
- [ ] I have updated documentation where applicable

## Additional Notes

<!-- Anything else reviewers should know. -->
```

**Step 4: Commit**

```bash
git add .github/CODEOWNERS .github/dependabot.yml .github/PULL_REQUEST_TEMPLATE.md
git commit -m "chore: add GitHub community files"
```

---

## Task 9: GitHub Actions workflows

**Files:**

- Create: `.github/workflows/ci.yml`
- Create: `.github/workflows/release-please.yml`
- Create: `.github/workflows/semantic-pr.yml`

**Step 1: Create `.github/workflows/ci.yml`**

```yaml
name: ci

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

permissions:
  contents: read

jobs:
  ci:
    name: ci
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '22'

      - name: Enable Corepack (Yarn 4)
        run: corepack enable

      - name: Install dependencies
        run: yarn install --immutable

      - name: Check formatting
        run: yarn format:check

      - name: Lint
        run: yarn lint

      - name: Build
        run: yarn build

      - name: Test
        run: yarn test
```

**Step 2: Create `.github/workflows/release-please.yml`**

```yaml
name: release-please

on:
  push:
    branches: [main]

permissions:
  contents: write
  pull-requests: write

jobs:
  release-please:
    runs-on: ubuntu-latest
    steps:
      - uses: googleapis/release-please-action@v4
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
          release-type: node
```

**Step 3: Create `.github/workflows/semantic-pr.yml`**

```yaml
name: semantic-pr

on:
  pull_request_target:
    types: [opened, edited, synchronize]
    branches: [main]

permissions:
  pull-requests: read

jobs:
  semantic-pr:
    name: Conventional commit PR title
    runs-on: ubuntu-latest
    steps:
      - uses: amannn/action-semantic-pull-request@v6.1.1
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          types: |
            feat
            fix
            docs
            style
            refactor
            perf
            test
            build
            ci
            chore
            revert
          requireScope: false
          subjectPattern: ^(?![A-Z]).+$
          subjectPatternError: >
            The subject "{subject}" found in the pull request title "{title}"
            must not start with an uppercase letter. Use lowercase to follow
            conventional commit conventions.
```

**Step 4: Commit**

```bash
git add .github/workflows/
git commit -m "ci: add GitHub Actions workflows (ci, release-please, semantic-pr)"
```

---

## Task 10: Release-please config

**Files:**

- Create: `release-please-config.json`
- Create: `.release-please-manifest.json`

**Step 1: Create `release-please-config.json`**

```json
{
  "$schema": "https://raw.githubusercontent.com/googleapis/release-please/main/schemas/config.json",
  "release-type": "node",
  "changelog-path": "CHANGELOG.md",
  "bump-minor-pre-major": true,
  "bump-patch-for-minor-pre-major": true,
  "draft": false,
  "prerelease": false,
  "packages": {
    ".": {}
  }
}
```

**Step 2: Create `.release-please-manifest.json`**

```json
{
  ".": "0.1.0"
}
```

**Step 3: Commit**

```bash
git add release-please-config.json .release-please-manifest.json
git commit -m "chore: add release-please config"
```

---

## Task 11: README

**Files:**

- Create: `README.md`

**Step 1: Create `README.md`**

````markdown
# candidate-starter-one

[![ci](https://github.com/jpfulton-lockboxai/candidate-starter-one/actions/workflows/ci.yml/badge.svg)](https://github.com/jpfulton-lockboxai/candidate-starter-one/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js 22+](https://img.shields.io/badge/node-%3E%3D22-brightgreen)](https://nodejs.org/)

A TypeScript starter scaffold for building RPA (Robotic Process Automation) applications using [Playwright](https://playwright.dev/) as a production browser automation library.

## Overview

This project uses Playwright's browser automation API directly in production code — not as a test runner. Jest is used for unit testing the automation logic with mocked Playwright instances.

## Prerequisites

- Node.js 22+
- Yarn 4 (`corepack enable && corepack prepare yarn@4.7.0 --activate`)

## Setup

```bash
# Install dependencies
yarn install

# Build
yarn build

# Run
yarn start
```
````

## Project Structure

```
src/
├── index.ts              # Entry point — calls run()
└── automation/
    └── example.ts        # Stub automation function — extend this

test/
└── automation/
    └── example.test.ts   # Jest unit tests (Playwright mocked)
```

## Development

```bash
yarn dev          # Run from source with ts-node
yarn build        # Compile TypeScript to dist/
yarn test         # Run Jest unit tests
yarn lint         # ESLint
yarn lint:fix     # ESLint with auto-fix
yarn format       # Prettier
yarn format:check # Check Prettier formatting
yarn clean        # Remove dist/
```

## Testing

Unit tests mock the Playwright browser API so no real browser is needed in CI. Run integration tests against a real browser manually with `yarn dev` after implementing your automation.

## License

Copyright (c) 2025-2026 Lockbox AI, Inc.

Licensed under the [MIT License](LICENSE).

````

**Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add README"
````

---

## Task 12: Final verification pass

**Step 1: Clean and rebuild**

```bash
yarn clean && yarn build
```

Expected: `dist/` directory created, no TypeScript errors.

**Step 2: Run all tests**

```bash
yarn test
```

Expected: 3 tests pass, 0 failures.

**Step 3: Run lint**

```bash
yarn lint
```

Expected: No errors.

**Step 4: Check formatting**

```bash
yarn format:check
```

Expected: No files need reformatting.

**Step 5: Verify git log is clean**

```bash
git log --oneline
```

Expected output (most recent first):

```
docs: add README
chore: add release-please config
ci: add GitHub Actions workflows (ci, release-please, semantic-pr)
chore: add GitHub community files
feat: add RPA automation stub with jest unit tests
chore: add jest config
chore: add ESLint flat config with MIT header rule
chore: add MIT license
chore: install dependencies and add playwright
chore: add package.json and tsconfig.json
chore: add tooling config files
docs: add TypeScript RPA shell design document
```
