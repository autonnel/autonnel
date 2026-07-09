


import {
  generateText,
  streamText,
  stepCountIs,
  Output,
  type LanguageModel,
  type ModelMessage,
} from 'ai';
import { z } from 'zod';
import type { ComponentInfo, PageState } from './page-tools';
import { loadSkillCatalog, buildSkillPrompt, createLoadSkillTool } from './skill-loader';


export type AgentEvent =
  | { type: 'step-start'; step: number }
  | { type: 'tool-call'; toolName: string; input: unknown }
  | { type: 'tool-result'; toolName: string; added?: number; removed?: number; unit?: string }
  | { type: 'tool-error'; toolName: string; error: string }
  | { type: 'text-delta'; delta: string }
  | { type: 'reasoning-delta'; delta: string };

function buildSystemPrompt(
  componentCatalog: ComponentInfo[],
  pageState: PageState | undefined,
  hasTools: boolean,
): string {
  const catalogLines = componentCatalog
    .map((c) => `- **${c.name}** (${c.label}) [${c.category}]`)
    .join('\n');

  let pageStateSection = '';
  if (pageState) {
    pageStateSection = `
## Current Page State
Root props: ${JSON.stringify(pageState.root)}
Content (${pageState.content.length} components):
${pageState.content.map((c, i) => `  ${i}: ${c.type} — ${JSON.stringify(c.props).substring(0, 200)}`).join('\n')}
`;
  }

  const workflowSection = hasTools
    ? `## Workflow (tools available)
1. If no page state is shown above, call \`getPageState\` to inspect the current components.
2. Plan ALL the changes needed before acting. Reference images and product descriptions imply changes across multiple components, not just one. Mentally list every index that needs updating, from 0 to the last one — do not skip leading or trailing indices.
3. **When the user provides a reference image** (a screenshot, mockup, product photo, or design), rewrite EVERY component to fit that reference — including index 0 (announcement bar), index 1 (hero), all middle sections, AND the footer. Do NOT stop after editing a single component or a single batch.
4. **For EVERY MediaFieldValue** (image / video / icon) inside any component you touch, you MUST write all three fields:
   - \`url\`: always empty string \`""\` — the page will auto-generate it later.
   - \`prompt\`: REQUIRED, 1-2 vivid sentences describing exactly what the image should depict (product, mood, composition, colors). NEVER leave this blank or "TODO" — a blank prompt leaves the page with no image.
   - \`referenceImageUrl\`: if the last user message contains a \`[Reference image URLs available to you ...]\` block, pick the URL whose subject best matches this component and set it here verbatim. Use the SAME URL across multiple components if they all depict the same product. If no reference URLs were given, omit this field.

   Example for a pillow product page with one reference URL \`https://cdn.example.com/pillow.png\`:
   \`\`\`
   updateComponent({
     index: 1,
     props: {
       productImage: {
         url: "",
         prompt: "Close-up of the SIBAISE natural cotton-linen buckwheat pillow on a clean grey backdrop, a hand pressing into it to show softness, daylight.",
         referenceImageUrl: "https://cdn.example.com/pillow.png"
       }
     }
   })
   \`\`\`

5. Use \`addComponent\` / \`removeComponent\` / \`updateComponent\` / \`reorderComponents\` / \`setRootProps\` to make changes. You may issue many tool calls in parallel in one turn — do so when changes are independent.
6. **Mandatory self-check before finishing**: After your batch of changes, call \`getPageState\` again and verify ALL of the following, patching with further tool calls until every check passes:
   - Each component's props reflect the user's request (right brand, language, colors) and every MediaFieldValue has a non-empty \`prompt\`.
   - \`root.maxWidth\` is set to a concrete width (e.g. "1080") — NOT missing and NOT "none".
   - Section widths flow consistently: full-bleed bands (\`fullWidth\`) must contain their content within the page width, and a wide section must not be followed by a squeezed, extremely narrow one. If a section would render as a tiny centered card between full-width neighbors, rework its props (or swap the component/theme) so the rhythm stays consistent.
7. NARRATION: Before each tool call output ONE short sentence saying what you're about to do, in the user's language. Examples: "Adding the hero banner.", "正在更新页脚组件." Keep under 60 chars. Do NOT narrate read-only calls (getPageState, getAvailableComponents).
8. FINAL SUMMARY: After the self-check passes, end with a markdown summary in the user's language, with three sections:
    - "## 修改概述" / "## Summary of changes": bullets of what changed.
    - "## 决策原因" / "## Why these changes": 1-3 sentences explaining your approach.
    - "## 后续建议" / "## Observations & next steps": bullet list of things you noticed (broken layout, missing prompts, things to follow up on). Skip if nothing notable.
   Do NOT echo the page state as JSON — your changes are committed through tool calls.`
    : `## Workflow (no tools — JSON output)
1. Review the current page state shown above.
2. Plan all the changes needed.
3. When adding components, provide appropriate initial props.
4. Return the COMPLETE new page state as a JSON object — not a diff, all components.

## Output Format
You MUST output a JSON object with exactly this structure:
\`\`\`json
{
  "explanation": "Brief message about what you did",
  "content": [{ "type": "ComponentName", "props": { ... } }],
  "root": { "maxWidth": "...", "fontFamily": "...", ... }
}
\`\`\`
- Always include ALL content items in the array, not just the changed ones.`;

  return `You are an expert page builder AI for a visual editor called Puck. You help users build e-commerce funnel pages by adding, removing, reordering, and updating components. You can analyze images that users paste or upload — use visual details from screenshots, designs, or reference images to inform page changes.

## Available Components
${catalogLines}

## Component Categories
- **Landing Page**: Hero banners, reviews, image-text sections, product showcases, FAQs, countdown timers, footers, etc.
- **Checkout**: Checkout forms, payment buttons, address forms, order summaries, coupon inputs.
- **Thank You / Confirmation**: Order details, order tracking.
- **Upsell**: Upsell hero sections, add-to-order buttons, product selectors, countdown timers.
- **Policy / Content**: Rich text content, footers.
- **E-commerce Store**: Announcement bars, navigation bars, hero sliders, category grids, product card grids.
- **Layout**: Column-based layouts.

## Value Types for Props
- **TextFieldValue**: { text: string, color?: string, fontSize?: number } — for styled text fields like headlines, taglines
- **MediaFieldValue**: { url: string, prompt?: string, mediaType?: 'image'|'video', referenceImageUrl?: string } — for images/videos. \`url\` should normally be left as empty string when you want a fresh generation; \`prompt\` describes what to generate; \`referenceImageUrl\` is a URL the generator uses as an input image (image-to-image / image-to-video).
- **URLFieldValue**: { type: 'custom'|'funnel-cta', url: string } — for links
- Plain strings, numbers, booleans, and arrays are used directly.

## Root Props
- **maxWidth**: Page max width — "none", "1440", "1280", "1080", "960", "768", "680"
- **fontFamily**: "system", "Inter", "Roboto", "Playfair Display", "Space Grotesk", "Plus Jakarta Sans"
- **fontSize**: Base font size — "0.85", "0.9", "1", "1.05", "1.1"
- **language**: "en", "zh", "es", "fr", "de"
${pageStateSection}
${workflowSection}

## Common Guidelines
- **Always give the page a content width.** Whenever you build or substantially rework a page, explicitly set \`root.maxWidth\` (via \`setRootProps\` or the JSON \`root\` object) to a concrete value — "1080" is a good default for landing/sales/checkout/upsell pages ("1280" for wide, airy layouts). NEVER leave it unset or "none": without a width cap every section stretches edge-to-edge and the page looks broken. When a section should visually bleed to the browser edge, keep the page maxWidth and enable that component's \`fullWidth\` prop instead — its background bleeds while the content stays aligned to the page width.
- **Build a COMPLETE page, not a skeleton.** When you start from an empty or nearly-empty page and the user asks for a landing/sales page, assemble a full, high-converting page — aim for roughly 9–14 sections, not 4–5. A strong default arc: urgency/announcement bar → hero → trust badges → key benefits (icon row or checklist) → product showcase → how-it-works / usage steps → social proof / customer reviews → expert or press endorsement → ingredients / science / comparison → FAQ → risk-reversal guarantee → a final full-width CTA → footer. Every section must carry real, specific, on-brand copy (concrete claims, named benefits, believable review text) — never placeholder or "lorem". Leave NO large empty gaps: if a section would render mostly blank, fill its props or replace it. Prefer denser, richer sections over sparse ones.
- **Give full-width sections a background image.** Any hero, CTA banner, or section rendered edge-to-edge (it exposes a \`fullWidth\` prop and a \`backgroundImage\`) looks unfinished as a flat color band. Whenever you enable \`fullWidth\` (or the component is already full-width), ALSO set its \`backgroundImage\` MediaFieldValue with a vivid, on-topic \`prompt\`, and set a \`backgroundOverlay\` (e.g. 30–55) so overlaid text stays legible. For the hero especially, the background should be an EVOCATIVE PHOTOGRAPHIC SCENE (e.g. soft-focus botanicals, a spa-lit marble surface, a model's radiant skin) — not a plain gradient — behind the copy, in addition to any separate \`productImage\`.
- **Fill per-item images so sections aren't half-empty.** Many components render a list of items, each with its own image/icon slot (e.g. HowToSteps \`steps[].image\`, ReviewList \`reviews[].avatarImage\`, FeatureIconRow / BenefitList item icons, CategoryTiles / ProductGrid tiles, MediaGrid). If an item schema includes an image/icon field, SET it (MediaFieldValue with a \`prompt\`) for every item — a steps or features row with empty item images collapses into big blank bands. Populate item imagery, not just item text.
- **Use only real prop names.** Every component reads a fixed set of props. When updating a component, use ONLY the keys in that component's \`validPropNames\` / \`schema\` (returned by \`getPageState\`, and as \`defaultProps\` from \`getAvailableComponents\`). Inventing prop names (e.g. \`headline\`, \`trustIcons\`) silently fails — the renderer ignores unknown keys, so your change won't appear even though the tool succeeds. If a component's existing props contain unknown keys (leftover from earlier mistakes), set the correct schema keys instead; do not copy the unknown keys.
- **Array items have fixed keys too.** List props (e.g. ReviewList \`reviews\`, HowToSteps \`steps\`, FaqAccordion items) read a fixed set of keys per item — check \`arrayItemKeys\` in \`getAvailableComponents\` / the item shapes in \`defaultProps\`. Writing \`reviews[].name\` / \`reviews[].text\` when the renderer reads \`author\` / \`content\` makes the whole section render EMPTY. If a tool result contains a \`warning\` about ignored keys (top-level or item-level), you MUST immediately re-write that component with the correct keys before moving on.
- For text content, use TextFieldValue format: { text: "the text" }
- For every MediaFieldValue you touch, ALWAYS fill \`prompt\` with a vivid 1-2 sentence description matching the surrounding content (product type, mood, composition). Leave \`url\` as an empty string — the page will auto-generate the image from your prompt.
- If the user has provided one or more **reference image URLs** in the conversation (look for the "[Reference image URLs available to you ...]" block in the last user message), populate \`referenceImageUrl\` on each MediaFieldValue with the URL whose subject best matches that component. Reuse the same URL across multiple components when they all depict the same product.
- Don't fabricate URLs you weren't given — only \`referenceImageUrl\` should ever contain a URL, and only one from the provided list.
- Match component type names EXACTLY as listed — case-sensitive.
- If the user's request is unclear, ask for clarification instead of guessing.`;
}

