# Resilient Browser Automation — Design Document

**Date:** 2026-03-04
**Exercise:** EX-001-RPA — Browser Automation and Resilient Data Extraction
**Target:** https://automation-target-one.engineering.lockboxai.com

## Overview

A Playwright-based automation solution that authenticates against a healthcare reporting system (Angular 21 + PrimeNG), extracts data from all 6 report types under configurable filter settings, and writes structured output to local folders. The central differentiator is a **tiered selector resilience framework** with self-healing capabilities, observability, and a real OCR vision tier.

## Target System

Six report types, each with:

- PrimeNG data tables (4000 rows, paginated at 25/page)
- Date range pickers (From/To comboboxes)
- Dropdown filters (Status, Payer, Denial Code, etc.)
- Sortable columns
- XLSX download button

| Report                | Path                    | Filters                        | Columns                                                                    |
| --------------------- | ----------------------- | ------------------------------ | -------------------------------------------------------------------------- |
| Claim Status          | /reports/claims         | Date range, Status, Payer      | Claim ID, Patient, Payer, DoS, Billed, Status, Paid, Denial Reason         |
| Encounters            | /reports/encounters     | Date range, dropdown(s)        | TBD on exploration                                                         |
| Current AR            | /reports/ar             | Date range, dropdown(s)        | TBD on exploration                                                         |
| Remittance / Payments | /reports/remittance     | Date range, dropdown(s)        | TBD on exploration                                                         |
| Denials               | /reports/denials        | Date range, Denial Code, Payer | Claim ID, Denial Code, Reason, Payer, Billed, Denial Date, Action Required |
| Prior Authorizations  | /reports/authorizations | Date range, dropdown(s)        | TBD on exploration                                                         |

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    AUTOMATION ENGINE                         │
│                                                              │
│  Workflow Orchestrator ──▶ Resilient Locator Engine          │
│  (YAML config-driven)      (4-tier cascade)                  │
│         │                       │                            │
│  Steps Pipeline            Observability Layer               │
│  (login, navigate,         (JSONL traces, screenshots,       │
│   filter, download,         Playwright traces, MD reports,   │
│   parse, save)              confidence logs)                 │
│         │                       │                            │
│  Data Pipeline             Self-Healing Module               │
│  (XLSX parse, validate,    (locator ensembles, success       │
│   cross-ref, dedup)         tracking, human escalation)      │
└─────────────────────────────────────────────────────────────┘
```

## Resilient Locator Engine

The core framework. A `ResilientLocator` provides a unified interface that cascades through 4 tiers, logging resolution details at each step.

### Tier 1 — User-Facing Locators

Role-based (`getByRole`), text-based (`getByText`), label-based (`getByLabel`), and test-ID (`getByTestId`). These mirror user perception rather than DOM implementation. The accessibility tree is the primary navigation model — more stable than DOM, maps directly to Playwright's locator APIs, dramatically smaller representation.

### Tier 2 — Anchor-Based Recovery

Identify stable anchor elements (headings, navigation landmarks, section labels) and locate targets by spatial/structural relationship (`near`, `below`, `above`, `within`, `sibling`). Survives layout refactors because semantic relationships persist even when DOM positions change.

### Tier 3 — Algorithmic Fuzzy Matching

When user-facing and anchor-based approaches fail, scan the DOM for candidates, build feature vectors (tag name, class list, attributes, position, visible text), and score using Jaro-Winkler distance and weighted attribute matching. Apply a confidence threshold (default 0.7) — proceed above it, flag for review below.

### Tier 4 — Machine Vision (GLM-OCR)

Last-resort tier. Capture a screenshot, send to a GLM-OCR endpoint (0.9B parameter model hosted on HuggingFace Inference Endpoint), get text locations, and interact by coordinates. Highest latency (1-5s) but demonstrates understanding of the full resilience spectrum.

### Cascade Logic

```
Try Tier 1 (role → text → label → testId)
  ├─ Match found → return with confidence, log tier 1
  └─ No match → Try Tier 2
      ├─ Anchor found + target located → return, log tier 2
      └─ Failure → Try Tier 3
          ├─ Best candidate above threshold → return, log tier 3
          └─ Below threshold → Try Tier 4
              ├─ OCR text found → return coordinates, log tier 4
              └─ All tiers failed → Human escalation
```

Every resolution is logged as a JSONL event with tier, confidence, timing, and full cascade trace.

### LocatorSpec Interface

```typescript
interface LocatorSpec {
    description: string; // Human-readable: "the Sign In button"
    tier1?: {
        role?: { role: string; name?: string };
        text?: string;
        label?: string;
        testId?: string;
    };
    tier2?: {
        anchor: LocatorSpec;
        relationship: 'near' | 'below' | 'above' | 'within' | 'sibling';
        target?: { role?: string; text?: string };
    };
    tier3?: {
        tag?: string;
        attributes?: Record<string, string>;
        visibleText?: string;
        minConfidence?: number;
    };
    tier4?: {
        searchText: string;
        region?: { x: number; y: number; width: number; height: number };
    };
}

