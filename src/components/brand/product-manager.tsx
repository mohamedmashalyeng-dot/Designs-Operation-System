"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { upsertProductAction, deleteProductAction } from "@/lib/actions/brand";
import type { Tables } from "@/types/database";

const splitList = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);
const NO_AUDIENCE = "__none__";

export function ProductManager({
  brandId,
  products,
  audiences,
}: {
  brandId: string;
  products: Tables<"products">[];
  audiences: Tables<"audiences">[];
}) {
  const [editing, setEditing] = useState<Tables<"products"> | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const audienceName = (id: string | null) => audiences.find((a) => a.id === id)?.name;

  return (
    <div className="space-y-4">
      <Button
        onClick={() => {
          setEditing(null);
          setDialogOpen(true);
        }}
      >
        <Plus /> Add course / product
      </Button>

      <div className="grid gap-3 sm:grid-cols-2">
        {products.map((product) => (
          <div key={product.id} className="space-y-2 rounded-lg border p-4">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium">{product.name}</p>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => {
                    setEditing(product);
                    setDialogOpen(true);
                  }}
                >
                  <Pencil />
                </Button>
                <DeleteProductButton productId={product.id} />
              </div>
            </div>
            {product.description && <p className="text-xs text-muted-foreground">{product.description}</p>}
            <div className="flex flex-wrap items-center gap-1.5">
              {product.audience_id && audienceName(product.audience_id) && (
                <Badge variant="outline">{audienceName(product.audience_id)}</Badge>
              )}
              {product.cta && <Badge variant="secondary">{product.cta}</Badge>}
            </div>
          </div>
        ))}
        {products.length === 0 && <p className="text-sm text-muted-foreground">No courses or products yet.</p>}
      </div>

      <ProductDialog brandId={brandId} product={editing} audiences={audiences} open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}

function DeleteProductButton({ productId }: { productId: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await deleteProductAction(productId);
          if (result?.error) toast.error(result.error);
        })
      }
    >
      <Trash2 />
    </Button>
  );
}

function ProductDialog({
  brandId,
  product,
  audiences,
  open,
  onOpenChange,
}: {
  brandId: string;
  product: Tables<"products"> | null;
  audiences: Tables<"audiences">[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [name, setName] = useState(product?.name ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [benefits, setBenefits] = useState((product?.benefits ?? []).join(", "));
  const [cta, setCta] = useState(product?.cta ?? "");
  const [audienceId, setAudienceId] = useState(product?.audience_id ?? NO_AUDIENCE);
  const [pending, startTransition] = useTransition();

  function handleSave() {
    startTransition(async () => {
      const result = await upsertProductAction({
        brandId,
        productId: product?.id,
        name,
        description: description || undefined,
        benefits: splitList(benefits),
        cta: cta || undefined,
        audienceId: audienceId === NO_AUDIENCE ? undefined : audienceId,
      });
      if (result?.error) toast.error(result.error);
      else onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{product ? "Edit course / product" : "Add course / product"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Associate Project Manager Apprenticeship" />
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="min-h-20" />
          </div>
          <div className="space-y-1.5">
            <Label>Benefits (comma separated)</Label>
            <Input value={benefits} onChange={(e) => setBenefits(e.target.value)} placeholder="Fully funded, real project experience" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>CTA</Label>
              <Input value={cta} onChange={(e) => setCta(e.target.value)} placeholder="Learn more" />
            </div>
            <div className="space-y-1.5">
              <Label>Audience</Label>
              <Select value={audienceId} onValueChange={(value) => setAudienceId(value ?? NO_AUDIENCE)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_AUDIENCE}>None</SelectItem>
                  {audiences.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={pending || !name.trim()}>
            {pending && <Loader2 className="animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
