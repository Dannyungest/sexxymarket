/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useRef, useState } from "react";
import { ActionButton } from "@sexxymarket/ui";
import { AuthoringRequestError } from "./api-types";
import { useProductAuthoringApi } from "./authoring-api-context";
import type { ProductMediaDraft } from "./types";
import { uploadProductImageFile } from "./product-image-upload";

function uid() {
  return `media-${Math.random().toString(36).slice(2, 10)}`;
}

function uploadKey(file: File, index: number) {
  return `${file.name}-${file.size}-${file.lastModified}-${index}`;
}

export function MediaUploader({
  media,
  onChange,
}: {
  media: ProductMediaDraft[];
  onChange: (next: ProductMediaDraft[]) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const api = useProductAuthoringApi();
  const mediaRef = useRef(media);
  const [uploadingFiles, setUploadingFiles] = useState<Array<{ id: string; name: string }>>([]);
  const [batchProgress, setBatchProgress] = useState<{ done: number; total: number } | null>(null);
  const [uploadNotes, setUploadNotes] = useState<string[]>([]);
  const [lastError, setLastError] = useState("");

  useEffect(() => {
    mediaRef.current = media;
  }, [media]);

  const upsertUploadingFile = (id: string, name: string, uploading: boolean) => {
    setUploadingFiles((prev) =>
      uploading
        ? (prev.some((item) => item.id === id) ? prev : [...prev, { id, name }])
        : prev.filter((item) => item.id !== id),
    );
  };

  const appendMedia = (entry: ProductMediaDraft) => {
    const next = [...mediaRef.current, entry];
    mediaRef.current = next;
    onChange(next);
  };

  const uploadFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const token = api.getToken();
    if (!token) {
      api.toast({ kind: "error", message: "Session missing. Please sign in again." });
      return;
    }
    const fileEntries = Array.from(files).map((file, index) => ({
      file,
      id: uploadKey(file, index),
    }));
    let successCount = 0;
    let failedCount = 0;
    const notes: string[] = [];
    setBatchProgress({ done: 0, total: fileEntries.length });
    setUploadNotes([]);
    setLastError("");

    for (const [index, entry] of fileEntries.entries()) {
      const { file, id } = entry;
      try {
        upsertUploadingFile(id, file.name, true);
        const done = await uploadProductImageFile(token, file, {
          apiBase: api.getApiBase(),
          path: api.productImageUploadPath,
        });
        appendMedia({
          id: uid(),
          imageUrl: done.url,
          storageKey: done.key,
          sortOrder: mediaRef.current.length,
          isPrimary: mediaRef.current.length === 0,
        });
        successCount += 1;
        notes.push(`${file.name} uploaded`);
      } catch (e) {
        failedCount += 1;
        const message = e instanceof AuthoringRequestError ? e.message : `Upload failed for ${file.name}`;
        notes.push(message);
        setLastError(message);
        api.toast({
          kind: "error",
          message: e instanceof AuthoringRequestError ? e.message : `Image upload failed for ${file.name}`,
        });
      } finally {
        upsertUploadingFile(id, file.name, false);
        setBatchProgress({ done: index + 1, total: fileEntries.length });
      }
    }

    setUploadNotes(notes);
    if (failedCount === 0) {
      api.toast({ kind: "success", message: `Uploaded ${successCount} image${successCount === 1 ? "" : "s"}.` });
    } else if (successCount > 0) {
      api.toast({ kind: "error", message: `Uploaded ${successCount}, ${failedCount} failed.` });
    }
  };

  return (
    <div className="panel-stack">
      <div className="actions-row" style={{ justifyContent: "space-between" }}>
        <h3 className="section-title" style={{ fontSize: "1rem", margin: 0 }}>
          Product media *
        </h3>
        <ActionButton ghost onClick={() => fileInputRef.current?.click()} disabled={uploadingFiles.length > 0}>
          {uploadingFiles.length > 0 ? `Uploading ${uploadingFiles.length}...` : "Upload image(s)"}
        </ActionButton>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          style={{ display: "none" }}
          disabled={uploadingFiles.length > 0}
          onChange={(e) => {
            void uploadFiles(e.target.files);
            e.currentTarget.value = "";
          }}
        />
      </div>
      <p className="muted" style={{ margin: 0, fontSize: "0.82rem" }}>
        Upload high-quality, well-lit images (recommended 1600px+ width) for a premium storefront experience.
      </p>
      {uploadingFiles.length > 0 ? (
        <p className="muted" role="status" style={{ margin: 0, fontSize: "0.82rem" }}>
          Uploading: {uploadingFiles.map((item) => item.name).join(", ")}
        </p>
      ) : null}
      {batchProgress ? (
        <p role="status" style={{ margin: 0, fontSize: "0.82rem", color: "var(--ui-muted)" }}>
          Upload progress: {batchProgress.done}/{batchProgress.total}
        </p>
      ) : null}
      {lastError ? (
        <p role="alert" style={{ margin: 0, fontSize: "0.82rem", color: "var(--ui-danger)" }}>
          {lastError}
        </p>
      ) : null}
      {uploadNotes.length > 0 ? (
        <div className="panel-stack" style={{ gap: 4 }}>
          {uploadNotes.slice(-4).map((note, index) => (
            <p key={`${note}-${index}`} className="muted" style={{ margin: 0, fontSize: "0.78rem" }}>
              {note}
            </p>
          ))}
        </div>
      ) : null}
      {media.length === 0 ? <p className="muted" style={{ margin: 0 }}>No images yet.</p> : null}
      <div className="actions-row">
        {media.map((item, index) => (
          <div key={item.id} className="surface-card" style={{ padding: "0.5rem", width: 160 }}>
            <div className="actions-row" style={{ justifyContent: "space-between", marginBottom: 4 }}>
              <span className="chip" style={{ fontSize: "0.72rem" }}>
                {item.isPrimary ? "Primary" : `Image ${index + 1}`}
              </span>
              <span className="muted" style={{ fontSize: "0.72rem" }}>
                {item.cropPreset ?? "card"}
              </span>
            </div>
            <img src={item.imageUrl} alt="" width={140} height={110} style={{ objectFit: "cover", borderRadius: 8 }} />
            <div className="field" style={{ marginTop: 6 }}>
              <label>Alt text</label>
              <input
                className="text-input"
                value={item.altText ?? ""}
                onChange={(e) => {
                  const next = [...media];
                  next[index] = { ...item, altText: e.target.value };
                  onChange(next);
                }}
              />
            </div>
            <div className="field" style={{ marginTop: 6 }}>
              <label>Crop preset</label>
              <select
                className="text-input"
                value={item.cropPreset ?? "card"}
                onChange={(e) => {
                  const next = [...media];
                  next[index] = { ...item, cropPreset: e.target.value as "hero" | "card" | "thumb" };
                  onChange(next);
                }}
              >
                <option value="hero">Hero</option>
                <option value="card">Card</option>
                <option value="thumb">Thumb</option>
              </select>
            </div>
            <div className="actions-row" style={{ marginTop: 6 }}>
              <ActionButton
                ghost
                onClick={() => {
                  const selected = media[index];
                  const others = media.filter((_, idx) => idx !== index).map((entry) => ({ ...entry, isPrimary: false }));
                  const next = [{ ...selected, isPrimary: true }, ...others].map((entry, idx) => ({
                    ...entry,
                    sortOrder: idx,
                  }));
                  onChange(next);
                }}
              >
                {item.isPrimary ? "Primary" : "Set primary"}
              </ActionButton>
              <button
                type="button"
                className="chip"
                onClick={() => {
                  if (index === 0) return;
                  const next = [...media];
                  const [moved] = next.splice(index, 1);
                  next.splice(index - 1, 0, moved);
                  onChange(
                    next.map((entry, idx) => ({
                      ...entry,
                      sortOrder: idx,
                      isPrimary: idx === 0,
                    })),
                  );
                }}
              >
                Up
              </button>
              <button
                type="button"
                className="chip"
                onClick={() => {
                  if (index >= media.length - 1) return;
                  const next = [...media];
                  const [moved] = next.splice(index, 1);
                  next.splice(index + 1, 0, moved);
                  onChange(
                    next.map((entry, idx) => ({
                      ...entry,
                      sortOrder: idx,
                      isPrimary: idx === 0,
                    })),
                  );
                }}
              >
                Down
              </button>
              <button
                type="button"
                className="chip"
                onClick={() => onChange(media.filter((entry) => entry.id !== item.id))}
              >
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
