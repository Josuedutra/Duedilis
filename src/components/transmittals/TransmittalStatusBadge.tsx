"use client";

/**
 * TransmittalStatusBadge — Transmittal lifecycle status badge
 * Task: gov-1775351727595-0iu0dd (D4-12v2)
 */

import { getTransmittalStatusBadgeConfig } from "@/lib/actions/transmittal-actions";

const VARIANT_CLASSES: Record<string, string> = {
  default: "bg-gray-100 text-gray-600 border border-gray-300",
  warning: "bg-yellow-100 text-yellow-800 border border-yellow-300",
  success: "bg-green-100 text-green-800 border border-green-300",
  error: "bg-red-100 text-red-800 border border-red-300",
};

interface TransmittalStatusBadgeProps {
  status: string;
  className?: string;
}

export function TransmittalStatusBadge({
  status,
  className = "",
}: TransmittalStatusBadgeProps) {
  const config = getTransmittalStatusBadgeConfig(status);
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
