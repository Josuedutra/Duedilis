"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import {
  updateProject,
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
      {pending ? "A guardar..." : "Guardar alterações"}
    </button>
  );
}

interface ProjectData {
  id: string;
  orgId: string;
  name: string;
  slug: string;
  description: string;
  address: string;
  startDate: string;
  endDate: string;
  status: string;
}

export function EditProjectForm({ project }: { project: ProjectData }) {
  const updateProjectWithId = updateProject.bind(null, project.id);
  const [state, formAction] = useActionState<ProjectFormState, FormData>(
    updateProjectWithId,
    {},
  );

  return (
    <main className="p-6 max-w-2xl">
      <div className="mb-6">
        <Link
          href={`/projects/${project.id}`}
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
          Voltar ao Projeto
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-2">
          Editar Projeto
        </h1>
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
        <input type="hidden" name="orgId" value={project.orgId} />

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
            defaultValue={project.name}
            className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            defaultValue={project.slug}
            className="w-full px-3 py-2 border rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
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
            defaultValue={project.description}
            className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
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
            defaultValue={project.address}
            className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              defaultValue={project.startDate}
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
              defaultValue={project.endDate}
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
            href={`/projects/${project.id}`}
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
