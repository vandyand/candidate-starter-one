# CLAUDE.md

## Project Overview

RPA automation for extracting healthcare report data from an Angular 21 + PrimeNG web application. Uses Playwright for browser automation with a 4-tier resilient locator system that self-heals when UI selectors break.

## Tech Stack

- **Runtime:** Node.js 22+, TypeScript 5.9, ES2022, NodeNext modules
- **Package Manager:** Yarn 4 (`corepack enable && corepack prepare yarn@4.7.0 --activate`)
- **Browser Automation:** Playwright (production library, not test runner)
- **Testing:** Jest 30 + ts-jest (unit tests mock Playwright)
- **Data:** ExcelJS for XLSX parsing, js-yaml for config
- **OCR (optional):** GLM-OCR 0.9B via HuggingFace Inference Endpoints

## Commands

```bash
yarn dev              # Run automation from source (tsx)
yarn build            # Compile TypeScript to dist/
yarn start            # Run compiled automation
yarn test             # Run unit tests (71 tests, 15 suites)
yarn test:integration # Run E2E tests against live target (requires RUN_INTEGRATION=true)
yarn lint             # ESLint
yarn lint:fix         # ESLint with auto-fix
yarn format           # Prettier
yarn format:check     # Check formatting
```

## Architecture

```
src/
├── index.ts                    # Entry point — calls run()
├── types/index.ts              # All TypeScript types
├── utils/logger.ts             # Structured logger factory
├── config/loader.ts            # YAML config + env var overrides
├── resilience/                 # 4-tier locator cascade
│   ├── index.ts                # ResilientLocator orchestrator
│   ├── tier1.ts                # User-facing: role/text/label/testId
│   ├── tier2.ts                # Anchor-based: relative locators
│   ├── tier3.ts                # Fuzzy: Jaro-Winkler DOM matching
│   ├── tier4.ts                # Vision: GLM-OCR screenshot analysis
│   ├── fuzzy.ts                # Jaro-Winkler + candidate scoring
│   ├── ocr-client.ts           # GLM-OCR HTTP client
│   └── tracer.ts               # JSONL trace events + locator health
├── steps/                      # Automation workflow steps
│   ├── locator-specs.ts        # LocatorSpec definitions for all UI elements
│   ├── login.ts                # Authentication
│   ├── navigate.ts             # Report navigation
│   ├── filter.ts               # Date range + dropdown filters
│   └── download.ts             # XLSX download handling
├── pipeline/                   # Data processing
│   ├── parse-xlsx.ts           # XLSX → JSON rows
│   ├── validate.ts             # Row count, cross-ref, dedup
│   └── output.ts               # JSON + metadata output
└── automation/
    ├── orchestrator.ts          # Main run() — config, browser, extract, summarize
    └── report-extractor.ts      # Per-report extraction pipeline
```

## Key Patterns

- **Resilient Locator Cascade:** Every UI interaction goes through `ResilientLocator.resolve(spec)` which tries Tier 1 → 2 → 3 → 4 in order. If Tier 1 fails, it degrades gracefully.
- **LocatorSpec:** Declarative specs in `src/steps/locator-specs.ts` define how to find each element across all tiers. Add new specs here when targeting new UI elements.
- **Config-driven:** All report definitions, filters, and validation rules live in `config/reports.yaml`. Add new reports by adding entries there.
- **Multi-period extraction:** The orchestrator runs each report across multiple date periods, then deduplicates by primary key.

## Conventions

- MIT license header required on all source files in `src/`
- Prettier: 100 char width, 4-space indent, single quotes, trailing commas
- TypeScript strict mode enabled
- All imports use `.js` extensions (NodeNext resolution)
- Logger pattern: `const logger = createLogger('ModuleName')` at top of each file
- Tests mirror source structure: `test/resilience/tier1.test.ts` tests `src/resilience/tier1.ts`

## Environment Variables

| Variable               | Description                             | Default                 |
| ---------------------- | --------------------------------------- | ----------------------- |
| `TARGET_URL`           | Base URL of target application          | from config             |
| `USERNAME`             | Login username                          | from config             |
| `PASSWORD`             | Login password                          | from config             |
| `CONFIDENCE_THRESHOLD` | Min confidence for fuzzy matching (0-1) | `0.7`                   |
| `GLM_OCR_ENDPOINT`     | GLM-OCR API endpoint URL                | empty (Tier 4 disabled) |
| `LOG_LEVEL`            | Logging level (debug/info/warn/error)   | `info`                  |

## Output Structure

```
output/
├── downloads/          # Raw XLSX files
├── reports/
│   ├── run-summary.md  # Markdown summary of extraction
│   └── {slug}/
│       └── {period}/
│           ├── data.json      # Extracted rows
│           └── metadata.json  # Row count, duration, columns
└── traces/
    ├── playwright-trace.zip   # Playwright trace recording
    ├── trace-events.jsonl     # Locator resolution events
    └── locator-health.json    # Per-locator success rates
```
