/**
 * Hand-authored types mirroring `supabase/migrations`.
 *
 * There is no live Supabase project linked yet, so these cannot be generated
 * with `supabase gen types typescript`. Once a project is linked, regenerate
 * with:
 *
 *   npx supabase gen types typescript --project-id <ref> > src/types/database.generated.ts
 *
 * and reconcile any drift with this file.
 *
 * Enum value lists live in `src/lib/constants/enums.ts` (the single source
 * of truth also used by Zod validation and UI label maps) — re-exported
 * here so every table row type can reference them.
 */

export type {
  OrganisationRole,
  CampaignObjective,
  AudienceType,
  Channel,
  CampaignStatus,
  ConceptStatus,
  DesignStatus,
  AssetStatus,
  FeedbackType,
  RejectionReason,
  ApprovalStatus,
  BrandAssetType,
  ConnectionProvider,
  ConnectionStatus,
  CanvaSyncStatus,
  PublicationStatus,
  BrandRuleCategory,
  BrandRulePriority,
  KnowledgeSourceType,
  KnowledgeDocumentStatus,
  RecommendationStatus,
} from "@/lib/constants/enums";

import type {
  OrganisationRole,
  CampaignObjective,
  AudienceType,
  Channel,
  CampaignStatus,
  ConceptStatus,
  DesignStatus,
  AssetStatus,
  FeedbackType,
  RejectionReason,
  ApprovalStatus,
  BrandAssetType,
  ConnectionProvider,
  ConnectionStatus,
  CanvaSyncStatus,
  PublicationStatus,
  BrandRuleCategory,
  BrandRulePriority,
  KnowledgeSourceType,
  KnowledgeDocumentStatus,
  RecommendationStatus,
} from "@/lib/constants/enums";

/**
 * Shapes one table's Row/Insert/Update/Relationships the way
 * `@supabase/postgrest-js`'s `GenericTable` requires (it needs all four —
 * omitting `Relationships` silently collapses every query's inferred type
 * to `never`, which is what makes this worth a shared helper rather than
 * writing each table out by hand). `RequiredInsert` lists the columns
 * `.insert()` must be given; every other column becomes optional
 * (defaulted/nullable in the migration).
 */
type Table<Row extends Record<string, unknown>, RequiredInsert extends keyof Row = never> = {
  Row: Row;
  Insert: Partial<Row> & Pick<Row, RequiredInsert>;
  Update: Partial<Row>;
  Relationships: [];
};

