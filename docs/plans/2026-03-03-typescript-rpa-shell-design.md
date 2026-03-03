# TypeScript RPA Candidate Starter Shell — Design

**Date:** 2026-03-03
**Repo:** `jpfulton-lockboxai/candidate-starter-one`
**License:** MIT

---

## Overview

A minimal TypeScript scaffold for interview candidates building an RPA (Robotic Process Automation) application. Playwright is used as a **production dependency** (not a test runner) to drive browser automation. Jest provides unit testing infrastructure. The repo is public under the `jpfulton-lockboxai` GitHub organization.

---

## Repository Structure

```
candidate-starter-one/
├── .github/
│   ├── workflows/
│   │   ├── ci.yml                  # lint + build + test on push/PR
│   │   ├── release-please.yml      # automated changelog + release tags
│   │   └── semantic-pr.yml         # enforces Conventional Commits PR titles
│   ├── CODEOWNERS
│   ├── dependabot.yml
│   └── PULL_REQUEST_TEMPLATE.md
├── src/
│   ├── index.ts                    # entry point; calls run()
│   └── automation/
│       └── example.ts              # stub: browser launch, navigate, close
├── test/
│   └── automation/
│       └── example.test.ts         # Jest unit test with mocked playwright
├── .editorconfig
├── .gitignore
├── .prettierignore
├── .prettierrc
├── .yarnrc.yml                     # nodeLinker: node-modules
├── eslint.config.mjs               # flat config; MIT header rule; ts-eslint; prettier
├── jest.config.js
├── LICENSE                         # MIT
├── package.json
├── README.md
├── release-please-config.json
├── .release-please-manifest.json
└── tsconfig.json
```

---

## Architecture

### Playwright as a Production Dependency

`playwright` (core library) is listed in `dependencies`, not `devDependencies`. Candidates use Playwright's browser automation API directly in their automation code. `@playwright/test` (the test runner) is intentionally excluded — Jest is the unit test framework.

### Source Code

**`src/index.ts`** — top-level entry point that imports and calls `run()` from the automation module. Candidates can extend or replace this as needed.

**`src/automation/example.ts`** — a stub automation function demonstrating the Playwright browser lifecycle:
- `chromium.launch({ headless: true })`
- `browser.newPage()`
- `page.goto(url)` — placeholder URL with `// TODO:` comment
- `browser.close()`

This gives candidates a concrete shape to extend without prescribing design patterns.

### Tests

**`test/automation/example.test.ts`** — a Jest unit test that mocks the `playwright` module, calls `run()`, and asserts that the automation logic invoked the expected Playwright API methods. Shows candidates the mocking pattern for browser dependencies.

---

## Key Configuration

### `tsconfig.json`

- Target: `ES2022`
- Module: `NodeNext` / `moduleResolution: NodeNext`
- Strict mode: `strict`, `noImplicitAny`, `strictNullChecks`
- `outDir: dist` — application output (not a published library)
- `declaration: false` — no type declaration files needed

### `package.json` Scripts

| Script           | Purpose                                    |
|------------------|--------------------------------------------|
| `build`          | `tsc` — compile TypeScript to `dist/`      |
| `clean`          | `rm -rf dist` — remove build output        |
| `start`          | `node dist/index.js` — run compiled output |
| `dev`            | `ts-node src/index.ts` — run from source   |
| `test`           | `jest`                                     |
| `lint`           | `eslint .`                                 |
| `lint:fix`       | `eslint . --fix`                           |
| `format`         | `prettier --write .`                       |
| `format:check`   | `prettier --check .`                       |

### License Header

All `.ts` source files enforce a MIT license header via an inline ESLint plugin rule (same pattern as the example repo's Apache rule). Copyright line:

```
// Copyright 2025-2026 Lockbox AI, Inc.
```

### CI / Release Automation

- **`ci.yml`** — runs on push and PR: `lint`, `build`, `test`
- **`release-please.yml`** — creates release PRs and tags from Conventional Commits
- **`semantic-pr.yml`** — validates PR titles follow Conventional Commits format
- **No DCO workflow** — public candidate repo does not require sign-off

---

## Decisions & Rationale

| Decision | Rationale |
|----------|-----------|
| `playwright` in `dependencies` | RPA is production code; browser is a runtime requirement |
| `@playwright/test` excluded | Candidates use Jest for unit tests; test runner not needed |
| `outDir: dist`, no `declaration` | Application, not a library; no consumers of type exports |
| Flat `src/automation/` structure | Minimal orientation without prescribing design patterns |
| MIT license | Public candidate-facing repo under lockboxai-public org |
| No DCO | Not required for a candidate exercise starter |
