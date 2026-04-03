/**
 * MSW handler stubs for Resend (email dispatch)
 *
 * NOTE: MSW (msw) is not yet installed in this project.
 * These are handler definitions that can be activated once msw is added as a dependency.
 * To install: pnpm add -D msw
 *
 * Pattern: mocks Resend email API responses for testing email notifications
 * without making real API calls.
 *
 * TODO: Add `msw` package and replace stubs with real HttpResponse handlers.
 */

// Resend mock stub — defines shape for future MSW integration
export const resendHandlers = {
  /**
   * Mock: Successful email dispatch
   * Returns Resend API success response with email ID
   */
  success: {
    url: "https://api.resend.com/emails",
    method: "POST",
    response: {
      status: 200,
      body: { id: "email_test_1", from: "noreply@duedilis.com" },
    },
  },

  /**
   * Mock: Resend rate limit response (429)
   * Should trigger retry logic in email service
   */
  rateLimit: {
    url: "https://api.resend.com/emails",
    method: "POST",
    response: {
      status: 429,
      headers: { "Retry-After": "60" },
      body: {
        name: "rate_limit_exceeded",
        message: "Too many requests. Try again in 60 seconds.",
      },
    },
  },

  /**
   * Mock: Resend server error (500)
   * Should mark notification as FAILED in outbox
   */
  serverError: {
    url: "https://api.resend.com/emails",
    method: "POST",
    response: {
      status: 500,
      body: { name: "internal_server_error", message: "An error occurred" },
    },
  },

  /**
   * Mock: Resend invalid API key (401)
   * Should propagate as auth error in notification service
   */
  unauthorized: {
    url: "https://api.resend.com/emails",
    method: "POST",
    response: {
      status: 401,
      body: { name: "missing_api_key", message: "Missing API key" },
    },
  },
};
