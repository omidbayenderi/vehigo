"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type VehicleImage = { id: string; storage_path: string; is_primary: boolean };

export default function ImageGallery({
  organizationId,
  vehicleId,
  images,
}: {
  organizationId: string;
  vehicleId: string;
  images: VehicleImage[];
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const entries = await Promise.all(
        images.map(async (img) => {
          const { data } = await supabase.storage
            .from("vehicle-images")
            .createSignedUrl(img.storage_path, 3600);
          return [img.id, data?.signedUrl ?? ""] as const;
        }),
      );
      if (!cancelled) setUrls(Object.fromEntries(entries));
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [images]);

  const handleUpload = async () => {
    const files = inputRef.current?.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    setError(null);

    for (const file of Array.from(files)) {
      const path = `${organizationId}/${vehicleId}/${crypto.randomUUID()}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("vehicle-images")
        .upload(path, file);

      if (uploadError) {
        setError(uploadError.message);
        continue;
      }

      const { error: insertError } = await supabase.from("vehicle_images").insert({
        vehicle_id: vehicleId,
        storage_path: path,
        is_primary: images.length === 0,
      });

      if (insertError) {
        setError(insertError.message);
      }
    }

    setUploading(false);
    if (inputRef.current) inputRef.current.value = "";
    router.refresh();
  };

  return (
    <div className="mt-6 rounded-lg border border-line-soft bg-surface p-6 shadow-[0_1px_2px_rgba(23,24,43,0.04)]">
      <h2 className="mb-3 text-sm font-medium text-ink-soft">Görseller</h2>
      {images.length > 0 ? (
        <div className="mb-4 grid grid-cols-4 gap-2">
          {images.map((img) => (
            <div key={img.id} className="aspect-square overflow-hidden rounded-md bg-surface-sunken">
              {urls[img.id] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={urls[img.id]} alt="" className="h-full w-full object-cover" />
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <p className="mb-4 text-sm text-ink-faint">Henüz görsel yüklenmedi.</p>
      )}
      <input ref={inputRef} type="file" accept="image/*" multiple className="mb-2 text-sm" />
      <button
        type="button"
        onClick={handleUpload}
        disabled={uploading}
        className="block rounded-md border border-line px-3 py-2 text-sm hover:bg-surface-sunken disabled:opacity-50"
      >
        {uploading ? "Yükleniyor..." : "Görsel yükle"}
      </button>
      {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
    </div>
  );
}
