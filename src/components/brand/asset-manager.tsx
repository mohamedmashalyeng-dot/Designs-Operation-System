"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { File as FileIcon, Loader2, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BRAND_ASSET_TYPES, type BrandAssetType } from "@/lib/constants/enums";
import { uploadBrandAssetAction, deleteBrandAssetAction } from "@/lib/actions/brand";
import type { BrandAssetWithUrl } from "@/lib/brand/queries";

const TYPE_LABELS: Record<BrandAssetType, string> = {
  logo: "Logo",
  image: "Image",
  document: "Document",
  other: "Other",
};

export function AssetManager({ brandId, assets }: { brandId: string; assets: BrandAssetWithUrl[] }) {
  const [type, setType] = useState<BrandAssetType>("logo");
  const [pending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.set("brandId", brandId);
    formData.set("type", type);
    formData.set("file", file);

    startTransition(async () => {
      const result = await uploadBrandAssetAction(formData);
      if (result?.error) toast.error(result.error);
      else toast.success("Uploaded");
      if (fileInputRef.current) fileInputRef.current.value = "";
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={type} onValueChange={(v) => setType(v as BrandAssetType)}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {BRAND_ASSET_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {TYPE_LABELS[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          disabled={pending}
          onClick={() => fileInputRef.current?.click()}
        >
          {pending ? <Loader2 className="animate-spin" /> : <Upload />}
          Upload file
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/svg+xml,image/webp,application/pdf"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {assets.map((asset) => (
          <div key={asset.id} className="space-y-2 rounded-lg border p-3">
            <div className="flex aspect-square items-center justify-center overflow-hidden rounded-md bg-muted">
              {asset.url && asset.mime_type?.startsWith("image/") ? (
                // eslint-disable-next-line @next/next/no-img-element -- dynamic Supabase Storage URL
                <img src={asset.url} alt={asset.file_name} className="size-full object-contain" />
              ) : (
                <FileIcon className="size-6 text-muted-foreground/50" />
              )}
            </div>
            <p className="truncate text-xs font-medium">{asset.file_name}</p>
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground">{TYPE_LABELS[asset.type]}</span>
              <DeleteAssetButton assetId={asset.id} storagePath={asset.storage_path} />
            </div>
          </div>
        ))}
        {assets.length === 0 && <p className="col-span-full text-sm text-muted-foreground">No assets uploaded yet.</p>}
      </div>
    </div>
  );
}

function DeleteAssetButton({ assetId, storagePath }: { assetId: string; storagePath: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await deleteBrandAssetAction(assetId, storagePath);
          if (result?.error) toast.error(result.error);
        })
      }
    >
      {pending ? <Loader2 className="animate-spin" /> : <Trash2 />}
    </Button>
  );
}
