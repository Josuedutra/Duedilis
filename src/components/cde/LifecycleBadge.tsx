"use client";

/**
 * LifecycleBadge — CDE Document lifecycle status badge
 * Task: gov-1775322234055-de2m1o (D4-10v2)
 *
 * Displays CdeDocStatus with colour-coded variant:
 *   WIP=blue, SHARED=yellow, PUBLISHED=green, SUPERSEDED=gray, ARCHIVED=gray
 */

import { getCdeStatusBadgeConfig } from "@/lib/actions/cde-actions";

const VARIANT_CLASSES: Record<string, string> = {
  blue: "bg-blue-100 text-blue-800 border border-blue-300",
  yellow: "bg-yellow-100 text-yellow-800 border border-yellow-300",
  green: "bg-green-100 text-green-800 border border-green-300",
  gray: "bg-gray-100 text-gray-600 border border-gray-300",
};

interface LifecycleBadgeProps {
  status: string;
  onClick?: () => void;
  className?: string;
}

export function LifecycleBadge({
  status,
  onClick,
  className = "",
}: LifecycleBadgeProps) {
  const config = getCdeStatusBadgeConfig(status);
  const variantClass = VARIANT_CLASSES[config.variant] ?? VARIANT_CLASSES.gray;

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium cursor-pointer select-none ${variantClass} ${className}`}
      onClick={onClick}
      title={`Estado: ${config.label}${onClick ? " — clique para transitar" : ""}`}
    >
      {config.label}
    </span>
  );
}
