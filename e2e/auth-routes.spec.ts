import { expect, test } from "@playwright/test";

const testEmail =
  process.env.PLAYWRIGHT_TEST_EMAIL ?? "testuser123@gmail.com";
const testPassword = process.env.PLAYWRIGHT_TEST_PASSWORD;

test("direct nested sign-in path renders Clerk UI instead of the app 404", async ({
  page,
}) => {
  await page.goto("/sign-in/factor-one");

  await expect(page.getByText("Customer access")).toBeVisible();
  await expect(
    page.getByText("This garment ticket does not exist."),
  ).toHaveCount(0);
});

test("credential flow stays inside Clerk auth and never falls into app not-found", async ({
  page,
}) => {
  test.skip(
    !testPassword,
    "PLAYWRIGHT_TEST_PASSWORD is required for the live credential flow.",
  );

  await page.goto("/sign-in");

  await page.getByLabel("Email address").fill(testEmail);
  await page.locator('input[name="password"]').fill(testPassword!);
  await page.getByRole("button", { name: "Continue", exact: true }).click();

  await expect(
    page.getByText("This garment ticket does not exist."),
  ).toHaveCount(0);

  await expect
    .poll(async () => page.url())
    .toContain("/customer/orders");

  await expect(
    page.getByRole("heading", {
      name: "A live view of every booking in the customer slice.",
    }),
  ).toBeVisible();

  await page.getByRole("link", { name: "Payments" }).click();

  await expect(
    page.getByRole("heading", {
      name: "Every Stripe-backed checkout, grounded in order history.",
    }),
  ).toBeVisible();
});
