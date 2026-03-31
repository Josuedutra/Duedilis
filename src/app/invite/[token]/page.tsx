import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { AcceptInviteClient } from "./accept-client";
import Link from "next/link";

interface Props {
  params: Promise<{ token: string }>;
}

export default async function InvitePage({ params }: Props) {
  const { token } = await params;
  const session = await auth();

  const invite = await prisma.orgInvite.findUnique({
    where: { token },
    include: { org: { select: { name: true } } },
  });

  if (!invite) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-sm w-full bg-white rounded-2xl border shadow-sm p-8 text-center">
          <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-6 h-6 text-red-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </div>
          <h1 className="text-lg font-semibold text-gray-900 mb-2">
            Convite inválido
          </h1>
          <p className="text-sm text-gray-500 mb-6">
            Este link de convite não existe ou foi revogado.
          </p>
          <Link href="/" className="text-sm text-blue-600 hover:underline">
            Ir para o início
          </Link>
        </div>
      </div>
    );
  }

  if (invite.acceptedAt) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-sm w-full bg-white rounded-2xl border shadow-sm p-8 text-center">
          <div className="w-12 h-12 rounded-full bg-yellow-100 flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-6 h-6 text-yellow-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h1 className="text-lg font-semibold text-gray-900 mb-2">
            Convite já utilizado
          </h1>
          <p className="text-sm text-gray-500 mb-6">
            Este convite já foi aceite anteriormente.
          </p>
          <Link href="/" className="text-sm text-blue-600 hover:underline">
            Aceder ao dashboard
          </Link>
        </div>
      </div>
    );
  }

  if (invite.expiresAt < new Date()) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-sm w-full bg-white rounded-2xl border shadow-sm p-8 text-center">
          <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-6 h-6 text-gray-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h1 className="text-lg font-semibold text-gray-900 mb-2">
            Convite expirado
          </h1>
          <p className="text-sm text-gray-500 mb-6">
            Este convite expirou. Solicite um novo convite ao administrador da
            organização.
          </p>
          <Link href="/" className="text-sm text-blue-600 hover:underline">
            Ir para o início
          </Link>
        </div>
      </div>
    );
  }

  return (
    <AcceptInviteClient
      token={token}
      orgName={invite.org.name}
      inviteEmail={invite.email}
      isAuthenticated={!!session?.user?.id}
      currentUserEmail={session?.user?.email ?? null}
    />
  );
}
