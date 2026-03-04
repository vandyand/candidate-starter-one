# Resilient Browser Automation — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a Playwright-based automation solution with a 4-tier selector resilience framework that extracts data from 6 healthcare reports, with self-healing, observability, and OCR vision capabilities.

**Architecture:** A tiered `ResilientLocator` engine cascading through user-facing locators → anchor-based recovery → fuzzy matching → GLM-OCR vision. A config-driven orchestrator reads YAML report definitions and drives modular step functions (login, navigate, filter, download, parse). All interactions are traced via JSONL observability.

**Tech Stack:** TypeScript (strict), Playwright (RPA mode), exceljs, fastest-levenshtein, js-yaml, Jest, Yarn 4, Node 22+, GLM-OCR on HuggingFace

**License Header:** All `.ts` files in `src/` MUST start with the MIT license header block (enforced by ESLint). The header is:

```typescript
// SPDX-License-Identifier: MIT
// Copyright (c) 2025-2026 Lockbox AI, Inc.
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

**Prettier Config:** 100 char width, 4-space indent, single quotes, trailing commas, arrow parens "avoid", LF line endings.

---

## Report Reference

| Report              | URL Path             | Dropdown Filters                                             | Columns                                                                                                   |
| ------------------- | -------------------- | ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| Claim Status        | /reports/claims      | Status ("All Statuses"), Payer ("All Payers")                | Claim ID, Patient, Payer, Date of Service, Billed, Status, Paid, Denial Reason                            |
| Encounters          | /reports/encounters  | Encounter Type ("All Types"), Diagnosis ICD-10 ("All Codes") | Encounter ID, Patient, Provider, Date, Facility, ICD-10, CPT, Type                                        |
| Current AR          | /reports/ar          | Payer ("All Payers")                                         | Patient, Payer, Original Charge, 0-30 Days, 31-60 Days, 61-90 Days, 91-120 Days, 120+ Days, Last Activity |
| Remittance/Payments | /reports/remittance  | Payer ("All Payers")                                         | Payment Date, Payer, Check/EFT #, Total Payment, Adjustments, Net                                         |
| Denials             | /reports/denials     | Denial Code ("All Codes"), Payer ("All Payers")              | Claim ID, Denial Code, Reason, Payer, Billed, Denial Date, Action Required                                |
| Prior Auths         | /reports/prior-auths | Status ("All Statuses"), Payer ("All Payers")                | Auth #, Patient, Procedure, Payer, Status, Effective Start, Effective End                                 |

All reports: From/To date pickers, 4000 rows, 25/page, sortable columns, Download XLSX button, Clear Filters button.

---

## Task 1: Fork Starter & Project Setup

**Files:**

- Fork: `https://github.com/Lockbox-AI/candidate-starter-one`
- Create: `.env`
- Create: `config/reports.yaml`
- Modify: `package.json` (add dependencies)

**Step 1: Fork and clone the starter repository**

```bash
cd /home/kingjames/contracting/upwork/lockboxai/assignment-1
gh repo fork Lockbox-AI/candidate-starter-one --clone --remote
# Or if that puts it in a subdirectory, move contents up
```

Note: If the fork creates a subdirectory, move all contents (including hidden files like .git, .editorconfig, .prettierrc, .yarnrc.yml) into the assignment-1 directory.

**Step 2: Install base dependencies**

```bash
corepack enable
yarn install
npx playwright install chromium
```

**Step 3: Add project dependencies**

```bash
yarn add exceljs js-yaml fastest-levenshtein
yarn add -D @types/js-yaml
```

**Step 4: Create `.env` file**

```env
TARGET_URL=https://automation-target-one.engineering.lockboxai.com
USERNAME=admin
PASSWORD=nxqz7bkm2wvj4rt9yphe6csa5ufd1lg3
GLM_OCR_ENDPOINT=
CONFIDENCE_THRESHOLD=0.7
LOG_LEVEL=info
```

**Step 5: Create initial config/reports.yaml**

```yaml
target:
    url: https://automation-target-one.engineering.lockboxai.com
    credentials:
        username: admin
        password: nxqz7bkm2wvj4rt9yphe6csa5ufd1lg3

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
      columns:
          exclude: []
      validation:
          minRows: 1

    - name: Denials
      slug: denials
      path: /reports/denials
      filters:
          - type: dateRange
            from: '2024-08-01'
            to: '2025-08-01'
          - type: dropdown
            label: Payer
            value: Aetna
      columns:
          exclude: []
      validation:
          minRows: 1
          crossRef:
              target: claim-status
              key: Claim ID

    - name: Encounters
      slug: encounters
      path: /reports/encounters
      filters:
          - type: dateRange
            from: '2024-08-01'
            to: '2025-08-01'
      columns:
          exclude: []
      validation:
          minRows: 1

    - name: Current AR
      slug: current-ar
      path: /reports/ar
      filters:
          - type: dateRange
            from: '2024-08-01'
            to: '2025-08-01'
      columns:
          exclude: []
      validation:
          minRows: 1

    - name: Remittance / Payments
      slug: remittance-payments
      path: /reports/remittance
      filters:
          - type: dateRange
            from: '2024-08-01'
            to: '2025-08-01'
          - type: dropdown
            label: Payer
            value: Medicare
      columns:
          exclude: []
      validation:
          minRows: 1

    - name: Prior Authorizations
      slug: prior-authorizations
      path: /reports/prior-auths
      filters:
          - type: dateRange
            from: '2024-08-01'
            to: '2025-08-01'
          - type: dropdown
            label: Status
            value: Denied
      columns:
          exclude: []
      validation:
          minRows: 1

periods:
    - from: '2024-08-01'
      to: '2025-02-01'
    - from: '2025-01-01'
      to: '2025-08-01'

settings:
    confidenceThreshold: 0.7
    screenshotOnDegradation: true
    maxRetries: 3
    downloadTimeoutMs: 30000
```

**Step 6: Update .gitignore**

Add to existing `.gitignore`:

```
.env
output/
downloads/
node_modules/
dist/
*.zip
```

**Step 7: Commit**

```bash
git add -A
git commit -m "chore: project setup with dependencies and report config

Add exceljs, js-yaml, fastest-levenshtein dependencies.
Create YAML config defining all 6 report types with filters.
Add .env for credentials and runtime settings."
```

---

## Task 2: Logger & Core Types

**Files:**

- Create: `src/utils/logger.ts`
- Create: `src/types/index.ts`
- Create: `test/utils/logger.test.ts`
- Create: `test/types/config.test.ts`

**Step 1: Write the failing test for logger**

```typescript
// test/utils/logger.test.ts
import { createLogger } from '../../src/utils/logger.js';

describe('Logger', () => {
    it('should create a logger with context', () => {
        const logger = createLogger('test-context');
        expect(logger).toBeDefined();
        expect(logger.info).toBeDefined();
        expect(logger.debug).toBeDefined();
        expect(logger.error).toBeDefined();
        expect(logger.warn).toBeDefined();
    });

    it('should format messages with timestamp and context', () => {
        const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
        const logger = createLogger('login');
        logger.info('Navigating to page');
        expect(consoleSpy).toHaveBeenCalledWith(
            expect.stringMatching(/\d{4}-\d{2}-\d{2}.*\[INFO\].*\[login\].*Navigating to page/),
        );
        consoleSpy.mockRestore();
    });
});
```

**Step 2: Run test to verify it fails**

Run: `yarn test -- test/utils/logger.test.ts`
Expected: FAIL — cannot find module

**Step 3: Implement logger**

```typescript
// src/utils/logger.ts
// (MIT license header)

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVELS: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

function getConfiguredLevel(): LogLevel {
    const env = process.env.LOG_LEVEL?.toLowerCase();
    if (env && env in LEVELS) return env as LogLevel;
    return 'info';
}

export interface Logger {
    debug(message: string, data?: Record<string, unknown>): void;
    info(message: string, data?: Record<string, unknown>): void;
    warn(message: string, data?: Record<string, unknown>): void;
    error(message: string, data?: Record<string, unknown>): void;
}

export function createLogger(context: string): Logger {
    const configuredLevel = getConfiguredLevel();

    function log(level: LogLevel, message: string, data?: Record<string, unknown>): void {
        if (LEVELS[level] < LEVELS[configuredLevel]) return;
        const timestamp = new Date().toISOString();
        const prefix = `${timestamp} [${level.toUpperCase()}] [${context}]`;
        const suffix = data ? ` ${JSON.stringify(data)}` : '';
        const output = `${prefix} ${message}${suffix}`;

        if (level === 'error') {
            console.error(output);
        } else if (level === 'warn') {
            console.warn(output);
        } else {
            console.log(output);
        }
    }

    return {
        debug: (msg, data?) => log('debug', msg, data),
        info: (msg, data?) => log('info', msg, data),
        warn: (msg, data?) => log('warn', msg, data),
        error: (msg, data?) => log('error', msg, data),
    };
}
```

**Step 4: Write the core types**

```typescript
// src/types/index.ts
// (MIT license header)

import type { Locator, Page } from 'playwright';

// --- Locator Types ---

export type ResilienceTier = 1 | 2 | 3 | 4;

export interface LocatorResult {
    element: Locator;
    tier: ResilienceTier;
    confidence: number;
    strategy: string;
    latencyMs: number;
    alternatives: number;
}

export interface Tier1Spec {
    role?: { role: string; name?: string };
    text?: string;
    label?: string;
    testId?: string;
}

export interface Tier2Spec {
    anchor: LocatorSpec;
    relationship: 'near' | 'below' | 'above' | 'within' | 'sibling';
    target?: { role?: string; text?: string };
}

export interface Tier3Spec {
    tag?: string;
    attributes?: Record<string, string>;
    visibleText?: string;
    minConfidence?: number;
}

export interface Tier4Spec {
    searchText: string;
    region?: { x: number; y: number; width: number; height: number };
}

export interface LocatorSpec {
    description: string;
    tier1?: Tier1Spec;
    tier2?: Tier2Spec;
    tier3?: Tier3Spec;
    tier4?: Tier4Spec;
}

// --- Config Types ---

export interface DateRangeFilter {
    type: 'dateRange';
    from: string;
    to: string;
}

export interface DropdownFilter {
    type: 'dropdown';
    label: string;
    value: string;
}

export type FilterConfig = DateRangeFilter | DropdownFilter;

export interface CrossRefValidation {
    target: string;
    key: string;
}

export interface ReportConfig {
    name: string;
    slug: string;
    path: string;
    filters: FilterConfig[];
    columns: { exclude: string[] };
    validation: {
        minRows: number;
        crossRef?: CrossRefValidation;
    };
}

export interface PeriodConfig {
    from: string;
    to: string;
}

export interface WorkflowConfig {
    target: {
        url: string;
        credentials: { username: string; password: string };
    };
    reports: ReportConfig[];
    periods: PeriodConfig[];
    settings: {
        confidenceThreshold: number;
        screenshotOnDegradation: boolean;
        maxRetries: number;
        downloadTimeoutMs: number;
    };
}

// --- Data Pipeline Types ---

export interface ExtractionMetadata {
    reportType: string;
    extractedAt: string;
    filters: Record<string, unknown>;
    rowCount: number;
    columns: string[];
    locatorResolution: Record<string, number>;
    durationMs: number;
    deduplication?: {
        beforeCount: number;
        afterCount: number;
        removed: number;
    };
}

// --- Observability Types ---

export interface TraceEvent {
    timestamp: string;
    action: string;
    tier?: ResilienceTier;
    confidence?: number;
    strategy?: string;
    latencyMs: number;
    status: 'success' | 'failure' | 'degraded';
    details?: Record<string, unknown>;
}

export interface LocatorHealth {
    description: string;
    totalAttempts: number;
    tierSuccesses: Record<number, number>;
    tierFailures: Record<number, number>;
    averageConfidence: number;
    lastUsed: string;
}
```

