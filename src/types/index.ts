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

import type { Locator } from 'playwright';

// ---------------------------------------------------------------------------
// Locator types
// ---------------------------------------------------------------------------

/** Which resilience tier resolved the element (1 = best, 4 = fallback). */
export type ResilienceTier = 1 | 2 | 3 | 4;

/** The result returned after the locator cascade resolves an element. */
export interface LocatorResult {
    element: Locator;
    tier: ResilienceTier;
    confidence: number;
    strategy: string;
    latencyMs: number;
    alternatives: Locator[];
}

/** Tier 1 — semantic / accessibility-based locator spec. */
export interface Tier1Spec {
    role?: string;
    text?: string;
    label?: string;
    testId?: string;
}

/** Tier 2 — anchor-relative locator spec. */
export interface Tier2Spec {
    anchor: LocatorSpec;
    relationship: 'near' | 'above' | 'below' | 'leftOf' | 'rightOf' | 'within';
    target?: Partial<Tier1Spec>;
}

/** Tier 3 — fuzzy / attribute-based locator spec. */
export interface Tier3Spec {
    tag?: string;
    attributes?: Record<string, string>;
    visibleText?: string;
    minConfidence?: number;
}

/** Tier 4 — GLM-OCR visual search spec. */
export interface Tier4Spec {
    searchText: string;
    region?: { x: number; y: number; width: number; height: number };
}

/** Unified locator spec passed into the cascade. */
export interface LocatorSpec {
    description: string;
    tier1?: Tier1Spec;
    tier2?: Tier2Spec;
    tier3?: Tier3Spec;
    tier4?: Tier4Spec;
}

// ---------------------------------------------------------------------------
// Config types
// ---------------------------------------------------------------------------

/** A date-range filter applied to a report. */
export interface DateRangeFilter {
    type: 'dateRange';
    from: string;
    to: string;
}

/** A dropdown filter applied to a report. */
export interface DropdownFilter {
    type: 'dropdown';
    label: string;
    value: string;
}

/** Discriminated union of all filter types. */
export type FilterConfig = DateRangeFilter | DropdownFilter;

/** Validation constraints for a report extraction. */
export interface ReportValidation {
    minRows: number;
    crossRef?: {
        target: string;
        key: string;
    };
}

/** Configuration for a single report to extract. */
export interface ReportConfig {
    name: string;
    slug: string;
    path: string;
    filters: FilterConfig[];
    columns: {
        exclude: string[];
    };
    validation: ReportValidation;
}

/** A date-range period used for multi-period extraction. */
export interface PeriodConfig {
    from: string;
    to: string;
}

/** Global workflow settings. */
export interface WorkflowSettings {
    confidenceThreshold: number;
    screenshotOnDegradation: boolean;
    maxRetries: number;
    downloadTimeoutMs: number;
}

/** Top-level workflow configuration (mirrors config/reports.yaml). */
export interface WorkflowConfig {
    target: {
        url: string;
        credentials: {
            username: string;
            password: string;
        };
    };
    reports: ReportConfig[];
    periods: PeriodConfig[];
    settings: WorkflowSettings;
}

// ---------------------------------------------------------------------------
// Data pipeline types
// ---------------------------------------------------------------------------

/** Deduplication stats optionally attached to extraction metadata. */
export interface DeduplicationInfo {
    duplicatesRemoved: number;
    key: string;
}

/** Metadata about a single report extraction run. */
export interface ExtractionMetadata {
    reportType: string;
    extractedAt: string;
    filters: FilterConfig[];
    rowCount: number;
    columns: string[];
    locatorResolution: Record<string, { tier: ResilienceTier; confidence: number }>;
    durationMs: number;
    deduplication?: DeduplicationInfo;
}

// ---------------------------------------------------------------------------
// Observability types
// ---------------------------------------------------------------------------

/** A single trace event emitted during automation. */
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

/** Aggregated health metrics for a single locator spec. */
export interface LocatorHealth {
    description: string;
    totalAttempts: number;
    tierSuccesses: Record<ResilienceTier, number>;
    tierFailures: Record<ResilienceTier, number>;
    averageConfidence: number;
    lastUsed: string;
}
