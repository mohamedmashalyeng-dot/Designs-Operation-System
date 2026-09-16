import { formatDistanceToNow, format } from "date-fns";

export function formatRelativeTime(isoDate: string): string {
  return formatDistanceToNow(new Date(isoDate), { addSuffix: true });
}

export function formatDate(isoDate: string): string {
  return format(new Date(isoDate), "d MMM yyyy");
}

export function formatDateTime(isoDate: string): string {
  return format(new Date(isoDate), "d MMM yyyy, HH:mm");
}
