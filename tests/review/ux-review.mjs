/* global window, document */
import { chromium, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const out = path.resolve('artifacts/ux-review');
await fs.mkdir(out, { recursive: true });
const axeSource = readFileSync('node_modules/axe-core/axe.min.js', 'utf8');
const browser = await chromium.launch({ headless: true });
const evidence = { date: new Date().toISOString(), url: process.env.REVIEW_URL ?? 'http://127.0.0.1:4185', views: [], interactions: [], findings: [], pageErrors: [] };
const record = (name, detail) => evidence.interactions.push({ name, detail });
const audit = async (page, label) => {
  // Color transitions are intentionally brief; audit the settled theme.
  await page.waitForTimeout(250);
  await page.evaluate(axeSource);
  const result = await page.evaluate(() => window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } }));
  const violations = result.violations.map(v => ({ id: v.id, impact: v.impact, description: v.description, nodes: v.nodes.map(n => ({ html: n.html, summary: n.failureSummary })) }));
  const geometry = await page.evaluate(() => ({ viewport: window.innerWidth, page: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight }));
  evidence.views.push({ label, geometry, violations });
  await page.screenshot({ path: path.join(out, `${label}.png`), fullPage: true });
};

try {
  for (const [name, viewport] of Object.entries({ desktop: { width: 1440, height: 1000 }, mobile390: { width: 390, height: 844 }, mobile320: { width: 320, height: 740 } })) {
    const context = await browser.newContext({ viewport, colorScheme: 'light' });
    const page = await context.newPage();
    page.on('pageerror', e => evidence.pageErrors.push(e.message));
    await page.goto(evidence.url);
    await expect(page.getByText('2/2', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: /Type drift/ }).click();
    for (const lang of ['en', 'ru']) {
      await page.locator('.header-tools select').selectOption(lang);
      for (const theme of ['light', 'dark']) {
        if (await page.locator('html').getAttribute('data-theme') !== theme) await page.locator('.header-tools button').click();
        await audit(page, `${name}-${lang}-${theme}`);
        const expectedLang = await page.locator('html').getAttribute('lang');
        if (expectedLang !== lang) evidence.findings.push({ severity: 'high', name: 'wrong-document-language', nameOfView: name, expectedLang, lang });
      }
    }
    await context.close();
  }

  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, colorScheme: 'light' });
  const page = await context.newPage();
  await page.goto(evidence.url);
  await expect(page.getByText('2/2', { exact: true })).toBeVisible();
  await page.keyboard.press('Tab');
  record('skip-link', await page.evaluate(() => ({ text: document.activeElement.textContent, bounds: document.activeElement.getBoundingClientRect().toJSON() })));
  await page.keyboard.press('Enter');
  record('skip-link-target', await page.evaluate(() => ({ tag: document.activeElement.tagName, id: document.activeElement.id })));
  await page.getByRole('button', { name: /Type drift/ }).click();
  const quantity = page.locator('.issue-card').filter({ has: page.locator('.pointer', { hasText: '/items/0/quantity' }) });
  await expect(quantity).toBeVisible();
  await expect(quantity).toContainText('#/definitions/item/properties/quantity/minimum');
  await quantity.getByRole('button', { name: 'Jump to field' }).click();
  const selection = await page.getByLabel('JSON response', { exact: true }).evaluate(el => ({ focus: el === document.activeElement, start: el.selectionStart, end: el.selectionEnd, selected: el.value.slice(el.selectionStart, el.selectionEnd), scroll: el.scrollTop }));
  record('nested-error-jump', selection);
  expect(selection.selected).toBe('"quantity"');
  await expect(page.getByLabel('JSON response', { exact: true })).toBeFocused();
  await page.getByLabel('JSON Schema', { exact: true }).fill('{"type":"object","required":["missing"]}');
  await expect(page.locator('.pointer', { hasText: '/missing' })).toBeVisible();
  await page.getByRole('button', { name: 'Jump to field' }).click();
  record('missing-field-jump', await page.getByLabel('JSON response', { exact: true }).evaluate(el => ({ selected: el.value.slice(el.selectionStart, el.selectionEnd), start: el.selectionStart, end: el.selectionEnd, focus: el === document.activeElement })));
  await page.getByLabel('JSON response', { exact: true }).fill('{\n "x":\n}');
  await expect(page.locator('.result-banner')).toContainText('JSON syntax error');
  await page.getByRole('button', { name: 'Jump to field' }).click();
  const syntaxSelection = await page.getByLabel('JSON response', { exact: true }).evaluate(el => ({ selected: el.value.slice(el.selectionStart, el.selectionEnd), start: el.selectionStart, end: el.selectionEnd, focus: el === document.activeElement }));
  record('syntax-error-jump', syntaxSelection);
  expect(syntaxSelection.start).toBeGreaterThan(0);
  await page.screenshot({ path: path.join(out, 'desktop-syntax-error.png'), fullPage: true });
  await page.getByRole('button', { name: 'Limits & help' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toBeVisible();
  record('help-dialog-initial-focus', await page.evaluate(() => ({ text: document.activeElement.textContent, label: document.activeElement.getAttribute('aria-label'), tag: document.activeElement.tagName })));
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press('Tab');
    const focus = await page.evaluate(() => ({ tag: document.activeElement.tagName, inDialog: document.activeElement.closest('dialog') !== null, body: document.activeElement === document.body }));
    record(`help-dialog-tab-${i}`, focus);
    // Native modal dialogs may hand focus to browser chrome (activeElement body).
    if (!focus.inDialog && !focus.body) evidence.findings.push({ severity: 'high', name: 'modal-tab-escaped', step: i });
  }
  await audit(page, 'desktop-help-dialog');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Limits & help' })).toBeFocused();
  record('help-dialog-restores-focus', true);
  await page.getByRole('button', { name: 'Clear workspace' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toBeVisible();
  record('clear-dialog-initial-focus', await page.evaluate(() => ({ text: document.activeElement.textContent, label: document.activeElement.getAttribute('aria-label'), tag: document.activeElement.tagName })));
  await page.getByRole('button', { name: 'Keep workspace' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Clear workspace' })).toBeFocused();
  record('clear-dialog-restores-focus', true);
  await page.getByLabel('JSON Schema', { exact: true }).focus();
  await page.keyboard.press('Control+Enter');
  await expect(page.locator('.result-banner')).toContainText('JSON syntax error');
  record('ctrl-enter-rerun', true);
  await page.locator('.header-tools select').selectOption('ru');
  await page.getByRole('button', { name: 'Добавить пример', exact: true }).click();
  await expect(page.getByLabel('Название примера')).toHaveValue('Новый пример 3');
  await page.getByRole('button', { name: 'Дублировать', exact: true }).click();
  record('ru-generated-fixture-name', await page.getByLabel('Название примера').inputValue());
  await page.getByRole('button', { name: 'Ограничения и помощь' }).click();
  await audit(page, 'desktop-ru-help-dialog');
  await page.keyboard.press('Escape');
  await page.locator('.header-tools select').selectOption('en');
  await page.getByLabel('JSON Schema', { exact: true }).fill(JSON.stringify({ type: 'object', properties: { '': { type: 'string' }, 'a/b~c': { type: 'string' } } }));
  await page.getByLabel('JSON response', { exact: true }).fill('{"":42,"a/b~c":43}');
  await expect(page.locator('.issue-card')).toHaveCount(2);
  for (const pointer of ['/', '/a~1b~0c']) {
    const card = page.locator('.issue-card').filter({ has: page.locator('.pointer').filter({ hasText: new RegExp(`^${pointer.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`) }) });
    await card.getByRole('button', { name: 'Jump to field' }).click();
    const selected = await page.getByLabel('JSON response', { exact: true }).evaluate(el => el.value.slice(el.selectionStart, el.selectionEnd));
    record(`escaped-key-${pointer}`, selected);
    expect(selected).toBe(pointer === '/' ? '""' : '"a/b~c"');
  }
  await page.getByLabel('JSON Schema', { exact: true }).fill('{"type":"string"}');
  await page.getByLabel('JSON response', { exact: true }).fill('{}');
  await expect(page.locator('.pointer')).toHaveText('Root');
  await page.getByRole('button', { name: 'Jump to field' }).click();
  const rootSelection = await page.getByLabel('JSON response', { exact: true }).evaluate(el => el.value.slice(el.selectionStart, el.selectionEnd));
  record('root-error-jump', rootSelection);
  expect(rootSelection).toBe('{}');
  await page.setViewportSize({ width: 320, height: 740 });
  await page.getByRole('button', { name: 'Limits & help' }).click();
  await audit(page, 'mobile320-en-help-dialog');
  record('mobile-dialog-scroll', await page.getByRole('dialog').evaluate(el => ({ scrollHeight: el.scrollHeight, clientHeight: el.clientHeight })));
  await page.keyboard.press('Escape');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.evaluate(() => { document.documentElement.style.fontSize = '32px'; });
  await audit(page, 'desktop-en-200percent-text');
  await context.close();
} finally {
  await fs.writeFile(path.join(out, 'evidence.json'), JSON.stringify(evidence, null, 2));
  await browser.close();
}
console.log(JSON.stringify({ views: evidence.views.map(v => ({ label: v.label, overflow: v.geometry.page > v.geometry.viewport, violations: v.violations.map(x => x.id) })), interactions: evidence.interactions, findings: evidence.findings, pageErrors: evidence.pageErrors, directory: out }, null, 2));