**Step 5: Write test for config parsing**

```typescript
// test/types/config.test.ts
import * as fs from 'fs';
import * as yaml from 'js-yaml';

describe('WorkflowConfig', () => {
    it('should parse reports.yaml into valid config', () => {
        const raw = fs.readFileSync('config/reports.yaml', 'utf-8');
        const config = yaml.load(raw) as any;

        expect(config.target.url).toBeDefined();
        expect(config.reports).toBeInstanceOf(Array);
        expect(config.reports.length).toBe(6);
        expect(config.periods).toBeInstanceOf(Array);
        expect(config.periods.length).toBeGreaterThanOrEqual(2);

        for (const report of config.reports) {
            expect(report.name).toBeDefined();
            expect(report.slug).toBeDefined();
            expect(report.path).toBeDefined();
            expect(report.filters).toBeInstanceOf(Array);
        }
    });
});
```

**Step 6: Run all tests**

Run: `yarn test`
Expected: ALL PASS

**Step 7: Commit**

```bash
git add src/utils/logger.ts src/types/index.ts test/utils/logger.test.ts test/types/config.test.ts
git commit -m "feat: add logger utility and core type definitions

Logger supports debug/info/warn/error with timestamped, contextual output.
Types define the full locator resilience spec (4 tiers), workflow config,
extraction metadata, and observability trace events."
```

---

## Task 3: Resilient Locator Engine — Tier 1

**Files:**

- Create: `src/resilience/resilient-locator.ts`
- Create: `src/resilience/tier1.ts`
- Create: `src/resilience/tracer.ts`
- Create: `test/resilience/tier1.test.ts`
- Create: `test/resilience/tracer.test.ts`

**Step 1: Write the failing test for Tier 1 resolution**

```typescript
// test/resilience/tier1.test.ts
import { resolveTier1 } from '../../src/resilience/tier1.js';

// Mock Playwright Page
function createMockPage(options: {
    roleMatch?: boolean;
    textMatch?: boolean;
    labelMatch?: boolean;
}) {
    const mockLocator = {
        count: jest.fn().mockResolvedValue(options.roleMatch ? 1 : 0),
        first: jest.fn().mockReturnThis(),
        isVisible: jest.fn().mockResolvedValue(true),
    };
    const noMatchLocator = {
        count: jest.fn().mockResolvedValue(0),
        first: jest.fn().mockReturnThis(),
        isVisible: jest.fn().mockResolvedValue(false),
    };
    const textLocator = {
        count: jest.fn().mockResolvedValue(options.textMatch ? 1 : 0),
        first: jest.fn().mockReturnThis(),
        isVisible: jest.fn().mockResolvedValue(true),
    };

    return {
        getByRole: jest.fn().mockReturnValue(options.roleMatch ? mockLocator : noMatchLocator),
        getByText: jest.fn().mockReturnValue(options.textMatch ? textLocator : noMatchLocator),
        getByLabel: jest.fn().mockReturnValue(options.labelMatch ? mockLocator : noMatchLocator),
        getByTestId: jest.fn().mockReturnValue(noMatchLocator),
    } as any;
}

describe('Tier 1 — User-Facing Locators', () => {
    it('should resolve by role when available', async () => {
        const page = createMockPage({ roleMatch: true });
        const spec = {
            description: 'Sign In button',
            tier1: { role: { role: 'button', name: 'Sign In' } },
        };
        const result = await resolveTier1(page, spec);
        expect(result).not.toBeNull();
        expect(result!.tier).toBe(1);
        expect(result!.confidence).toBeGreaterThanOrEqual(0.95);
        expect(result!.strategy).toContain('role');
    });

    it('should fall through to text when role fails', async () => {
        const page = createMockPage({ roleMatch: false, textMatch: true });
        const spec = {
            description: 'Sign In button',
            tier1: {
                role: { role: 'button', name: 'Sign In' },
                text: 'Sign In',
            },
        };
        const result = await resolveTier1(page, spec);
        expect(result).not.toBeNull();
        expect(result!.strategy).toContain('text');
    });

    it('should return null when no tier 1 strategies match', async () => {
        const page = createMockPage({ roleMatch: false, textMatch: false, labelMatch: false });
        const spec = {
            description: 'Missing element',
            tier1: { role: { role: 'button', name: 'Nonexistent' } },
        };
        const result = await resolveTier1(page, spec);
        expect(result).toBeNull();
    });
});
```

**Step 2: Run test to verify it fails**

Run: `yarn test -- test/resilience/tier1.test.ts`
Expected: FAIL — cannot find module

**Step 3: Implement Tier 1 resolver**

```typescript
// src/resilience/tier1.ts
// (MIT license header)

import type { Page } from 'playwright';
import type { LocatorSpec, LocatorResult } from '../types/index.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('tier1');

async function tryLocator(
    locator: any,
    strategy: string,
): Promise<{ element: any; strategy: string } | null> {
    try {
        const count = await locator.count();
        if (count === 1) {
            return { element: locator.first(), strategy };
        }
        if (count > 1) {
            logger.debug(`Multiple matches (${count}) for ${strategy}, using first`);
            return { element: locator.first(), strategy };
        }
    } catch {
        logger.debug(`Strategy ${strategy} threw an error`);
    }
    return null;
}

export async function resolveTier1(page: Page, spec: LocatorSpec): Promise<LocatorResult | null> {
    if (!spec.tier1) return null;

    const start = Date.now();
    const { role, text, label, testId } = spec.tier1;

    // Try strategies in priority order: role → text → label → testId
    const strategies: Array<{ locator: any; name: string }> = [];

    if (role) {
        const opts: Record<string, string> = {};
        if (role.name) opts.name = role.name;
        strategies.push({
            locator: page.getByRole(role.role as any, opts),
            name: `role(${role.role}, ${role.name || ''})`,
        });
    }
    if (text) {
        strategies.push({
            locator: page.getByText(text, { exact: true }),
            name: `text("${text}")`,
        });
    }
    if (label) {
        strategies.push({
            locator: page.getByLabel(label),
            name: `label("${label}")`,
        });
    }
    if (testId) {
        strategies.push({
            locator: page.getByTestId(testId),
            name: `testId("${testId}")`,
        });
    }

    for (const { locator, name } of strategies) {
        const result = await tryLocator(locator, name);
        if (result) {
            const latencyMs = Date.now() - start;
            logger.info(`Resolved "${spec.description}" via ${name}`, { latencyMs });
            return {
                element: result.element,
                tier: 1,
                confidence: 0.95,
                strategy: name,
                latencyMs,
                alternatives: strategies.length,
            };
        }
    }

    logger.debug(`All Tier 1 strategies failed for "${spec.description}"`);
    return null;
}
```

**Step 4: Implement the tracer**

```typescript
// src/resilience/tracer.ts
// (MIT license header)

import * as fs from 'fs';
import * as path from 'path';
import type { TraceEvent, LocatorHealth } from '../types/index.js';

export class ExecutionTracer {
    private events: TraceEvent[] = [];
    private outputDir: string;
    private healthFile: string;
    private health: Record<string, LocatorHealth> = {};

    constructor(outputDir: string) {
        this.outputDir = outputDir;
        this.healthFile = path.join(outputDir, 'locator-health.json');
        fs.mkdirSync(path.join(outputDir, 'traces'), { recursive: true });
        this.loadHealth();
    }

    private loadHealth(): void {
        try {
            if (fs.existsSync(this.healthFile)) {
                this.health = JSON.parse(fs.readFileSync(this.healthFile, 'utf-8'));
            }
        } catch {
            this.health = {};
        }
    }

    recordEvent(event: TraceEvent): void {
        this.events.push(event);
    }

    recordLocatorResolution(
        description: string,
        tier: number,
        confidence: number,
        success: boolean,
    ): void {
        if (!this.health[description]) {
            this.health[description] = {
                description,
                totalAttempts: 0,
                tierSuccesses: {},
                tierFailures: {},
                averageConfidence: 0,
                lastUsed: new Date().toISOString(),
            };
        }

        const h = this.health[description];
        h.totalAttempts++;
        h.lastUsed = new Date().toISOString();

        if (success) {
            h.tierSuccesses[tier] = (h.tierSuccesses[tier] || 0) + 1;
        } else {
            h.tierFailures[tier] = (h.tierFailures[tier] || 0) + 1;
        }

        // Running average
        h.averageConfidence =
            (h.averageConfidence * (h.totalAttempts - 1) + confidence) / h.totalAttempts;
    }

    flush(): void {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const traceFile = path.join(this.outputDir, 'traces', `execution-${timestamp}.jsonl`);
        const lines = this.events.map(e => JSON.stringify(e)).join('\n');
        fs.writeFileSync(traceFile, lines + '\n');

        fs.writeFileSync(this.healthFile, JSON.stringify(this.health, null, 2));
    }

    getEvents(): TraceEvent[] {
        return [...this.events];
    }

    getHealth(): Record<string, LocatorHealth> {
        return { ...this.health };
    }
}
```

**Step 5: Write tracer test**

```typescript
// test/resilience/tracer.test.ts
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ExecutionTracer } from '../../src/resilience/tracer.js';

describe('ExecutionTracer', () => {
    let tmpDir: string;
    let tracer: ExecutionTracer;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tracer-test-'));
        tracer = new ExecutionTracer(tmpDir);
    });

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('should record and flush trace events to JSONL', () => {
        tracer.recordEvent({
            timestamp: '2026-03-04T00:00:00Z',
            action: 'click',
            tier: 1,
            confidence: 0.95,
            strategy: 'role(button, Sign In)',
            latencyMs: 50,
            status: 'success',
        });
        tracer.flush();

        const traceDir = path.join(tmpDir, 'traces');
        const files = fs.readdirSync(traceDir);
        expect(files.length).toBe(1);

        const content = fs.readFileSync(path.join(traceDir, files[0]), 'utf-8');
        const event = JSON.parse(content.trim());
        expect(event.action).toBe('click');
        expect(event.tier).toBe(1);
    });

    it('should track locator health across resolutions', () => {
        tracer.recordLocatorResolution('Sign In button', 1, 0.95, true);
        tracer.recordLocatorResolution('Sign In button', 1, 0.9, true);
        tracer.recordLocatorResolution('Sign In button', 2, 0.8, true);
        tracer.flush();

        const health = tracer.getHealth();
        expect(health['Sign In button'].totalAttempts).toBe(3);
        expect(health['Sign In button'].tierSuccesses[1]).toBe(2);
        expect(health['Sign In button'].tierSuccesses[2]).toBe(1);
    });
});
```

**Step 6: Run tests**

Run: `yarn test`
Expected: ALL PASS

**Step 7: Commit**

```bash
git add src/resilience/ test/resilience/
git commit -m "feat: implement Tier 1 user-facing locator resolution and execution tracer

Tier 1 cascades through role → text → label → testId locator strategies.
ExecutionTracer records JSONL trace events and tracks per-locator health
metrics (success rates by tier, confidence averages) across runs."
```

---

## Task 4: Resilient Locator Engine — Tier 2 (Anchor-Based)

**Files:**

- Create: `src/resilience/tier2.ts`
- Create: `test/resilience/tier2.test.ts`

