/**
 * Single source of truth for every enum in the schema. `src/types/database.ts`
 * types against these, `src/lib/validation/*` builds Zod enums from them, and
 * UI label maps key off them — so a new value is added in exactly one place.
 */

export const ORGANISATION_ROLES = ["owner", "admin", "member"] as const;
export type OrganisationRole = (typeof ORGANISATION_ROLES)[number];

export const CAMPAIGN_OBJECTIVES = [
  "awareness",
  "leads",
  "applications",
  "employer_engagement",
  "event_promotion",
  "other",
] as const;
export type CampaignObjective = (typeof CAMPAIGN_OBJECTIVES)[number];

export const AUDIENCE_TYPES = ["employers", "apprentices", "learners", "professionals", "custom"] as const;
export type AudienceType = (typeof AUDIENCE_TYPES)[number];

export const CHANNELS = ["linkedin", "instagram", "facebook", "website"] as const;
export type Channel = (typeof CHANNELS)[number];

export const CAMPAIGN_STATUSES = [
  "draft",
  "brief_generating",
  "brief_ready",
  "concepts_generating",
  "concepts_ready",
  "in_review",
  "completed",
  "archived",
] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

export const CONCEPT_STATUSES = ["proposed", "selected", "rejected"] as const;
export type ConceptStatus = (typeof CONCEPT_STATUSES)[number];

export const DESIGN_STATUSES = [
  "draft",
  "generating",
  "variations_ready",
  "ai_review",
  "human_review",
  "changes_requested",
  "approved",
  "rejected",
  "scheduled",
  "published",
] as const;
export type DesignStatus = (typeof DESIGN_STATUSES)[number];

export const ASSET_STATUSES = ["pending", "generating", "completed", "failed"] as const;
export type AssetStatus = (typeof ASSET_STATUSES)[number];

export const FEEDBACK_TYPES = ["rejection", "change_request", "comment"] as const;
export type FeedbackType = (typeof FEEDBACK_TYPES)[number];

export const REJECTION_REASONS = [
  "too_generic",
  "wrong_audience",
  "poor_image",
  "looks_like_stock_photography",
  "incorrect_branding",
  "too_much_text",
  "weak_headline",
  "wrong_creative_direction",
  "incorrect_colours",
  "other",
] as const;
export type RejectionReason = (typeof REJECTION_REASONS)[number];

export const APPROVAL_STATUSES = ["approved", "rejected"] as const;
export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];

export const BRAND_ASSET_TYPES = ["logo", "image", "document", "other"] as const;
export type BrandAssetType = (typeof BRAND_ASSET_TYPES)[number];

export const CONNECTION_PROVIDERS = ["canva", "meta", "linkedin", "website"] as const;
export type ConnectionProvider = (typeof CONNECTION_PROVIDERS)[number];

export const CONNECTION_STATUSES = ["connected", "disconnected", "error", "expired"] as const;
export type ConnectionStatus = (typeof CONNECTION_STATUSES)[number];

export const CANVA_SYNC_STATUSES = ["not_synced", "syncing", "synced", "error"] as const;
export type CanvaSyncStatus = (typeof CANVA_SYNC_STATUSES)[number];

export const PUBLICATION_STATUSES = ["queued", "scheduled", "publishing", "published", "failed", "cancelled"] as const;
export type PublicationStatus = (typeof PUBLICATION_STATUSES)[number];

export const BRAND_RULE_CATEGORIES = ["visual", "copy", "logo", "photography", "compliance", "audience", "platform", "campaign"] as const;
export type BrandRuleCategory = (typeof BRAND_RULE_CATEGORIES)[number];

export const BRAND_RULE_PRIORITIES = ["critical", "high", "normal", "preference"] as const;
export type BrandRulePriority = (typeof BRAND_RULE_PRIORITIES)[number];

export const KNOWLEDGE_SOURCE_TYPES = ["upload", "drive"] as const;
export type KnowledgeSourceType = (typeof KNOWLEDGE_SOURCE_TYPES)[number];

export const KNOWLEDGE_DOCUMENT_STATUSES = ["uploaded", "processing", "ready", "failed", "outdated"] as const;
export type KnowledgeDocumentStatus = (typeof KNOWLEDGE_DOCUMENT_STATUSES)[number];

export const RECOMMENDATION_STATUSES = ["suggested", "saved", "dismissed", "created"] as const;
export type RecommendationStatus = (typeof RECOMMENDATION_STATUSES)[number];

export const DISMISSAL_REASONS = ["not_relevant", "already_planned", "wrong_timing", "wrong_audience", "not_a_priority", "other"] as const;
export type DismissalReason = (typeof DISMISSAL_REASONS)[number];
