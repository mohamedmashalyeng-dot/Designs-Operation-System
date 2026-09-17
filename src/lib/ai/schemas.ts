import { z } from "zod";

/** Shared schema identifiers — passed as `schemaName` to
 * `LLMProvider.generateStructured()` and matched by the mock provider to
 * pick the right fixture. Keep every caller referencing these constants
 * rather than typing the strings inline. */
export const SCHEMA_NAMES = {
  creativeBrief: "creative_brief",
  creativeConcepts: "creative_concepts",
  imageReview: "image_review",
  designEdit: "design_edit",
  visualDirection: "visual_direction",
  platformCopy: "platform_copy",
} as const;

/**
 * Structured-output contracts for every AI Creative Director call. These
 * are the schemas passed to `LLMProvider.generateStructured()` — the
 * provider (OpenAI today) turns them into a strict JSON Schema and the
 * result is parsed through the same Zod schema again before anything
 * touches the database, per product spec §8: "Validate AI outputs before
 * storing them."
 */

export const creativeBriefSchema = z.object({
  campaignObjective: z
    .string()
    .describe("The single, specific objective this campaign is optimising for."),
  targetAudience: z
    .string()
    .describe("Who this campaign is speaking to, specifically — not just a persona label."),
  coreMessage: z.string().describe("The one idea the audience should take away."),
  valueProposition: z.string().describe("Why this matters to the audience, in their terms."),
  tone: z
    .array(z.string())
    .min(1)
    .max(5)
    .describe("3-5 tone descriptors, e.g. 'confident', 'warm', 'direct'."),
  visualDirection: z.string().describe("Overall art direction for the campaign's visuals."),
  photographyDirection: z
    .string()
    .describe("Concrete direction for photography/imagery style — avoid generic stock-photo language."),
  emotionalDirection: z.string().describe("The feeling the creative should evoke."),
  cta: z.string().describe("The primary call to action."),
  platformConsiderations: z
    .string()
    .describe("How the selected channels should shape format, length, or tone."),
  constraints: z
    .array(z.string())
    .default([])
    .describe("Hard constraints pulled from the brief or brand rules, e.g. legal, compliance, accessibility."),
});

export type CreativeBrief = z.infer<typeof creativeBriefSchema>;

export const creativeConceptSchema = z.object({
  name: z.string().describe("Short, memorable concept name, e.g. 'Future Project Leader'."),
  strategicIdea: z.string().describe("The strategic angle this concept takes and why."),
  visualDescription: z.string().describe("What the viewer sees, described concretely enough to brief a designer."),
  headline: z.string().describe("Primary headline copy for this concept."),
  supportingCopy: z.string().describe("Supporting body copy, 1-2 sentences."),
  cta: z.string().describe("Call-to-action text for this concept."),
  imagePrompt: z
    .string()
    .describe(
      "A complete, self-contained prompt for an image-generation model: subject, setting, lighting, composition, style. Must not include any text/typography to render — copy is composited separately."
    ),
  rationale: z.string().describe("Why this concept could work for this audience and objective."),
});

export type CreativeConcept = z.infer<typeof creativeConceptSchema>;

export const creativeConceptsSchema = z.object({
  concepts: z
    .array(creativeConceptSchema)
    .min(3)
    .max(5)
    .describe("3-5 meaningfully different creative concepts — different strategic angles, not variations on one idea."),
});

export type CreativeConcepts = z.infer<typeof creativeConceptsSchema>;

export const imageReviewSchema = z.object({
  overallScore: z.number().min(0).max(100).describe("Overall quality/fit score."),
  passesBrandGuidelines: z.boolean(),
  issues: z
    .array(
      z.object({
        severity: z.enum(["low", "medium", "high"]),
        category: z.string().describe("e.g. 'brand-colour', 'stock-photo-look', 'text-legibility'."),
        description: z.string(),
      })
    )
    .default([]),
  suggestions: z.array(z.string()).default([]),
  recommendation: z.enum(["approve", "needs_human_review", "regenerate"]),
});

export type ImageReview = z.infer<typeof imageReviewSchema>;

