import { generateText, stepCountIs, tool, type ModelMessage } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';
import { getLlmModel } from '@/lib/config/llm-models';
import { LlmNotConfiguredError } from '@/lib/llm/errors';
import { loadSkillCatalog, buildSkillPrompt, createLoadSkillTool } from './skill-loader';

const AVAILABLE_COMPONENT_TYPES = [
  'HeroPanel',
  'NoticeBar',
  'ImageTextSplit',
  'EndorsementPanel',
  'ReviewList',
  'FaqAccordion',
  'HowToSteps',
  'ProductSpotlight',
  'CountdownTimer',
  'StickyCheckoutBar',
  'PageFooter',
  'RichTextBlock',
  'StickyPageHeader',
  'CallToActionBanner',
  'FeatureIconRow',
  'StoreHeader',
  'HeroCarousel',
  'CategoryTiles',
  'ProductGrid',
] as const;

const componentTypeEnum = z.enum(AVAILABLE_COMPONENT_TYPES);

const componentSchema = z.object({
  type: componentTypeEnum,
  props: z.record(z.string(), z.unknown()).optional().describe(
    'Component content props. Generate real, specific content — no placeholders.',
  ),
});

const setComponentsTool = tool({
  description:
    'Replace the entire page with a new ordered list of components and their content. ' +
    'Use when the user wants to build or fully redesign the page. ' +
    'Generate complete, real content for every component — not placeholders.',
  inputSchema: z.object({
    components: z.array(componentSchema).min(1).describe('Full ordered list of page components'),
  }),
  execute: async () => ({ success: true }),
});

const addComponentTool = tool({
  description:
    'Add a single component to the page at a specific position. ' +
    'Use when the user asks to add one specific section.',
  inputSchema: z.object({
    type: componentTypeEnum,
    index: z.number().int().min(0).optional().describe(
      'Insert at this 0-based index. Omit to append at the end.',
    ),
    props: z.record(z.string(), z.unknown()).optional().describe('Component content props'),
  }),
  execute: async () => ({ success: true }),
});

const removeComponentTool = tool({
  description: 'Remove the component at the given 0-based index.',
  inputSchema: z.object({
    index: z.number().int().min(0),
  }),
  execute: async () => ({ success: true }),
});

const updateComponentTool = tool({
  description:
    'Update the props of the component at the given 0-based index. ' +
    'Only provide the props that need to change — others are preserved.',
  inputSchema: z.object({
    index: z.number().int().min(0),
    props: z.record(z.string(), z.unknown()).describe('Props to merge into the existing component'),
  }),
  execute: async () => ({ success: true }),
});

const COMPONENT_CATALOG = `
## Available Components

### Landing Page Components
- **HeroPanel** – Full-width hero section. Key props: headline, subheadline, tagline, ctaText, benefits (string[]), trustBadges (string[]), logoImage ({url,prompt,mediaType}), productImage ({url,prompt,mediaType}), backgroundImage ({url,prompt,mediaType})
- **NoticeBar** – Top announcement strip. Key props: text, link, backgroundColor
- **ImageTextSplit** – Image + text side by side. Key props: sectionTitle, headline, description, bulletPoints ([{icon,title,description}]), imagePosition ("left"|"right"), image ({url,prompt,mediaType}), backgroundColor
- **EndorsementPanel** – Expert/doctor endorsement. Key props: sectionTitle, expertName, expertTitle, quote, credentials (string[]), expertImage ({url,prompt,mediaType}), backgroundColor
- **ReviewList** – Customer reviews / photos. Pick theme: 'list' (stacked review cards with author, rating, content, optional images), 'hero' (full-bleed background + single big avatar carousel), or 'carousel' (auto-scrolling UGC photo strip). Key props: theme, sectionTitle, reviews ([{author,country,rating,content,verified,date,images}]) for list/hero, images ([{image:{url}}]) for carousel, backgroundColor, backgroundImage (hero), backgroundOverlay (hero), autoScroll (carousel).
- **FaqAccordion** – Accordion FAQ. Key props: title, faqs ([{question,answer}]), backgroundColor
- **HowToSteps** – Step-by-step usage guide. Key props: sectionTitle, subtitle, steps ([{title,description,image:{url,prompt,mediaType}}]), backgroundColor
- **ProductSpotlight** – Product with countdown + CTA. Key props: headline, productName, badgeText, cardTitle, ctaText, guaranteeText, countdownHours, countdownMinutes, productImage ({url,prompt,mediaType})
- **CountdownTimer** – Urgency countdown. Pick theme: 'block' (full section with headline, subheadline, product image, three boxes, urgency line, CTA button) or 'mini' (compact dashed-border HH:MM:SS strip). Key props: theme, hours, minutes, seconds, backgroundColor; block-only: headline, subheadline, ctaText, urgencyText, productImage; mini-only: label, timerColor.
- **StickyCheckoutBar** – Fixed bottom CTA bar. Key props: tagline, ctaText, ctaUrl, backgroundColor, ctaColor, logoImage ({url,prompt,mediaType})
- **PageFooter** – Page footer. Pick theme: 'full' (logo, tagline, nav, about, copyright) or 'compact' (brand name + flat link row, used in checkout). Key props: theme, backgroundColor, links, padding, fullWidth; full-only: logoImage, tagline, aboutTitle, aboutText, copyright; compact-only: brandName, brandLogo.
- **RichTextBlock** – Free-form rich text block with title and styling. Key props: title, content (rich text — pass plain HTML or escaped string and Puck will render it), backgroundColor, contentFontSize, contentAlignment, maxWidth, padding.
- **StickyPageHeader** – Sticky header with countdown. Key props: logoText, ctaText, ctaUrl
- **CallToActionBanner** – Call-to-action section. Pick theme: 'plain' (centered headline + button only, no image, optional fullWidth) or 'sale-card' (dashed-border card on tinted background, top sale badge, image-left + text-right grid, urgency line, guarantee). Key props: theme, headline, ctaText, ctaUrl, backgroundColor, ctaColor; sale-card-only: badgeText, taglineText, headlineSuffix, productImage, urgencyText, guaranteeText.
- **FeatureIconRow** – Icon feature strip (free shipping etc.). Key props: features ([{icon,title}]), layout ("inline"|"card")
- **StoreHeader** – Store navigation bar. Key props: logoText, links ([{label,url}])
- **HeroCarousel** – Multi-image hero slider. Key props: slides ([{headline,ctaText,image:{url,prompt,mediaType}}])
- **CategoryTiles** – Category image grid. Key props: title, categories ([{name,link,image:{url,prompt,mediaType}}])
- **ProductGrid** – Product card grid. Key props: title, products ([{name,price,badge,link,image:{url,prompt,mediaType}}])
`.trim();

