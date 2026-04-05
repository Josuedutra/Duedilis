/**
 * MSW handler stubs for Stripe (webhook signature validation)
 *
 * NOTE: MSW (msw) is not yet installed in this project.
 * These are handler definitions that can be activated once msw is added as a dependency.
 * To install: pnpm add -D msw
 *
 * Pattern: validates Stripe-Signature header presence and format.
 * Used to test webhook endpoint without real Stripe secrets.
 *
 * TODO: Add `msw` package and replace stubs with real HttpResponse handlers.
 */

// Stripe mock stub — defines the shape for future MSW integration
export const stripeHandlers = {
  /**
   * Mock: Stripe webhook with valid signature
   * Simulates a successful webhook event (e.g., checkout.session.completed)
   */
  validWebhook: {
    url: "/api/webhooks/stripe",
    method: "POST",
    headers: {
      "stripe-signature":
        "t=1234567890,v1=abc123def456abc123def456abc123def456abc123def456abc123def456abc12",
    },
    body: JSON.stringify({
      type: "checkout.session.completed",
      data: { object: { id: "cs_test_1" } },
    }),
  },

  /**
   * Mock: Stripe webhook with invalid/missing signature
   * Should result in 400 response from webhook handler
   */
  invalidSignature: {
    url: "/api/webhooks/stripe",
    method: "POST",
    headers: {
      "stripe-signature": "t=0,v1=invalidsignature",
    },
    body: JSON.stringify({
      type: "checkout.session.completed",
      data: { object: { id: "cs_test_bad" } },
    }),
  },

  /**
   * Mock: Stripe webhook with no signature header
   * Should result in 400 response from webhook handler
   */
  missingSignature: {
    url: "/api/webhooks/stripe",
    method: "POST",
    headers: {},
    body: JSON.stringify({ type: "payment_intent.succeeded" }),
  },
};
