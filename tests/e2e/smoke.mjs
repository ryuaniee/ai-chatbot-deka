/**
 * Browser smoke test for Chatbot Deka.
 * Requires app running at BASE_URL (default http://127.0.0.1:8000).
 *
 *   npm run test:e2e
 */
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const BASE = process.env.BASE_URL ?? 'http://localhost:8000';
const ROOT = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../..',
);
const require = createRequire(import.meta.url);

let chromiumPath = '/usr/bin/chromium';

try {
    // Prefer Playwright's own browser if installed
    const { chromium: pwChromium } = require('playwright');
    void pwChromium;
} catch {
    // ignore
}

const results = [];
const log = (name, ok, detail = '') => {
    results.push({ name, ok, detail });
    console.log(
        `${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`,
    );
};

async function main() {
    const browser = await chromium.launch({
        headless: true,
        executablePath: process.env.CHROMIUM_PATH || chromiumPath,
        args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
    });
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
        await page.fill('input[type="email"]', 'admin@deka.dev');
        await page.fill('input[type="password"]', 'password');
        await page.getByRole('button', { name: /Masuk/i }).click();
        await page.waitForURL(/\/admin/);
        log('admin_login', /\/admin/.test(page.url()), page.url());

        await page.goto(`${BASE}/admin/activity-log`);
        await page.waitForTimeout(800);
        const activityBody = await page.innerText('body');
        log(
            'activity_export_buttons',
            activityBody.includes('Export Excel') &&
                activityBody.includes('Export PDF'),
            'visible export buttons',
        );

        const [popup] = await Promise.all([
            page.waitForEvent('popup'),
            page.getByRole('button', { name: /Export PDF/i }).click(),
        ]);
        await popup.waitForLoadState('domcontentloaded');
        log(
            'export_pdf',
            /activity-log\/report/.test(popup.url()),
            popup.url(),
        );
        await popup.close();

        const [download] = await Promise.all([
            page.waitForEvent('download'),
            page.getByRole('button', { name: /Export Excel/i }).click(),
        ]);
        log(
            'export_excel',
            /laporan-aktivitas-admin/i.test(download.suggestedFilename()),
            download.suggestedFilename(),
        );

        await page.goto(`${BASE}/chat`);
        await page.waitForTimeout(500);
        log(
            'admin_blocked_from_chat',
            !/\/chat$/.test(page.url()) ||
                /Admin|cannot access|403/i.test(await page.innerText('body')),
            page.url(),
        );
    } catch (error) {
        log('fatal', false, String(error));
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
