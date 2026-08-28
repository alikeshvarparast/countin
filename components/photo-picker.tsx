"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/avatar";
import { prepareImageFile } from "@/lib/prepare-image";

export function PhotoPicker({
  name,
  imageUrl,
  extraFields,
  action,
  label,
}: {
  name: string;
  imageUrl?: string | null;
  extraFields?: React.ReactNode;
  action: (formData: FormData) => Promise<{ error?: string; imageUrl?: string | null } | void>;
  label: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onPick(file: File | undefined) {
    if (!file || !file.size) return;
    setError(null);
    setBusy(true);
    setPreview(URL.createObjectURL(file));
    try {
      const prepared = await prepareImageFile(file);
      const formData = new FormData();
      const form = inputRef.current?.form;
      if (form) {
        for (const [key, value] of new FormData(form).entries()) {
          if (key !== "avatar") formData.set(key, value);
        }
      }
      formData.set("avatar", prepared);
      const result = await action(formData);
      if (result && "error" in result && result.error) {
        setError(result.error);
        setPreview(null);
      } else {
        if (result && "imageUrl" in result && result.imageUrl) setPreview(result.imageUrl);
        router.refresh();
      }
    } catch {
      setError("Could not save the picture.");
      setPreview(null);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div>
      <form className="flex items-center gap-4">
        {extraFields}
        <button
          type="button"
          className="shrink-0 rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          aria-label={label}
        >
          <Avatar src={preview || imageUrl} name={name} size="lg" />
        </button>
        <div className="min-w-0">
          <input
            ref={inputRef}
            name="avatar"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/*"
            className="hidden"
            onChange={(event) => void onPick(event.target.files?.[0])}
          />
          <button
            type="button"
            className="text-sm font-medium text-primary"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
          >
            {busy ? "Saving…" : label}
          </button>
          <p className="mt-1 text-xs text-ink/50">Tap the picture to change it. JPG, PNG, or WebP.</p>
          {error && <p className="mt-1 text-sm text-clay">{error}</p>}
        </div>
      </form>
    </div>
  );
}
