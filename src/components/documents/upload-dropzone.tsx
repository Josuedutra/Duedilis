"use client";

/**
 * UploadDropzone — drag & drop upload com SHA-256 hash + R2 presigned URL
 * Task: gov-1775041228837-pj6dba
 *
 * Flow:
 *  1. User drops/selects files (≤50)
 *  2. SHA-256 hash calculado no browser via Web Crypto API
 *  3. Presign API chamada → uploadUrl + key
 *  4. PUT directo ao R2 com uploadUrl
 *  5. Confirm API chamada para registar Document em DB
 */

import { useState, useCallback, useRef } from "react";
import { presignUpload } from "@/lib/actions/upload-actions";
import { createIndividualDocument } from "@/lib/actions/upload-actions";

const MAX_FILES = 50;

interface FileState {
  file: File;
  status: "hashing" | "uploading" | "done" | "error";
  progress: number;
  error?: string;
  hash?: string;
}

interface Props {
  orgId: string;
  projectId: string;
  folderId: string;
  onComplete: () => void;
  onCancel: () => void;
}

export function UploadDropzone({
  orgId,
  projectId,
  folderId,
  onComplete,
  onCancel,
}: Props) {
  const [fileStates, setFileStates] = useState<FileState[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback((newFiles: FileList | File[]) => {
    const arr = Array.from(newFiles).slice(0, MAX_FILES);
    if (arr.length === 0) return;
    setFileStates((prev) => {
      const existing = new Set(prev.map((f) => f.file.name));
      const fresh = arr.filter((f) => !existing.has(f.name));
      return [
        ...prev,
        ...fresh.map((f) => ({
          file: f,
          status: "hashing" as const,
          progress: 0,
        })),
      ];
    });
  }, []);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    addFiles(e.dataTransfer.files);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave() {
    setIsDragging(false);
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) addFiles(e.target.files);
  }

  function removeFile(name: string) {
    setFileStates((prev) => prev.filter((f) => f.file.name !== name));
  }

  async function computeSha256(file: File): Promise<string> {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  async function uploadFile(fileState: FileState): Promise<void> {
    const { file } = fileState;

    // Step 1: hash
    updateFile(file.name, { status: "hashing", progress: 5 });
    const hash = await computeSha256(file);
    updateFile(file.name, { hash, progress: 20 });

    // Step 2: presign
    const { uploadUrl } = await presignUpload({
      orgId,
      projectId,
      folderId,
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      fileSizeBytes: file.size,
    });

    updateFile(file.name, { status: "uploading", progress: 40 });

    // Step 3: upload to R2 (direct PUT)
    // If uploadUrl is a placeholder (dev), skip actual PUT
    if (!uploadUrl.includes("r2-pending.example.com")) {
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", uploadUrl);
        xhr.setRequestHeader(
          "Content-Type",
          file.type || "application/octet-stream",
        );
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const pct = 40 + Math.round((e.loaded / e.total) * 40);
            updateFile(file.name, { progress: pct });
          }
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else reject(new Error(`R2 upload falhou: ${xhr.status}`));
        };
        xhr.onerror = () => reject(new Error("Erro de rede no upload."));
        xhr.send(file);
      });
    } else {
      updateFile(file.name, { progress: 80 });
    }

    // Step 4: create Document record in DB
    await createIndividualDocument({
      orgId,
      projectId,
      folderId,
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      fileSizeBytes: file.size,
      fileHash: hash,
    });

    updateFile(file.name, { status: "done", progress: 100 });
  }

  function updateFile(name: string, patch: Partial<FileState>) {
    setFileStates((prev) =>
      prev.map((f) => (f.file.name === name ? { ...f, ...patch } : f)),
    );
  }

  async function handleUpload() {
    if (fileStates.length === 0) return;
    if (fileStates.length > MAX_FILES) {
      setGlobalError(`Máximo ${MAX_FILES} ficheiros por batch.`);
      return;
    }
    setIsUploading(true);
    setGlobalError(null);

    const pending = fileStates.filter((f) => f.status !== "done");

    await Promise.allSettled(
      pending.map(async (fs) => {
        try {
          await uploadFile(fs);
        } catch (err) {
          updateFile(fs.file.name, {
            status: "error",
            error: err instanceof Error ? err.message : "Erro desconhecido.",
          });
        }
      }),
    );

    setIsUploading(false);

    const hasErrors = fileStates.some((f) => f.status === "error");
    if (!hasErrors) {
      onComplete();
    }
  }

  const allDone =
    fileStates.length > 0 && fileStates.every((f) => f.status === "done");

  return (
    <div className="bg-white rounded-xl border p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-900">
          Carregar documentos
        </h3>
        <button
          onClick={onCancel}
          disabled={isUploading}
          className="text-gray-400 hover:text-gray-600 transition-colors"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => !isUploading && inputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors mb-4 ${
          isDragging
            ? "border-blue-400 bg-blue-50"
            : "border-gray-200 hover:border-blue-300 hover:bg-gray-50"
        } ${isUploading ? "cursor-not-allowed opacity-60" : ""}`}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFileInput}
          disabled={isUploading}
        />
        <svg
          className="w-10 h-10 text-gray-300 mx-auto mb-3"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
          />
        </svg>
        <p className="text-sm text-gray-600">
          <span className="font-medium text-blue-600">
            Clique para seleccionar
          </span>{" "}
          ou arraste ficheiros aqui
        </p>
        <p className="text-xs text-gray-400 mt-1">
          PDF, DWG, IFC, DOCX, XLSX, imagens — máx. {MAX_FILES} ficheiros /
          100MB cada
        </p>
      </div>

      {/* File list */}
      {fileStates.length > 0 && (
        <ul className="space-y-2 mb-4 max-h-60 overflow-y-auto">
          {fileStates.map((fs) => (
            <li
              key={fs.file.name}
              className="flex items-center gap-3 bg-gray-50 rounded-lg px-3 py-2"
            >
              <span
                className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  fs.status === "done"
                    ? "bg-green-400"
                    : fs.status === "error"
                      ? "bg-red-400"
                      : fs.status === "uploading" || fs.status === "hashing"
                        ? "bg-blue-400 animate-pulse"
                        : "bg-gray-300"
                }`}
              />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-800 truncate">
                  {fs.file.name}
                </p>
                {fs.status === "error" && fs.error && (
                  <p className="text-xs text-red-500 mt-0.5">{fs.error}</p>
                )}
                {(fs.status === "hashing" || fs.status === "uploading") && (
                  <div className="mt-1 h-1 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-400 rounded-full transition-all duration-300"
                      style={{ width: `${fs.progress}%` }}
                    />
                  </div>
                )}
              </div>
              <span className="text-xs text-gray-400 flex-shrink-0">
                {formatBytes(fs.file.size)}
              </span>
              {!isUploading && fs.status !== "done" && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFile(fs.file.name);
                  }}
                  className="text-gray-300 hover:text-red-400 transition-colors flex-shrink-0"
                >
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {globalError && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-4">
          {globalError}
        </p>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-400">
          {fileStates.length > 0
            ? `${fileStates.length} ficheiro(s) seleccionado(s)`
            : "Nenhum ficheiro seleccionado"}
        </p>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            disabled={isUploading}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          {allDone ? (
            <button
              onClick={onComplete}
              className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
            >
              Concluído
            </button>
          ) : (
            <button
              onClick={handleUpload}
              disabled={isUploading || fileStates.length === 0}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {isUploading
                ? "A carregar..."
                : `Carregar ${fileStates.length > 0 ? fileStates.length : ""} ficheiro(s)`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
