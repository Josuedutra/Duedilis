"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { acceptInvite } from "@/lib/actions/membership-actions";

interface Props {
  token: string;
  orgName: string;
  inviteEmail: string;
  isAuthenticated: boolean;
  currentUserEmail: string | null;
}

export function AcceptInviteClient({
  token,
  orgName,
  inviteEmail,
  isAuthenticated,
  currentUserEmail,
}: Props) {
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const router = useRouter();

  function handleAccept() {
    setError(null);
    startTransition(async () => {
      const result = await acceptInvite(token);
      if (result.error === "not_authenticated") {
        router.push(`/login?callbackUrl=/invite/${token}`);
      } else if (result.error) {
        setError(result.error);
      } else {
        router.push("/");
      }
    });
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-sm w-full bg-white rounded-2xl border shadow-sm p-8 text-center">
        <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-4">
          <svg
            className="w-6 h-6 text-blue-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
        </div>

        <h1 className="text-xl font-bold text-gray-900 mb-1">
          Convite para {orgName}
        </h1>
        <p className="text-sm text-gray-500 mb-2">
          Foste convidado para juntar-te à organização{" "}
          <span className="font-medium text-gray-700">{orgName}</span>.
        </p>
        <p className="text-xs text-gray-400 mb-6">
          Convite para: {inviteEmail}
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 text-left">
            {error}
          </div>
        )}

        {isAuthenticated && currentUserEmail !== inviteEmail && (
          <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800 text-left">
            Atenção: estás com sessão como <strong>{currentUserEmail}</strong>,
            mas este convite é para <strong>{inviteEmail}</strong>.
          </div>
        )}

        {isAuthenticated ? (
          <button
            onClick={handleAccept}
            className="w-full px-4 py-3 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition-colors"
          >
            Aceitar convite
          </button>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              Para aceitar, inicia sessão ou cria uma conta.
            </p>
            <Link
              href={`/login?callbackUrl=/invite/${token}`}
              className="block w-full px-4 py-3 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition-colors text-center"
            >
              Iniciar sessão
            </Link>
            <Link
              href={`/register?callbackUrl=/invite/${token}`}
              className="block w-full px-4 py-3 border text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-colors text-center"
            >
              Criar conta
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