/**
 * AI Visual Director output (product spec §3/§9): one shared production
 * brief plus N concrete variations. Shared fields keep every variation
 * strategically faithful to the concept; each variation's own composition/
 * subjectPosition/imagePrompt is what makes the four options meaningfully
 * different rather than the same prompt sent four times.
 */
export const visualVariationSchema = z.object({
  label: z.string().describe("Short internal label for this variation, e.g. 'Mentoring moment, close crop'."),
  composition: z.string().describe("How this variation's composition/framing differs from the others."),
  subjectPosition: z.string().describe("Where the subject sits in frame, consistent with the requested layout's negative space."),
  action: z.string().describe("What the subject is doing in this specific variation."),
  imagePrompt: z
    .string()
    .describe(
      "Complete, self-contained image-generation prompt for this variation: subject, environment, action, composition, lighting, photography style, camera direction, authenticity requirements, and what to avoid. Must not ask for rendered text, logos, or UI elements — those are composited separately."
    ),
});

export const visualDirectionSchema = z.object({
  subject: z.string().describe("The main subject across all variations, specific enough to brief a photographer."),
  environment: z.string().describe("The setting/location, grounded and specific (UK context where relevant)."),
  photographyStyle: z.string().describe("e.g. 'documentary editorial', 'natural-light candid'."),
  lighting: z.string().describe("Lighting direction and quality."),
  mood: z.string().describe("The emotional register the imagery should carry."),
  cameraDirection: z.string().describe("Framing/lens guidance, e.g. 'shallow depth of field, eye-level, 35mm-equivalent'."),
  negativeSpace: z.string().describe("Where clean negative space is preserved for the chosen layout's text panel."),
  textSafeArea: z.string().describe("Which region of the frame must stay clear of visual clutter for overlaid typography."),
  brandConsiderations: z.array(z.string()).default([]).describe("Brand rules/tone this imagery must respect."),
  authenticityRequirements: z.array(z.string()).default([]).describe("What makes this read as real rather than generic stock photography."),
  avoid: z.array(z.string()).default([]).describe("Concrete things to avoid — generic AI tells, stock-photo cliches, fake text/logos, etc."),
  variations: z.array(visualVariationSchema).length(4).describe("Exactly 4 meaningfully different variations, all faithful to the subject/environment/mood above."),
});

export type VisualDirection = z.infer<typeof visualDirectionSchema>;
export type VisualVariation = z.infer<typeof visualVariationSchema>;

/**
 * Platform Copywriter output (product spec §7-11): one platform's copy,
 * generated separately per channel rather than reusing the same caption
 * everywhere — LinkedIn, Instagram, Facebook, and Website each get their
 * own tone/length/structure via buildPlatformCopyPrompt's per-channel
 * instructions.
 */
export const platformCopySchema = z.object({
  headline: z
    .string()
    .describe("Distinct headline text where the platform uses one (LinkedIn, Website); return the same as the body's opening line for caption-only platforms."),
  body: z.string().describe("The main post copy/caption, sized and styled for this specific platform."),
  cta: z.string().describe("Call to action text appropriate for this platform."),
  hashtags: z.array(z.string()).default([]).describe("Relevant hashtags — empty array where the platform convention doesn't call for them."),
});

export type PlatformCopy = z.infer<typeof platformCopySchema>;

export const designEditSchema = z.object({
  changeType: z
    .enum(["text_only", "image_only", "both"])
    .describe(
      "text_only: only headline/copy/cta should change, the current image is kept as-is. " +
        "image_only: only the visual should change, keep headline/copy/cta identical to the current version. " +
        "both: the feedback calls for changing both."
    ),
  headline: z.string().describe("Revised headline — return the CURRENT headline unchanged if changeType is image_only."),
  supportingCopy: z.string().describe("Revised supporting copy — return unchanged if changeType is image_only."),
  cta: z.string().describe("Revised CTA — return unchanged if changeType is image_only."),
  imagePrompt: z
    .string()
    .describe(
      "Revised image-generation prompt reflecting the feedback — return the CURRENT image prompt unchanged if changeType is text_only."
    ),
  editSummary: z.string().describe("One-sentence human-readable summary of what changed, for the version history log."),
});

export type DesignEdit = z.infer<typeof designEditSchema>;
