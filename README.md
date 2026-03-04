# Resilient Healthcare Report Automation

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js 22+](https://img.shields.io/badge/node-%3E%3D22-brightgreen)](https://nodejs.org/)
[![TypeScript 5.9](https://img.shields.io/badge/typescript-5.9-blue)](https://www.typescriptlang.org/)

A TypeScript RPA system that extracts structured data from a healthcare reporting web application (Angular 21 + PrimeNG). Built with Playwright and a 4-tier resilient locator framework that self-heals when UI selectors break.

## The Problem

Healthcare reporting systems change their UI frequently — CSS classes get renamed, DOM structures shift, Angular components update. Traditional automation breaks whenever the UI changes, requiring constant maintenance.

## The Solution

A **4-tier locator cascade** that progressively falls back through increasingly robust resolution strategies:

| Tier  | Strategy                                        | Confidence | Speed |
| ----- | ----------------------------------------------- | ---------- | ----- |
| **1** | User-facing (role, text, label, testId)         | 0.95       | ~ms   |
| **2** | Anchor-based (relative to stable landmarks)     | 0.85       | ~ms   |
| **3** | Fuzzy matching (Jaro-Winkler on DOM candidates) | variable   | ~50ms |
| **4** | Vision/OCR (screenshot → GLM-OCR → coordinates) | 0.70       | ~2s   |

Every UI interaction flows through `ResilientLocator.resolve()`. When Tier 1 selectors break, the system automatically tries anchoring, fuzzy matching, and finally vision-based OCR — logging degradation events for observability.

## Quick Start

### Prerequisites

- Node.js 22+
- Yarn 4: `corepack enable && corepack prepare yarn@4.7.0 --activate`

### Setup

```bash
# Install dependencies
yarn install

# Configure environment
cp .env.example .env
# Edit .env with target URL and credentials

# Run the automation
yarn dev
```

### Configuration

All report definitions live in `config/reports.yaml`:

```yaml
reports:
    - name: Claim Status
      slug: claim-status
      path: /reports/claims
      filters:
          - type: dateRange
            from: '2024-08-01'
            to: '2025-08-01'
          - type: dropdown
            label: Status
            value: Denied
      validation:
          minRows: 1
```

Add new reports by adding entries to this file. The system handles navigation, filtering, downloading, parsing, and validation automatically.

## Architecture

```
src/
├── resilience/          # 4-tier locator cascade + tracer
├── steps/               # Automation workflow (login, navigate, filter, download)
├── pipeline/            # Data processing (XLSX parse, validate, output)
├── config/              # YAML config loader with env overrides
├── automation/          # Orchestrator + per-report extraction
├── types/               # TypeScript type definitions
└── utils/               # Structured logger
```

### Data Flow

```
Config (YAML) → Login → Navigate → Apply Filters → Download XLSX
    → Parse → Validate → Deduplicate → Cross-Reference → Output JSON
```

### Resilience System

Each UI element is defined as a `LocatorSpec` — a declarative description of how to find the element across all 4 tiers:

```typescript
const signInButton: LocatorSpec = {
    name: 'signInButton',
    tier1: { role: 'button', name: 'Sign In' },
    tier2: { anchor: passwordField, relation: 'below', target: { role: 'button' } },
    tier3: { tag: 'button', text: 'Sign In', attributes: { type: 'submit' } },
    tier4: { searchText: 'Sign In' },
};
```

The `ExecutionTracer` records every locator resolution as a JSONL event and maintains a `locator-health.json` file with per-locator success rates across runs — enabling analysis of which selectors are degrading over time.

### Multi-Period Extraction

The system extracts each report across multiple overlapping date periods (configured in `reports.yaml`), then deduplicates rows by primary key. This captures data that might otherwise be missed at period boundaries.

## Output

```
output/
├── downloads/              # Raw XLSX files
├── reports/
│   ├── run-summary.md      # Extraction summary with stats
│   └── {report-slug}/
│       └── {period}/
│           ├── data.json       # Extracted rows
│           └── metadata.json   # Row count, duration, columns
└── traces/
    ├── playwright-trace.zip    # Full Playwright recording
    ├── trace-events.jsonl      # Locator resolution events
    └── locator-health.json     # Self-healing health data
```

## Testing

```bash
yarn test                # 71 unit tests (Playwright mocked, no browser needed)
yarn test:integration    # E2E tests against live target (requires RUN_INTEGRATION=true)
```

Unit tests mock the Playwright browser API so no real browser is needed in CI. The test suite covers all 4 resilience tiers, the cascade orchestrator, automation steps, data pipeline, and config loading.

## Tier 4: GLM-OCR Vision Fallback

The system optionally integrates [GLM-OCR](https://huggingface.co/zai-org/GLM-OCR) (0.9B parameters) as a vision-based last resort. When all CSS/DOM-based strategies fail, it takes a screenshot, sends it to the OCR model, and uses returned coordinates to interact with the element.

See `scripts/deploy-ocr.sh` for deployment instructions on HuggingFace Inference Endpoints.

```bash
# Enable by setting the endpoint
export GLM_OCR_ENDPOINT=https://your-endpoint.us-east-1.aws.endpoints.huggingface.cloud
```

The system gracefully degrades when no endpoint is configured — Tier 4 simply returns "not found" and the locator reports the failure.

## Design Documents

- [Design Document](docs/plans/2026-03-04-resilient-automation-design.md) — Architecture decisions, trade-offs, and alternatives considered
- [Implementation Plan](docs/plans/2026-03-04-implementation-plan.md) — Task-by-task build plan with TDD steps

## License

Copyright (c) 2025-2026 Lockbox AI, Inc.

Licensed under the [MIT License](LICENSE).
