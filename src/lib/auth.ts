import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { compare } from "bcryptjs";
import { prisma } from "@/lib/prisma";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  trustHost: true,
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
          include: {
            orgMemberships: {
              orderBy: { updatedAt: "desc" },
              take: 1,
            },
          },
        });
        if (!user?.passwordHash) return null;
        const valid = await compare(
          credentials.password as string,
          user.passwordHash,
        );
        if (!valid) return null;
        const latestMembership = user.orgMemberships[0];
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          orgId: latestMembership?.orgId ?? null,
          orgRole: latestMembership?.role ?? null,
        };
      },
    }),
    ...(process.env.GOOGLE_CLIENT_ID
      ? [
          Google({
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
          }),
        ]
      : []),
  ],
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async jwt({ token, user, trigger }) {
      // On first sign-in, seed token from user
      if (user) {
        token.id = user.id;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        token.orgId = (user as any).orgId ?? null;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        token.orgRole = (user as any).orgRole ?? null;
      }

      // On session update or refresh, re-fetch latest org membership
      if (trigger === "update" || (!token.orgId && token.id)) {
        const membership = await prisma.orgMembership.findFirst({
          where: { userId: token.id as string },
          orderBy: { updatedAt: "desc" },
        });
        token.orgId = membership?.orgId ?? null;
        token.orgRole = membership?.role ?? null;
      }

      return token;
    },
    async session({ session, token }) {
      if (token?.id) session.user.id = token.id as string;
      if (token?.orgId) session.user.orgId = token.orgId as string;
      if (token?.orgRole) session.user.orgRole = token.orgRole as string;
      return session;
    },
  },
});