function buildSystemPrompt(pagePrompt: string, currentComponents: string): string {
  return `You are an expert e-commerce page builder AI integrated into a visual drag-and-drop editor.

## Your job
When the user asks you to build or change a page, call the appropriate tool(s) and generate complete, real content — not placeholders. Think like a professional copywriter who specializes in high-converting e-commerce landing pages.

## Page context
- Product / page description: ${pagePrompt}
- Current page components (indexed from 0):
${currentComponents || '  (empty page — no components yet)'}

${COMPONENT_CATALOG}

## Content rules
- All text must be real, specific, and persuasive — never say "Insert headline here" or similar
- For image props, provide a descriptive "prompt" string (used to generate the image later); leave "url" as ""
- For media fields use format: { url: "", prompt: "...", mediaType: "image" }
- String arrays (benefits, trustBadges, credentials) must be plain strings, not objects
- backgroundColor should alternate between "#ffffff" and "#f8fafc" across consecutive sections
- Use American English; write in a direct, benefit-focused style that converts

## Tool selection guide
- User wants to build/redesign the page → call set_components with the full layout
- User wants to add one section → call add_component
- User wants to remove a section → call remove_component (use 0-based index)
- User wants to tweak copy/content → call update_component
- You may call multiple tools in sequence for complex requests`;
}

export interface PageComponentState {
  type: string;
  index: number;
}

export interface PageBuilderMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface PageBuilderToolCall {
  payload: {
    toolName: string;
    args: unknown;
  };
}

export interface PageBuilderResult {
  text: string;
  toolCalls: PageBuilderToolCall[];
}

export interface PageBuilderRunner {
  generate(messages: PageBuilderMessage[]): Promise<PageBuilderResult>;
}

export async function createPageBuilderAgent(
  pagePrompt: string,
  currentComponents: PageComponentState[],
): Promise<PageBuilderRunner> {
  const row = await getLlmModel('text');
  if (!row) throw new LlmNotConfiguredError();

  const openai = createOpenAI({
    baseURL: row.baseUrl.replace(/\/+$/, ''),
    apiKey: row.apiKey,
  });
  const modelId = row.name;
  const model = openai(modelId);

  const currentComponentsStr = currentComponents.length
    ? currentComponents.map((c) => `  [${c.index}] ${c.type}`).join('\n')
    : '';

  const baseSystem = buildSystemPrompt(pagePrompt, currentComponentsStr);
  const skills = loadSkillCatalog('page-builder');
  const skillsPrompt = buildSkillPrompt(skills);
  const system = skillsPrompt ? `${baseSystem}\n\n${skillsPrompt}` : baseSystem;

  const tools: Record<string, any> = {
    set_components: setComponentsTool,
    add_component: addComponentTool,
    remove_component: removeComponentTool,
    update_component: updateComponentTool,
  };
  if (skills.length > 0) {
    tools.load_skill = createLoadSkillTool(skills);
  }

  return {
    async generate(messages) {
      const modelMessages: ModelMessage[] = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const result = await generateText({
        model,
        system,
        messages: modelMessages,
        tools,
        stopWhen: stepCountIs(10),
      });

      const toolCalls: PageBuilderToolCall[] = (result.toolCalls ?? []).map((tc: any) => ({
        payload: {
          toolName: tc.toolName,
          args: tc.input,
        },
      }));

      return { text: result.text ?? '', toolCalls };
    },
  };
}
