"use client";

import { useState } from "react";
import { Film, Upload, X } from "lucide-react";

export function SingleVideoUpload({
  value,
  onChange,
  label = "Video",
}: {
  value: string;
  onChange: (url: string) => void;
  label?: string;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  async function handleFile(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setError("");

    if (!file.type.startsWith("video/")) {
      setError("Choose an MP4, WebM or MOV video");
      return;
    }
    if (file.size > 100 * 1024 * 1024) {
      setError("Video must be under 100MB");
      return;
    }

    setUploading(true);
    try {
      const sigRes = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resourceType: "video" }),
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

      const uploadRes = await fetch(uploadUrl, { method: "POST", body: form });
      const data = await uploadRes.json();
      if (!uploadRes.ok || !data.secure_url) {
        throw new Error(data?.error?.message || "Video upload failed");
      }
      onChange(data.secure_url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Video upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <label className="mb-1 block text-sm font-medium">{label}</label>
      {value ? (
        <div className="group relative aspect-[9/16] w-28 overflow-hidden rounded-md border bg-gray-950">
          <video src={value} muted playsInline preload="metadata" className="h-full w-full object-cover" />
          <span className="absolute left-1 top-1 rounded bg-black/60 p-1 text-white">
            <Film size={13} />
          </span>
          <button
            type="button"
            onClick={() => onChange("")}
            aria-label="Remove video"
            className="absolute right-1 top-1 rounded-full bg-red-600 p-1 text-white opacity-90 transition hover:scale-110"
          >
            <X size={12} />
          </button>
        </div>
      ) : (
        <label className="flex aspect-[9/16] w-28 cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed text-gray-400 hover:border-gray-500 hover:text-gray-600">
          <Upload size={18} />
          <span className="mt-1 text-xs">{uploading ? "Uploading…" : "Upload video"}</span>
          <input
            type="file"
            accept="video/mp4,video/webm,video/quicktime"
            className="hidden"
            disabled={uploading}
            onChange={(event) => {
              handleFile(event.target.files);
              event.target.value = "";
            }}
          />
        </label>
      )}
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
}
