import NextAuth, { type DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import LinkedIn from "next-auth/providers/linkedin";
import { PrismaAdapter } from "@auth/prisma-adapter";
import argon2 from "argon2";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { env, features } from "@/lib/env";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      role: "prospect" | "client" | "staff" | "partner";
      fullName: string;
    } & DefaultSession["user"];
  }
}

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(200),
});

const providers = [
  Credentials({
    name: "Credentials",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
    },
    async authorize(raw) {
      const parsed = credentialsSchema.safeParse(raw);
      if (!parsed.success) return null;
      const user = await prisma.user.findUnique({ where: { email: parsed.data.email.toLowerCase() } });
      if (!user || !user.passwordHash) return null;
      if (user.deactivatedAt) return null;
      const ok = await argon2.verify(user.passwordHash, parsed.data.password);
      if (!ok) return null;
      if (!user.emailVerified) {
        // We deliberately don't leak the difference between "wrong password" and
        // "unverified" — callers should hit /api/auth/resend-verification.
        throw new Error("EMAIL_NOT_VERIFIED");
      }
      return {
        id: user.id,
        email: user.email,
        name: user.fullName,
        role: user.role,
      } as never;
    },
  }),
];

if (features.googleOAuth) {
  providers.push(
    Google({
      clientId: env().GOOGLE_CLIENT_ID!,
      clientSecret: env().GOOGLE_CLIENT_SECRET!,
    }) as never,
  );
}

if (features.linkedinOAuth) {
  providers.push(
    LinkedIn({
      clientId: env().LINKEDIN_CLIENT_ID!,
      clientSecret: env().LINKEDIN_CLIENT_SECRET!,
    }) as never,
  );
}

export const { auth, handlers, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 7 }, // 7 days
  providers,
  pages: {
    signIn: "/login",
    error: "/login",
    verifyRequest: "/verify-sent",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.uid = (user as { id: string }).id;
        token.role = (user as { role: string }).role;
        token.fullName = (user as { name?: string }).name;
        token.email = (user as { email?: string }).email ?? token.email;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.uid as string;
        session.user.role = token.role as "prospect" | "client" | "staff" | "partner";
        session.user.fullName = (token.fullName as string) ?? session.user.name ?? "";
      }
      return session;
    },
  },
  trustHost: true,
});
