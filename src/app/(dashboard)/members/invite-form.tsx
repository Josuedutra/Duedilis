"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  inviteOrgMember,
  type InviteFormState,
} from "@/lib/actions/membership-actions";
import { useState } from "react";

const ROLES = [
  { value: "OBSERVADOR", label: "Observador" },
  { value: "TECNICO", label: "Técnico" },
  { value: "FISCAL", label: "Fiscal" },
  { value: "AUDITOR", label: "Auditor" },
  { value: "GESTOR_PROJETO", label: "Gestor de Projeto" },
  { value: "ADMIN_ORG", label: "Admin" },
];

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    >
      {pending ? "A enviar..." : "Enviar convite"}
    </button>
  );
}

export function InviteMemberForm() {
  const [state, formAction] = useActionState<InviteFormState, FormData>(
    inviteOrgMember,
    {},
  );
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    if (!state.inviteLink) return;
    await navigator.clipboard.writeText(state.inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="bg-white rounded-xl border p-5">
      {state.inviteLink ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
            <svg
              className="w-5 h-5 text-green-600 shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <p className="text-sm text-green-800">
              Convite criado com sucesso!
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-600 mb-1.5">
              Link de convite (válido 7 dias):
            </p>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={state.inviteLink}
                className="flex-1 px-3 py-2 border rounded-lg text-xs font-mono bg-gray-50 text-gray-700 focus:outline-none"
              />
              <button
                onClick={copyLink}
                className="px-3 py-2 border rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-1.5 shrink-0"
              >
                {copied ? (
                  <>
                    <svg
                      className="w-3.5 h-3.5 text-green-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    Copiado
                  </>
                ) : (
                  <>
                    <svg
                      className="w-3.5 h-3.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                      />
                    </svg>
                    Copiar
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <form action={formAction} className="space-y-4">
          {state.message && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {state.message}
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Email <span className="text-red-500">*</span>
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="nome@empresa.com"
              />
              {state.errors?.email && (
                <p className="mt-1 text-xs text-red-600">
                  {state.errors.email[0]}
                </p>
              )}
            </div>
            <div>
              <label
                htmlFor="role"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Função
              </label>
              <select
                id="role"
                name="role"
                defaultValue="OBSERVADOR"
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {ROLES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
              {state.errors?.role && (
                <p className="mt-1 text-xs text-red-600">
                  {state.errors.role[0]}
                </p>
              )}
            </div>
          </div>

          <div className="flex justify-end">
            <SubmitButton />
          </div>
        </form>
      )}
    </div>
  );
}