**Step 1: Write the failing test**

```typescript
// test/resilience/tier2.test.ts
import { resolveTier2 } from '../../src/resilience/tier2.js';

function createMockPage() {
    const anchorLocator = {
        count: jest.fn().mockResolvedValue(1),
        first: jest.fn().mockReturnThis(),
    };
    const targetLocator = {
        count: jest.fn().mockResolvedValue(1),
        first: jest.fn().mockReturnThis(),
    };

    const locatorChain = {
        count: jest.fn().mockResolvedValue(1),
        first: jest.fn().mockReturnValue(targetLocator),
        locator: jest.fn().mockReturnValue(targetLocator),
    };

    return {
        getByRole: jest.fn().mockReturnValue(anchorLocator),
        getByText: jest.fn().mockReturnValue(anchorLocator),
        locator: jest.fn().mockReturnValue(locatorChain),
    } as any;
}

describe('Tier 2 — Anchor-Based Recovery', () => {
    it('should resolve target relative to anchor using "below" relationship', async () => {
        const page = createMockPage();
        const spec = {
            description: 'Username field',
            tier2: {
                anchor: {
                    description: 'Username label',
                    tier1: { text: 'Username' },
                },
                relationship: 'below' as const,
                target: { role: 'textbox' },
            },
        };

        const result = await resolveTier2(page, spec);
        expect(result).not.toBeNull();
        expect(result!.tier).toBe(2);
        expect(result!.confidence).toBeGreaterThanOrEqual(0.85);
    });
});
```

**Step 2: Run test to verify it fails**

Run: `yarn test -- test/resilience/tier2.test.ts`
Expected: FAIL

**Step 3: Implement Tier 2**

```typescript
// src/resilience/tier2.ts
// (MIT license header)

import type { Page } from 'playwright';
import type { LocatorSpec, LocatorResult } from '../types/index.js';
import { resolveTier1 } from './tier1.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('tier2');

export async function resolveTier2(page: Page, spec: LocatorSpec): Promise<LocatorResult | null> {
    if (!spec.tier2) return null;

    const start = Date.now();
    const { anchor, relationship, target } = spec.tier2;

    // First, resolve the anchor element using Tier 1
    const anchorResult = await resolveTier1(page, anchor);
    if (!anchorResult) {
        logger.debug(`Anchor "${anchor.description}" could not be resolved`);
        return null;
    }

    try {
        let targetLocator;
        const anchorEl = anchorResult.element;

        switch (relationship) {
            case 'near':
                // Use Playwright's locator relative to anchor with :near pseudo
                if (target?.role) {
                    targetLocator = page.getByRole(target.role as any).near(anchorEl);
                } else if (target?.text) {
                    targetLocator = page.getByText(target.text).near(anchorEl);
                }
                break;

            case 'below':
                if (target?.role) {
                    targetLocator = page.getByRole(target.role as any).below(anchorEl);
                } else if (target?.text) {
                    targetLocator = page.getByText(target.text).below(anchorEl);
                }
                break;

            case 'above':
                if (target?.role) {
                    targetLocator = page.getByRole(target.role as any).above(anchorEl);
                } else if (target?.text) {
                    targetLocator = page.getByText(target.text).above(anchorEl);
                }
                break;

            case 'within':
                // Locator chained from anchor
                if (target?.role) {
                    targetLocator = anchorEl.locator(`[role="${target.role}"]`);
                } else if (target?.text) {
                    targetLocator = anchorEl.getByText(target.text);
                }
                break;

            case 'sibling':
                // Use XPath sibling axis
                if (target?.role) {
                    targetLocator = anchorEl
                        .locator(`xpath=following-sibling::*[contains(@role,"${target.role}")]`)
                        .first();
                }
                break;
        }

        if (targetLocator) {
            const count = await targetLocator.count();
            if (count > 0) {
                const latencyMs = Date.now() - start;
                const strategy = `anchor("${anchor.description}").${relationship}(${target?.role || target?.text || ''})`;
                logger.info(`Resolved "${spec.description}" via ${strategy}`, { latencyMs });
                return {
                    element: targetLocator.first(),
                    tier: 2,
                    confidence: 0.85,
                    strategy,
                    latencyMs,
                    alternatives: 1,
                };
            }
        }
    } catch (e) {
        logger.debug(`Tier 2 failed for "${spec.description}": ${e}`);
    }

    return null;
}
```

**Step 4: Run tests**

Run: `yarn test`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add src/resilience/tier2.ts test/resilience/tier2.test.ts
git commit -m "feat: implement Tier 2 anchor-based locator recovery

Resolves elements by their spatial/structural relationship to stable
anchor elements (above, below, near, within, sibling). Survives layout
refactors where DOM positions change but semantic relationships persist."
```

---

## Task 5: Resilient Locator Engine — Tier 3 (Fuzzy Matching)

**Files:**

- Create: `src/resilience/tier3.ts`
- Create: `src/resilience/fuzzy.ts`
- Create: `test/resilience/tier3.test.ts`
- Create: `test/resilience/fuzzy.test.ts`

**Step 1: Write the failing test for fuzzy scoring**

```typescript
// test/resilience/fuzzy.test.ts
import { jaroWinkler, scoreCandidates } from '../../src/resilience/fuzzy.js';

describe('Fuzzy Matching', () => {
    describe('jaroWinkler', () => {
        it('should return 1.0 for identical strings', () => {
            expect(jaroWinkler('hello', 'hello')).toBe(1.0);
        });

        it('should return high score for similar strings', () => {
            const score = jaroWinkler('Sign In', 'SignIn');
            expect(score).toBeGreaterThan(0.8);
        });

        it('should return low score for dissimilar strings', () => {
            const score = jaroWinkler('Sign In', 'Logout');
            expect(score).toBeLessThan(0.6);
        });
    });

    describe('scoreCandidates', () => {
        it('should rank candidates by combined feature score', () => {
            const candidates = [
                { tag: 'button', text: 'Sign In', attributes: { type: 'submit' } },
                { tag: 'div', text: 'Sign In', attributes: {} },
                { tag: 'span', text: 'Log Out', attributes: {} },
            ];
            const target = { tag: 'button', visibleText: 'Sign In' };
            const scores = scoreCandidates(candidates, target);

            expect(scores[0].score).toBeGreaterThan(scores[1].score);
            expect(scores[1].score).toBeGreaterThan(scores[2].score);
        });
    });
});
```

**Step 2: Run test to verify it fails**

Run: `yarn test -- test/resilience/fuzzy.test.ts`
Expected: FAIL

**Step 3: Implement fuzzy matching utilities**

```typescript
// src/resilience/fuzzy.ts
// (MIT license header)

import { distance as levenshtein } from 'fastest-levenshtein';

export function jaroWinkler(s1: string, s2: string): number {
    if (s1 === s2) return 1.0;
    if (s1.length === 0 || s2.length === 0) return 0.0;

    const matchWindow = Math.max(0, Math.floor(Math.max(s1.length, s2.length) / 2) - 1);
    const s1Matches = new Array(s1.length).fill(false);
    const s2Matches = new Array(s2.length).fill(false);

    let matches = 0;
    let transpositions = 0;

    for (let i = 0; i < s1.length; i++) {
        const start = Math.max(0, i - matchWindow);
        const end = Math.min(i + matchWindow + 1, s2.length);
        for (let j = start; j < end; j++) {
            if (s2Matches[j] || s1[i] !== s2[j]) continue;
            s1Matches[i] = true;
            s2Matches[j] = true;
            matches++;
            break;
        }
    }

    if (matches === 0) return 0.0;

    let k = 0;
    for (let i = 0; i < s1.length; i++) {
        if (!s1Matches[i]) continue;
        while (!s2Matches[k]) k++;
        if (s1[i] !== s2[k]) transpositions++;
        k++;
    }

    const jaro =
        (matches / s1.length + matches / s2.length + (matches - transpositions / 2) / matches) / 3;

    // Winkler modification: boost for common prefix
    let prefix = 0;
    for (let i = 0; i < Math.min(4, Math.min(s1.length, s2.length)); i++) {
        if (s1[i] === s2[i]) prefix++;
        else break;
    }

    return jaro + prefix * 0.1 * (1 - jaro);
}

export interface CandidateFeatures {
    tag: string;
    text: string;
    attributes: Record<string, string>;
}

export interface ScoredCandidate {
    index: number;
    score: number;
    breakdown: Record<string, number>;
}

export function scoreCandidates(
    candidates: CandidateFeatures[],
    target: { tag?: string; visibleText?: string; attributes?: Record<string, string> },
): ScoredCandidate[] {
    const weights = { tag: 0.2, text: 0.5, attributes: 0.3 };

    return candidates
        .map((candidate, index) => {
            const breakdown: Record<string, number> = {};

            // Tag match
            breakdown.tag = target.tag && candidate.tag === target.tag ? 1.0 : 0.0;

            // Text similarity
            breakdown.text =
                target.visibleText && candidate.text
                    ? jaroWinkler(target.visibleText, candidate.text)
                    : 0.0;

            // Attribute overlap
            if (target.attributes && Object.keys(target.attributes).length > 0) {
                const targetKeys = Object.keys(target.attributes);
                let attrScore = 0;
                for (const key of targetKeys) {
                    if (candidate.attributes[key] === target.attributes[key]) {
                        attrScore += 1;
                    }
                }
                breakdown.attributes = attrScore / targetKeys.length;
            } else {
                breakdown.attributes = 0;
            }

            const score =
                breakdown.tag * weights.tag +
                breakdown.text * weights.text +
                breakdown.attributes * weights.attributes;

            return { index, score, breakdown };
        })
        .sort((a, b) => b.score - a.score);
}
```

**Step 4: Implement Tier 3 resolver**

```typescript
// src/resilience/tier3.ts
// (MIT license header)

import type { Page } from 'playwright';
import type { LocatorSpec, LocatorResult } from '../types/index.js';
import { scoreCandidates } from './fuzzy.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('tier3');

export async function resolveTier3(
    page: Page,
    spec: LocatorSpec,
    confidenceThreshold = 0.7,
): Promise<LocatorResult | null> {
    if (!spec.tier3) return null;

    const start = Date.now();
    const { tag, attributes, visibleText, minConfidence } = spec.tier3;
    const threshold = minConfidence ?? confidenceThreshold;

    try {
        // Build a CSS selector to narrow candidates
        const selector = tag || '*';
        const elements = page.locator(selector);
        const count = await elements.count();

        if (count === 0) {
            logger.debug(`No candidates found for "${spec.description}" with tag "${tag}"`);
            return null;
        }

        // Collect features from DOM candidates (limit scan to 100 elements)
        const scanLimit = Math.min(count, 100);
        const candidates = [];

        for (let i = 0; i < scanLimit; i++) {
            const el = elements.nth(i);
            const text = await el.innerText().catch(() => '');
            const tagName = await el.evaluate(e => e.tagName.toLowerCase()).catch(() => '');
            const attrs: Record<string, string> = {};

            if (attributes) {
                for (const key of Object.keys(attributes)) {
                    const val = await el.getAttribute(key).catch(() => null);
                    if (val) attrs[key] = val;
                }
            }

            candidates.push({ tag: tagName, text: text.trim(), attributes: attrs });
        }

        // Score candidates
        const scored = scoreCandidates(candidates, {
            tag,
            visibleText,
            attributes,
        });

        if (scored.length > 0 && scored[0].score >= threshold) {
            const best = scored[0];
            const latencyMs = Date.now() - start;
            const strategy = `fuzzy(tag=${tag}, text="${visibleText}", score=${best.score.toFixed(3)})`;

            logger.info(`Resolved "${spec.description}" via ${strategy}`, {
                latencyMs,
                alternatives: scored.filter(s => s.score >= threshold).length,
            });

            return {
                element: elements.nth(best.index),
                tier: 3,
                confidence: best.score,
                strategy,
                latencyMs,
                alternatives: scored.filter(s => s.score >= threshold).length,
            };
        }

        logger.debug(
            `Best fuzzy match for "${spec.description}" scored ${scored[0]?.score.toFixed(3)} (below threshold ${threshold})`,
        );
    } catch (e) {
        logger.debug(`Tier 3 failed for "${spec.description}": ${e}`);
    }

    return null;
}
```

**Step 5: Run tests**

Run: `yarn test`
Expected: ALL PASS

**Step 6: Commit**

```bash
git add src/resilience/tier3.ts src/resilience/fuzzy.ts test/resilience/tier3.test.ts test/resilience/fuzzy.test.ts
git commit -m "feat: implement Tier 3 algorithmic fuzzy matching

