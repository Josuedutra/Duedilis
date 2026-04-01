"use client";

/**
 * CDE page client component — Sprint D2-03/05/06
 * Task: gov-1775041228837-pj6dba
 */

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FolderTree } from "@/components/documents/folder-tree";
import { DocumentList } from "@/components/documents/document-list";
import { CreateFolderModal } from "@/components/documents/create-folder-modal";
import { UploadDropzone } from "@/components/documents/upload-dropzone";

interface Folder {
  id: string;
  name: string;
  parentId: string | null;
  path: string;
}

interface DocumentItem {
  id: string;
  originalName: string;
  isoName: string | null;
  status: string;
  revision: string | null;
  mimeType: string;
  fileSizeBytes: number;
  createdAt: string;
  uploader: { name: string | null; email: string };
}

interface Props {
  project: { id: string; name: string; orgId: string };
  org: { name: string };
  folders: Folder[];
  activeFolderId: string | null;
  activeFolder: { id: string; name: string; parentId: string | null } | null;
  initialDocuments: DocumentItem[];
}

export function CdePageClient({
  project,
  org,
  folders: initialFolders,
  activeFolderId,
  activeFolder,
  initialDocuments,
}: Props) {
  const router = useRouter();
  const [folders, setFolders] = useState<Folder[]>(initialFolders);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [showUpload, setShowUpload] = useState(false);

  const breadcrumbs = buildBreadcrumbs(folders, activeFolderId);

  const handleFolderCreated = useCallback(
    (newFolder: Folder) => {
      setFolders((prev) => [...prev, newFolder]);
      setShowCreateFolder(false);
      router.push(`/projects/${project.id}/documents?folderId=${newFolder.id}`);
    },
    [project.id, router],
  );

  const handleUploadComplete = useCallback(() => {
    setShowUpload(false);
    router.refresh();
  }, [router]);

  return (
    <div className="flex h-full min-h-screen bg-gray-50">
      {/* Sidebar — árvore de pastas */}
      <aside className="w-64 border-r bg-white flex flex-col">
        <div className="p-4 border-b">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Pastas
            </span>
            <button
              onClick={() => setShowCreateFolder(true)}
              className="text-blue-600 hover:text-blue-700 text-xs font-medium"
              title="Nova pasta"
            >
              + Nova
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          <FolderTree
            folders={folders}
            activeFolderId={activeFolderId}
            projectId={project.id}
          />
        </div>
      </aside>

      {/* Main area */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Breadcrumb */}
        <div className="px-6 py-3 border-b bg-white flex items-center gap-1.5 text-sm text-gray-600 flex-wrap">
          <Link
            href="/projects"
            className="hover:text-blue-600 transition-colors"
          >
            Projetos
          </Link>
          <span className="text-gray-300">/</span>
          <Link
            href={`/projects/${project.id}`}
            className="hover:text-blue-600 transition-colors"
          >
            {project.name}
          </Link>
          <span className="text-gray-300">/</span>
          <span className="text-gray-500">Documentos</span>
          {breadcrumbs.map((crumb) => (
            <span key={crumb.id} className="flex items-center gap-1.5">
              <span className="text-gray-300">/</span>
              <Link
                href={`/projects/${project.id}/documents?folderId=${crumb.id}`}
                className="hover:text-blue-600 transition-colors"
              >
                {crumb.name}
              </Link>
            </span>
          ))}
        </div>

        <div className="flex-1 p-6 overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="text-xs text-gray-400">{org.name}</p>
              <h1 className="text-xl font-semibold text-gray-900">
                {activeFolder ? activeFolder.name : "CDE — Documentos"}
              </h1>
            </div>
            {activeFolderId && (
              <button
                onClick={() => setShowUpload(true)}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                Carregar ficheiros
              </button>
            )}
          </div>

          {/* Upload dropzone (inline, shown on demand) */}
          {showUpload && activeFolderId && (
            <div className="mb-6">
              <UploadDropzone
                orgId={project.orgId}
                projectId={project.id}
                folderId={activeFolderId}
                onComplete={handleUploadComplete}
                onCancel={() => setShowUpload(false)}
              />
            </div>
          )}

          {/* Document list */}
          {activeFolderId ? (
            <DocumentList
              orgId={project.orgId}
              folderId={activeFolderId}
              initialDocuments={initialDocuments}
            />
          ) : (
            <EmptyState onCreateFolder={() => setShowCreateFolder(true)} />
          )}
        </div>
      </main>

      {/* Create folder modal */}
      {showCreateFolder && (
        <CreateFolderModal
          orgId={project.orgId}
          projectId={project.id}
          folders={folders}
          onCreated={handleFolderCreated}
          onClose={() => setShowCreateFolder(false)}
        />
      )}
    </div>
  );
}

function buildBreadcrumbs(
  folders: Folder[],
  activeFolderId: string | null,
): Array<{ id: string; name: string }> {
  if (!activeFolderId) return [];
  const folderMap = new Map(folders.map((f) => [f.id, f]));
  const crumbs: Array<{ id: string; name: string }> = [];
  let current = folderMap.get(activeFolderId);
  while (current) {
    crumbs.unshift({ id: current.id, name: current.name });
    current = current.parentId ? folderMap.get(current.parentId) : undefined;
  }
  return crumbs;
}

function EmptyState({ onCreateFolder }: { onCreateFolder: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
        <svg
          className="w-8 h-8 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
          />
        </svg>
      </div>
      <p className="text-sm font-medium text-gray-700 mb-1">
        Sem pastas criadas
      </p>
      <p className="text-xs text-gray-400 mb-4">
        Crie uma pasta para começar a organizar documentos.
      </p>
      <button
        onClick={onCreateFolder}
        className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
      >
        Criar primeira pasta
      </button>
    </div>
  );
}
