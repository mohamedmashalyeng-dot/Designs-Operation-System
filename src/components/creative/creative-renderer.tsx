import Image from "next/image";
import { getFormat } from "@/lib/creative/formats";
import { getLayoutPreset } from "@/lib/creative/layouts";
import { cn } from "@/lib/utils";

/**
 * Renders a design the way it will actually look as a finished ad: the
 * AI-generated photo as a background, with the real KBC logo and real
 * headline/copy/CTA composited on top by this component — never baked
 * into the image itself (product spec §10/§13). Every place a design is
 * previewed (variation picker, review panel, library/dashboard cards)
 * should render through this so they all agree on what "the design" is.
 *
 * `variant="compact"` skips the text/logo overlay (used in small grid
 * cards where overlaid copy would just be illegible) but still renders at
 * the correct aspect ratio for the format — never force-squared.
 */
export function CreativeRenderer({
  imageUrl,
  formatId,
  layoutPresetId,
  headline,
  supportingCopy,
  cta,
  focalPoint,
  variant = "full",
  className,
  children,
}: {
  imageUrl: string | null;
  formatId: string;
  layoutPresetId: string;
  headline: string;
  supportingCopy: string;
  cta: string;
  focalPoint?: { x: number; y: number } | null;
  variant?: "full" | "compact";
  className?: string;
  /** Overlaid on top of everything (e.g. a status badge, loading spinner). */
  children?: React.ReactNode;
}) {
  const format = getFormat(formatId);
  const layout = getLayoutPreset(layoutPresetId);
  const objectPosition = focalPoint ? `${focalPoint.x * 100}% ${focalPoint.y * 100}%` : "center";
  const showOverlay = variant === "full" && imageUrl;

  return (
    <div
      className={cn("relative w-full overflow-hidden rounded-xl bg-muted", className)}
      style={{ aspectRatio: `${format.width} / ${format.height}` }}
    >
      {imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- dynamic Supabase Storage URL
        <img
          src={imageUrl}
          alt={headline}
          className="absolute inset-0 size-full object-cover"
          style={{ objectPosition }}
        />
      )}

      {showOverlay && layout.overlayStyle === "gradient-bottom" && (
        <div
          className={cn(
            "absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/50 to-transparent p-[6%] pt-[22%]",
            layout.textAlignment === "right" && "text-right"
          )}
        >
          <TextBlock headline={headline} supportingCopy={supportingCopy} cta={cta} light />
        </div>
      )}

      {showOverlay && layout.overlayStyle === "solid-panel" && (
        <div
          className={cn(
            "absolute inset-y-0 flex w-[44%] min-w-[140px] flex-col justify-center bg-background/95 p-[6%] backdrop-blur-sm",
            layout.subjectSide === "right" ? "left-0" : "right-0",
            layout.textAlignment === "right" && "items-end text-right"
          )}
        >
          <TextBlock headline={headline} supportingCopy={supportingCopy} cta={cta} light={false} />
        </div>
      )}

      {showOverlay && (
        <div className="absolute right-[4%] top-[4%] h-[9%] max-h-12 min-h-6 w-[20%] max-w-24">
          <Image src="/kbc-logo.png" alt="Kent Business College" fill sizes="120px" className="object-contain drop-shadow-md" />
        </div>
      )}

      {children}
    </div>
  );
}

function TextBlock({
  headline,
  supportingCopy,
  cta,
  light,
}: {
  headline: string;
  supportingCopy: string;
  cta: string;
  light: boolean;
}) {
  return (
    <>
      <p className={cn("text-base font-semibold leading-tight sm:text-xl", light ? "text-white drop-shadow-sm" : "text-foreground")}>
        {headline}
      </p>
      <p className={cn("mt-1.5 line-clamp-3 text-xs sm:text-sm", light ? "text-white/85" : "text-muted-foreground")}>
        {supportingCopy}
      </p>
      <span
        className={cn(
          "mt-3 inline-block rounded-full px-3.5 py-1.5 text-xs font-semibold",
          light ? "bg-white text-black" : "bg-primary text-primary-foreground"
        )}
      >
        {cta}
      </span>
    </>
  );
}
