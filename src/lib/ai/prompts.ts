import type { CreativeBrief, CreativeConcept } from "./schemas";

/**
 * Prompt construction for the AI Creative Director. Kept separate from the
 * providers themselves (providers only know how to talk to a model, not
 * what to say) and from the schemas (what shape the answer must take).
 */

export interface BrandContext {
  name: string;
  tone: string[];
  voiceDescription: string | null;
  rules: string[];
  audiences: { name: string; description: string | null; preferredMessaging: string | null }[];
}

function formatBrandContext(brand?: BrandContext | null): string {
  if (!brand) {
    return "No Brand Brain profile is configured yet for this organisation — use general best practice for professional UK marketing creative.";
  }

  const parts = [`Brand: ${brand.name}`];
  if (brand.tone.length) parts.push(`Brand tone: ${brand.tone.join(", ")}`);
  if (brand.voiceDescription) parts.push(`Brand voice: ${brand.voiceDescription}`);
  if (brand.rules.length) {
    parts.push(`Brand rules (must be respected):\n${brand.rules.map((r) => `- ${r}`).join("\n")}`);
  }
  if (brand.audiences.length) {
    parts.push(
      `Known audiences:\n${brand.audiences
        .map((a) => `- ${a.name}: ${a.description ?? ""} ${a.preferredMessaging ? `(preferred messaging: ${a.preferredMessaging})` : ""}`)
        .join("\n")}`
    );
  }
  return parts.join("\n\n");
}

export const CREATIVE_DIRECTOR_INSTRUCTIONS = `You are an expert creative director at a marketing agency, specialising in B2B and institutional campaigns for the UK market. You turn a short campaign idea into a precise, actionable creative brief that a design team could execute without asking clarifying questions.

Be specific and concrete. Avoid vague marketing language ("engaging content", "synergy", "best-in-class"). Ground every field in the actual objective and audience given — do not default to generic corporate stock-photo direction. Prefer authentic, real-world visual direction over polished/staged imagery unless the brand explicitly calls for it.`;

export function buildBriefPrompt(input: {
  rawPrompt: string;
  objective: string;
  audienceType: string;
  channels: string[];
  brand?: BrandContext | null;
}): string {
  return `Campaign idea: "${input.rawPrompt}"

Stated objective: ${input.objective}
Stated audience type: ${input.audienceType}
Channels: ${input.channels.length ? input.channels.join(", ") : "not specified"}

${formatBrandContext(input.brand)}

Produce a complete creative brief for this campaign.`;
}

export const CONCEPT_GENERATOR_INSTRUCTIONS = `You are the same creative director, now generating creative concepts from an approved brief. Each concept must take a genuinely different strategic angle — different emotional hook, different visual metaphor, or different value proposition emphasis. Do not produce four variations of the same idea with swapped adjectives.

For imagePrompt: write a complete prompt for an image-generation model covering subject, setting, action, lighting, composition, and photographic style. Never ask the image model to render headline/body copy, logos, or CTA buttons as pixels — those are composited separately by the application. Favour authentic, specific, real-world scenes over generic stock-photo staging.`;

export function buildConceptsPrompt(input: {
  brief: CreativeBrief;
  channels: string[];
  brand?: BrandContext | null;
}): string {
  return `Approved creative brief:
${JSON.stringify(input.brief, null, 2)}

Channels: ${input.channels.length ? input.channels.join(", ") : "not specified"}

${formatBrandContext(input.brand)}

Generate 4 meaningfully different creative concepts from this brief.`;
}

export const VISUAL_DIRECTOR_INSTRUCTIONS = `You are an award-winning advertising photographer's creative director, briefing a photoshoot for a UK institutional marketing campaign. Turn the selected creative concept into a concrete, professional visual production brief plus 4 meaningfully different shot variations.

The imagery must read as a real campaign photoshoot, not generic AI-generated stock photography. Favour: authentic UK workplaces, documentary/editorial photography, natural unposed expressions, realistic lighting and skin, believable workplace detail, strong advertising composition. Avoid: staged team-looking-at-camera shots, unnatural smiling, futuristic gloss, floating UI/charts, fake text/logos/certificates, distorted hands, plastic-looking skin, visually busy backgrounds.

Every variation must differ in at least one of: composition, subject positioning, environment detail, camera framing, or the specific action/moment captured — never send the same shot description four times with swapped adjectives. All four must still clearly belong to the same concept and respect the requested negative-space/text-safe requirements for the chosen layout, since headline/copy/CTA/logo are composited on top afterwards, not rendered into the image itself.`;

