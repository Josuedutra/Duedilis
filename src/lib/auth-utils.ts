import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export type CurrentUser = {
  userId: string;
  email: string | null;
  name: string | null;
  orgId: string | null;
  orgRole: string | null;
};

/**
 * Returns the current authenticated user from the JWT session.
 * Redirects to /login if not authenticated.
 */
export async function getCurrentUser(): Promise<CurrentUser> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return {
    userId: session.user.id,
    email: session.user.email ?? null,
    name: session.user.name ?? null,
    orgId: session.user.orgId ?? null,
    orgRole: session.user.orgRole ?? null,
  };
}

/**
 * Returns the current session without redirecting.
 * Returns null if not authenticated.
 */
export async function getOptionalUser(): Promise<CurrentUser | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  return {
    userId: session.user.id,
    email: session.user.email ?? null,
    name: session.user.name ?? null,
    orgId: session.user.orgId ?? null,
    orgRole: session.user.orgRole ?? null,
  };
}
