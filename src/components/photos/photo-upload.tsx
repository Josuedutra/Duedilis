"use client";

/**
 * PhotoUpload component — Sprint D2, Task gov-1775041297153-uzp0s2
 *
 * Upload múltiplo de fotos de obra (drag & drop + file picker + camera móvel).
 * Extrai EXIF GPS do JPEG antes de enviar.
 * Aceita: image/jpeg, image/png, image/webp, image/heic, image/heif, image/gif
 */

import { useRef, useState, useCallback, DragEvent, ChangeEvent } from "react";
import { extractExifMetadata, ExifGpsData } from "@/lib/services/exif-parser";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PhotoUploadInput {
  orgId: string;
  projectId: string;
  folderId: string;
  issueId?: string;
}

interface PendingPhoto {
  file: File;
  previewUrl: string;
  caption: string;
  gps: ExifGpsData | null;
  status: "pending" | "uploading" | "done" | "error";
  errorMessage?: string;
}

const ACCEPTED_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "image/gif",
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatGps(gps: ExifGpsData | null): string | null {
  if (!gps?.latitude || !gps?.longitude) return null;
  const lat = gps.latitude.toFixed(6);
  const lng = gps.longitude.toFixed(6);
  const alt = gps.altitude != null ? `, ${gps.altitude.toFixed(1)}m alt` : "";
  return `${lat}, ${lng}${alt}`;
}

