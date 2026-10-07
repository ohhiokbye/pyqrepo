// Optional browser checks: run against the isolated dev server via validate-local.py.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';

assert.equal(new URL(process.env.DATABASE_URL).pathname, '/cpyq_notes_validation');
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || '/tmp/cpyq-browser/node_modules/playwright/index.mjs');
const prisma = new PrismaClient();
const course = await prisma.course.create({ data: { code: `BROWSER${randomUUID().slice(0, 6)}`, title: 'Browser validation algorithms', credits: 0 } });
let browser;
try {
  browser = await chromium.launch({ executablePath: process.env.BROWSER_EXECUTABLE || '/usr/bin/google-chrome-stable', headless: true, args: ['--no-sandbox'] });
  for (const width of [375, 1280]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.route('**/api/auth/session', (route) => route.fulfill({ json: { authenticated: true, session: { email: 'browser@example.com', isAdmin: true } } }));
    let sent;
    await page.route('**/api/tutor/chat', (route) => {
      sent = route.request().postDataJSON();
      return route.fulfill({ json: { reply: 'Start with hashing collisions. See your notes [1].', sources: [{ id: 'note', source: 1, kind: 'notes', label: 'Lecture · p. 2', url: '/api/files/uploads/submissions/fixture.pdf#page=2' }], revision: { minutes: sent.minutes, paperCount: 4, status: 'available', topics: [{ topicId: 'hashing', topic: 'Hashing', module: 'Algorithms', matchingPapers: 3, allocatedMarks: 15 }] } } });
    });
    await page.goto(`http://127.0.0.1:3100/?courseCode=${course.code}`);
    await page.getByRole('button', { name: /Key required/ }).click();
    await page.locator('#api-key-input').fill('browser-fixture-key');
    await page.getByRole('button', { name: 'Save for this page' }).click();
    await page.getByRole('button', { name: 'Prioritize revision', exact: true }).click();
    await page.getByLabel('Available minutes').fill('60');
    await page.getByRole('button', { name: 'Send question' }).click();
    await page.getByLabel('Historical revision evidence').waitFor();
    assert.equal(sent.intent, 'revision'); assert.equal(sent.minutes, 60); assert.equal(sent.apiKey, 'browser-fixture-key');
    assert.equal(await page.getByRole('link', { name: '1', exact: true }).getAttribute('href'), '/api/files/uploads/submissions/fixture.pdf#page=2');
    await page.getByLabel('Ask your tutor').fill('Explain chaining');
    await page.getByLabel('Ask your tutor').press('Enter');
    await page.waitForFunction(() => document.querySelectorAll('.tutor-assistant-message').length === 2);
    assert.equal(sent.apiKey, 'browser-fixture-key');
    assert.equal(await page.evaluate(() => Object.keys(localStorage).some((key) => /api|student_ai_key/.test(key))), false);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.reload();
    await page.getByRole('button', { name: /Key required/ }).waitFor();
    await page.goto('http://127.0.0.1:3100/upload');
    await page.getByLabel('Document type').selectOption('STUDY_MATERIAL');
    await page.getByLabel('Notes title').fill('Hashing answer key');
    await page.getByLabel('Course', { exact: true }).selectOption(course.id);
    await page.route('**/api/upload/init', (route) => route.fulfill({ json: { url: '/api/local-upload?key=uploads/submissions/fixture.pdf', s3Key: 'uploads/submissions/fixture.pdf', uploadToken: 'fixture' } }));
    await page.route('**/api/local-upload?**', (route) => route.fulfill({ json: { success: true } }));
    let metadata;
    await page.route('**/api/upload/finalize', (route) => { metadata = route.request().postDataJSON(); return route.fulfill({ json: { success: true, jobId: 'fixture-job' } }); });
    await page.getByLabel('English PDF (up to 25 MB)').setInputFiles({ name: 'notes.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 fixture') });
    await page.getByRole('button', { name: 'Upload PDF' }).click();
    await page.getByText(/Queued successfully/).waitFor({ timeout: 10_000 }).catch(async () => assert.fail(JSON.stringify(await page.getByRole('status').allTextContents())));
    assert.equal(metadata.documentType, 'STUDY_MATERIAL'); assert.equal(metadata.title, 'Hashing answer key');
    assert.equal(errors.length, 0, errors.join('\n'));
    console.log(`Browser ${width}px: notes upload, revision, citations, consecutive messages, refresh and layout passed (provider/session mocked).`);
    await context.close();
  }
} finally {
  await browser?.close();
  await prisma.course.delete({ where: { id: course.id } });
  await prisma.$disconnect();
}
