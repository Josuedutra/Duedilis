/**
 * Sentry context enrichment — sets org/project/user on the Sentry scope.
 * Task: gov-1775311338439-h1lvf9 (D4-E3-14)
 *
 * IMPORTANT: Never include PII (email, name) in Sentry context.
 * Only opaque IDs are safe.
 */

import * as Sentry from "@sentry/nextjs";

export interface SentryRequestContext {
  orgId?: string;
  projectId?: string;
  userId?: string;
}

/**
 * Enriches the current Sentry scope with request context.
 * Sets only opaque IDs — never email, name, or other PII.
 */
export function setSentryContext(ctx: SentryRequestContext): void {
  Sentry.withScope((scope) => {
    if (ctx.userId) {
      scope.setUser({ id: ctx.userId });
    }

    if (ctx.orgId) {
      scope.setTag("orgId", ctx.orgId);
    }

    if (ctx.projectId) {
      scope.setTag("projectId", ctx.projectId);
    }
  });
}
