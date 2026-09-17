import type {
  AudienceType,
  CampaignObjective,
  CampaignStatus,
  Channel,
  DesignStatus,
  KnowledgeDocumentStatus,
  PublicationStatus,
  RejectionReason,
} from "./enums";

export const CAMPAIGN_OBJECTIVE_LABELS: Record<CampaignObjective, string> = {
  awareness: "Awareness",
  leads: "Lead generation",
  applications: "Applications",
  employer_engagement: "Employer engagement",
  event_promotion: "Event promotion",
  other: "Other",
};

export const AUDIENCE_TYPE_LABELS: Record<AudienceType, string> = {
  employers: "Employers",
  apprentices: "Apprentices",
  learners: "Learners",
  professionals: "Professionals",
  custom: "Custom",
};

export const CHANNEL_LABELS: Record<Channel, string> = {
  linkedin: "LinkedIn",
  instagram: "Instagram",
  facebook: "Facebook",
  website: "Website",
};

export const REJECTION_REASON_LABELS: Record<RejectionReason, string> = {
  too_generic: "Too generic",
  wrong_audience: "Wrong audience",
  poor_image: "Poor image",
  looks_like_stock_photography: "Looks like stock photography",
  incorrect_branding: "Incorrect branding",
  too_much_text: "Too much text",
  weak_headline: "Weak headline",
  wrong_creative_direction: "Wrong creative direction",
  incorrect_colours: "Incorrect colours",
  other: "Other",
};

/** Semantic tone used by StatusBadge — kept separate from the label so the
 * badge component owns the actual colour classes for each tone. */
export type StatusTone = "neutral" | "progress" | "review" | "warning" | "success" | "danger";

export const CAMPAIGN_STATUS_META: Record<CampaignStatus, { label: string; tone: StatusTone }> = {
  draft: { label: "Draft", tone: "neutral" },
  brief_generating: { label: "Generating brief…", tone: "progress" },
  brief_ready: { label: "Brief ready", tone: "review" },
  concepts_generating: { label: "Generating concepts…", tone: "progress" },
  concepts_ready: { label: "Concepts ready", tone: "review" },
  in_review: { label: "In review", tone: "review" },
  completed: { label: "Completed", tone: "success" },
  archived: { label: "Archived", tone: "neutral" },
};

export const DESIGN_STATUS_META: Record<DesignStatus, { label: string; tone: StatusTone }> = {
  draft: { label: "Draft", tone: "neutral" },
  generating: { label: "Generating…", tone: "progress" },
  variations_ready: { label: "Choose a visual", tone: "review" },
  ai_review: { label: "AI review", tone: "progress" },
  human_review: { label: "Awaiting review", tone: "review" },
  changes_requested: { label: "Changes requested", tone: "warning" },
  approved: { label: "Approved", tone: "success" },
  rejected: { label: "Rejected", tone: "danger" },
  scheduled: { label: "Scheduled", tone: "review" },
  published: { label: "Published", tone: "success" },
};

export const PUBLICATION_STATUS_META: Record<PublicationStatus, { label: string; tone: StatusTone }> = {
  queued: { label: "Queued", tone: "neutral" },
  scheduled: { label: "Scheduled", tone: "review" },
  publishing: { label: "Publishing…", tone: "progress" },
  published: { label: "Published", tone: "success" },
  failed: { label: "Failed", tone: "danger" },
  cancelled: { label: "Cancelled", tone: "neutral" },
};

export const KNOWLEDGE_DOCUMENT_STATUS_META: Record<KnowledgeDocumentStatus, { label: string; tone: StatusTone }> = {
  uploaded: { label: "Uploaded", tone: "neutral" },
  processing: { label: "Processing…", tone: "progress" },
  ready: { label: "Ready", tone: "success" },
  failed: { label: "Failed", tone: "danger" },
  outdated: { label: "Outdated", tone: "warning" },
};
