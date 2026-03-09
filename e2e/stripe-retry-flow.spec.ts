import { expect, test, type Locator, type Page } from '@playwright/test';

const testEmail = process.env.PLAYWRIGHT_TEST_EMAIL ?? 'testuser123@gmail.com';
const testPassword = process.env.PLAYWRIGHT_TEST_PASSWORD;
const pendingOrderId = process.env.PLAYWRIGHT_PENDING_ORDER_ID;
const runStripeRetryFlow = process.env.PLAYWRIGHT_ENABLE_STRIPE_RETRY_E2E === '1';

async function signIn(page: Page) {
    await page.goto('/sign-in');

    await page.getByLabel('Email address').fill(testEmail);
    await page.locator('input[name="password"]').fill(testPassword!);
    await page.getByRole('button', { name: 'Continue', exact: true }).click();

    await expect.poll(async () => page.url()).toContain('/customer/orders');
}

async function selectFirstAvailableOption(select: Locator) {
    const optionCount = await select.locator('option').count();

    for (let index = 1; index < optionCount; index += 1) {
        const option = select.locator('option').nth(index);
        const value = await option.getAttribute('value');

        if (value) {
            await select.selectOption(value);
            return;
        }
    }
}

test('stripe decline cancels the order, then reorder opens a fresh successful checkout', async ({ page }) => {
    test.skip(
        !runStripeRetryFlow || !testPassword || !pendingOrderId,
        'Set PLAYWRIGHT_ENABLE_STRIPE_RETRY_E2E=1, PLAYWRIGHT_TEST_PASSWORD, and PLAYWRIGHT_PENDING_ORDER_ID to run this live Stripe retry flow.'
    );

    await signIn(page);
    await page.goto(`/customer/orders/${pendingOrderId}`);

    await page.getByRole('button', { name: 'Continue to secure checkout' }).click();
    await expect.poll(async () => page.url()).toContain('checkout.stripe.com');

    await page.getByLabel('Card number').fill('4000000000000002');
    await page.getByLabel('Expiration date').fill('1234');
    await page.getByLabel('Security code').fill('123');

    const postalCode = page.getByLabel('Postal code');
    if (await postalCode.count()) {
        await postalCode.fill('12345');
    }

    await page.getByRole('button', { name: /pay/i }).click();
    await expect(page.getByText(/declined|failed|insufficient/i)).toBeVisible();

    await page.goto(`/customer/orders/${pendingOrderId}`);
    await expect(page.getByText(/failed payment|cancelled this order|reorder/i)).toBeVisible();
    await expect(page.getByRole('link', { name: 'Reorder from these details' })).toBeVisible();

    await page.getByRole('link', { name: 'Reorder from these details' }).click();
    await expect.poll(async () => page.url()).toContain(`/customer/new-order?reorderFrom=${pendingOrderId}`);
    await expect(page.getByText('Reorder draft')).toBeVisible();

    const dropoffSelect = page.locator('select[name="dropoffSlotId"]');
    if ((await dropoffSelect.inputValue()) === '') {
        await selectFirstAvailableOption(dropoffSelect);
    }

    const deliverySelect = page.locator('select[name="deliverySlotId"]');
    if ((await deliverySelect.inputValue()) === '') {
        await selectFirstAvailableOption(deliverySelect);
    }

    await page.getByRole('button', { name: 'Reserve and continue' }).click();
    await expect.poll(async () => page.url()).toContain('checkout.stripe.com');

    await page.getByLabel('Card number').fill('4242424242424242');
    await page.getByLabel('Expiration date').fill('1234');
    await page.getByLabel('Security code').fill('123');
    if (await postalCode.count()) {
        await postalCode.fill('12345');
    }

    await page.getByRole('button', { name: /pay/i }).click();
    await expect.poll(async () => page.url()).toContain('/customer/orders/');

    await expect(page.getByRole('heading', { name: 'Stripe checkout' })).toBeVisible();

    await expect(page.getByText(/Payment confirmed|Waiting for Stripe confirmation/i)).toBeVisible();

    await expect(page.getByText('Checkout cancelled')).toHaveCount(0);
});