// Some models (notably Qwen via Anthropic-compatible endpoints) stringify

function preParseJson(v: unknown): unknown {
  if (typeof v !== 'string') return v;
  const trimmed = v.trim();
  if (!trimmed) return v;
  if (!trimmed.startsWith('[') && !trimmed.startsWith('{')) return v;
  try {
    return JSON.parse(trimmed);
  } catch {
    return v;
  }
}

const ContentItemSchema = z.object({
  type: z.string().describe('Component type name, e.g. "HeroPanel"'),
  props: z.record(z.string(), z.any()).describe('Component props'),
});

const ContentArraySchema = z
  .preprocess(preParseJson, z.array(ContentItemSchema))
  .describe('The complete new content array for the page.');

const RootObjectSchema = z
  .preprocess(preParseJson, z.record(z.string(), z.any()))
  .optional();

const RawOutputSchema = z.object({
  explanation: z
    .string()
    .optional()
    .describe('A concise message to the user explaining what was done or asking for clarification.'),
  content: ContentArraySchema,
  root: RootObjectSchema.describe('The root/page-level props.'),
  rootProps: RootObjectSchema.describe('Alias for root props.'),
});

export { RawOutputSchema };

export type RawAgentOutput = z.infer<typeof RawOutputSchema>;
export type AgentOutput = {
  explanation: string;
  content: Array<{ type: string; props: Record<string, any> }>;
  root: Record<string, any>;
};

