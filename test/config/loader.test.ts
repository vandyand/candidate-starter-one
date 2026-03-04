import * as path from 'node:path';
import { loadConfig } from '../../src/config/loader.js';

const CONFIG_PATH = path.resolve(
    __dirname,
    '../../config/reports.yaml',
);

describe('loadConfig', () => {
    // Preserve original env.
    const originalEnv = { ...process.env };

    afterEach(() => {
        process.env = { ...originalEnv };
    });

    it('loads and parses config/reports.yaml correctly', () => {
        const config = loadConfig(CONFIG_PATH);

        expect(config.target.url).toBe(
            'https://automation-target-one.engineering.lockboxai.com',
        );
        expect(config.reports).toHaveLength(6);
        expect(config.reports[0].slug).toBe('claim-status');
        expect(config.periods).toHaveLength(2);
        expect(config.settings.confidenceThreshold).toBe(0.7);
        expect(config.settings.maxRetries).toBe(3);
    });

    it('applies environment variable overrides', () => {
        process.env.TARGET_URL = 'https://override.example.com';
        process.env.USERNAME = 'env-user';
        process.env.PASSWORD = 'env-pass';
        process.env.CONFIDENCE_THRESHOLD = '0.95';

        const config = loadConfig(CONFIG_PATH);

        expect(config.target.url).toBe('https://override.example.com');
        expect(config.target.credentials.username).toBe('env-user');
        expect(config.target.credentials.password).toBe('env-pass');
        expect(config.settings.confidenceThreshold).toBe(0.95);
    });
});