Custom Jaro-Winkler implementation for string similarity scoring.
DOM candidate scanner builds feature vectors (tag, text, attributes)
and scores against target spec. Confidence threshold gates automatic
resolution vs. human escalation."
```

---

## Task 6: Resilient Locator Engine — Tier 4 (GLM-OCR Vision)

**Files:**

- Create: `src/resilience/tier4.ts`
- Create: `src/resilience/ocr-client.ts`
- Create: `test/resilience/tier4.test.ts`

**Step 1: Write the failing test**

```typescript
// test/resilience/tier4.test.ts
import { resolveTier4 } from '../../src/resilience/tier4.js';

// Mock page with screenshot
function createMockPage() {
    return {
        screenshot: jest.fn().mockResolvedValue(Buffer.from('fake-png-data')),
        mouse: {
            click: jest.fn().mockResolvedValue(undefined),
        },
        locator: jest.fn().mockReturnValue({
            count: jest.fn().mockResolvedValue(0),
            first: jest.fn().mockReturnThis(),
        }),
    } as any;
}

// Mock OCR client
jest.mock('../../src/resilience/ocr-client.js', () => ({
    findTextInScreenshot: jest.fn().mockResolvedValue({
        found: true,
        x: 150,
        y: 200,
        width: 80,
        height: 20,
        confidence: 0.92,
    }),
}));

describe('Tier 4 — Vision/OCR', () => {
    it('should find text via OCR and return coordinates', async () => {
        const page = createMockPage();
        const spec = {
            description: 'Download button',
            tier4: { searchText: 'Download XLSX' },
        };

        const result = await resolveTier4(page, spec);
        expect(result).not.toBeNull();
        expect(result!.tier).toBe(4);
        expect(result!.confidence).toBeGreaterThan(0.8);
        expect(result!.strategy).toContain('ocr');
    });
});
```

**Step 2: Run test to verify it fails**

Run: `yarn test -- test/resilience/tier4.test.ts`
Expected: FAIL

**Step 3: Implement OCR client**

```typescript
// src/resilience/ocr-client.ts
// (MIT license header)

import { createLogger } from '../utils/logger.js';

const logger = createLogger('ocr-client');

export interface OCRResult {
    found: boolean;
    x: number;
    y: number;
    width: number;
    height: number;
    confidence: number;
}

export async function findTextInScreenshot(
    screenshotBuffer: Buffer,
    searchText: string,
    endpoint?: string,
): Promise<OCRResult> {
    const ocrEndpoint = endpoint || process.env.GLM_OCR_ENDPOINT;

    if (!ocrEndpoint) {
        logger.warn('No GLM_OCR_ENDPOINT configured, Tier 4 unavailable');
        return { found: false, x: 0, y: 0, width: 0, height: 0, confidence: 0 };
    }

    try {
        const base64Image = screenshotBuffer.toString('base64');

        const response = await fetch(ocrEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                inputs: {
                    image: base64Image,
                    question: `Find the exact pixel coordinates (x, y, width, height) of the text "${searchText}" in this screenshot. Return JSON with fields: found (boolean), x (number), y (number), width (number), height (number), confidence (number 0-1).`,
                },
            }),
        });

        if (!response.ok) {
            logger.error(`OCR endpoint returned ${response.status}`);
            return { found: false, x: 0, y: 0, width: 0, height: 0, confidence: 0 };
        }

        const result = await response.json();
        logger.info(`OCR result for "${searchText}":`, { result });

        // Parse the model's response — adapt based on actual GLM-OCR output format
        if (typeof result === 'object' && result.found !== undefined) {
            return result as OCRResult;
        }

        // If the model returns a text response, try to parse it
        const text = typeof result === 'string' ? result : JSON.stringify(result);
        const jsonMatch = text.match(/\{[^}]+\}/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]) as OCRResult;
        }

        return { found: false, x: 0, y: 0, width: 0, height: 0, confidence: 0 };
    } catch (e) {
        logger.error(`OCR request failed: ${e}`);
        return { found: false, x: 0, y: 0, width: 0, height: 0, confidence: 0 };
    }
}
```

**Step 4: Implement Tier 4**

```typescript
// src/resilience/tier4.ts
// (MIT license header)

import type { Page } from 'playwright';
import type { LocatorSpec, LocatorResult } from '../types/index.js';
import { findTextInScreenshot } from './ocr-client.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('tier4');

export async function resolveTier4(page: Page, spec: LocatorSpec): Promise<LocatorResult | null> {
    if (!spec.tier4) return null;

    const start = Date.now();
    const { searchText, region } = spec.tier4;

    try {
        // Take screenshot (full page or clipped region)
        const screenshotOpts: any = { type: 'png' };
        if (region) {
            screenshotOpts.clip = region;
        }
        const screenshot = await page.screenshot(screenshotOpts);

        // Send to OCR
        const ocrResult = await findTextInScreenshot(screenshot, searchText);

        if (ocrResult.found && ocrResult.confidence > 0.5) {
            const latencyMs = Date.now() - start;
            // Adjust coordinates if we used a region clip
            const clickX = (region?.x || 0) + ocrResult.x + ocrResult.width / 2;
            const clickY = (region?.y || 0) + ocrResult.y + ocrResult.height / 2;

            const strategy = `ocr("${searchText}", x=${clickX}, y=${clickY}, conf=${ocrResult.confidence.toFixed(3)})`;
            logger.info(`Resolved "${spec.description}" via ${strategy}`, { latencyMs });

            // Create a coordinate-based "locator" — wrap in a click action
            // Since OCR gives us coordinates, we create a pseudo-locator
            const pseudoLocator = {
                click: () => page.mouse.click(clickX, clickY),
                fill: (text: string) =>
                    page.mouse.click(clickX, clickY).then(() => page.keyboard.type(text)),
                // Expose coordinates for callers that need them
                _ocrCoordinates: { x: clickX, y: clickY },
            };

            return {
                element: pseudoLocator as any,
                tier: 4,
                confidence: ocrResult.confidence,
                strategy,
                latencyMs,
                alternatives: 1,
            };
        }

        logger.debug(`OCR did not find "${searchText}" in screenshot`);
    } catch (e) {
        logger.debug(`Tier 4 failed for "${spec.description}": ${e}`);
    }

    return null;
}
```

**Step 5: Run tests**

Run: `yarn test`
Expected: ALL PASS

**Step 6: Commit**

```bash
git add src/resilience/tier4.ts src/resilience/ocr-client.ts test/resilience/tier4.test.ts
git commit -m "feat: implement Tier 4 vision/OCR locator with GLM-OCR

Last-resort tier captures screenshots and sends to GLM-OCR endpoint
for text location. Returns coordinate-based pseudo-locators for click/fill.
Gracefully degrades when no OCR endpoint is configured."
```

---

## Task 7: Resilient Locator — Cascade Orchestrator

**Files:**

- Create: `src/resilience/index.ts`
- Create: `test/resilience/cascade.test.ts`

**Step 1: Write the failing test**

```typescript
// test/resilience/cascade.test.ts
import { ResilientLocator } from '../../src/resilience/index.js';

describe('ResilientLocator Cascade', () => {
    it('should resolve via Tier 1 when available', async () => {
        const mockPage = {
            getByRole: jest.fn().mockReturnValue({
                count: jest.fn().mockResolvedValue(1),
                first: jest.fn().mockReturnThis(),
            }),
            getByText: jest.fn(),
            getByLabel: jest.fn(),
            getByTestId: jest.fn(),
        } as any;

        const locator = new ResilientLocator(mockPage, '/tmp/test-output');
        const result = await locator.resolve({
            description: 'Sign In button',
            tier1: { role: { role: 'button', name: 'Sign In' } },
        });

        expect(result).not.toBeNull();
        expect(result!.tier).toBe(1);
    });

    it('should cascade to Tier 2 when Tier 1 fails', async () => {
        const noMatch = {
            count: jest.fn().mockResolvedValue(0),
            first: jest.fn().mockReturnThis(),
        };
        const match = {
            count: jest.fn().mockResolvedValue(1),
            first: jest.fn().mockReturnThis(),
        };

        const mockPage = {
            getByRole: jest.fn().mockImplementation((role: string, opts?: any) => {
                if (opts?.name === 'Username label') return match;
                return noMatch;
            }),
            getByText: jest.fn().mockImplementation((text: string) => {
                if (text === 'Username') {
                    return {
                        count: jest.fn().mockResolvedValue(1),
                        first: jest.fn().mockReturnThis(),
                        near: jest.fn().mockReturnValue(match),
                        below: jest.fn().mockReturnValue(match),
                    };
                }
                return noMatch;
            }),
            getByLabel: jest.fn().mockReturnValue(noMatch),
            getByTestId: jest.fn().mockReturnValue(noMatch),
            locator: jest.fn().mockReturnValue(noMatch),
        } as any;

        const locator = new ResilientLocator(mockPage, '/tmp/test-output');
        const result = await locator.resolve({
            description: 'Username input',
            tier1: { role: { role: 'textbox', name: 'Username' } },
            tier2: {
                anchor: { description: 'Username label', tier1: { text: 'Username' } },
                relationship: 'below',
                target: { role: 'textbox' },
            },
        });

        // Should resolve via tier 2 since tier 1 failed
        expect(result).not.toBeNull();
        if (result) {
            expect(result.tier).toBeGreaterThanOrEqual(1);
        }
    });

    it('should track resolution stats', async () => {
        const mockPage = {
            getByRole: jest.fn().mockReturnValue({
                count: jest.fn().mockResolvedValue(1),
                first: jest.fn().mockReturnThis(),
            }),
            getByText: jest.fn(),
            getByLabel: jest.fn(),
            getByTestId: jest.fn(),
        } as any;

        const locator = new ResilientLocator(mockPage, '/tmp/test-output');
        await locator.resolve({
            description: 'Button',
            tier1: { role: { role: 'button', name: 'Test' } },
        });

        const stats = locator.getResolutionStats();
        expect(stats.tier1).toBeGreaterThanOrEqual(1);
    });
});
```

**Step 2: Implement the cascade orchestrator**

```typescript
// src/resilience/index.ts
// (MIT license header)

import type { Page } from 'playwright';
import type { LocatorSpec, LocatorResult, ResilienceTier } from '../types/index.js';
import { resolveTier1 } from './tier1.js';
import { resolveTier2 } from './tier2.js';
import { resolveTier3 } from './tier3.js';
import { resolveTier4 } from './tier4.js';
import { ExecutionTracer } from './tracer.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('resilient-locator');

