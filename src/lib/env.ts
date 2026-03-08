const clerkPublishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY ?? "";
const convexUrl = import.meta.env.VITE_CONVEX_URL ?? "";

export const env = {
  clerkPublishableKey,
  convexUrl,
  isConfigured: Boolean(clerkPublishableKey && convexUrl),
  missingKeys: [
    !clerkPublishableKey ? "VITE_CLERK_PUBLISHABLE_KEY" : null,
    !convexUrl ? "VITE_CONVEX_URL" : null,
  ].filter(Boolean) as string[],
};