async function hashFile(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ─── Component ───────────────────────────────────────────────────────────────

interface PhotoUploadProps {
  input: PhotoUploadInput;
  onUploadComplete?: (photoId: string) => void;
  className?: string;
}

export function PhotoUpload({
  input,
  onUploadComplete,
  className,
}: PhotoUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState<PendingPhoto[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const addFiles = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const imageFiles = fileArray.filter((f) => ACCEPTED_TYPES.includes(f.type));

    if (imageFiles.length === 0) return;

    const newPhotos: PendingPhoto[] = await Promise.all(
      imageFiles.map(async (file) => {
        const previewUrl = URL.createObjectURL(file);
        let gps: ExifGpsData | null = null;
        try {
          gps = await extractExifMetadata(file);
        } catch {
          // GPS extraction is optional
        }
        return {
          file,
          previewUrl,
          caption: "",
          gps,
          status: "pending" as const,
        };
      }),
    );

    setPhotos((prev) => [...prev, ...newPhotos]);
  }, []);

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files) {
        addFiles(e.dataTransfer.files);
      }
    },
    [addFiles],
  );

  const handleFileChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) {
        addFiles(e.target.files);
        e.target.value = "";
      }
    },
    [addFiles],
  );

  const updateCaption = useCallback((index: number, caption: string) => {
    setPhotos((prev) =>
      prev.map((p, i) => (i === index ? { ...p, caption } : p)),
    );
  }, []);

  const removePhoto = useCallback((index: number) => {
    setPhotos((prev) => {
      const photo = prev[index];
      if (photo) URL.revokeObjectURL(photo.previewUrl);
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  const uploadAll = useCallback(async () => {
    const pending = photos.filter((p) => p.status === "pending");
    if (pending.length === 0) return;

    for (let i = 0; i < photos.length; i++) {
      if (photos[i].status !== "pending") continue;

      setPhotos((prev) =>
        prev.map((p, idx) => (idx === i ? { ...p, status: "uploading" } : p)),
      );

      try {
        const photo = photos[i];
        const fileHash = await hashFile(photo.file);

        const body = {
          orgId: input.orgId,
          projectId: input.projectId,
          folderId: input.folderId,
          fileName: photo.file.name,
          mimeType: photo.file.type || "image/jpeg",
          fileSizeBytes: photo.file.size,
          fileHash,
          gpsMetadata:
            photo.gps?.latitude != null && photo.gps?.longitude != null
              ? {
                  latitude: photo.gps.latitude,
                  longitude: photo.gps.longitude,
                  altitude: photo.gps.altitude,
                }
              : null,
          isMobile: /mobile|android|iphone|ipad/i.test(navigator.userAgent),
        };

        const res = await fetch("/api/photos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Erro" }));
          throw new Error(err.error ?? "Erro ao fazer upload");
        }

        const { photo: created } = await res.json();

        // If issueId provided, link to issue
        if (input.issueId && created?.id) {
          await fetch(`/api/issues/${input.issueId}/photos`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              photoId: created.id,
              orgId: input.orgId,
            }),
          });
        }

        setPhotos((prev) =>
          prev.map((p, idx) => (idx === i ? { ...p, status: "done" } : p)),
        );

        onUploadComplete?.(created?.id);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Erro ao fazer upload";
        setPhotos((prev) =>
          prev.map((p, idx) =>
            idx === i ? { ...p, status: "error", errorMessage: message } : p,
          ),
        );
      }
    }
  }, [photos, input, onUploadComplete]);

  const hasPending = photos.some((p) => p.status === "pending");

  return (
    <div className={className}>
      {/* Drop zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={[
          "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors",
          isDragging
            ? "border-blue-500 bg-blue-50"
            : "border-gray-300 hover:border-gray-400 hover:bg-gray-50",
        ].join(" ")}
      >
        <div className="text-gray-400 text-3xl mb-2">📷</div>
        <p className="text-sm font-medium text-gray-700">
          Arrastar fotos ou clicar para seleccionar
        </p>
        <p className="text-xs text-gray-500 mt-1">
          JPEG, PNG, HEIC, WebP — GPS extraído automaticamente
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {/* Preview list */}
      {photos.length > 0 && (
        <div className="mt-4 space-y-3">
          {photos.map((photo, index) => (
            <div
              key={index}
              className="flex gap-3 p-3 border border-gray-200 rounded-lg bg-white"
            >
              {/* Thumbnail */}
              <div className="flex-shrink-0 w-16 h-16 relative overflow-hidden rounded">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.previewUrl}
                  alt={photo.file.name}
                  className="w-full h-full object-cover"
                />
                {photo.status === "uploading" && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                    <span className="text-white text-xs">...</span>
                  </div>
                )}
                {photo.status === "done" && (
                  <div className="absolute inset-0 bg-green-500/40 flex items-center justify-center">
                    <span className="text-white text-lg">✓</span>
                  </div>
                )}
                {photo.status === "error" && (
                  <div className="absolute inset-0 bg-red-500/40 flex items-center justify-center">
                    <span className="text-white text-lg">✗</span>
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {photo.file.name}
                </p>
                <p className="text-xs text-gray-500">
                  {formatFileSize(photo.file.size)}
                </p>
                {formatGps(photo.gps) && (
                  <p className="text-xs text-blue-600 mt-0.5">
                    📍 {formatGps(photo.gps)}
                  </p>
                )}
                {photo.status === "error" && (
                  <p className="text-xs text-red-600 mt-0.5">
                    {photo.errorMessage}
                  </p>
                )}
                {photo.status === "pending" && (
                  <input
                    type="text"
                    placeholder="Legenda (opcional)"
                    value={photo.caption}
                    onChange={(e) => updateCaption(index, e.target.value)}
                    className="mt-1 w-full text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                )}
              </div>

              {/* Remove */}
              {photo.status !== "uploading" && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removePhoto(index);
                  }}
                  className="flex-shrink-0 text-gray-400 hover:text-red-500 text-sm"
                  title="Remover"
                >
                  ✕
                </button>
              )}
            </div>
          ))}

          {/* Upload button */}
          {hasPending && (
            <button
              onClick={uploadAll}
              className="w-full py-2 px-4 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              Fazer upload (
              {photos.filter((p) => p.status === "pending").length}{" "}
              {photos.filter((p) => p.status === "pending").length === 1
                ? "foto"
                : "fotos"}
              )
            </button>
          )}
        </div>
      )}
    </div>
  );
}
