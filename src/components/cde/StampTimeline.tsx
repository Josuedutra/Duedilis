"use client";

/**
 * StampTimeline — list of ValidationStamps with type and date
 * Task: gov-1775322234055-de2m1o (D4-10v2)
 */

import type { ValidationStampWithType } from "@/lib/actions/cde-revisions";

interface StampTimelineProps {
  stamps: ValidationStampWithType[];
}

const STAMP_TYPE_LABEL: Record<string, string> = {
  APPROVAL: "Aprovação",
  REVIEW: "Revisão",
  REJECTION: "Rejeição",
};

export function StampTimeline({ stamps }: StampTimelineProps) {
  if (stamps.length === 0) {
    return (
      <p className="text-sm text-gray-500">
        Nenhum stamp de validação registado.
      </p>
    );
  }

  return (
    <ol className="relative border-l border-gray-200 space-y-6 ml-3">
      {stamps.map((stamp) => (
        <li key={stamp.id} className="ml-6">
          <span className="absolute -left-3 flex items-center justify-center w-6 h-6 bg-green-100 rounded-full ring-4 ring-white text-xs">
            ✓
          </span>
          <div className="bg-gray-50 border border-gray-200 rounded-md p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-900">
                {STAMP_TYPE_LABEL[stamp.stampType] ?? stamp.stampType}
              </span>
              <time className="text-xs text-gray-500">
                {new Date(stamp.createdAt).toLocaleDateString("pt-PT", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })}
              </time>
            </div>
            <p className="text-xs text-gray-400 mt-1 font-mono truncate">
              Hash: {stamp.payloadHash.slice(0, 16)}…
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
