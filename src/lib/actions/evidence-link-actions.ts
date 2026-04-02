"use server";

/**
 * Evidence Link actions — Sprint D3, Tasks D3-04/05
 * (gov-1775086355505-6o0fis)
 *
 * Módulo 8: Links Probatórios — NC↔Foto↔Doc↔Reunião
 *
 * Regras de negócio:
 *  - Links são IMUTÁVEIS (append-only) — sem update, sem delete
 *  - Hash SHA-256 calculado no momento da criação
 *  - RLS: source e target devem pertencer à mesma org
 *  - AuditLog gerado em cada criação (hash encadeado)
 */

import crypto from "crypto";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

// ─── Types ────────────────────────────────────────────────────────────────────

type EntityType = "Issue" | "Document" | "Photo" | "Meeting";

interface CreateEvidenceLinkInput {
  orgId: string;
  projectId: string;
  sourceType: EntityType;
  sourceId: string;
  targetType: EntityType;
  targetId: string;
  description?: string;
}

interface ListEvidenceLinksInput {
  orgId: string;
  sourceType?: EntityType;
  sourceId?: string;
  targetType?: EntityType;
  targetId?: string;
}

interface GetEntityWithLinksInput {
  orgId: string;
  entityType: EntityType;
  entityId: string;
}

interface UpdateEvidenceLinkInput {
  linkId: string;
  orgId: string;
  description?: string;
  hash?: string;
  [key: string]: unknown;
}

