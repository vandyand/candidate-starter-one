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

  globalIgnores([
    'node_modules/**',
    'dist/**',
    '**/*.js',
    '**/*.d.ts',
    '!eslint.config.mjs',
  ]),

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
