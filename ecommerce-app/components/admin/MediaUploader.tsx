"use client";

import { useState } from "react";
import { X, Upload, Film, Image as ImageIcon, ArrowLeft, ArrowRight } from "lucide-react";
import { uploadResourceType, videoPoster, type MediaItem } from "@/lib/media";

/**
 * Gallery editor accepting both images and videos.
 *
 * Uploads go straight from the browser to Cloudinary using a short-lived signed
 * signature, so the file bytes never pass through our server — which is what
 * keeps a 40MB product video from hitting the serverless request-body limit.
 * A fresh signature is requested per file, because one signature is tied to a
 * single timestamp and folder.
 */
export function MediaUploader({
  media,
  onChange,
  max = 8,
  label = "Images & video",
  hint,
}: {
  media: MediaItem[];
  onChange: (media: MediaItem[]) => void;
  max?: number;
  label?: string;
  hint?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    setError("");

    const remaining = max - media.length;
    if (remaining <= 0) {
      setError(`You can add at most ${max} items`);
      return;
    }

    const batch = Array.from(files).slice(0, remaining);
    setBusy(true);
    const added: MediaItem[] = [];

    try {
      for (const [i, file] of batch.entries()) {
        const kind = uploadResourceType(file);
        setProgress(`Uploading ${i + 1} of ${batch.length}…`);

        // Videos are large; warn rather than letting Cloudinary reject it after
        // the shopper's admin has waited through a long upload.
        if (kind === "video" && file.size > 100 * 1024 * 1024) {
          throw new Error(`"${file.name}" is over 100MB — compress it before uploading`);
        }

        const sigRes = await fetch("/api/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ resourceType: kind }),
        });
        if (!sigRes.ok) {
          const data = await sigRes.json().catch(() => ({}));
          throw new Error(data.error || "Could not start the upload");
        }
        const { signature, timestamp, folder, apiKey, uploadUrl } = await sigRes.json();

        const form = new FormData();
        form.append("file", file);
        form.append("api_key", apiKey);
        form.append("timestamp", String(timestamp));
        form.append("signature", signature);
        form.append("folder", folder);

        const res = await fetch(uploadUrl, { method: "POST", body: form });
        const data = await res.json();
        if (!res.ok || !data.secure_url) {
          throw new Error(data?.error?.message || `Upload failed for "${file.name}"`);
        }

        added.push({ type: kind, url: data.secure_url });
      }

      onChange([...media, ...added]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
      setProgress("");
    }
  }

  function move(from: number, to: number) {
    if (to < 0 || to >= media.length) return;
    const next = [...media];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onChange(next);
  }

  const imageCount = media.filter((m) => m.type === "image").length;

  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium">{label}</label>
      {hint && <p className="mb-2 text-xs text-gray-500">{hint}</p>}

      <div className="flex flex-wrap gap-2.5">
        {media.map((item, i) => (
          <div
            key={item.url + i}
            className="group relative h-24 w-20 overflow-hidden rounded-md border bg-gray-50"
          >
            {item.type === "video" ? (
              videoPoster(item) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={videoPoster(item)} alt="" className="h-full w-full object-cover" />
              ) : (
                <video src={item.url} muted className="h-full w-full object-cover" />
              )
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.url} alt="" className="h-full w-full object-cover" />
            )}

            <span className="absolute left-1 top-1 rounded bg-black/60 px-1 py-0.5 text-[9px] font-medium uppercase tracking-wide text-white">
              {item.type === "video" ? (
                <Film size={9} className="inline" />
              ) : (
                <ImageIcon size={9} className="inline" />
              )}
            </span>

            <button
              type="button"
              onClick={() => onChange(media.filter((_, j) => j !== i))}
              aria-label="Remove"
              className="absolute right-1 top-1 rounded-full bg-red-600 p-0.5 text-white"
            >
              <X size={10} />
            </button>

            <div className="absolute inset-x-0 bottom-0 flex justify-between bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
              <button
                type="button"
                onClick={() => move(i, i - 1)}
                disabled={i === 0}
                aria-label="Move earlier"
                className="p-1 text-white disabled:opacity-30"
              >
                <ArrowLeft size={11} />
              </button>
              <button
                type="button"
                onClick={() => move(i, i + 1)}
                disabled={i === media.length - 1}
                aria-label="Move later"
                className="p-1 text-white disabled:opacity-30"
              >
                <ArrowRight size={11} />
              </button>
            </div>
          </div>
        ))}

        {media.length < max && (
          <label className="flex h-24 w-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-md border border-dashed text-gray-400 hover:border-gray-500 hover:text-gray-600">
            <input
              type="file"
              accept="image/*,video/mp4,video/webm,video/quicktime"
              multiple
              className="sr-only"
              onChange={(e) => {
                handleFiles(e.target.files);
                e.target.value = "";
              }}
            />
            <Upload size={15} />
            <span className="text-[10px]">{busy ? "…" : "Add"}</span>
          </label>
        )}
      </div>

      {progress && <p className="mt-2 text-xs text-gray-500">{progress}</p>}
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

      <p className="mt-2 text-xs text-gray-400">
        {media.length} of {max} · {imageCount} image{imageCount === 1 ? "" : "s"},{" "}
        {media.length - imageCount} video{media.length - imageCount === 1 ? "" : "s"}. The first
        image is used as the thumbnail and social preview. Drag order with the arrows.
      </p>
    </div>
  );
}
