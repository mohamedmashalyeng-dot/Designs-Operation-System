"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { upsertBrandAction } from "@/lib/actions/brand";
import type { Tables } from "@/types/database";

type Colour = { name: string; hex: string };
type Font = { role: string; family: string };

export function BrandIdentityForm({ brand }: { brand: Tables<"brands"> | null }) {
  const [name, setName] = useState(brand?.name ?? "");
  const [voiceDescription, setVoiceDescription] = useState(brand?.voice_description ?? "");
  const [tone, setTone] = useState<string[]>(brand?.tone ?? []);
  const [toneInput, setToneInput] = useState("");
  const [colours, setColours] = useState<Colour[]>((brand?.colours as Colour[]) ?? []);
  const [fonts, setFonts] = useState<Font[]>((brand?.fonts as Font[]) ?? []);
  const [pending, startTransition] = useTransition();

  function addTone() {
    const value = toneInput.trim();
    if (value && !tone.includes(value)) setTone([...tone, value]);
    setToneInput("");
  }

  function handleSave() {
    startTransition(async () => {
      const result = await upsertBrandAction({
        brandId: brand?.id,
        name,
        voiceDescription: voiceDescription || undefined,
        tone,
        colours,
        fonts,
      });
      if (result?.error) toast.error(result.error);
      else toast.success("Brand saved");
    });
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="brand-name">Brand name</Label>
          <Input id="brand-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Marketing" />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="brand-voice">Voice description</Label>
        <Textarea
          id="brand-voice"
          value={voiceDescription}
          onChange={(e) => setVoiceDescription(e.target.value)}
          placeholder="How this brand talks — e.g. plain-spoken, confident, never uses jargon."
          className="min-h-20"
        />
      </div>

      <div className="space-y-1.5">
        <Label>Tone</Label>
        <div className="flex flex-wrap gap-1.5">
          {tone.map((t) => (
            <Badge key={t} variant="secondary" className="gap-1">
              {t}
              <button type="button" onClick={() => setTone(tone.filter((x) => x !== t))} aria-label={`Remove ${t}`}>
                <X className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            value={toneInput}
            onChange={(e) => setToneInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addTone();
              }
            }}
            placeholder="e.g. confident"
            className="max-w-48"
          />
          <Button type="button" variant="outline" size="sm" onClick={addTone}>
            Add
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Colours</Label>
        {colours.map((c, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="size-6 shrink-0 rounded border" style={{ backgroundColor: /^#[0-9a-fA-F]{6}$/.test(c.hex) ? c.hex : undefined }} />
            <Input
              value={c.name}
              onChange={(e) => setColours(colours.map((x, xi) => (xi === i ? { ...x, name: e.target.value } : x)))}
              placeholder="Primary"
              className="max-w-36"
            />
            <Input
              value={c.hex}
              onChange={(e) => setColours(colours.map((x, xi) => (xi === i ? { ...x, hex: e.target.value } : x)))}
              placeholder="#4F46E5"
              className="max-w-28"
            />
            <Button type="button" variant="ghost" size="icon-sm" onClick={() => setColours(colours.filter((_, xi) => xi !== i))}>
              <Trash2 />
            </Button>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={() => setColours([...colours, { name: "", hex: "#" }])}>
          <Plus /> Add colour
        </Button>
      </div>

      <div className="space-y-2">
        <Label>Fonts</Label>
        {fonts.map((f, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input
              value={f.role}
              onChange={(e) => setFonts(fonts.map((x, xi) => (xi === i ? { ...x, role: e.target.value } : x)))}
              placeholder="Heading"
              className="max-w-36"
            />
            <Input
              value={f.family}
              onChange={(e) => setFonts(fonts.map((x, xi) => (xi === i ? { ...x, family: e.target.value } : x)))}
              placeholder="Inter"
              className="max-w-48"
            />
            <Button type="button" variant="ghost" size="icon-sm" onClick={() => setFonts(fonts.filter((_, xi) => xi !== i))}>
              <Trash2 />
            </Button>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={() => setFonts([...fonts, { role: "", family: "" }])}>
          <Plus /> Add font
        </Button>
      </div>

      <Button onClick={handleSave} disabled={pending || !name.trim()}>
        {pending && <Loader2 className="animate-spin" />}
        Save brand
      </Button>
    </div>
  );
}