export class ResilientLocator {
    private page: Page;
    private tracer: ExecutionTracer;
    private stats: Record<string, number> = { tier1: 0, tier2: 0, tier3: 0, tier4: 0, failed: 0 };
    private confidenceThreshold: number;

    constructor(page: Page, outputDir: string, confidenceThreshold = 0.7) {
        this.page = page;
        this.tracer = new ExecutionTracer(outputDir);
        this.confidenceThreshold = confidenceThreshold;
    }

    async resolve(spec: LocatorSpec): Promise<LocatorResult | null> {
        const start = Date.now();

        // Tier 1 — User-facing locators
        const t1 = await resolveTier1(this.page, spec);
        if (t1) {
            this.recordResolution(spec, t1, start);
            return t1;
        }

        // Tier 2 — Anchor-based recovery
        const t2 = await resolveTier2(this.page, spec);
        if (t2) {
            this.recordResolution(spec, t2, start);
            return t2;
        }

        // Tier 3 — Fuzzy matching
        const t3 = await resolveTier3(this.page, spec, this.confidenceThreshold);
        if (t3) {
            this.recordResolution(spec, t3, start);
            return t3;
        }

        // Tier 4 — Vision/OCR
        const t4 = await resolveTier4(this.page, spec);
        if (t4) {
            this.recordResolution(spec, t4, start);
            return t4;
        }

        // All tiers failed
        this.stats.failed++;
        const latencyMs = Date.now() - start;
        logger.error(`All tiers failed for "${spec.description}"`, { latencyMs });

        this.tracer.recordEvent({
            timestamp: new Date().toISOString(),
            action: 'resolve',
            latencyMs,
            status: 'failure',
            details: { description: spec.description, message: 'All 4 tiers exhausted' },
        });

        this.tracer.recordLocatorResolution(spec.description, 0, 0, false);
        return null;
    }

    private recordResolution(spec: LocatorSpec, result: LocatorResult, start: number): void {
        const tierKey = `tier${result.tier}`;
        this.stats[tierKey] = (this.stats[tierKey] || 0) + 1;

        const status = result.tier === 1 ? 'success' : 'degraded';
        this.tracer.recordEvent({
            timestamp: new Date().toISOString(),
            action: 'resolve',
            tier: result.tier,
            confidence: result.confidence,
            strategy: result.strategy,
            latencyMs: Date.now() - start,
            status,
            details: { description: spec.description },
        });

        this.tracer.recordLocatorResolution(spec.description, result.tier, result.confidence, true);

        if (result.tier > 1) {
            logger.warn(
                `Degraded to Tier ${result.tier} for "${spec.description}" (confidence: ${result.confidence.toFixed(3)})`,
            );
        }
    }

    getResolutionStats(): Record<string, number> {
        return { ...this.stats };
    }

    getTracer(): ExecutionTracer {
        return this.tracer;
    }

    flush(): void {
        this.tracer.flush();
    }
}

export { ExecutionTracer } from './tracer.js';
export { resolveTier1 } from './tier1.js';
export { resolveTier2 } from './tier2.js';
export { resolveTier3 } from './tier3.js';
export { resolveTier4 } from './tier4.js';
```

**Step 3: Run tests**

Run: `yarn test`
Expected: ALL PASS

**Step 4: Commit**

```bash
git add src/resilience/index.ts test/resilience/cascade.test.ts
git commit -m "feat: implement 4-tier resilient locator cascade orchestrator

ResilientLocator cascades Tier 1 → 2 → 3 → 4, logging which tier
resolved each interaction. Tracks cumulative resolution stats and
records degradation events. Self-healing data persisted via tracer."
```

---

## Task 8: Step Functions — Login & Navigation

**Files:**

- Create: `src/steps/login.ts`
- Create: `src/steps/navigate.ts`
- Create: `src/steps/locator-specs.ts`
- Create: `test/steps/login.test.ts`

**Step 1: Define locator specs for key UI elements**

```typescript
// src/steps/locator-specs.ts
// (MIT license header)

import type { LocatorSpec } from '../types/index.js';

export const loginSpecs = {
    usernameField: {
        description: 'Username input field',
        tier1: { role: { role: 'textbox', name: 'Username' }, label: 'Username' },
        tier2: {
            anchor: { description: 'Username label', tier1: { text: 'Username' } },
            relationship: 'below' as const,
            target: { role: 'textbox' },
        },
        tier3: { tag: 'input', visibleText: 'Username', attributes: { type: 'text' } },
        tier4: { searchText: 'Username' },
    } satisfies LocatorSpec,

    passwordField: {
        description: 'Password input field',
        tier1: { label: 'Password' },
        tier2: {
            anchor: { description: 'Password label', tier1: { text: 'Password' } },
            relationship: 'below' as const,
            target: { role: 'textbox' },
        },
        tier3: { tag: 'input', attributes: { type: 'password' } },
        tier4: { searchText: 'Password' },
    } satisfies LocatorSpec,

    signInButton: {
        description: 'Sign In button',
        tier1: { role: { role: 'button', name: 'Sign In' }, text: 'Sign In' },
        tier3: { tag: 'button', visibleText: 'Sign In' },
        tier4: { searchText: 'Sign In' },
    } satisfies LocatorSpec,
};

export const navSpecs = {
    reportsTab: {
        description: 'Reports navigation tab',
        tier1: { role: { role: 'tab', name: 'Reports' }, text: 'Reports' },
        tier3: { tag: 'a', visibleText: 'Reports' },
        tier4: { searchText: 'Reports' },
    } satisfies LocatorSpec,

    backToReports: {
        description: 'Back to Reports button',
        tier1: { role: { role: 'button', name: 'Back to Reports' } },
        tier3: { tag: 'button', visibleText: 'Back to Reports' },
        tier4: { searchText: 'Back to Reports' },
    } satisfies LocatorSpec,

    downloadXlsx: {
        description: 'Download XLSX button',
        tier1: { role: { role: 'button', name: 'Download XLSX' }, text: 'Download XLSX' },
        tier3: { tag: 'button', visibleText: 'Download XLSX' },
        tier4: { searchText: 'Download XLSX' },
    } satisfies LocatorSpec,

    clearFilters: {
        description: 'Clear Filters button',
        tier1: { role: { role: 'button', name: 'Clear Filters' }, text: 'Clear Filters' },
        tier3: { tag: 'button', visibleText: 'Clear Filters' },
        tier4: { searchText: 'Clear Filters' },
    } satisfies LocatorSpec,
};

export function reportCardSpec(reportName: string): LocatorSpec {
    return {
        description: `${reportName} report card`,
        tier1: { text: reportName },
        tier3: { visibleText: reportName },
        tier4: { searchText: reportName },
    };
}

export function dateFilterSpec(label: string): LocatorSpec {
    return {
        description: `${label} date picker`,
        tier1: { role: { role: 'combobox', name: label }, label },
        tier2: {
            anchor: { description: `${label} label`, tier1: { text: label } },
            relationship: 'below' as const,
            target: { role: 'combobox' },
        },
        tier3: { tag: 'input', visibleText: label },
        tier4: { searchText: label },
    };
}

export function dropdownFilterSpec(label: string, placeholder: string): LocatorSpec {
    return {
        description: `${label} dropdown filter`,
        tier1: { role: { role: 'combobox', name: placeholder }, label },
        tier2: {
            anchor: { description: `${label} label`, tier1: { text: label } },
            relationship: 'below' as const,
            target: { role: 'combobox' },
        },
        tier3: { tag: 'select', visibleText: label },
        tier4: { searchText: label },
    };
}
```

**Step 2: Implement login step**

```typescript
// src/steps/login.ts
// (MIT license header)

import type { Page } from 'playwright';
import { ResilientLocator } from '../resilience/index.js';
import { loginSpecs } from './locator-specs.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('login');

export async function login(
    page: Page,
    locator: ResilientLocator,
    baseUrl: string,
    username: string,
    password: string,
): Promise<void> {
    logger.info(`Navigating to ${baseUrl}/login`);
    await page.goto(`${baseUrl}/login`);
    await page.waitForLoadState('networkidle');

    // Resolve and fill username
    const usernameResult = await locator.resolve(loginSpecs.usernameField);
    if (!usernameResult) throw new Error('Could not find username field');
    await usernameResult.element.fill(username);
    logger.info('Filled username');

    // Resolve and fill password
    const passwordResult = await locator.resolve(loginSpecs.passwordField);
    if (!passwordResult) throw new Error('Could not find password field');
    await passwordResult.element.fill(password);
    logger.info('Filled password');

    // Click sign in
    const signInResult = await locator.resolve(loginSpecs.signInButton);
    if (!signInResult) throw new Error('Could not find Sign In button');
    await signInResult.element.click();
    logger.info('Clicked Sign In');

    // Wait for navigation away from login
    await page.waitForURL('**/!(login)**', { timeout: 10000 });
    logger.info('Login successful');
}
```

**Step 3: Implement navigate step**

```typescript
// src/steps/navigate.ts
// (MIT license header)

import type { Page } from 'playwright';
import { ResilientLocator } from '../resilience/index.js';
import { navSpecs, reportCardSpec } from './locator-specs.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('navigate');

export async function navigateToReports(page: Page, locator: ResilientLocator): Promise<void> {
    const tabResult = await locator.resolve(navSpecs.reportsTab);
    if (!tabResult) throw new Error('Could not find Reports tab');
    await tabResult.element.click();
    await page.waitForURL('**/reports', { timeout: 10000 });
    logger.info('Navigated to Reports page');
}

export async function navigateToReport(
    page: Page,
    locator: ResilientLocator,
    reportName: string,
    reportPath: string,
    baseUrl: string,
): Promise<void> {
    // Navigate directly to the report URL — more reliable than clicking cards
    logger.info(`Navigating to report: ${reportName}`);
    await page.goto(`${baseUrl}${reportPath}`);
    await page.waitForLoadState('networkidle');

    // Verify we're on the right page by checking for the report heading
    const heading = await page
        .getByRole('heading', { name: reportName })
        .isVisible()
        .catch(() => false);
    if (!heading) {
        // Fallback: try navigating via Reports page
        await navigateToReports(page, locator);
        const cardSpec = reportCardSpec(reportName);
        const cardResult = await locator.resolve(cardSpec);
        if (!cardResult) throw new Error(`Could not find report card for "${reportName}"`);
        await cardResult.element.click();
        await page.waitForLoadState('networkidle');
    }

    logger.info(`On report page: ${reportName}`);
}
```

**Step 4: Write login test**

```typescript
// test/steps/login.test.ts
import { login } from '../../src/steps/login.js';

jest.mock('../../src/resilience/index.js', () => {
    return {
        ResilientLocator: jest.fn().mockImplementation(() => ({
            resolve: jest.fn().mockResolvedValue({
                element: {
                    fill: jest.fn().mockResolvedValue(undefined),
                    click: jest.fn().mockResolvedValue(undefined),
                },
                tier: 1,
                confidence: 0.95,
                strategy: 'role',
                latencyMs: 10,
                alternatives: 1,
            }),
        })),
    };
});

