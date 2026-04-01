"use client";

/**
 * FolderTree — renderiza árvore hierárquica de pastas CDE
 * Task: gov-1775041228837-pj6dba
 */

import Link from "next/link";

interface Folder {
  id: string;
  name: string;
  parentId: string | null;
  path: string;
}

interface Props {
  folders: Folder[];
  activeFolderId: string | null;
  projectId: string;
}

export function FolderTree({ folders, activeFolderId, projectId }: Props) {
  const roots = folders.filter((f) => f.parentId === null);

  if (roots.length === 0) {
    return (
      <p className="text-xs text-gray-400 px-2 py-3">Sem pastas criadas.</p>
    );
  }

  return (
    <ul className="space-y-0.5">
      {roots.map((folder) => (
        <FolderNode
          key={folder.id}
          folder={folder}
          allFolders={folders}
          activeFolderId={activeFolderId}
          projectId={projectId}
          depth={0}
        />
      ))}
    </ul>
  );
}

function FolderNode({
  folder,
  allFolders,
  activeFolderId,
  projectId,
  depth,
}: {
  folder: Folder;
  allFolders: Folder[];
  activeFolderId: string | null;
  projectId: string;
  depth: number;
}) {
  const children = allFolders.filter((f) => f.parentId === folder.id);
  const isActive = folder.id === activeFolderId;

  return (
    <li>
      <Link
        href={`/projects/${projectId}/documents?folderId=${folder.id}`}
        className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors ${
          isActive
            ? "bg-blue-50 text-blue-700 font-medium"
            : "text-gray-700 hover:bg-gray-100"
        }`}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
      >
        <svg
          className={`w-4 h-4 flex-shrink-0 ${isActive ? "text-blue-500" : "text-gray-400"}`}
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
        <span className="truncate">{folder.name}</span>
      </Link>
      {children.length > 0 && (
        <ul>
          {children.map((child) => (
            <FolderNode
              key={child.id}
              folder={child}
              allFolders={allFolders}
              activeFolderId={activeFolderId}
              projectId={projectId}
              depth={depth + 1}
            />
          ))}
        </ul>
      )}
    </li>
  );
}
