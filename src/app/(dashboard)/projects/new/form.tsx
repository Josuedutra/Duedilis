"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import {
  createProject,
  type ProjectFormState,
} from "@/lib/actions/project-actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full sm:w-auto px-6 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    >
      {pending ? "A criar..." : "Criar Projeto"}
    </button>
  );
}

export function NewProjectForm({ orgId }: { orgId: string }) {
  const [state, formAction] = useActionState<ProjectFormState, FormData>(
    createProject,
    {},
  );

  return (
    <main className="p-6 max-w-2xl">
      <div className="mb-6">
        <Link
          href="/projects"
          className="text-sm text-blue-600 hover:underline flex items-center gap-1"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Voltar a Projetos
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-2">Novo Projeto</h1>
      </div>

      {state.message && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {state.message}
        </div>
      )}

      <form
        action={formAction}
        className="bg-white rounded-xl border shadow-sm p-6 space-y-5"
      >
        <input type="hidden" name="orgId" value={orgId} />

        <div>
          <label
            htmlFor="name"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Nome do Projeto <span className="text-red-500">*</span>
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            maxLength={100}
            className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Ex: Reabilitação Urbana Centro Histórico"
          />
          {state.errors?.name && (
            <p className="mt-1 text-xs text-red-600">{state.errors.name[0]}</p>
          )}
        </div>

        <div>
          <label
            htmlFor="slug"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Slug <span className="text-red-500">*</span>
          </label>
          <input
            id="slug"
            name="slug"
            type="text"
            required
            maxLength={60}
            pattern="[a-z0-9-]+"
            className="w-full px-3 py-2 border rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="reabilitacao-centro-historico"
          />
          <p className="mt-1 text-xs text-gray-500">
            Só letras minúsculas, números e hífens. Único dentro da organização.
          </p>
          {state.errors?.slug && (
            <p className="mt-1 text-xs text-red-600">{state.errors.slug[0]}</p>
          )}
        </div>

        <div>
          <label
            htmlFor="description"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Descrição
          </label>
          <textarea
            id="description"
            name="description"
            rows={3}
            maxLength={500}
            className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            placeholder="Breve descrição do projeto..."
          />
          {state.errors?.description && (
            <p className="mt-1 text-xs text-red-600">
              {state.errors.description[0]}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="address"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Morada / Localização
          </label>
          <input
            id="address"
            name="address"
            type="text"
            maxLength={200}
            className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Ex: Rua do Comércio 45, Lisboa"
          />
          {state.errors?.address && (
            <p className="mt-1 text-xs text-red-600">
              {state.errors.address[0]}
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="startDate"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Data de Início
            </label>
            <input
              id="startDate"
              name="startDate"
              type="date"
              className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {state.errors?.startDate && (
              <p className="mt-1 text-xs text-red-600">
                {state.errors.startDate[0]}
              </p>
            )}
          </div>
          <div>
            <label
              htmlFor="endDate"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Data de Fim
            </label>
            <input
              id="endDate"
              name="endDate"
              type="date"
              className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {state.errors?.endDate && (
              <p className="mt-1 text-xs text-red-600">
                {state.errors.endDate[0]}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <Link
            href="/projects"
            className="px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </Link>
          <SubmitButton />
        </div>
      </form>
    </main>
  );
}
