/**
 * Browser smoke test for Chatbot Deka.
 * Requires app running at BASE_URL (default http://127.0.0.1:8000).
 *
 *   npm run test:e2e
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const BASE = process.env.BASE_URL ?? 'http://localhost:8000';
const ROOT = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../..',
);

const launchOptions = {
    headless: true,
    args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
};

if (process.env.CHROMIUM_PATH) {
    launchOptions.executablePath = process.env.CHROMIUM_PATH;
}

const results = [];
const log = (name, ok, detail = '') => {
    results.push({ name, ok, detail });
    console.log(
        `${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`,
    );
};

async function launchBrowser() {
    try {
        return await chromium.launch(launchOptions);
    } catch (error) {
        if (process.env.CHROMIUM_PATH || !existsSync('/usr/bin/chromium')) {
            throw error;
        }

        return chromium.launch({
            ...launchOptions,
            executablePath: '/usr/bin/chromium',
        });
    }
}

async function main() {
    const browser = await launchBrowser();
    const page = await browser.newPage({
        viewport: { width: 1440, height: 900 },
    });
    page.setDefaultTimeout(20000);

    try {
        await page.goto(`${BASE}/`);
        const welcome = await page.innerText('body');
        log(
            'welcome_it_branding',
            !/Coffee|Arts Studio/i.test(welcome) &&
                /DEKA|Solusi AI|layanan IT/i.test(welcome),
            'no coffee branding',
        );

        await page.goto(`${BASE}/login`);
        await page.waitForLoadState('networkidle');
        const loginBody = await page.innerText('body');
        log(
            'login_screen',
            /Masuk ke Deka/i.test(loginBody) &&
                /ALAMAT EMAIL/i.test(loginBody) &&
                /KATA SANDI/i.test(loginBody),
            'visible login form',
        );

        await page.goto(`${BASE}/admin/overview`);
        await page.waitForURL(/\/login/, { timeout: 30000 });
        log('admin_guard_redirect', /\/login/.test(page.url()), page.url());
    } catch (error) {
        const body = await page.innerText('body').catch(() => '');
        const detail = body
            ? `${String(error)} | body: ${body}`
            : String(error);

        log('fatal', false, detail.slice(0, 1200));
    } finally {
        await browser.close();
    }

    const failed = results.filter((r) => !r.ok).length;
    console.log(`\n${results.length - failed}/${results.length} passed`);

    if (failed > 0) {
        process.exit(1);
    }
}

// Ensure playwright package is available
const check = spawnSync('node', ['-e', "require('playwright')"], {
    cwd: ROOT,
    encoding: 'utf8',
});

if (check.status !== 0) {
    console.error('playwright package missing. Run: npm i -D playwright');
    process.exit(1);
}

main();