interface DeleteEvidenceLinkInput {
  linkId: string;
  orgId: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Busca entidade por tipo e id.
 * Usa (prisma as any) pois Photo/Meeting/Issue não estão todos no schema principal.
 */
async function fetchEntity(
  entityType: EntityType,
  entityId: string,
): Promise<{ id: string; orgId: string } | null> {
  const modelMap: Record<EntityType, string> = {
    Issue: "issue",
    Document: "document",
    Photo: "photo",
    Meeting: "meeting",
  };
  const modelName = modelMap[entityType];
  return db[modelName].findUnique({ where: { id: entityId } });
}

/**
 * Calcula SHA-256 do link probatório.
 * Formato: SHA-256(orgId + sourceType + sourceId + targetType + targetId + createdById + createdAt)
 */
function computeLinkHash(params: {
  orgId: string;
  sourceType: string;
  sourceId: string;
  targetType: string;
  targetId: string;
  createdById: string;
  createdAt: Date;
}): string {
  const raw = `${params.orgId}${params.sourceType}${params.sourceId}${params.targetType}${params.targetId}${params.createdById}${params.createdAt.toISOString()}`;
  return crypto.createHash("sha256").update(raw).digest("hex");
}

/**
 * Calcula SHA-256 de uma entry de AuditLog encadeada.
 * Formato: SHA-256(prevHash + action + entityType + entityId + userId)
 */
function computeAuditHash(params: {
  prevHash: string | null;
  action: string;
  entityType: string;
  entityId: string;
  userId: string;
}): string {
  const raw = `${params.prevHash ?? ""}${params.action}${params.entityType}${params.entityId}${params.userId}`;
  return crypto.createHash("sha256").update(raw).digest("hex");
}

// ─── Actions ─────────────────────────────────────────────────────────────────

/**
 * Cria um link probatório entre duas entidades.
 * Verifica RLS: source e target devem pertencer à mesma org.
 */
export async function createEvidenceLink(input: CreateEvidenceLinkInput) {
  const session = await auth();
  if (!session?.user) throw new Error("Não autenticado.");

  const userId = session.user.id!;

  // Verificar membership
  const membership = await prisma.orgMembership.findUnique({
    where: { userId_orgId: { userId, orgId: input.orgId } },
  });
  if (!membership) throw new Error("403: Sem acesso à organização.");

  // Buscar entidades source e target
  const sourceEntity = await fetchEntity(input.sourceType, input.sourceId);
  const targetEntity = await fetchEntity(input.targetType, input.targetId);

  // RLS: source deve pertencer à org
  if (!sourceEntity || sourceEntity.orgId !== input.orgId) {
    throw new Error(
      "403: forbidden — source entity não pertence a esta org (cross-org proibido).",
    );
  }

  // RLS: target deve pertencer à org
  if (!targetEntity || targetEntity.orgId !== input.orgId) {
    throw new Error(
      "403: forbidden — target entity não pertence a esta org (cross-org proibido).",
    );
  }

  // Calcular hash imutável
  const createdAt = new Date();
  const hash = computeLinkHash({
    orgId: input.orgId,
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    targetType: input.targetType,
    targetId: input.targetId,
    createdById: userId,
    createdAt,
  });

  // Criar o link
  const link = await db.evidenceLink.create({
    data: {
      orgId: input.orgId,
      projectId: input.projectId,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      targetType: input.targetType,
      targetId: input.targetId,
      description: input.description ?? null,
      createdById: userId,
      hash,
    },
  });

  // AuditLog com hash encadeado
  const lastAudit = await prisma.auditLog.findFirst({
    where: { entityType: "EvidenceLink", entityId: link.id },
    orderBy: { createdAt: "desc" },
  });

  const auditHash = computeAuditHash({
    prevHash: lastAudit?.hash ?? null,
    action: "CREATE",
    entityType: "EvidenceLink",
    entityId: link.id,
    userId,
  });

  await prisma.auditLog.create({
    data: {
      orgId: input.orgId,
      entityType: "EvidenceLink",
      entityId: link.id,
      action: "CREATE",
      userId,
      hash: auditHash,
      payload: {
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        targetType: input.targetType,
        targetId: input.targetId,
      },
    },
  });

  return link;
}

/**
 * Lista links probatórios de uma entidade (por source ou target).
 * RLS: sempre filtra por orgId.
 */
export async function listEvidenceLinks(input: ListEvidenceLinksInput) {
  const session = await auth();
  if (!session?.user) throw new Error("Não autenticado.");

  const userId = session.user.id!;

  // Verificar membership — se não é membro, retorna vazio (sem leak)
  const membership = await prisma.orgMembership.findUnique({
    where: { userId_orgId: { userId, orgId: input.orgId } },
  });
  if (!membership) return [];

  // Construir filtro
  const where: Record<string, unknown> = { orgId: input.orgId };
  if (input.sourceType) where.sourceType = input.sourceType;
  if (input.sourceId) where.sourceId = input.sourceId;
  if (input.targetType) where.targetType = input.targetType;
  if (input.targetId) where.targetId = input.targetId;

  return db.evidenceLink.findMany({ where });
}

/**
 * Retorna entidade + todos os links (bidirecional: source + target).
 */
export async function getEntityWithLinks(input: GetEntityWithLinksInput) {
  const session = await auth();
  if (!session?.user) throw new Error("Não autenticado.");

  const entity = await fetchEntity(input.entityType, input.entityId);

  // Links onde é source
  const linksAsSource = await db.evidenceLink.findMany({
    where: {
      orgId: input.orgId,
      sourceType: input.entityType,
      sourceId: input.entityId,
    },
  });

  // Links onde é target
  const linksAsTarget = await db.evidenceLink.findMany({
    where: {
      orgId: input.orgId,
      targetType: input.entityType,
      targetId: input.entityId,
    },
  });

  // Combinar, deduplicando por id
  const allLinks = [...linksAsSource, ...linksAsTarget];
  const seen = new Set<string>();
  const links = allLinks.filter((l: { id: string }) => {
    if (seen.has(l.id)) return false;
    seen.add(l.id);
    return true;
  });

  return { entity, links };
}

/**
 * Links probatórios são IMUTÁVEIS — update é proibido.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function updateEvidenceLink(_input: UpdateEvidenceLinkInput) {
  throw new Error(
    "403: proibido — links probatórios são imutáveis (append-only). não é permitido alterar.",
  );
}

/**
 * Links probatórios são IMUTÁVEIS — delete é proibido.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function deleteEvidenceLink(_input: DeleteEvidenceLinkInput) {
  throw new Error(
    "403: proibido — links probatórios são imutáveis (append-only). não é permitido eliminar.",
  );
}
