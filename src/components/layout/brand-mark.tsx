import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

/** Kent Business College crest — sourced from kentbusinesscollege.com.
 * Shared between the app shell sidebar and the auth pages so the mark
 * only needs to change in one place. */
export function BrandMark({ href = "/dashboard", className }: { href?: string; className?: string }) {
  return (
    <Link href={href} className={cn("flex items-center gap-2 px-2.5 py-1", className)}>
      <span className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-md ring-1 ring-kbc-gold/50">
        <Image src="/kbc-logo.png" alt="Kent Business College" width={64} height={64} className="size-9 object-contain" priority />
      </span>
      <span className="font-heading text-base leading-none text-kbc-purple dark:text-kbc-purple-bright">
        Kent Business College
      </span>
    </Link>
  );
}
