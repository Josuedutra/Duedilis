"use client";

/**
 * PhotoGallery component — Sprint D2, Task gov-1775041297153-uzp0s2
 *
 * Grid de thumbnails com lightbox.
 * Suporta filtros por issue, data, uploader.
 * Responsivo: 4 colunas desktop, 2 colunas mobile.
 */

import { useState, useEffect, useCallback } from "react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface PhotoEvidence {
  id: string;
  type: string;
  fileName: string;
  fileUrl: string;
  caption?: string | null;
  mimeType: string;
  fileSizeBytes: number;
  createdAt: string | Date;
  metadata?: {
    latitude?: number;
    longitude?: number;
    altitude?: number;
  } | null;
  issueId?: string | null;
  issue?: {
    id: string;
    title?: string;
    projectId?: string;
  } | null;
  uploadedBy?: {
    id: string;
    name?: string | null;
    email?: string | null;
  } | null;
}

interface PhotoGalleryProps {
  projectId: string;
  orgId: string;
  issueId?: string;
  className?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatGpsCoords(
  lat?: number | null,
  lng?: number | null,
  alt?: number | null,
): string | null {
  if (!lat || !lng) return null;
  const altStr = alt != null ? `, ${alt.toFixed(1)}m` : "";
  return `${lat.toFixed(6)}, ${lng.toFixed(6)}${altStr}`;
}

// ─── Lightbox ─────────────────────────────────────────────────────────────────

interface LightboxProps {
  photo: PhotoEvidence;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
}

function Lightbox({ photo, onClose, onPrev, onNext }: LightboxProps) {
  const gps = formatGpsCoords(
    photo.metadata?.latitude,
    photo.metadata?.longitude,
    photo.metadata?.altitude,
  );

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") onPrev?.();
      if (e.key === "ArrowRight") onNext?.();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose, onPrev, onNext]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
      onClick={onClose}
    >
      {/* Close */}
      <button
        className="absolute top-4 right-4 text-white text-2xl hover:text-gray-300 z-10"
        onClick={onClose}
      >
        ✕
      </button>

      {/* Prev */}
      {onPrev && (
        <button
          className="absolute left-4 top-1/2 -translate-y-1/2 text-white text-3xl hover:text-gray-300 z-10 px-2"
          onClick={(e) => {
            e.stopPropagation();
            onPrev();
          }}
        >
          ‹
        </button>
      )}

      {/* Next */}
      {onNext && (
        <button
          className="absolute right-4 top-1/2 -translate-y-1/2 text-white text-3xl hover:text-gray-300 z-10 px-2"
          onClick={(e) => {
            e.stopPropagation();
            onNext();
          }}
        >
          ›
        </button>
      )}

