"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type VehicleImage = { id: string; storage_path: string; is_primary: boolean };

export default function ImageGallery({
  vehicleId,
  images,
}: {
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
      const path = `${vehicleId}/${crypto.randomUUID()}-${file.name}`;
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
    <div className="mt-6 rounded-lg border border-zinc-200 bg-white p-6">
      <h2 className="mb-3 text-sm font-medium text-zinc-700">Görseller</h2>
      {images.length > 0 ? (
        <div className="mb-4 grid grid-cols-4 gap-2">
          {images.map((img) => (
            <div key={img.id} className="aspect-square overflow-hidden rounded-md bg-zinc-100">
              {urls[img.id] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={urls[img.id]} alt="" className="h-full w-full object-cover" />
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <p className="mb-4 text-sm text-zinc-500">Henüz görsel yüklenmedi.</p>
      )}
      <input ref={inputRef} type="file" accept="image/*" multiple className="mb-2 text-sm" />
      <button
        type="button"
        onClick={handleUpload}
        disabled={uploading}
        className="block rounded-md border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-100 disabled:opacity-50"
      >
        {uploading ? "Yükleniyor..." : "Görsel yükle"}
      </button>
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