export interface Database {
  public: {
    Tables: {
      profiles: Table<
        {
          id: string;
          full_name: string | null;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        },
        "id"
      >;
      organisations: Table<
        {
          id: string;
          name: string;
          slug: string;
          created_at: string;
          updated_at: string;
        },
        "name" | "slug"
      >;
      organisation_members: Table<
        {
          id: string;
          organisation_id: string;
          user_id: string;
          role: OrganisationRole;
          created_at: string;
        },
        "organisation_id" | "user_id"
      >;
      brands: Table<
        {
          id: string;
          organisation_id: string;
          name: string;
          logo_url: string | null;
          colours: { name: string; hex: string }[];
          fonts: { role: string; family: string }[];
          tone: string[];
          voice_description: string | null;
          created_at: string;
          updated_at: string;
        },
        "organisation_id" | "name"
      >;
      brand_rules: Table<
        {
          id: string;
          brand_id: string;
          rule_text: string;
          is_active: boolean;
          category: BrandRuleCategory;
          priority: BrandRulePriority;
          source: string | null;
          created_at: string;
        },
        "brand_id" | "rule_text"
      >;
      audiences: Table<
        {
          id: string;
          brand_id: string;
          name: string;
          description: string | null;
          market: string | null;
          problems: string[];
          motivations: string[];
          preferred_messaging: string | null;
          roles: string[];
          objections: string[];
          avoid_messaging: string | null;
          tone: string[];
          platforms: string[];
          created_at: string;
          updated_at: string;
        },
        "brand_id" | "name"
      >;
      products: Table<
        {
          id: string;
          brand_id: string;
          audience_id: string | null;
          name: string;
          description: string | null;
          long_description: string | null;
          delivery_info: string | null;
          benefits: string[];
          approved_claims: string[];
          prohibited_claims: string[];
          keywords: string[];
          status: string;
          cta: string | null;
          reference_material_url: string | null;
          created_at: string;
          updated_at: string;
        },
        "brand_id" | "name"
      >;
      brand_assets: Table<
        {
          id: string;
          brand_id: string;
          type: BrandAssetType;
          storage_path: string;
          file_name: string;
          mime_type: string | null;
          size_bytes: number | null;
          created_at: string;
        },
        "brand_id" | "type" | "storage_path" | "file_name"
      >;
      campaigns: Table<
        {
          id: string;
          organisation_id: string;
          brand_id: string | null;
          created_by: string;
          title: string;
          raw_prompt: string;
          objective: CampaignObjective;
          audience_type: AudienceType;
          channels: Channel[];
          status: CampaignStatus;
          created_at: string;
          updated_at: string;
        },
        "organisation_id" | "created_by" | "title" | "raw_prompt"
      >;
      creative_briefs: Table<
        {
          id: string;
          campaign_id: string;
          campaign_objective: string;
          target_audience: string;
          core_message: string;
          value_proposition: string;
          tone: string[];
          visual_direction: string;
          photography_direction: string;
          emotional_direction: string;
          cta: string;
          platform_considerations: string;
          constraints: string[];
          model_used: string | null;
          raw_ai_response: Record<string, unknown>;
          created_at: string;
        },
        "campaign_id"
      >;
      creative_concepts: Table<
        {
          id: string;
          campaign_id: string;
          creative_brief_id: string;
          name: string;
          strategic_idea: string;
          visual_description: string;
          headline: string;
          supporting_copy: string;
          cta: string;
          image_prompt: string;
          rationale: string;
          status: ConceptStatus;
          display_order: number;
          created_at: string;
        },
        "campaign_id" | "creative_brief_id" | "name"
      >;
      designs: Table<
        {
          id: string;
          campaign_id: string;
          concept_id: string;
          title: string;
          status: DesignStatus;
          current_version_id: string | null;
          format_id: string;
          latest_batch_id: string | null;
          master_design_id: string | null;
          canva_design_id: string | null;
          canva_edit_url: string | null;
          canva_last_synced_at: string | null;
          canva_sync_status: CanvaSyncStatus;
          created_at: string;
          updated_at: string;
        },
        "campaign_id" | "concept_id" | "title"
      >;
      design_versions: Table<
        {
          id: string;
          design_id: string;
          version_number: number;
          headline: string;
          supporting_copy: string;
          cta: string;
          generated_asset_id: string | null;
          layout_preset: string;
          change_description: string;
          changed_by_user_id: string | null;
          changed_by_ai: boolean;
          ai_prompt: string | null;
          ai_review: Record<string, unknown> | null;
          created_at: string;
        },
        "design_id" | "version_number" | "headline" | "supporting_copy" | "cta" | "change_description"
      >;
      generated_assets: Table<
        {
          id: string;
          organisation_id: string;
          campaign_id: string | null;
          concept_id: string | null;
          design_version_id: string | null;
          provider: string;
          model: string;
          prompt: string;
          mime_type: string;
          width: number;
          height: number;
          storage_path: string | null;
          status: AssetStatus;
          error_message: string | null;
          parent_asset_id: string | null;
          generation_batch_id: string | null;
          focal_x: number | null;
          focal_y: number | null;
          generation_params: Record<string, unknown>;
          created_at: string;
        },
        "organisation_id" | "provider" | "model" | "prompt" | "width" | "height"
      >;
      feedback: Table<
        {
          id: string;
          design_id: string;
          design_version_id: string | null;
          user_id: string;
          type: FeedbackType;
          reasons: RejectionReason[];
          comment: string | null;
          created_at: string;
        },
        "design_id" | "user_id" | "type"
      >;
      approvals: Table<
        {
          id: string;
          design_id: string;
          design_version_id: string;
          user_id: string;
          status: ApprovalStatus;
          created_at: string;
        },
        "design_id" | "design_version_id" | "user_id" | "status"
      >;
      connections: Table<
        {
          id: string;
          organisation_id: string;
          provider: ConnectionProvider;
          status: ConnectionStatus;
          external_account_id: string | null;
          external_account_name: string | null;
          access_token_encrypted: string | null;
          refresh_token_encrypted: string | null;
          expires_at: string | null;
          metadata: Record<string, unknown>;
          created_at: string;
          updated_at: string;
        },
        "organisation_id" | "provider"
      >;
      publication_jobs: Table<
        {
          id: string;
          design_id: string;
          connection_id: string;
          channel: Channel;
          scheduled_for: string | null;
          status: PublicationStatus;
          error_message: string | null;
          created_at: string;
          updated_at: string;
        },
        "design_id" | "connection_id" | "channel"
      >;
      published_posts: Table<
        {
          id: string;
          publication_job_id: string;
          design_id: string;
          connection_id: string;
          external_post_id: string | null;
          external_url: string | null;
          published_at: string;
          metrics: Record<string, unknown>;
        },
        "publication_job_id" | "design_id" | "connection_id"
      >;
      knowledge_documents: Table<
        {
          id: string;
          organisation_id: string;
          title: string;
          source_type: KnowledgeSourceType;
          storage_path: string | null;
          mime_type: string | null;
          size_bytes: number | null;
          status: KnowledgeDocumentStatus;
          error_message: string | null;
          content_hash: string | null;
          drive_file_id: string | null;
          drive_modified_at: string | null;
          last_synced_at: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        },
        "organisation_id" | "title"
      >;
      knowledge_chunks: Table<
        {
          id: string;
          document_id: string;
          organisation_id: string;
          chunk_index: number;
          content: string;
          embedding: number[] | null;
          embedding_model: string | null;
          created_at: string;
        },
        "document_id" | "organisation_id" | "chunk_index" | "content"
      >;
      inspiration_items: Table<
        {
          id: string;
          organisation_id: string;
          title: string;
          url: string | null;
          storage_path: string | null;
          notes: string | null;
          category: string | null;
          created_by: string | null;
          created_at: string;
        },
        "organisation_id" | "title"
      >;
      competitors: Table<
        {
          id: string;
          organisation_id: string;
          name: string;
          website: string | null;
          notes: string | null;
          created_at: string;
        },
        "organisation_id" | "name"
      >;
      campaign_recommendations: Table<
        {
          id: string;
          organisation_id: string;
          title: string;
          reason: string;
          objective: CampaignObjective | null;
          audience_type: AudienceType | null;
          product_id: string | null;
          suggested_concept: string | null;
          suggested_channels: Channel[];
          priority: string;
          evidence: string;
          confidence: string;
          status: RecommendationStatus;
          dismissal_reason: string | null;
          resulting_campaign_id: string | null;
          created_at: string;
          updated_at: string;
        },
        "organisation_id" | "title" | "reason" | "evidence"
      >;
      performance_snapshots: Table<
        {
          id: string;
          organisation_id: string;
          published_post_id: string;
          metric_type: string;
          value: number;
          captured_at: string;
          raw: Record<string, unknown>;
        },
        "organisation_id" | "published_post_id" | "metric_type" | "value"
      >;
    };
    Views: Record<string, never>;
    Functions: {
      match_knowledge_chunks: {
        Args: { query_embedding: number[]; match_org: string; match_count?: number };
        Returns: { id: string; document_id: string; content: string; similarity: number }[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
