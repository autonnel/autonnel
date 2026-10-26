export interface PinnedPage {
  stepSlug: string;
  pageId: string;
  // The storefront starts checkout sessions with the page slug, which can differ from the authored stepSlug.
  pageSlug?: string;
  pagePublicationVersion: number;
}