function normalizeOutput(raw: RawAgentOutput | undefined): AgentOutput | undefined {
  if (!raw) return undefined;
  return {
    explanation: raw.explanation ?? 'Done!',
    content: raw.content ?? [],
    root: raw.root ?? raw.rootProps ?? {},
  };
}

interface StreamWithEventsOptions {
  model: LanguageModel;
  system: string;
  messages: ModelMessage[];
  tools?: Record<string, any>;
  maxSteps: number;
  onEvent?: (event: AgentEvent) => void;
}

interface StreamWithEventsResult {
  text: string;
  steps: Awaited<ReturnType<typeof generateText>>['steps'];
  finishReason: string;
  usage: unknown;
}

async function streamWithEvents(opts: StreamWithEventsOptions): Promise<StreamWithEventsResult> {
  const { model, system, messages, tools, maxSteps, onEvent } = opts;

  const stream = streamText({
    model,
    system,
    messages,
    ...(tools && Object.keys(tools).length > 0 ? { tools } : {}),
    stopWhen: stepCountIs(maxSteps),
  });

  let stepCount = 0;
  for await (const part of stream.fullStream) {
    switch (part.type) {
      case 'start-step':
        stepCount++;
        onEvent?.({ type: 'step-start', step: stepCount });
        break;
      case 'tool-call':
        onEvent?.({ type: 'tool-call', toolName: part.toolName, input: part.input });
        break;
      case 'tool-result': {
        const out = (part as { output?: { added?: unknown; removed?: unknown; unit?: unknown } }).output;
        onEvent?.({
          type: 'tool-result',
          toolName: part.toolName,
          added: typeof out?.added === 'number' ? out.added : undefined,
          removed: typeof out?.removed === 'number' ? out.removed : undefined,
          unit: typeof out?.unit === 'string' ? out.unit : undefined,
        });
        break;
      }
      case 'tool-error':
        onEvent?.({
          type: 'tool-error',
          toolName: (part as { toolName: string }).toolName,
          error: String((part as { error: unknown }).error),
        });
        break;
      case 'text-delta':
        onEvent?.({ type: 'text-delta', delta: (part as { text: string }).text ?? '' });
        break;
      case 'reasoning-delta':
        onEvent?.({ type: 'reasoning-delta', delta: (part as { text: string }).text ?? '' });
        break;
      default:
        break;
    }
  }

  return {
    text: (await stream.text) ?? '',
    steps: (await stream.steps) ?? [],
    finishReason: (await stream.finishReason) ?? 'unknown',
    usage: await stream.usage,
  };
}