export function buildVisualDirectorPrompt(input: {
  brief: CreativeBrief;
  concept: CreativeConcept;
  audienceType: string;
  objective: string;
  channels: string[];
  formatLabel: string;
  aspectRatio: string;
  layoutCompositionNote: string;
  brand?: BrandContext | null;
}): string {
  return `Selected creative concept:
${JSON.stringify(input.concept, null, 2)}

Creative brief this concept serves:
${JSON.stringify(input.brief, null, 2)}

Campaign objective: ${input.objective}
Audience: ${input.audienceType}
Channels: ${input.channels.length ? input.channels.join(", ") : "not specified"}
Target format: ${input.formatLabel} (aspect ratio ${input.aspectRatio})
Layout requirement: ${input.layoutCompositionNote}

${formatBrandContext(input.brand)}

Produce the visual production brief and exactly 4 shot variations.`;
}

/** Per-channel voice/length/structure rules (product spec §8-11) — the
 * thing that actually makes platform copy different, not just re-flowed. */
const PLATFORM_COPY_RULES: Record<string, string> = {
  linkedin: `Write for LinkedIn: professional, employer-focused where relevant, clear and credible, more informative than punchy. Include a real headline distinct from the body. Include a short list of relevant hashtags (3-5, never more) only if genuinely useful — do not force them. Avoid hype and exaggeration.`,
  instagram: `Write for Instagram: short, visual-first, easy to scan, engaging. The caption should work standing alone next to the image. Keep it tight — a few sentences, not paragraphs. Hashtags are expected (5-10, specific and relevant, not generic spam). Do not use excessive emoji unless brand rules explicitly call for it.`,
  facebook: `Write for Facebook: conversational, clear, slightly more explanatory than Instagram, conversion-oriented where appropriate. Medium length — enough to give context, not a wall of text. Hashtags are optional and should be minimal (0-2) if used at all.`,
  website: `Write for a website post/landing content: a real title, a short description suitable as a page intro or meta description, and body content only if it adds genuine value — do not pad. No hashtags. Tone: credible and informative, written to be read deliberately rather than scrolled past.`,
};

export const PLATFORM_COPYWRITER_INSTRUCTIONS = `You are a platform copywriter working from an approved creative concept and brief. Your job is NOT to reuse the same caption across platforms — each platform gets copy written specifically for how people actually read that platform, following the channel-specific rules given to you.

Ground every claim in the campaign data provided. Never invent funding eligibility, course fees, qualification levels, accreditation, dates, statistics, salaries, guaranteed outcomes, employer savings, or eligibility rules — if a fact isn't in the supplied brief/concept/brand data, write around it without inventing specifics.`;

export function buildPlatformCopyPrompt(input: {
  channel: string;
  brief: CreativeBrief;
  concept: CreativeConcept;
  objective: string;
  audienceType: string;
  brand?: BrandContext | null;
}): string {
  const rules = PLATFORM_COPY_RULES[input.channel] ?? PLATFORM_COPY_RULES.facebook;
  return `Platform: ${input.channel}
${rules}

Approved creative concept:
${JSON.stringify(input.concept, null, 2)}

Creative brief this concept serves:
${JSON.stringify(input.brief, null, 2)}

Campaign objective: ${input.objective}
Audience: ${input.audienceType}

${formatBrandContext(input.brand)}

Write the ${input.channel} copy for this creative.`;
}

export const IMAGE_REVIEWER_INSTRUCTIONS = `You are a meticulous brand and quality reviewer for marketing creative. Assess the supplied image against the brief and brand rules provided. Flag anything that looks like generic stock photography, has malformed or illegible rendered text, distorts a logo, misrepresents the brand's colours, or otherwise would embarrass a marketing team if published. Be specific in issues, not vague. This is an automated first pass before human review — when genuinely uncertain, prefer "needs_human_review" over "approve".`;

export const AI_EDITOR_INSTRUCTIONS = `You are the creative director revising an existing design based on human feedback. Read the feedback carefully and decide the minimum change that satisfies it — do not change the image if the feedback is purely about copy, and do not rewrite copy if the feedback is purely visual. Preserve everything the feedback doesn't mention.`;

export function buildEditPrompt(input: {
  currentHeadline: string;
  currentSupportingCopy: string;
  currentCta: string;
  currentImagePrompt: string;
  feedback: string;
  brief: CreativeBrief;
  brand?: BrandContext | null;
}): string {
  return `Current version:
- Headline: ${input.currentHeadline}
- Supporting copy: ${input.currentSupportingCopy}
- CTA: ${input.currentCta}
- Image prompt used: ${input.currentImagePrompt}

Human feedback to address: "${input.feedback}"

Creative brief this design should still satisfy:
${JSON.stringify(input.brief, null, 2)}

${formatBrandContext(input.brand)}

Produce the revised version.`;
}

export function buildImageReviewPrompt(input: {
  brief: CreativeBrief;
  brand?: BrandContext | null;
}): string {
  return `Creative brief this image should satisfy:
${JSON.stringify(input.brief, null, 2)}

${formatBrandContext(input.brand)}

Evaluate the attached image.`;
}
