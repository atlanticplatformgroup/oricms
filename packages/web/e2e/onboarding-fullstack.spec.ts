import { expect, test } from '@playwright/test';

test('first-run onboarding creates an owner and managed project against the real API', async ({ page }) => {
  const projectName = `Full Stack Project ${Date.now()}`;

  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Welcome to OriCMS' })).toBeVisible();
  await page.getByRole('button', { name: 'Begin initialization' }).click();

  await page.getByLabel('First name').fill('Full');
  await page.getByLabel('Last name').fill('Stack');
  await page.getByLabel('Email address').fill(`owner-${Date.now()}@example.com`);
  await page.getByLabel('Secure password').fill('Password123!');
  await page.getByRole('button', { name: 'Create owner account' }).click();

  await expect(page.getByRole('heading', { name: 'Setup your first project' })).toBeVisible();
  await page.getByRole('textbox', { name: 'Project name' }).fill(projectName);
  await page.getByRole('button', { name: 'Launch managed project' }).click();

  await expect(page.getByTestId('section-collections')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId('section-schemas')).toBeVisible();

  const accessToken = await page.evaluate(() => window.localStorage.getItem('accessToken'));
  expect(accessToken).toBeTruthy();
  const projectsResponse = await page.request.get('/api/v1/projects', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  expect(projectsResponse.ok()).toBeTruthy();
  const projectsPayload = await projectsResponse.json();
  expect(projectsPayload.data.projects).toEqual(
    expect.arrayContaining([expect.objectContaining({ name: projectName })]),
  );
});