      {/* Image + overlay */}
      <div
        className="flex flex-col items-center max-w-4xl w-full px-16"
        onClick={(e) => e.stopPropagation()}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo.fileUrl}
          alt={photo.fileName}
          className="max-h-[70vh] max-w-full object-contain rounded"
        />

        {/* Info overlay */}
        <div className="mt-4 bg-black/60 text-white rounded-lg px-4 py-3 w-full max-w-lg text-sm space-y-1">
          {photo.caption && <p className="font-medium">{photo.caption}</p>}
          <p className="text-gray-300 text-xs">{photo.fileName}</p>
          <p className="text-gray-400 text-xs">{formatDate(photo.createdAt)}</p>
          {gps && <p className="text-blue-300 text-xs">📍 {gps}</p>}
          {photo.uploadedBy && (
            <p className="text-gray-400 text-xs">
              Por {photo.uploadedBy.name ?? photo.uploadedBy.email}
            </p>
          )}
          {photo.issue && (
            <p className="text-gray-400 text-xs">
              Issue: {photo.issue.title ?? photo.issue.id}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function PhotoGallery({
  projectId,
  orgId,
  issueId,
  className,
}: PhotoGalleryProps) {
  const [photos, setPhotos] = useState<PhotoEvidence[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [filterIssue, setFilterIssue] = useState("");

  const fetchPhotos = useCallback(
    async (pageNum: number, reset = false) => {
      try {
        setLoading(true);
        setError(null);

        let url: string;
        if (issueId) {
          url = `/api/photos?orgId=${orgId}&issueId=${issueId}&page=${pageNum}&limit=20`;
        } else {
          url = `/api/photos?orgId=${orgId}&projectId=${projectId}&page=${pageNum}&limit=20`;
        }

        const res = await fetch(url);
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? "Erro ao carregar fotos");
        }

        const data = await res.json();
        const newPhotos: PhotoEvidence[] = data.photos ?? [];

        setPhotos((prev) => (reset ? newPhotos : [...prev, ...newPhotos]));
        setHasMore(newPhotos.length === 20);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro desconhecido");
      } finally {
        setLoading(false);
      }
    },
    [projectId, orgId, issueId],
  );

  useEffect(() => {
    fetchPhotos(1, true);
    setPage(1);
  }, [fetchPhotos]);

  const loadMore = useCallback(() => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchPhotos(nextPage, false);
  }, [page, fetchPhotos]);

  const openLightbox = useCallback((index: number) => {
    setLightboxIndex(index);
  }, []);

  const closeLightbox = useCallback(() => {
    setLightboxIndex(null);
  }, []);

  const prevPhoto = useCallback(() => {
    setLightboxIndex((i) => (i != null && i > 0 ? i - 1 : i));
  }, []);

  const nextPhoto = useCallback(() => {
    setLightboxIndex((i) => (i != null && i < photos.length - 1 ? i + 1 : i));
  }, [photos.length]);

  // Filter by issue
  const filteredPhotos = filterIssue
    ? photos.filter((p) => p.issueId === filterIssue)
    : photos;

  // Unique issues for filter
  const issues = Array.from(
    new Map(
      photos.filter((p) => p.issue?.id).map((p) => [p.issue!.id, p.issue!]),
    ).values(),
  );

  if (error) {
    return (
      <div className={className}>
        <p className="text-sm text-red-600">{error}</p>
      </div>
    );
  }

  return (
    <div className={className}>
      {/* Filters (only for project-level gallery) */}
      {!issueId && issues.length > 0 && (
        <div className="flex gap-2 mb-4 flex-wrap">
          <button
            onClick={() => setFilterIssue("")}
            className={[
              "px-3 py-1 text-xs rounded-full border transition-colors",
              !filterIssue
                ? "bg-blue-600 text-white border-blue-600"
                : "border-gray-300 text-gray-600 hover:border-gray-400",
            ].join(" ")}
          >
            Todas
          </button>
          {issues.map((issue) => (
            <button
              key={issue.id}
              onClick={() => setFilterIssue(issue.id)}
              className={[
                "px-3 py-1 text-xs rounded-full border transition-colors",
                filterIssue === issue.id
                  ? "bg-blue-600 text-white border-blue-600"
                  : "border-gray-300 text-gray-600 hover:border-gray-400",
              ].join(" ")}
            >
              {issue.title ?? issue.id}
            </button>
          ))}
        </div>
      )}

      {/* Grid */}
      {filteredPhotos.length === 0 && !loading && (
        <div className="text-center py-12 text-gray-500">
          <div className="text-4xl mb-2">📷</div>
          <p className="text-sm">Nenhuma foto de obra ainda</p>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
        {filteredPhotos.map((photo, index) => (
          <button
            key={photo.id}
            onClick={() => openLightbox(index)}
            className="relative aspect-square overflow-hidden rounded-lg group bg-gray-100 hover:ring-2 hover:ring-blue-500 transition-all"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo.fileUrl}
              alt={photo.fileName}
              className="w-full h-full object-cover transition-transform group-hover:scale-105"
              loading="lazy"
            />
            {/* GPS badge */}
            {photo.metadata?.latitude && (
              <span className="absolute top-1 right-1 bg-blue-500/80 text-white text-[10px] px-1 rounded">
                📍
              </span>
            )}
            {/* Caption overlay */}
            {photo.caption && (
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <p className="text-white text-xs truncate">{photo.caption}</p>
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Load more */}
      {hasMore && !loading && filteredPhotos.length >= 20 && (
        <div className="text-center mt-4">
          <button
            onClick={loadMore}
            className="px-4 py-2 text-sm text-blue-600 border border-blue-300 rounded-lg hover:bg-blue-50 transition-colors"
          >
            Carregar mais fotos
          </button>
        </div>
      )}

      {loading && (
        <div className="text-center py-4 text-gray-400 text-sm">
          A carregar...
        </div>
      )}

      {/* Lightbox */}
      {lightboxIndex != null && filteredPhotos[lightboxIndex] && (
        <Lightbox
          photo={filteredPhotos[lightboxIndex]}
          onClose={closeLightbox}
          onPrev={lightboxIndex > 0 ? prevPhoto : undefined}
          onNext={
            lightboxIndex < filteredPhotos.length - 1 ? nextPhoto : undefined
          }
        />
      )}
    </div>
  );
}