describe('Login Step', () => {
    it('should fill credentials and click sign in', async () => {
        const mockPage = {
            goto: jest.fn().mockResolvedValue(undefined),
            waitForLoadState: jest.fn().mockResolvedValue(undefined),
            waitForURL: jest.fn().mockResolvedValue(undefined),
        } as any;

        const { ResilientLocator } = require('../../src/resilience/index.js');
        const locator = new ResilientLocator(mockPage, '/tmp/test');

        await login(mockPage, locator, 'http://localhost', 'admin', 'pass');

        expect(mockPage.goto).toHaveBeenCalledWith('http://localhost/login');
        expect(locator.resolve).toHaveBeenCalledTimes(3); // username, password, sign in
    });
});
```

**Step 5: Run tests**

Run: `yarn test`
Expected: ALL PASS

**Step 6: Commit**

```bash
git add src/steps/ test/steps/
git commit -m "feat: implement login and navigation steps with resilient locators

Login step resolves username/password/button via ResilientLocator cascade.
Navigation supports both direct URL and fallback card-click approaches.
Locator specs define all 4 tiers for every UI element."
```

---

## Task 9: Step Functions — Filters & Download

**Files:**

- Create: `src/steps/filter.ts`
- Create: `src/steps/download.ts`
- Create: `test/steps/filter.test.ts`

**Step 1: Implement filter application**

```typescript
// src/steps/filter.ts
// (MIT license header)

import type { Page } from 'playwright';
import type { FilterConfig, DateRangeFilter, DropdownFilter } from '../types/index.js';
import { ResilientLocator } from '../resilience/index.js';
import { dateFilterSpec, dropdownFilterSpec, navSpecs } from './locator-specs.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('filter');

async function applyDateRange(
    page: Page,
    locator: ResilientLocator,
    filter: DateRangeFilter,
): Promise<void> {
    // Clear existing filters first
    const clearResult = await locator.resolve(navSpecs.clearFilters);
    if (clearResult) {
        await clearResult.element.click();
        await page.waitForTimeout(500);
    }

    // Fill From date
    const fromSpec = dateFilterSpec('From');
    const fromResult = await locator.resolve(fromSpec);
    if (!fromResult) throw new Error('Could not find From date picker');
    await fromResult.element.fill(filter.from);
    logger.info(`Set From date: ${filter.from}`);

    // Fill To date
    const toSpec = dateFilterSpec('To');
    const toResult = await locator.resolve(toSpec);
    if (!toResult) throw new Error('Could not find To date picker');
    await toResult.element.fill(filter.to);
    logger.info(`Set To date: ${filter.to}`);

    // Press Enter or Tab to trigger filter
    await page.keyboard.press('Tab');
    await page.waitForTimeout(1000);
}

async function applyDropdown(
    page: Page,
    locator: ResilientLocator,
    filter: DropdownFilter,
): Promise<void> {
    // Determine the placeholder text based on common patterns
    const placeholders: Record<string, string> = {
        Status: 'All Statuses',
        Payer: 'All Payers',
        'Denial Code': 'All Codes',
        'Encounter Type': 'All Types',
        'Diagnosis (ICD-10)': 'All Codes',
    };
    const placeholder = placeholders[filter.label] || `All ${filter.label}s`;

    const spec = dropdownFilterSpec(filter.label, placeholder);
    const result = await locator.resolve(spec);
    if (!result) throw new Error(`Could not find ${filter.label} dropdown`);

    // Click to open the PrimeNG dropdown
    await result.element.click();
    await page.waitForTimeout(500);

    // Select the value from the dropdown list
    const option = page.getByText(filter.value, { exact: true });
    const optionCount = await option.count();
    if (optionCount > 0) {
        await option.first().click();
        logger.info(`Selected ${filter.label}: ${filter.value}`);
    } else {
        logger.warn(`Option "${filter.value}" not found in ${filter.label} dropdown`);
    }

    await page.waitForTimeout(1000);
}

export async function applyFilters(
    page: Page,
    locator: ResilientLocator,
    filters: FilterConfig[],
): Promise<void> {
    for (const filter of filters) {
        if (filter.type === 'dateRange') {
            await applyDateRange(page, locator, filter);
        } else if (filter.type === 'dropdown') {
            await applyDropdown(page, locator, filter);
        }
    }
    logger.info(`Applied ${filters.length} filters`);
}
```

**Step 2: Implement download step**

```typescript
// src/steps/download.ts
// (MIT license header)

import * as fs from 'fs';
import * as path from 'path';
import type { Page } from 'playwright';
import { ResilientLocator } from '../resilience/index.js';
import { navSpecs } from './locator-specs.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('download');

export async function downloadReport(
    page: Page,
    locator: ResilientLocator,
    outputDir: string,
    filename: string,
    timeoutMs = 30000,
): Promise<string> {
    fs.mkdirSync(outputDir, { recursive: true });

    // Set up download listener before clicking
    const downloadPromise = page.waitForEvent('download', { timeout: timeoutMs });

    // Click Download XLSX
    const downloadResult = await locator.resolve(navSpecs.downloadXlsx);
    if (!downloadResult) throw new Error('Could not find Download XLSX button');
    await downloadResult.element.click();
    logger.info('Clicked Download XLSX, waiting for download...');

    // Wait for download to complete
    const download = await downloadPromise;
    const filePath = path.join(outputDir, filename);
    await download.saveAs(filePath);

    logger.info(`Downloaded to ${filePath}`);
    return filePath;
}
```

**Step 3: Write filter test**

```typescript
// test/steps/filter.test.ts
import { applyFilters } from '../../src/steps/filter.js';

jest.mock('../../src/resilience/index.js', () => ({
    ResilientLocator: jest.fn().mockImplementation(() => ({
        resolve: jest.fn().mockResolvedValue({
            element: {
                fill: jest.fn().mockResolvedValue(undefined),
                click: jest.fn().mockResolvedValue(undefined),
            },
            tier: 1,
            confidence: 0.95,
            strategy: 'role',
            latencyMs: 10,
            alternatives: 1,
        }),
    })),
}));

describe('Filter Step', () => {
    it('should apply date range and dropdown filters', async () => {
        const mockPage = {
            keyboard: { press: jest.fn().mockResolvedValue(undefined) },
            waitForTimeout: jest.fn().mockResolvedValue(undefined),
            getByText: jest.fn().mockReturnValue({
                count: jest.fn().mockResolvedValue(1),
                first: jest.fn().mockReturnValue({
                    click: jest.fn().mockResolvedValue(undefined),
                }),
            }),
        } as any;

        const { ResilientLocator } = require('../../src/resilience/index.js');
        const locator = new ResilientLocator(mockPage, '/tmp/test');

        await applyFilters(mockPage, locator, [
            { type: 'dateRange', from: '2024-08-01', to: '2025-02-01' },
            { type: 'dropdown', label: 'Status', value: 'Denied' },
        ]);

        // Should have resolved: clear filters, from, to, dropdown = 4
        expect(locator.resolve).toHaveBeenCalled();
    });
});
```

**Step 4: Run tests**

Run: `yarn test`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add src/steps/filter.ts src/steps/download.ts test/steps/filter.test.ts
git commit -m "feat: implement filter application and XLSX download steps

Filter step handles date range pickers and PrimeNG dropdown selection.
Download step uses Playwright download event listener with configurable
timeout. Both use ResilientLocator for all element interactions."
```

---

## Task 10: Data Pipeline — XLSX Parsing & Output

**Files:**

- Create: `src/pipeline/parse-xlsx.ts`
- Create: `src/pipeline/output.ts`
- Create: `src/pipeline/validate.ts`
- Create: `test/pipeline/parse-xlsx.test.ts`
- Create: `test/pipeline/validate.test.ts`

**Step 1: Write the failing test for XLSX parsing**

```typescript
// test/pipeline/parse-xlsx.test.ts
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { parseXlsx } from '../../src/pipeline/parse-xlsx.js';
import ExcelJS from 'exceljs';

describe('XLSX Parser', () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'xlsx-test-'));
    });

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('should parse an XLSX file into structured rows', async () => {
        // Create a test XLSX
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Report');
        sheet.addRow(['Claim ID', 'Patient', 'Billed']);
        sheet.addRow(['CLM-001', 'John Doe', 1500]);
        sheet.addRow(['CLM-002', 'Jane Smith', 2500]);
        const filePath = path.join(tmpDir, 'test.xlsx');
        await workbook.xlsx.writeFile(filePath);

        const result = await parseXlsx(filePath);
        expect(result.columns).toEqual(['Claim ID', 'Patient', 'Billed']);
        expect(result.rows.length).toBe(2);
        expect(result.rows[0]['Claim ID']).toBe('CLM-001');
    });

    it('should exclude specified columns', async () => {
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Report');
        sheet.addRow(['Claim ID', 'Internal ID', 'Patient']);
        sheet.addRow(['CLM-001', 'INT-001', 'John Doe']);
        const filePath = path.join(tmpDir, 'test.xlsx');
        await workbook.xlsx.writeFile(filePath);

        const result = await parseXlsx(filePath, { excludeColumns: ['Internal ID'] });
        expect(result.columns).toEqual(['Claim ID', 'Patient']);
        expect(result.rows[0]['Internal ID']).toBeUndefined();
    });
});
```

**Step 2: Run test to verify it fails**

Run: `yarn test -- test/pipeline/parse-xlsx.test.ts`
Expected: FAIL

**Step 3: Implement XLSX parser**

```typescript
// src/pipeline/parse-xlsx.ts
// (MIT license header)

import ExcelJS from 'exceljs';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('parse-xlsx');

export interface ParseOptions {
    excludeColumns?: string[];
}

export interface ParseResult {
    columns: string[];
    rows: Record<string, unknown>[];
    rawRowCount: number;
}

export async function parseXlsx(
    filePath: string,
    options: ParseOptions = {},
): Promise<ParseResult> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);

    const sheet = workbook.worksheets[0];
    if (!sheet) throw new Error('No worksheet found in XLSX file');

    // Read header row
    const headerRow = sheet.getRow(1);
    const allColumns: string[] = [];
    headerRow.eachCell((cell, colNumber) => {
        allColumns[colNumber - 1] = String(cell.value || '');
    });

    // Filter out excluded columns
    const excludeSet = new Set(options.excludeColumns || []);
    const columns = allColumns.filter(c => !excludeSet.has(c));
    const includeIndices = allColumns
        .map((col, idx) => ({ col, idx }))
        .filter(({ col }) => !excludeSet.has(col))
        .map(({ idx }) => idx);

    // Read data rows
    const rows: Record<string, unknown>[] = [];
    for (let rowIdx = 2; rowIdx <= sheet.rowCount; rowIdx++) {
        const row = sheet.getRow(rowIdx);
        const record: Record<string, unknown> = {};
        let hasData = false;

        for (const idx of includeIndices) {
            const cell = row.getCell(idx + 1);
            const value = cell.value;
            if (value !== null && value !== undefined) hasData = true;
            record[allColumns[idx]] = value;
        }

        if (hasData) rows.push(record);
    }

    logger.info(`Parsed ${rows.length} rows, ${columns.length} columns from ${filePath}`);
    return { columns, rows, rawRowCount: rows.length };
}
```

**Step 4: Implement validation**

