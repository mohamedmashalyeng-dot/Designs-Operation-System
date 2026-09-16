import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Sparkles,
  Zap,
  ClipboardCheck,
  LibraryBig,
  CalendarDays,
  Send,
  BrainCircuit,
  Plug,
  BarChart3,
  Settings,
} from "lucide-react";

export interface NavLeaf {
  label: string;
  href: string;
  /** Sections not yet built in this phase — rendered but visually muted,
   * still routable to a well-designed "coming soon" placeholder. */
  comingSoon?: boolean;
}

export interface NavSection {
  label: string;
  href?: string;
  icon: LucideIcon;
  children?: NavLeaf[];
}

export const NAV_SECTIONS: NavSection[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  {
    label: "Create",
    icon: Sparkles,
    children: [
      { label: "New Campaign", href: "/create" },
      { label: "Quick Creative", href: "/create/quick", comingSoon: true },
    ],
  },
  {
    label: "Review",
    icon: ClipboardCheck,
    children: [
      { label: "Awaiting Review", href: "/review" },
      { label: "Approved", href: "/review/approved" },
      { label: "Rejected", href: "/review/rejected" },
    ],
  },
  { label: "Creative Library", href: "/library", icon: LibraryBig },
  { label: "Calendar", href: "/calendar", icon: CalendarDays },
  { label: "Published", href: "/published", icon: Send },
  {
    label: "Brand Brain",
    icon: BrainCircuit,
    children: [
      { label: "Brand", href: "/brand" },
      { label: "Audiences", href: "/brand/audiences" },
      { label: "Courses", href: "/brand/courses" },
      { label: "Inspiration", href: "/brand/inspiration", comingSoon: true },
      { label: "Brand Rules", href: "/brand/rules" },
      { label: "Assets", href: "/brand/assets" },
    ],
  },
  {
    label: "Connections",
    icon: Plug,
    children: [
      { label: "Canva", href: "/connections/canva" },
      { label: "Meta", href: "/connections/meta", comingSoon: true },
      { label: "LinkedIn", href: "/connections/linkedin", comingSoon: true },
      { label: "Website", href: "/connections/website", comingSoon: true },
    ],
  },
  { label: "Analytics", href: "/analytics", icon: BarChart3 },
  { label: "Settings", href: "/settings", icon: Settings },
];

export const QUICK_CREATE_HREF = "/create";