interface LocatorResult {
    element: Locator;
    tier: 1 | 2 | 3 | 4;
    confidence: number;
    strategy: string;
    latencyMs: number;
    alternatives: number;
}
```

### Self-Healing

- Store `locator-health.json` tracking per-locator success/failure history
- On subsequent runs, skip tiers with consistent failures for a given locator
- Locator ensemble: store multiple locator hypotheses, fall through in priority order, re-rank based on historical success rates
- Confidence threshold determines whether to proceed automatically or flag for human review

## Config-Driven Workflow

```yaml
# config/reports.yaml
reports:
    - name: Claim Status
      slug: claim-status
      path: /reports/claims
      filters:
          - type: dateRange
            from: '2024-08-01'
            to: '2025-02-01'
          - type: dropdown
            label: Status
            value: Denied
      columns:
          exclude: []
      validation:
          minRows: 1
          crossRef:
              target: denials
              key: Claim ID
    # ... all 6 reports

periods:
    - from: '2024-08-01'
      to: '2025-02-01'
    - from: '2025-01-01'
      to: '2025-08-01'
    # Intentional overlap for dedup demonstration
```

Adding a new report = adding a YAML block. Zero code changes to the orchestrator.

## Data Pipeline

1. **Parse XLSX** — Read downloaded Excel files with `exceljs`
2. **Column filtering** — Remove excluded columns per config
3. **Row deduplication** — When multi-period extraction produces overlapping rows, deduplicate by primary key (Claim ID, etc.)
4. **Cross-report validation** — Verify referential integrity (e.g., denied claim IDs in Denials also exist in Claim Status)
5. **Output** — Write `data.json` + `metadata.json` sidecar per extraction

### Metadata Sidecar

```json
{
    "reportType": "claim-status",
    "extractedAt": "2026-03-04T12:00:00Z",
    "filters": { "dateRange": ["2024-08-01", "2025-02-01"], "status": "Denied" },
    "rowCount": 847,
    "columns": ["Claim ID", "Patient", "Payer", "..."],
    "locatorResolution": { "tier1": 12, "tier2": 2, "tier3": 0, "tier4": 0 },
    "durationMs": 4500,
    "deduplication": { "beforeCount": 900, "afterCount": 847, "removed": 53 }
}
```

## Output Structure

```
output/
├── claim-status/
│   ├── 2024-08-01_2025-02-01/
│   │   ├── data.json
│   │   └── metadata.json
│   └── 2025-01-01_2025-08-01/
│       ├── data.json
│       └── metadata.json
├── denials/
│   └── ...
├── encounters/
│   └── ...
├── current-ar/
│   └── ...
├── remittance-payments/
│   └── ...
├── prior-authorizations/
│   └── ...
├── traces/
│   ├── execution-{timestamp}.jsonl
│   ├── locator-health.json
│   └── playwright-trace.zip
└── reports/
    └── run-summary.md
```

## Observability

- **JSONL execution trace** — Every action as a structured event with timing, status, locator tier
- **Playwright trace** — Native `.zip` trace files for Playwright Trace Viewer
- **Screenshots** — On tier degradation and failures
- **Markdown run summary** — Human-readable report of extractions, tiers used, warnings
- **Locator health** — Cumulative success rates per locator across runs

## Testing Strategy

- **Unit tests (Jest)** — Fuzzy matching algorithms, confidence scoring, YAML config parsing, data pipeline transforms (dedup, cross-ref, column exclusion)
- **Integration tests (Playwright Test)** — Full E2E against live target: login → extract → validate output
- **Resilience tests** — Verify cascade degrades gracefully (mock Tier 1 failure, confirm Tier 2 resolves)

## Technology Stack

- TypeScript (strict mode)
- Playwright (RPA mode, not test runner)
- `exceljs` — XLSX parsing
- `fastest-levenshtein` + custom Jaro-Winkler — fuzzy matching (Tier 3)
- GLM-OCR (0.9B) on HuggingFace Inference Endpoint — vision tier (Tier 4)
- `js-yaml` — config parsing
- Jest — unit tests
- Playwright Test — integration tests
- Yarn 4, Node 22+

## Extraction Strategy

Use the **XLSX download** button (already present in the UI) for data extraction. Apply filters via UI interaction before downloading. Parse the Excel file locally. This is faster and more reliable than scraping 160 pages of paginated table rows.

## Key Design Decisions

1. **Resilience framework as a first-class module**, not a decorator — makes tier tracking, confidence scoring, and self-healing natural
2. **YAML config over code** — adding reports requires zero code changes
3. **XLSX download over table scraping** — pragmatic choice; the exercise values resilience depth over extraction complexity
4. **GLM-OCR over Tesseract** — modern VLM approach, 94.62% on OmniDocBench, tiny model (0.9B), deployable on minimal GPU
5. **Step functions** — modular, testable, composable pipeline stages
6. **JSONL observability** — structured, append-only, analyzable
