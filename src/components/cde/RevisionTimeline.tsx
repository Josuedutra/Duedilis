"use client";

/**
 * RevisionTimeline — ordered list of DocumentRevision entries
 * Task: gov-1775322234055-de2m1o (D4-10v2)
 */

import type { DocumentRevision } from "@/lib/actions/cde-revisions";

interface RevisionTimelineProps {
  revisions: DocumentRevision[];
}

export function RevisionTimeline({ revisions }: RevisionTimelineProps) {
  if (revisions.length === 0) {
    return <p className="text-sm text-gray-500">Nenhuma revisão registada.</p>;
  }

  return (
    <ol className="relative border-l border-gray-200 space-y-6 ml-3">
      {revisions.map((rev, idx) => (
        <li key={rev.id} className="ml-6">
          <span className="absolute -left-3 flex items-center justify-center w-6 h-6 bg-blue-100 rounded-full ring-4 ring-white text-xs font-bold text-blue-800">
            {idx + 1}
          </span>
          <div className="bg-gray-50 border border-gray-200 rounded-md p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-900">
                Revisão {rev.revisionCode}
              </span>
              <time className="text-xs text-gray-500">
                {new Date(rev.createdAt).toLocaleDateString("pt-PT", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })}
              </time>
            </div>
            <p className="text-xs text-gray-400 mt-1 font-mono truncate">
              SHA-256: {rev.fileChecksum.slice(0, 16)}…
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
