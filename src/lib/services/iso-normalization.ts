/**
 * ISO 19650 Normalization Service — Sprint D2
 * Task: gov-1775041253896-v20gul
 *
 * Uses Claude Haiku to suggest ISO 19650-compliant document names.
 * Format: {ProjectCode}-{Discipline}-{DocType}-{Zone}-{Number}-{Revision}
 */

import Anthropic from "@anthropic-ai/sdk";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface NormalizationInput {
  originalName: string;
  projectCode: string;
  folderPath: string;
}

export interface NormalizationResult {
  isoName: string | null; // null if confidence < 0.5
  discipline: string | null;
  docType: string | null;
  revision: string | null;
  confidence: number; // 0-1
}

// ─── Discipline + DocType maps ────────────────────────────────────────────────

const DISCIPLINE_CODES: Record<string, string> = {
  AR: "Arquitetura",
  ST: "Estruturas",
  ME: "Mecânica",
  EL: "Eléctrica",
  PL: "Hidráulica",
  GE: "Geotecnia",
  SS: "Segurança",
  FP: "Protecção Contra Incêndio",
};

const DOC_TYPE_CODES: Record<string, string> = {
  DR: "Drawing",
  SP: "Specification",
  RP: "Report",
  CA: "Calculation",
  PR: "Procedure",
  MS: "Method Statement",
  RFI: "Request for Information",
  CO: "Correspondence",
};

// ─── ISO 19650 normalization via Claude Haiku ─────────────────────────────────

export async function normalizeDocumentName(
  input: NormalizationInput,
): Promise<NormalizationResult> {
  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  const disciplineList = Object.entries(DISCIPLINE_CODES)
    .map(([code, name]) => `  ${code}: ${name}`)
    .join("\n");

  const docTypeList = Object.entries(DOC_TYPE_CODES)
    .map(([code, name]) => `  ${code}: ${name}`)
    .join("\n");

  const systemPrompt = `You are an ISO 19650 document naming specialist for construction projects.
Given a document's original filename, project code, and folder path, suggest an ISO 19650-compliant name.

ISO 19650 format: {ProjectCode}-{Discipline}-{DocType}-{Zone}-{Number}-{Revision}
- ProjectCode: use the provided project code
- Discipline codes:\n${disciplineList}
- DocType codes:\n${docTypeList}
- Zone: use "ZZ" if unknown or not applicable
- Number: 4-digit sequential number, default "0001" if unknown
- Revision: use "P01" for preliminary drawings, "C01" for construction, "A" for reports/specs

Rules:
- Photos (jpg, jpeg, png, heic) from "obra" or "site" context → discipline="GE", docType="DR", but LOW confidence (0.3)
- Generic photos without construction context → confidence=0.2
- Respond ONLY with valid JSON, no markdown, no explanation.

Response format:
{
  "isoName": "VNT-AR-DR-ZZ-0001-P01",
  "discipline": "AR",
  "docType": "DR",
  "revision": "P01",
  "confidence": 0.85
}`;

  const userMessage = `Original filename: "${input.originalName}"
Project code: "${input.projectCode}"
Folder path: "${input.folderPath}"

Suggest an ISO 19650 name for this document.`;

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 256,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
  });

  const text =
    response.content[0].type === "text" ? response.content[0].text : "";

  // Parse JSON response
  let parsed: {
    isoName: string;
    discipline: string;
    docType: string;
    revision: string;
    confidence: number;
  };

  try {
    parsed = JSON.parse(text.trim());
  } catch {
    // If parsing fails, return low confidence null result
    return {
      isoName: null,
      discipline: null,
      docType: null,
      revision: null,
      confidence: 0,
    };
  }

  const confidence = Math.max(0, Math.min(1, parsed.confidence ?? 0));

  // Only suggest if confidence >= 0.5
  if (confidence < 0.5) {
    return {
      isoName: null,
      discipline: parsed.discipline ?? null,
      docType: parsed.docType ?? null,
      revision: parsed.revision ?? null,
      confidence,
    };
  }

  // Validate discipline and docType codes
  const discipline =
    parsed.discipline && parsed.discipline in DISCIPLINE_CODES
      ? parsed.discipline
      : null;
  const docType =
    parsed.docType && parsed.docType in DOC_TYPE_CODES ? parsed.docType : null;

  return {
    isoName: parsed.isoName ?? null,
    discipline,
    docType,
    revision: parsed.revision ?? null,
    confidence,
  };
}
