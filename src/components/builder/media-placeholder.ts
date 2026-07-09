export const MEDIA_PLACEHOLDER_DATA_URL =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 400">
  <defs>
    <pattern id="p" patternUnits="userSpaceOnUse" width="24" height="24" patternTransform="rotate(45)">
      <rect width="12" height="24" fill="#e0e7ff"/>
      <rect x="12" width="12" height="24" fill="#eef2ff"/>
    </pattern>
  </defs>
  <rect width="100%" height="100%" fill="url(#p)"/>
  <g transform="translate(300 175)" stroke="#3730a3" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round">
    <rect x="-36" y="-36" width="72" height="72" rx="6"/>
    <circle cx="-12" cy="-12" r="6" fill="#3730a3"/>
    <path d="M36 18 L12 -8 L-32 36" stroke="#3730a3"/>
  </g>
  <text x="50%" y="74%" text-anchor="middle" font-family="-apple-system,system-ui,Segoe UI,Roboto,sans-serif" font-size="22" font-weight="600" fill="#3730a3">Image to generate</text>
</svg>`,
  );

export interface PuckRenderExtras {
  puck?: { isEditing?: boolean };
}

/**
 * Resolves the "to generate" placeholder for a media slot that has a prompt but no
 * generated url yet. The placeholder is an editor-only affordance: on the published
 * storefront (Puck `<Render>` passes isEditing=false, island/dynamic paths pass none)
 * an ungenerated prompt renders nothing instead of leaking the striped placeholder.
 */
export function placeholderUrl(prompt: string | undefined, puck?: { isEditing?: boolean }): string {
  return prompt && puck?.isEditing ? MEDIA_PLACEHOLDER_DATA_URL : '';
}
