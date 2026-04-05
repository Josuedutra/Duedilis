// Status badge config + sync UI helpers — shared (no "use server")
// Sync functions cannot live in "use server" files when used by Client Components.

export type BadgeVariant = "default" | "warning" | "success" | "error";

export interface StatusBadgeConfig {
  variant: BadgeVariant;
  label: string;
}

// ─── CDE lifecycle ────────────────────────────────────────────────────────────

export function getChangeStatusBadgeConfig(status: string): StatusBadgeConfig {
  switch (status) {
    case "DRAFT": return { variant: "default", label: "Draft" };
    case "OPEN": return { variant: "warning", label: "Open" };
    case "SUBMITTED": return { variant: "warning", label: "Submitted" };
    case "UNDER_REVIEW": return { variant: "warning", label: "Under Review" };
    case "APPROVED": return { variant: "success", label: "Approved" };
    case "REJECTED": return { variant: "error", label: "Rejected" };
    case "FORMALIZED": return { variant: "success", label: "Formalized" };
    case "CLOSED": return { variant: "default", label: "Closed" };
    default: return { variant: "default", label: status };
  }
}

export function canTransitionChange(status: string): boolean {
  return ["DRAFT", "OPEN", "SUBMITTED", "UNDER_REVIEW", "FORMALIZED"].includes(status);
}

export function hasImmutableComments(status: string): boolean {
  return ["APPROVED", "REJECTED", "CLOSED"].includes(status);
}

// ─── Transmittals ─────────────────────────────────────────────────────────────

export function getTransmittalStatusBadgeConfig(status: string): StatusBadgeConfig {
  switch (status) {
    case "DRAFT": return { variant: "default", label: "Draft" };
    case "SENT": return { variant: "warning", label: "Sent" };
    case "RECEIVED": return { variant: "success", label: "Received" };
    default: return { variant: "default", label: status };
  }
}

export function canSendTransmittal(status: string, documentCount: number): boolean {
  return status === "DRAFT" && documentCount >= 1;
}

// ─── Staging quarantine ───────────────────────────────────────────────────────

export interface StagingStatusBadgeConfig {
  variant: "warning" | "default" | "success" | "error";
  label: string;
}

const STAGING_STATUS_BADGE_MAP: Record<string, StagingStatusBadgeConfig> = {
  PENDING: { variant: "warning", label: "Pendente" },
  VALIDATING: { variant: "default", label: "A validar" },
  READY: { variant: "success", label: "Pronto" },
  PROMOTED: { variant: "success", label: "Promovido" },
  REJECTED: { variant: "error", label: "Rejeitado" },
};

export function getStagingStatusBadgeConfig(status: string): StagingStatusBadgeConfig {
  return STAGING_STATUS_BADGE_MAP[status] ?? { variant: "default", label: status };
}

export function canValidateStaging(status: string): boolean {
  return status === "PENDING";
}

export function canPromoteStaging(status: string): boolean {
  return status === "READY";
}

export function canRejectStaging(status: string): boolean {
  return ["PENDING", "VALIDATING", "READY"].includes(status);
}

// ─── Staging metadata suggestion ──────────────────────────────────────────────

export interface MetadataSuggestion {
  discipline: string | null;
  docType: string | null;
}

export function suggestMetadataFromFilename(filename: string): MetadataSuggestion {
  const upper = filename.toUpperCase();
  const parts = upper.split("-");
  if (parts.length < 2) return { discipline: null, docType: null };

  const DISCIPLINE_MAP: Record<string, string> = {
    ARQ: "ARQUITECTURA", EST: "ESTRUTURAL", MEP: "MEP",
  };
  const DOC_TYPE_MAP: Record<string, string> = {
    PLT: "PLANTA", ESQ: "ESQUEMA", CRT: "CORTE",
  };

  const discipline = DISCIPLINE_MAP[parts[0]] ?? null;
  const docType = DOC_TYPE_MAP[parts[1]] ?? null;
  if (!discipline && !docType) return { discipline: null, docType: null };
  return { discipline, docType };
}

// ─── CDE lifecycle transitions ────────────────────────────────────────────────

export const CDE_VALID_TRANSITIONS: Record<string, string[]> = {
  WIP: ["SHARED"],
  SHARED: ["PUBLISHED", "WIP"],
  PUBLISHED: ["SUPERSEDED"],
  SUPERSEDED: ["ARCHIVED"],
  ARCHIVED: [],
};
