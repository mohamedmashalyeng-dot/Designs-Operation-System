"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_SECTIONS } from "@/lib/constants/nav";
import { cn } from "@/lib/utils";

function isActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-4 px-3 py-2">
      {NAV_SECTIONS.map((section) => {
        if (!section.children) {
          const active = isActive(pathname, section.href!);
          return (
            <Link
              key={section.label}
              href={section.href!}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
              )}
            >
              <section.icon className="size-4 shrink-0" strokeWidth={1.75} />
              {section.label}
            </Link>
          );
        }

        return (
          <div key={section.label} className="space-y-0.5">
            <p className="px-2.5 pb-1 text-[11px] font-semibold uppercase tracking-wide text-sidebar-foreground/40">
              {section.label}
            </p>
            {section.children.map((child) => {
              const active = isActive(pathname, child.href);
              return (
                <Link
                  key={child.href}
                  href={child.href}
                  onClick={onNavigate}
                  aria-disabled={child.comingSoon}
                  className={cn(
                    "flex items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-sm transition-colors",
                    active
                      ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                  )}
                >
                  <span>{child.label}</span>
                  {child.comingSoon && (
                    <span className="rounded-full bg-sidebar-foreground/10 px-1.5 py-0.5 text-[10px] font-medium text-sidebar-foreground/50">
                      Soon
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        );
      })}
    </nav>
  );
}