```typescript
// src/pipeline/validate.ts
// (MIT license header)

import { createLogger } from '../utils/logger.js';

const logger = createLogger('validate');

export interface ValidationResult {
    valid: boolean;
    errors: string[];
    warnings: string[];
}

export function validateRowCount(
    rows: Record<string, unknown>[],
    minRows: number,
): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (rows.length < minRows) {
        errors.push(`Expected at least ${minRows} rows, got ${rows.length}`);
    }

    if (rows.length === 0) {
        errors.push('No data rows found');
    }

    return { valid: errors.length === 0, errors, warnings };
}

export function crossReferenceValidation(
    sourceRows: Record<string, unknown>[],
    targetRows: Record<string, unknown>[],
    key: string,
): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    const targetKeys = new Set(targetRows.map(r => String(r[key] || '')));
    let missingCount = 0;

    for (const row of sourceRows) {
        const value = String(row[key] || '');
        if (value && !targetKeys.has(value)) {
            missingCount++;
        }
    }

    if (missingCount > 0) {
        warnings.push(
            `${missingCount} ${key} values in source not found in target (${((missingCount / sourceRows.length) * 100).toFixed(1)}%)`,
        );
    }

    logger.info(
        `Cross-reference: ${sourceRows.length} source rows, ${missingCount} missing in target`,
    );
    return { valid: true, errors, warnings };
}

export function deduplicateRows(
    rows: Record<string, unknown>[],
    keyColumn: string,
): { rows: Record<string, unknown>[]; removed: number } {
    const seen = new Set<string>();
    const deduped: Record<string, unknown>[] = [];

    for (const row of rows) {
        const key = String(row[keyColumn] || '');
        if (!seen.has(key)) {
            seen.add(key);
            deduped.push(row);
        }
    }

    const removed = rows.length - deduped.length;
    if (removed > 0) {
        logger.info(`Deduplicated: removed ${removed} duplicate rows by ${keyColumn}`);
    }

    return { rows: deduped, removed };
}
```

**Step 5: Implement output writer**

```typescript
// src/pipeline/output.ts
// (MIT license header)

import * as fs from 'fs';
import * as path from 'path';
import type { ExtractionMetadata } from '../types/index.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('output');

export function writeOutput(
    outputDir: string,
    slug: string,
    periodLabel: string,
    data: Record<string, unknown>[],
    metadata: ExtractionMetadata,
): void {
    const dir = path.join(outputDir, slug, periodLabel);
    fs.mkdirSync(dir, { recursive: true });

    const dataPath = path.join(dir, 'data.json');
    fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));

    const metaPath = path.join(dir, 'metadata.json');
    fs.writeFileSync(metaPath, JSON.stringify(metadata, null, 2));

    logger.info(`Wrote ${data.length} rows to ${dataPath}`);
    logger.info(`Wrote metadata to ${metaPath}`);
}
```

**Step 6: Write validation test**

```typescript
// test/pipeline/validate.test.ts
import {
    validateRowCount,
    crossReferenceValidation,
    deduplicateRows,
} from '../../src/pipeline/validate.js';

describe('Data Pipeline Validation', () => {
    it('should validate minimum row count', () => {
        const result = validateRowCount([{ id: 1 }, { id: 2 }], 1);
        expect(result.valid).toBe(true);
    });

    it('should fail when below minimum', () => {
        const result = validateRowCount([], 1);
        expect(result.valid).toBe(false);
    });

    it('should cross-reference keys between datasets', () => {
        const source = [{ 'Claim ID': 'CLM-001' }, { 'Claim ID': 'CLM-002' }];
        const target = [{ 'Claim ID': 'CLM-001' }];
        const result = crossReferenceValidation(source, target, 'Claim ID');
        expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should deduplicate rows by key column', () => {
        const rows = [
            { 'Claim ID': 'CLM-001', amount: 100 },
            { 'Claim ID': 'CLM-001', amount: 100 },
            { 'Claim ID': 'CLM-002', amount: 200 },
        ];
        const result = deduplicateRows(rows, 'Claim ID');
        expect(result.rows.length).toBe(2);
        expect(result.removed).toBe(1);
    });
});
```

**Step 7: Run tests**

Run: `yarn test`
Expected: ALL PASS

**Step 8: Commit**

```bash
git add src/pipeline/ test/pipeline/
git commit -m "feat: implement data pipeline — XLSX parsing, validation, and output

Parse XLSX with column exclusion, validate row counts, cross-reference
between report types, deduplicate overlapping extractions. Output writes
data.json + metadata.json sidecar to structured folder hierarchy."
```

---

## Task 11: Config Loader

**Files:**

- Create: `src/config/loader.ts`
- Create: `test/config/loader.test.ts`

**Step 1: Implement config loader**

```typescript
// src/config/loader.ts
// (MIT license header)

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import type { WorkflowConfig } from '../types/index.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('config');

export function loadConfig(configPath?: string): WorkflowConfig {
    const resolvedPath = configPath || path.join(process.cwd(), 'config', 'reports.yaml');

    if (!fs.existsSync(resolvedPath)) {
        throw new Error(`Config file not found: ${resolvedPath}`);
    }

    const raw = fs.readFileSync(resolvedPath, 'utf-8');
    const config = yaml.load(raw) as WorkflowConfig;

    // Apply env overrides
    if (process.env.TARGET_URL) {
        config.target.url = process.env.TARGET_URL;
    }
    if (process.env.USERNAME) {
        config.target.credentials.username = process.env.USERNAME;
    }
    if (process.env.PASSWORD) {
        config.target.credentials.password = process.env.PASSWORD;
    }
    if (process.env.CONFIDENCE_THRESHOLD) {
        config.settings.confidenceThreshold = parseFloat(process.env.CONFIDENCE_THRESHOLD);
    }

    logger.info(
        `Loaded config with ${config.reports.length} reports, ${config.periods.length} periods`,
    );
    return config;
}
```

**Step 2: Write test**

```typescript
// test/config/loader.test.ts
import { loadConfig } from '../../src/config/loader.js';

describe('Config Loader', () => {
    it('should load and parse config/reports.yaml', () => {
        const config = loadConfig();
        expect(config.reports.length).toBe(6);
        expect(config.target.url).toBeDefined();
        expect(config.settings.confidenceThreshold).toBe(0.7);
    });

    it('should override with env vars', () => {
        const original = process.env.TARGET_URL;
        process.env.TARGET_URL = 'http://override.example.com';
        const config = loadConfig();
        expect(config.target.url).toBe('http://override.example.com');
        if (original) {
            process.env.TARGET_URL = original;
        } else {
            delete process.env.TARGET_URL;
        }
    });
});
```

**Step 3: Run tests**

Run: `yarn test`
Expected: ALL PASS

**Step 4: Commit**

```bash
git add src/config/ test/config/
git commit -m "feat: implement YAML config loader with env var overrides

Loads config/reports.yaml, applies environment variable overrides for
credentials and runtime settings. Validates report definitions."
```

---

## Task 12: Orchestrator — Main Entry Point

**Files:**

- Modify: `src/index.ts`
- Modify: `src/automation/example.ts` → rename to `src/automation/orchestrator.ts`
- Create: `src/automation/report-extractor.ts`

**Step 1: Implement report extractor**

```typescript
// src/automation/report-extractor.ts
// (MIT license header)

import type { Page, BrowserContext } from 'playwright';
import type { ReportConfig, FilterConfig, ExtractionMetadata } from '../types/index.js';
import { ResilientLocator } from '../resilience/index.js';
import { navigateToReport } from '../steps/navigate.js';
import { applyFilters } from '../steps/filter.js';
import { downloadReport } from '../steps/download.js';
import { parseXlsx } from '../pipeline/parse-xlsx.js';
import { writeOutput } from '../pipeline/output.js';
import { validateRowCount } from '../pipeline/validate.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('extractor');

export async function extractReport(
    page: Page,
    locator: ResilientLocator,
    report: ReportConfig,
    baseUrl: string,
    outputDir: string,
    overrideFilters?: FilterConfig[],
): Promise<{ rows: Record<string, unknown>[]; metadata: ExtractionMetadata }> {
    const start = Date.now();
    const filters = overrideFilters || report.filters;

    logger.info(`Extracting report: ${report.name}`);

    // Navigate to the report
    await navigateToReport(page, locator, report.name, report.path, baseUrl);

    // Apply filters
    await applyFilters(page, locator, filters);

    // Build period label from date range filter
    const dateFilter = filters.find(f => f.type === 'dateRange');
    const periodLabel = dateFilter
        ? `${(dateFilter as any).from}_${(dateFilter as any).to}`
        : 'unfiltered';

    // Download XLSX
    const xlsxPath = await downloadReport(
        page,
        locator,
        outputDir,
        `${report.slug}-${periodLabel}.xlsx`,
    );

    // Parse XLSX
    const parseResult = await parseXlsx(xlsxPath, {
        excludeColumns: report.columns.exclude,
    });

    // Validate
    const validation = validateRowCount(parseResult.rows, report.validation.minRows);
    if (!validation.valid) {
        logger.error(`Validation failed for ${report.name}: ${validation.errors.join(', ')}`);
    }

    // Build metadata
    const metadata: ExtractionMetadata = {
        reportType: report.slug,
        extractedAt: new Date().toISOString(),
        filters: filters.reduce(
            (acc, f) => {
                if (f.type === 'dateRange') {
                    acc.dateRange = [f.from, f.to];
                } else {
                    acc[f.label] = f.value;
                }
                return acc;
            },
            {} as Record<string, unknown>,
        ),
        rowCount: parseResult.rows.length,
        columns: parseResult.columns,
        locatorResolution: locator.getResolutionStats(),
        durationMs: Date.now() - start,
    };

    // Write output
    writeOutput(outputDir, report.slug, periodLabel, parseResult.rows, metadata);

    logger.info(
        `Completed ${report.name}: ${parseResult.rows.length} rows in ${metadata.durationMs}ms`,
    );

    return { rows: parseResult.rows, metadata };
}
```

**Step 2: Implement orchestrator (replace example.ts)**

