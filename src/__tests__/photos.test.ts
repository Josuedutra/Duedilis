/**
 * Fotos de obra tests — Sprint D2, Task D2-T04
 * Task: gov-1775041180765-0yiwrq
 *
 * Testes (red phase TDD — features ainda não implementadas):
 *  - Upload foto com GPS metadata (lat, lng, altitude opcionais)
 *  - Upload foto sem GPS → aceite (GPS é opcional em desktop)
 *  - Link foto a Issue → Evidence criada com type FOTO
 *  - Upload foto mobile (simular viewport mobile)
 *  - Listar fotos por Issue + listar fotos por Projecto
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Hoist mocks ─────────────────────────────────────────────────────────────
const mockAuth = vi.hoisted(() => vi.fn());
const mockEvidenceCreate = vi.hoisted(() => vi.fn());
const mockEvidenceFindMany = vi.hoisted(() => vi.fn());
const mockIssueFindUnique = vi.hoisted(() => vi.fn());
const mockDocumentCreate = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({ auth: mockAuth }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    evidence: {
      create: mockEvidenceCreate,
      findMany: mockEvidenceFindMany,
    },
    issue: {
      findUnique: mockIssueFindUnique,
    },
    document: {
      create: mockDocumentCreate,
    },
  },
}));

// Importar funções a testar (não existem ainda — red phase)
import {
  uploadPhoto,
  linkPhotoToIssue,
  listPhotosByIssue,
  listPhotosByProject,
} from "@/lib/actions/photo-actions";

describe("uploadPhoto — com GPS metadata", () => {
  beforeEach(() => vi.clearAllMocks());

  it("deve aceitar upload de foto com GPS completo (lat, lng, altitude)", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } });
    mockDocumentCreate.mockResolvedValue({
      id: "photo-doc-1",
      mimeType: "image/jpeg",
      status: "PENDING",
    });

    const result = await uploadPhoto({
      orgId: "org1",
      projectId: "proj1",
      folderId: "folder1",
      fileName: "foto-pilares-piso0.jpg",
      mimeType: "image/jpeg",
      fileSizeBytes: 3 * 1024 * 1024, // 3MB
      fileHash: "photo-hash-abc",
      gpsMetadata: {
        latitude: 38.7169,
        longitude: -9.1395,
        altitude: 45.2,
      },
    });

    expect(result).toHaveProperty("id");
    expect(result.mimeType).toBe("image/jpeg");
  });

  it("deve aceitar upload de foto sem GPS metadata (GPS é opcional)", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } });
    mockDocumentCreate.mockResolvedValue({
      id: "photo-doc-2",
      mimeType: "image/jpeg",
      status: "PENDING",
      metadata: null, // sem GPS
    });

    const result = await uploadPhoto({
      orgId: "org1",
      projectId: "proj1",
      folderId: "folder1",
      fileName: "screenshot-desktop.jpg",
      mimeType: "image/jpeg",
      fileSizeBytes: 512 * 1024,
      fileHash: "photo-hash-no-gps",
      gpsMetadata: null, // desktop — sem GPS
    });

    expect(result).toHaveProperty("id");
    // Não deve lançar erro quando gpsMetadata é null
  });

  it("deve aceitar upload de foto com apenas latitude e longitude (altitude opcional)", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } });
    mockDocumentCreate.mockResolvedValue({
      id: "photo-doc-3",
      mimeType: "image/png",
      status: "PENDING",
    });

    const result = await uploadPhoto({
      orgId: "org1",
      projectId: "proj1",
      folderId: "folder1",
      fileName: "inspecao-armaduras.png",
      mimeType: "image/png",
      fileSizeBytes: 2 * 1024 * 1024,
      fileHash: "photo-hash-partial-gps",
      gpsMetadata: {
        latitude: 38.7169,
        longitude: -9.1395,
        altitude: null, // altitude opcional
      },
    });

    expect(result).toHaveProperty("id");
  });

  it("deve simular upload foto de dispositivo mobile (imagem HEIC)", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u-mobile" } });
    mockDocumentCreate.mockResolvedValue({
      id: "photo-doc-mobile",
      mimeType: "image/heic",
      status: "PENDING",
    });

    const result = await uploadPhoto({
      orgId: "org1",
      projectId: "proj1",
      folderId: "folder1",
      fileName: "IMG_4821.HEIC",
      mimeType: "image/heic", // formato mobile típico iOS
      fileSizeBytes: 8 * 1024 * 1024, // 8MB — típico iOS
      fileHash: "photo-hash-mobile",
      gpsMetadata: {
        latitude: 38.7169,
        longitude: -9.1395,
        altitude: 12.5,
      },
      isMobile: true,
    });

    expect(result).toHaveProperty("id");
  });
});

describe("linkPhotoToIssue — associar foto a issue", () => {
  beforeEach(() => vi.clearAllMocks());

  it("deve criar Evidence com type FOTO ao ligar foto a Issue existente", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } });
    mockIssueFindUnique.mockResolvedValue({
      id: "issue1",
      orgId: "org1",
      projectId: "proj1",
      status: "ABERTA",
    });
    mockEvidenceCreate.mockResolvedValue({
      id: "evidence1",
      issueId: "issue1",
      type: "FOTO",
      fileName: "foto-pilares.jpg",
      fileUrl: "https://r2.example.com/foto-pilares.jpg",
      fileHash: "hash-abc",
      fileSizeBytes: 2048,
      mimeType: "image/jpeg",
      uploadedById: "u1",
    });

    const result = await linkPhotoToIssue({
      issueId: "issue1",
      orgId: "org1",
      fileName: "foto-pilares.jpg",
      fileUrl: "https://r2.example.com/foto-pilares.jpg",
      fileHash: "hash-abc",
      fileSizeBytes: 2048,
      mimeType: "image/jpeg",
    });

    expect(result.type).toBe("FOTO");
    expect(result.issueId).toBe("issue1");
    expect(mockEvidenceCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: "FOTO",
          issueId: "issue1",
        }),
      }),
    );
  });

  it("deve rejeitar link quando issue não existe", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } });
    mockIssueFindUnique.mockResolvedValue(null); // issue não existe

    await expect(
      linkPhotoToIssue({
        issueId: "nonexistent-issue",
        orgId: "org1",
        fileName: "foto.jpg",
        fileUrl: "https://r2.example.com/foto.jpg",
        fileHash: "hash-xyz",
        fileSizeBytes: 1024,
        mimeType: "image/jpeg",
      }),
    ).rejects.toThrow(/issue|não encontrada|404/i);
  });

  it("deve guardar GPS metadata na evidence quando disponível", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } });
    mockIssueFindUnique.mockResolvedValue({
      id: "issue2",
      orgId: "org1",
      projectId: "proj1",
    });
    const gps = { latitude: 38.7, longitude: -9.14, altitude: 10.0 };
    mockEvidenceCreate.mockResolvedValue({
      id: "evidence2",
      issueId: "issue2",
      type: "FOTO",
      metadata: gps,
    });

    const result = await linkPhotoToIssue({
      issueId: "issue2",
      orgId: "org1",
      fileName: "geo-foto.jpg",
      fileUrl: "https://r2.example.com/geo-foto.jpg",
      fileHash: "hash-geo",
      fileSizeBytes: 4096,
      mimeType: "image/jpeg",
      gpsMetadata: gps,
    });

    expect(result.metadata).toEqual(gps);
  });
});

describe("listPhotosByIssue", () => {
  beforeEach(() => vi.clearAllMocks());

  it("deve listar apenas evidências do tipo FOTO para uma issue", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } });
    mockEvidenceFindMany.mockResolvedValue([
      { id: "ev1", type: "FOTO", issueId: "issue1" },
      { id: "ev2", type: "FOTO", issueId: "issue1" },
    ]);

    const result = await listPhotosByIssue({
      issueId: "issue1",
      orgId: "org1",
    });

    expect(result).toHaveLength(2);
    expect(result.every((e: { type: string }) => e.type === "FOTO")).toBe(true);
    expect(mockEvidenceFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          issueId: "issue1",
          type: "FOTO",
        }),
      }),
    );
  });
});

describe("listPhotosByProject", () => {
  beforeEach(() => vi.clearAllMocks());

  it("deve listar todas as fotos de um projecto (de todas as issues)", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } });
    mockEvidenceFindMany.mockResolvedValue([
      {
        id: "ev1",
        type: "FOTO",
        issueId: "issue1",
        issue: { projectId: "proj1" },
      },
      {
        id: "ev2",
        type: "FOTO",
        issueId: "issue2",
        issue: { projectId: "proj1" },
      },
      {
        id: "ev3",
        type: "FOTO",
        issueId: "issue3",
        issue: { projectId: "proj1" },
      },
    ]);

    const result = await listPhotosByProject({
      projectId: "proj1",
      orgId: "org1",
    });

    expect(result).toHaveLength(3);
    expect(mockEvidenceFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          type: "FOTO",
          orgId: "org1",
          issue: expect.objectContaining({ projectId: "proj1" }),
        }),
      }),
    );
  });
});
