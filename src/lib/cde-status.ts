// CDE status badge configuration — shared utility (no "use server")

export interface CdeStatusBadgeConfig {
  variant: "blue" | "yellow" | "green" | "gray";
  label: string;
}

const CDE_STATUS_BADGE_MAP: Record<string, CdeStatusBadgeConfig> = {
  WIP: { variant: "blue", label: "Em Progresso" },
  SHARED: { variant: "yellow", label: "Partilhado" },
  PUBLISHED: { variant: "green", label: "Publicado" },
  SUPERSEDED: { variant: "gray", label: "Substituído" },
  ARCHIVED: { variant: "gray", label: "Arquivado" },
};

export function getCdeStatusBadgeConfig(status: string): CdeStatusBadgeConfig {
  return CDE_STATUS_BADGE_MAP[status] ?? { variant: "gray", label: status };
}
