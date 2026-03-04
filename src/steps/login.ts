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

import type { Page } from 'playwright';
import type { ResilientLocator } from '../resilience/index.js';
import { createLogger } from '../utils/logger.js';
import { loginSpecs } from './locator-specs.js';

const logger = createLogger('LoginStep');

/**
 * Logs in to the target application by filling username/password and clicking
 * Sign In. Throws if any required element cannot be resolved.
 */
export async function login(
    page: Page,
    locator: ResilientLocator,
    baseUrl: string,
    username: string,
    password: string,
): Promise<void> {
    logger.info('Navigating to login page', { url: `${baseUrl}/login` });
    await page.goto(`${baseUrl}/login`);
    await page.waitForLoadState('networkidle');

    // Resolve and fill the username field
    const usernameResult = await locator.resolve(loginSpecs.usernameField);
    if (usernameResult === null) {
        throw new Error('Failed to resolve username field');
    }
    await usernameResult.element.fill(username);

    // Resolve and fill the password field
    const passwordResult = await locator.resolve(loginSpecs.passwordField);
    if (passwordResult === null) {
        throw new Error('Failed to resolve password field');
    }
    await passwordResult.element.fill(password);

    // Resolve and click the Sign In button
    const signInResult = await locator.resolve(loginSpecs.signInButton);
    if (signInResult === null) {
        throw new Error('Failed to resolve Sign In button');
    }
    await signInResult.element.click();

    // Wait for navigation away from the login page
    await page.waitForURL((url) => !url.pathname.includes('/login'), {
        timeout: 10_000,
    });

    logger.info('Login successful');
}
