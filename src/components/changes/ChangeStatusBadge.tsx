"use client";

/**
 * ChangeStatusBadge — Change lifecycle status badge
 * Task: gov-1775351727595-0iu0dd (D4-12v2)
 */

import { getChangeStatusBadgeConfig } from "@/lib/actions/change-actions";

const VARIANT_CLASSES: Record<string, string> = {
  default: "bg-gray-100 text-gray-600 border border-gray-300",
  warning: "bg-yellow-100 text-yellow-800 border border-yellow-300",
  success: "bg-green-100 text-green-800 border border-green-300",
  error: "bg-red-100 text-red-800 border border-red-300",
};

interface ChangeStatusBadgeProps {
  status: string;
  className?: string;
}

export function ChangeStatusBadge({
  status,
  className = "",
}: ChangeStatusBadgeProps) {
  const config = getChangeStatusBadgeConfig(status);
  const variantClass =
    VARIANT_CLASSES[config.variant] ?? VARIANT_CLASSES.default;

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium select-none ${variantClass} ${className}`}
      title={`Estado: ${config.label}`}
    >
      {config.label}
    </span>
  );
}
