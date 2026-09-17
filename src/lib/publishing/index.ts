import "server-only";
import type { Channel, Tables } from "@/types/database";
import type { PublishParams, PublishResult } from "./types";
import { publishToWordPress } from "@/lib/wordpress/service";
import { publishToLinkedIn } from "@/lib/linkedin/service";
import { publishToFacebook, publishToInstagram } from "@/lib/meta/service";

export type { PublishParams, PublishResult };

export type Publisher = (connection: Tables<"connections">, params: PublishParams) => Promise<PublishResult>;

/** channel → connection provider it publishes through. "instagram" and
 * "facebook" both read from the single "meta" connection (one OAuth
 * connection, one Page + its linked Instagram account). */
export const CHANNEL_CONNECTION_PROVIDER: Record<Channel, Tables<"connections">["provider"]> = {
  linkedin: "linkedin",
  instagram: "meta",
  facebook: "meta",
  website: "website",
};

const PUBLISHERS: Record<Channel, Publisher> = {
  website: publishToWordPress,
  linkedin: publishToLinkedIn,
  facebook: publishToFacebook,
  instagram: publishToInstagram,
};

export function getPublisher(channel: Channel): Publisher {
  return PUBLISHERS[channel];
}
