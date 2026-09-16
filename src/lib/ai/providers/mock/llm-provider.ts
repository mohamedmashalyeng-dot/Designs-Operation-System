import type { LLMProvider, StructuredGenerationInput, StructuredGenerationResult } from "../../types";
import { AIProviderError } from "../../types";
import { SCHEMA_NAMES } from "../../schemas";
import { sleep } from "./sleep";

function extractCampaignIdea(prompt: string): string {
  const match = prompt.match(/Campaign idea: "(.*?)"/);
  return match?.[1] ?? "this campaign";
}

function mockBrief(prompt: string) {
  const idea = extractCampaignIdea(prompt);
  return {
    campaignObjective: `Drive measurable response to: ${idea}`,
    targetAudience: "Decision-makers and influencers directly affected by this offer — not a broad general audience.",
    coreMessage: `${idea} — framed around the concrete outcome it delivers, not the feature itself.`,
    valueProposition: "Tangible, near-term benefit that's credible without overclaiming.",
    tone: ["confident", "direct", "credible", "warm"],
    visualDirection: "Real environments and real people over staged studio photography; natural light, unposed moments.",
    photographyDirection: "Documentary-style photography, UK-realistic settings, diverse and authentic — no stock-photo gloss.",
    emotionalDirection: "Motivated and reassured — the viewer should feel this is achievable, not aspirational fantasy.",
    cta: "Learn more",
    platformConsiderations: "Lead with a strong static visual; keep copy scannable for feed placements.",
    constraints: ["Must remain accurate to the underlying offer", "No unverifiable claims"],
  };
}

const MOCK_CONCEPTS = [
  {
    name: "Future Project Leader",
    strategicIdea: "Position the audience's next hire as tomorrow's leadership, not just today's headcount.",
    visualDescription: "A young professional confidently leading a small team huddle in a bright, real office — mid-conversation, gesturing at a whiteboard.",
    headline: "Grow Your Next Leader, Not Just Your Headcount",
    supportingCopy: "Give ambitious talent a structured path into leadership — backed by real qualifications.",
    cta: "Explore the Programme",
    imagePrompt: "Documentary-style photo of a confident young professional leading a small team discussion around a whiteboard in a modern UK office, natural window light, candid mid-gesture, shallow depth of field, no visible text or logos.",
    rationale: "Appeals to employers thinking about succession and internal growth, not just filling a vacancy.",
  },
  {
    name: "Develop Talent From Within",
    strategicIdea: "Speak to the cost and risk of external hiring versus growing existing people.",
    visualDescription: "Two colleagues of different seniority reviewing work together at a desk, one visibly mentoring the other.",
    headline: "Your Best Hire Might Already Work For You",
    supportingCopy: "Turn potential already in your business into qualified, promotable capability.",
    cta: "See How It Works",
    imagePrompt: "Natural-light photo of a senior and junior colleague reviewing a laptop screen together at a desk in a UK workplace, genuine collaborative expression, candid framing, no on-image text.",
    rationale: "Reframes the offer as a retention and cost-saving play, which resonates with budget-conscious employers.",
  },
  {
    name: "Business Impact",
    strategicIdea: "Lead with the commercial outcome rather than the training mechanics.",
    visualDescription: "A clean, confident shot of a small business team reviewing a results chart or project board — energy of momentum, not a classroom.",
    headline: "Qualified. Capable. Delivering From Day One.",
    supportingCopy: "A structured programme built around real projects and measurable outcomes.",
    cta: "Get the Details",
    imagePrompt: "Candid photo of a small UK team gathered around a project board with visible progress markers, focused and energetic body language, natural office lighting, no readable text in frame.",
    rationale: "Targets employers who are outcome-driven and skeptical of 'training for training's sake'.",
  },
  {
    name: "Authentic Workplace",
    strategicIdea: "Show the real, everyday texture of the role rather than an idealised version.",
    visualDescription: "An unposed moment — someone at their desk mid-task, genuine focus, realistic (not overly tidy) workplace detail.",
    headline: "Real Work. Real Progress. Real Opportunity.",
    supportingCopy: "See what the role actually looks like — and what it could grow into.",
    cta: "Find Out More",
    imagePrompt: "Unposed documentary photo of a professional genuinely focused on their laptop at a realistic (slightly lived-in) desk in a UK office, soft natural light, authentic expression, no stock-photo styling, no visible text.",
    rationale: "Builds trust with audiences who are fatigued by polished, generic recruitment imagery.",
  },
];

function mockImageReview() {
  return {
    overallScore: 84,
    passesBrandGuidelines: true,
    issues: [
      {
        severity: "low" as const,
        category: "composition",
        description: "Subject is slightly close to the left edge — consider more breathing room if used with left-aligned copy.",
      },
    ],
    suggestions: ["Confirm the scene reads clearly at social feed thumbnail size before final approval."],
    recommendation: "needs_human_review" as const,
  };
}

export class MockLLMProvider implements LLMProvider {
  readonly id = "mock";

  async generateStructured<T>(input: StructuredGenerationInput<T>): Promise<StructuredGenerationResult<T>> {
    await sleep(1500);

    let raw: unknown;
    switch (input.schemaName) {
      case SCHEMA_NAMES.creativeBrief:
        raw = mockBrief(input.prompt);
        break;
      case SCHEMA_NAMES.creativeConcepts:
        raw = { concepts: MOCK_CONCEPTS };
        break;
      case SCHEMA_NAMES.imageReview:
        raw = mockImageReview();
        break;
      default:
        throw new AIProviderError(
          `Mock provider has no fixture for schema "${input.schemaName}". Set OPENAI_API_KEY to use the real provider.`,
          this.id,
          "invalid_response"
        );
    }

    const parsed = input.schema.safeParse(raw);
    if (!parsed.success) {
      throw new AIProviderError(
        `Mock fixture for "${input.schemaName}" no longer matches its schema: ${parsed.error.message}`,
        this.id,
        "invalid_response"
      );
    }

    return { data: parsed.data, model: "mock-creative-director", provider: this.id };
  }
}
