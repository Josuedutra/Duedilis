"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

const STATUS_LABELS: Record<string, string> = {
  ATIVO: "Ativo",
  SUSPENSO: "Suspenso",
  CONCLUIDO: "Concluído",
  CANCELADO: "Cancelado",
};

const STATUS_COLORS: Record<string, string> = {
  ATIVO: "bg-green-100 text-green-800",
  SUSPENSO: "bg-yellow-100 text-yellow-800",
  CONCLUIDO: "bg-blue-100 text-blue-800",
  CANCELADO: "bg-gray-100 text-gray-600",
};

interface Project {
  id: string;
  name: string;
  slug: string;
  status: string;
  description: string | null;
  address: string | null;
  org: { name: string };
  _count: { memberships: number; issues: number };
}

const STATUS_OPTIONS = ["TODOS", "ATIVO", "SUSPENSO", "CONCLUIDO", "CANCELADO"];

export function ProjectsClient({ projects }: { projects: Project[] }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("TODOS");

  const filtered = useMemo(() => {
    return projects.filter((p) => {
      const matchSearch =
        !search ||
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.slug.toLowerCase().includes(search.toLowerCase()) ||
        (p.address ?? "").toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === "TODOS" || p.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [projects, search, statusFilter]);

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1 max-w-sm">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            placeholder="Pesquisar projetos..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex gap-1 flex-wrap">
          {STATUS_OPTIONS.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                statusFilter === s
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
              }`}
            >
              {s === "TODOS" ? "Todos" : (STATUS_LABELS[s] ?? s)}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((project) => (
          <Link
            key={project.id}
            href={`/projects/${project.id}`}
            className="block bg-white rounded-xl border p-4 hover:shadow-md transition-shadow group"
          >
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="min-w-0">
                <p className="font-semibold text-gray-900 truncate group-hover:text-blue-700 transition-colors">
                  {project.name}
                </p>
                <p className="text-xs text-gray-400 font-mono">
                  {project.slug}
                </p>
              </div>
              <span
                className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[project.status] ?? "bg-gray-100 text-gray-600"}`}
              >
                {STATUS_LABELS[project.status] ?? project.status}
              </span>
            </div>
            {project.description && (
              <p className="text-sm text-gray-600 line-clamp-2 mb-2">
                {project.description}
              </p>
            )}
            {project.address && (
              <p className="text-xs text-gray-500 flex items-center gap-1 mb-2">
                <svg
                  className="w-3 h-3 shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
                <span className="truncate">{project.address}</span>
              </p>
            )}
            <div className="flex items-center gap-3 text-xs text-gray-400 mt-2">
              <span>{project._count.memberships} membros</span>
              <span>{project._count.issues} issues</span>
            </div>
          </Link>
        ))}
        {filtered.length === 0 && (
          <p className="text-gray-500 col-span-full text-center py-12">
            {projects.length === 0
              ? "Ainda não há projetos. Crie o primeiro!"
              : "Nenhum projeto corresponde à pesquisa."}
          </p>
        )}
      </div>
    </div>
  );
}
