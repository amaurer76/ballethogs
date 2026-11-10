import { test, expect } from '@playwright/test';
test('ten-note dance scrolls the meadow, wins, and resets', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('#timer')).toHaveText('Play do to start');
  await page.locator('#listen').click();
  for (let i = 0; i < 10; i++) {
    await expect(page.locator('.target')).toBeEnabled();
    await page.locator('.target').click();
    await expect(page.locator('#progress')).toHaveText(`${i + 1} / 10 notes`);
  }
  await expect(page.locator('#result-title')).toHaveText('Take a bow.');
  await expect(page.locator('.scenery-track')).toHaveCSS('animation-play-state', 'paused');
  await page.locator('#play-again').click();
  await expect(page.locator('#progress')).toHaveText('0 / 10 notes');
  await expect(page.locator('#timer')).toHaveText('Play do to start');
  await expect(page.locator('.scenery-track')).toHaveCSS('animation-play-state', 'running');
  expect(errors).toEqual([]);
});
test('wrong notes trigger stumble, fall and a swarm over the dancer', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('f');
  await expect(page.locator('#dancer')).toHaveClass(/stumble/);
  await page.keyboard.press('g');
  await expect(page.locator('#dancer')).toHaveClass(/falling/);
  await page.keyboard.press('h');
  await expect(page.locator('#result-title')).toHaveText('Dinner is served.');
  await expect(page.locator('.lives')).toHaveAttribute('aria-label', '0 chances remaining');
  const layers = await page.evaluate(() => [getComputedStyle(document.querySelector('.swarm')).zIndex, getComputedStyle(document.querySelector('.dancer-position')).zIndex]);
  expect(Number(layers[0])).toBeGreaterThan(Number(layers[1]));
});
test('five-second deadline, replay does not extend time, and reset cancels pending notes', async ({ page }) => {
  await page.clock.install();
  await page.goto('/');
  await page.clock.runFor(6000);
  await expect(page.locator('.lives')).toHaveAttribute('aria-label', '3 chances remaining');
  await page.locator('[data-note="C4"]').click();
  await page.clock.runFor(1000);
  await expect(page.locator('#listen')).toBeEnabled();
  await page.clock.runFor(3000);
  await page.locator('#listen').click();
  await page.clock.runFor(2100);
  await expect(page.locator('.lives')).toHaveAttribute('aria-label', '2 chances remaining');
  await page.locator('#reset').click();
  await page.locator('[data-note="C4"]').click();
  await page.locator('#reset').click();
  await page.clock.runFor(20000);
  await expect(page.locator('#progress')).toHaveText('0 / 10 notes');
  await expect(page.locator('.lives')).toHaveAttribute('aria-label', '3 chances remaining');
});
test('phone layout and hidden hints', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.locator('#hints').uncheck();
  await expect(page.locator('.target')).toHaveCount(0);
  await page.screenshot({ path: 'test-results/mobile.png', fullPage: true });
});

test('scenery and dance continue without input; key reactions are temporary', async ({ page }) => {
  await page.goto('/');
  const track = page.locator('.scenery-track');
  const before = await track.evaluate(el => getComputedStyle(el).transform);
  await page.waitForTimeout(400);
  expect(await track.evaluate(el => getComputedStyle(el).transform)).not.toBe(before);
  await expect(page.locator('.figure')).toHaveCSS('animation-name', 'dance-stride');
  await page.keyboard.press('f');
  await expect(page.locator('#dancer')).toHaveClass(/stumble/);
  await expect(page.locator('#dancer')).not.toHaveClass(/stumble/);
  await expect(track).toHaveCSS('animation-play-state', 'running');
  await page.keyboard.press('a');
  await expect(page.locator('#dancer')).toHaveClass(/hop/);
  await expect(page.locator('#dancer')).not.toHaveClass(/hop/);
  await expect(track).toHaveCSS('animation-play-state', 'running');
});