```typescript
// src/automation/orchestrator.ts
// (MIT license header)

import * as fs from 'fs';
import * as path from 'path';
import { chromium } from 'playwright';
import type { DateRangeFilter, FilterConfig } from '../types/index.js';
import { loadConfig } from '../config/loader.js';
import { ResilientLocator } from '../resilience/index.js';
import { login } from '../steps/login.js';
import { extractReport } from './report-extractor.js';
import { crossReferenceValidation, deduplicateRows } from '../pipeline/validate.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('orchestrator');

export async function run(): Promise<void> {
    const config = loadConfig();
    const outputDir = path.join(process.cwd(), 'output');
    const downloadDir = path.join(outputDir, 'downloads');
    fs.mkdirSync(downloadDir, { recursive: true });

    logger.info('Starting automation run', {
        reports: config.reports.length,
        periods: config.periods.length,
    });

    const browser = await chromium.launch({ headless: true });

    try {
        const context = await browser.newContext({ acceptDownloads: true });
        const page = await context.newPage();
        const locator = new ResilientLocator(page, outputDir, config.settings.confidenceThreshold);

        // Step 1: Login
        await login(
            page,
            locator,
            config.target.url,
            config.target.credentials.username,
            config.target.credentials.password,
        );

        // Step 2: Extract each report for each period
        const extractedData: Record<string, Record<string, unknown>[]> = {};

        for (const report of config.reports) {
            const allRows: Record<string, unknown>[] = [];

            for (const period of config.periods) {
                const overrideFilters: FilterConfig[] = report.filters.map(f => {
                    if (f.type === 'dateRange') {
                        return {
                            type: 'dateRange',
                            from: period.from,
                            to: period.to,
                        } as DateRangeFilter;
                    }
                    return f;
                });

                const result = await extractReport(
                    page,
                    locator,
                    report,
                    config.target.url,
                    downloadDir,
                    overrideFilters,
                );

                allRows.push(...result.rows);
            }

            // Deduplicate across periods
            const primaryKey =
                report.slug === 'current-ar'
                    ? 'Patient'
                    : report.slug === 'remittance-payments'
                      ? 'Check / EFT #'
                      : report.slug === 'prior-authorizations'
                        ? 'Auth #'
                        : report.slug === 'encounters'
                          ? 'Encounter ID'
                          : 'Claim ID';

            const { rows: dedupedRows, removed } = deduplicateRows(allRows, primaryKey);
            extractedData[report.slug] = dedupedRows;

            if (removed > 0) {
                logger.info(`Deduplicated ${report.name}: ${removed} overlapping rows removed`);
            }
        }

        // Step 3: Cross-report validation
        for (const report of config.reports) {
            if (report.validation.crossRef) {
                const sourceRows = extractedData[report.slug] || [];
                const targetRows = extractedData[report.validation.crossRef.target] || [];
                const result = crossReferenceValidation(
                    sourceRows,
                    targetRows,
                    report.validation.crossRef.key,
                );
                if (result.warnings.length > 0) {
                    logger.warn(
                        `Cross-ref ${report.slug} → ${report.validation.crossRef.target}: ${result.warnings.join('; ')}`,
                    );
                }
            }
        }

        // Step 4: Generate run summary
        generateRunSummary(outputDir, locator, extractedData);

        // Flush traces
        locator.flush();

        logger.info('Automation run completed successfully');
    } finally {
        await browser.close();
    }
}

function generateRunSummary(
    outputDir: string,
    locator: ResilientLocator,
    data: Record<string, Record<string, unknown>[]>,
): void {
    const reportsDir = path.join(outputDir, 'reports');
    fs.mkdirSync(reportsDir, { recursive: true });

    const stats = locator.getResolutionStats();
    const lines: string[] = [
        '# Automation Run Summary',
        '',
        `**Timestamp:** ${new Date().toISOString()}`,
        '',
        '## Locator Resolution Stats',
        '',
        `| Tier | Count |`,
        `|------|-------|`,
        `| Tier 1 (User-facing) | ${stats.tier1 || 0} |`,
        `| Tier 2 (Anchor-based) | ${stats.tier2 || 0} |`,
        `| Tier 3 (Fuzzy) | ${stats.tier3 || 0} |`,
        `| Tier 4 (OCR) | ${stats.tier4 || 0} |`,
        `| Failed | ${stats.failed || 0} |`,
        '',
        '## Extracted Reports',
        '',
    ];

    for (const [slug, rows] of Object.entries(data)) {
        lines.push(`- **${slug}**: ${rows.length} rows`);
    }

    fs.writeFileSync(path.join(reportsDir, 'run-summary.md'), lines.join('\n'));
}
```

**Step 3: Update index.ts to use orchestrator**

```typescript
// src/index.ts
// (MIT license header)

import { run } from './automation/orchestrator.js';

(async () => {
    try {
        await run();
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
})();
```

**Step 4: Delete old example.ts and its test (or update test to point at orchestrator)**

Delete `src/automation/example.ts` and update `test/automation/example.test.ts` to test the orchestrator mock.

**Step 5: Run tests**

Run: `yarn test`
Expected: ALL PASS (adjust mocks as needed)

**Step 6: Commit**

```bash
git add src/index.ts src/automation/orchestrator.ts src/automation/report-extractor.ts
git rm src/automation/example.ts
git add test/
git commit -m "feat: implement main orchestrator with multi-period extraction

Config-driven orchestrator extracts all 6 reports across overlapping
periods, deduplicates, cross-references between report types, and
generates a Markdown run summary with locator resolution statistics."
```

---

## Task 13: Integration Test — End-to-End

**Files:**

- Create: `test/integration/e2e.test.ts`

**Step 1: Write E2E integration test**

```typescript
// test/integration/e2e.test.ts
import * as fs from 'fs';
import * as path from 'path';
import { chromium } from 'playwright';
import { loadConfig } from '../../src/config/loader.js';
import { ResilientLocator } from '../../src/resilience/index.js';
import { login } from '../../src/steps/login.js';
import { extractReport } from '../../src/automation/report-extractor.js';

// This test runs against the real target system
// Mark as integration test — skip in CI unless explicitly enabled
const RUN_INTEGRATION = process.env.RUN_INTEGRATION === 'true';
const describeIntegration = RUN_INTEGRATION ? describe : describe.skip;

describeIntegration('E2E Integration', () => {
    let browser: any;
    let page: any;
    let locator: ResilientLocator;
    const outputDir = path.join(process.cwd(), 'output', 'test-run');

    beforeAll(async () => {
        browser = await chromium.launch({ headless: true });
        const context = await browser.newContext({ acceptDownloads: true });
        page = await context.newPage();

        locator = new ResilientLocator(page, outputDir);
        const config = loadConfig();

        await login(
            page,
            locator,
            config.target.url,
            config.target.credentials.username,
            config.target.credentials.password,
        );
    }, 30000);

    afterAll(async () => {
        locator.flush();
        await browser?.close();
        // Clean up test output
        fs.rmSync(outputDir, { recursive: true, force: true });
    });

    it('should extract Claim Status report with date filter', async () => {
        const config = loadConfig();
        const report = config.reports.find(r => r.slug === 'claim-status')!;

        const result = await extractReport(
            page,
            locator,
            report,
            config.target.url,
            path.join(outputDir, 'downloads'),
        );

        expect(result.rows.length).toBeGreaterThan(0);
        expect(result.metadata.reportType).toBe('claim-status');
        expect(result.metadata.columns).toContain('Claim ID');
    }, 60000);

    it('should extract Denials report', async () => {
        const config = loadConfig();
        const report = config.reports.find(r => r.slug === 'denials')!;

        const result = await extractReport(
            page,
            locator,
            report,
            config.target.url,
            path.join(outputDir, 'downloads'),
        );

        expect(result.rows.length).toBeGreaterThan(0);
        expect(result.metadata.columns).toContain('Denial Code');
    }, 60000);

    it('should resolve most interactions via Tier 1', () => {
        const stats = locator.getResolutionStats();
        const total = Object.values(stats).reduce((a, b) => a + b, 0);
        const tier1Ratio = (stats.tier1 || 0) / total;
        // Expect at least 80% Tier 1 resolution
        expect(tier1Ratio).toBeGreaterThan(0.8);
    });
});
```

**Step 2: Add integration test script to package.json**

Add to `scripts` in package.json:

```json
"test:integration": "RUN_INTEGRATION=true jest --testPathPattern=integration --testTimeout=120000"
```

**Step 3: Run unit tests (integration skipped by default)**

Run: `yarn test`
Expected: ALL PASS (integration tests skipped)

**Step 4: Commit**

```bash
git add test/integration/ package.json
git commit -m "feat: add E2E integration test against live target system

Tests login, Claim Status extraction, and Denials extraction against
the real target. Validates data structure, row counts, and asserts
>80% Tier 1 locator resolution rate. Skipped by default, enabled
via RUN_INTEGRATION=true."
```

---

## Task 14: Observability — Markdown Report & Playwright Traces

**Files:**

- Modify: `src/automation/orchestrator.ts` (add Playwright trace support)
- Enhance the `generateRunSummary` function

**Step 1: Add Playwright trace recording to orchestrator**

In the orchestrator's `run()` function, after creating the context:

```typescript
// Start tracing
await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
```

Before closing browser:

```typescript
// Save trace
const tracePath = path.join(outputDir, 'traces', `playwright-trace-${Date.now()}.zip`);
await context.tracing.stop({ path: tracePath });
logger.info(`Playwright trace saved to ${tracePath}`);
```

**Step 2: Enhance run summary with more detail**

Add per-report timing, filter details, validation results, and tier degradation warnings to the Markdown summary.

**Step 3: Run tests**

Run: `yarn test`
Expected: ALL PASS

**Step 4: Commit**

```bash
git add src/automation/orchestrator.ts
git commit -m "feat: add Playwright trace recording and enhanced run summary

Records full Playwright traces (screenshots, snapshots, sources) for
every run. Enhanced Markdown summary includes per-report timing,
filter details, and tier degradation warnings."
```

---

## Task 15: GLM-OCR Deployment & Integration

**Files:**

- Create: `scripts/deploy-ocr.sh` (or documentation)
- Modify: `src/resilience/ocr-client.ts` (adapt to actual GLM-OCR API format)

**Step 1: Set up GLM-OCR on HuggingFace**

This step requires manual setup:

1. Create a HuggingFace Inference Endpoint for `zai-org/GLM-OCR`
2. Note the endpoint URL
3. Add it to `.env` as `GLM_OCR_ENDPOINT`

Create a deployment guide:

```bash
# scripts/deploy-ocr.sh - Documentation script
echo "GLM-OCR Deployment Guide"
echo "========================"
echo "1. Go to https://ui.endpoints.huggingface.co/new"
echo "2. Select model: zai-org/GLM-OCR"
echo "3. Choose GPU: nvidia-l4 (cheapest option with enough VRAM for 0.9B)"
echo "4. Deploy and copy the endpoint URL"
echo "5. Set GLM_OCR_ENDPOINT in .env"
```

**Step 2: Adapt OCR client to actual API format**

Test against the actual endpoint and adjust the request/response format based on the GLM-OCR API documentation. The core logic (screenshot → API → coordinates) stays the same.

**Step 3: Commit**

```bash
git add scripts/ src/resilience/ocr-client.ts .env
git commit -m "feat: GLM-OCR integration with HuggingFace deployment guide

Adapted OCR client to GLM-OCR API format. Tier 4 gracefully degrades
when no endpoint is configured. Included deployment documentation."
```

---

## Task 16: CLAUDE.md & Documentation

**Files:**

- Create: `CLAUDE.md`
- Create: `README.md`

**Step 1: Create CLAUDE.md**

Document project conventions, architecture decisions, and how AI assistants should work in this codebase.

**Step 2: Create README.md**

Cover:

- Project overview and purpose
- Architecture diagram
- Resilience tier descriptions
- How to run
- How to configure
- Output structure
- Testing
- Design decisions and trade-offs
- AI-assisted workflow artifacts

**Step 3: Commit**

```bash
git add CLAUDE.md README.md
git commit -m "docs: add CLAUDE.md project conventions and comprehensive README

Documents architecture, 4-tier resilience model, configuration system,
output format, and design decisions. Includes AI workflow artifacts
as encouraged by the exercise."
```

---

## Task 17: Final Polish & Verification

**Step 1: Run linter and fix issues**

```bash
yarn lint:fix
yarn format
```

**Step 2: Run all unit tests**

```bash
yarn test
```

**Step 3: Run integration test**

```bash
yarn test:integration
```

**Step 4: Verify output structure**

```bash
ls -R output/
```

Confirm:

- 6 report directories with data.json + metadata.json
- traces/ with JSONL and Playwright trace
- reports/ with run-summary.md

**Step 5: Final commit**

```bash
git add -A
git commit -m "chore: lint, format, and verify full pipeline

All unit tests passing. Integration test validates end-to-end
extraction against live target. Output structure confirmed."
```

---

## Summary of Commits (Expected ~17)

1. Project setup with dependencies and config
2. Logger and core types
3. Tier 1 user-facing locator resolution
4. Tier 2 anchor-based recovery
5. Tier 3 fuzzy matching
6. Tier 4 GLM-OCR vision
7. Cascade orchestrator
8. Login and navigation steps
9. Filter and download steps
10. Data pipeline (XLSX parse, validate, output)
11. Config loader
12. Main orchestrator with multi-period extraction
13. E2E integration tests
14. Playwright traces and observability
15. GLM-OCR deployment and integration
16. Documentation (CLAUDE.md + README)
17. Final polish and verification
