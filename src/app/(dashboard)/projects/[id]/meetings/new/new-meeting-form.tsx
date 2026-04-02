"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  projectId: string;
  orgId: string;
}

export function NewMeetingForm({ projectId, orgId }: Props) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const form = e.currentTarget;
    const data = {
      orgId,
      projectId,
      title: (form.elements.namedItem("title") as HTMLInputElement).value,
      description:
        (form.elements.namedItem("description") as HTMLTextAreaElement).value ||
        undefined,
      location:
        (form.elements.namedItem("location") as HTMLInputElement).value ||
        undefined,
      scheduledAt: (form.elements.namedItem("scheduledAt") as HTMLInputElement)
        .value,
    };

    try {
      const res = await fetch("/api/meetings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const json = await res.json();
        setError(json.error ?? "Erro ao criar reunião.");
        return;
      }

      const json = await res.json();
      router.push(`/projects/${projectId}/meetings/${json.meeting.id}`);
    } catch {
      setError("Erro de rede. Tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white rounded-xl border border-gray-200 p-6 space-y-4"
    >
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div>
        <label
          htmlFor="title"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Título <span className="text-red-500">*</span>
        </label>
        <input
          id="title"
          name="title"
          type="text"
          required
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Ex: Reunião de Coordenação"
        />
      </div>

      <div>
        <label
          htmlFor="scheduledAt"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Data e Hora <span className="text-red-500">*</span>
        </label>
        <input
          id="scheduledAt"
          name="scheduledAt"
          type="datetime-local"
          required
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label
          htmlFor="location"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Local
        </label>
        <input
          id="location"
          name="location"
          type="text"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Ex: Sala A, Obra, Videoconferência"
        />
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
          rows={4}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          placeholder="Ordem de trabalhos, objectivos..."
        />
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={() => router.push(`/projects/${projectId}/meetings`)}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {isSubmitting ? "A criar..." : "Criar Reunião"}
        </button>
      </div>
    </form>
  );
}