export interface RunPageBuilderAgentOptions {
  model: LanguageModel;
  componentCatalog: ComponentInfo[];
  pageState?: PageState;
  messages: ModelMessage[];
  tools?: Record<string, any>;
  maxSteps?: number;


  onEvent?: (event: AgentEvent) => void;


  systemPrompt?: string;
}

export interface RunPageBuilderAgentResult {
  object: AgentOutput | undefined;
  text: string;
  steps: Awaited<ReturnType<typeof generateText>>['steps'];
  finishReason: string;
  usage: unknown;
}

export async function runPageBuilderAgent(
  opts: RunPageBuilderAgentOptions
): Promise<RunPageBuilderAgentResult> {
  const { model, componentCatalog, pageState, messages, tools, maxSteps = 20, onEvent, systemPrompt } = opts;

  const skills = loadSkillCatalog('page-builder');
  const skillsPrompt = buildSkillPrompt(skills);
  const hasUserTools = !!tools && Object.keys(tools).length > 0;
  const baseSystem = systemPrompt ?? buildSystemPrompt(componentCatalog, pageState, hasUserTools);
  const system = skillsPrompt ? `${baseSystem}\n\n${skillsPrompt}` : baseSystem;

  const userTools = tools ?? {};
  const mergedTools: Record<string, any> =
    skills.length > 0
      ? { ...userTools, load_skill: createLoadSkillTool(skills) }
      : userTools;

  // We also avoid Output.object here because it forces `tool_choice` to a
  // specific tool, which Anthropic rejects whenever extended thinking is on
  if (hasUserTools || Object.keys(mergedTools).length > 0) {
    const result = await streamWithEvents({ model, system, messages, tools: mergedTools, maxSteps, onEvent });
    return { object: undefined, ...result };
  }

  // No-tools path (OpenAI-compat / Claude w/o tools): keep Output.object for
  const result = await generateText({
    model,
    system,
    messages,
    output: Output.object({ schema: RawOutputSchema }),
  });

  const rawObject = result.output as RawAgentOutput | undefined;
  return {
    object: normalizeOutput(rawObject),
    text: result.text ?? '',
    steps: result.steps ?? [],
    finishReason: result.finishReason ?? 'unknown',
    usage: result.usage,
  };
}

export interface RunAnalystAgentOptions {
  model: LanguageModel;
  system: string;
  messages: ModelMessage[];
  tools?: Record<string, any>;
  maxSteps?: number;
  onEvent?: (event: AgentEvent) => void;
}

export interface RunAnalystAgentResult {
  text: string;
  steps: Awaited<ReturnType<typeof generateText>>['steps'];
  finishReason: string;
  usage: unknown;
}

// Generic streaming analyst loop. Freeform markdown output (no Output.object).
// When no tools are given it still streams text deltas via the shared loop.
export async function runAnalystAgent(opts: RunAnalystAgentOptions): Promise<RunAnalystAgentResult> {
  const { model, system, messages, tools, maxSteps = 12, onEvent } = opts;
  return streamWithEvents({ model, system, messages, tools, maxSteps, onEvent });
}
