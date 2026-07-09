import * as cheerio from 'cheerio';

const MEDIA_SELECTOR = 'img, video';

export function randomPid(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let out = 'p';
  for (let i = 0; i < 8; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

export function tagMediaWithPids(html: string): string {
  const $ = cheerio.load(html, null, false);
  const used = new Set<string>();
  $('[data-pid]').each((_, el) => {
    if ('attribs' in el) used.add(el.attribs['data-pid']);
  });
  $(MEDIA_SELECTOR).each((_, el) => {
    if (!('attribs' in el)) return;
    if (el.attribs['data-pid']) return;
    let pid = randomPid();
    while (used.has(pid)) pid = randomPid();
    el.attribs['data-pid'] = pid;
    used.add(pid);
  });
  return $.html();
}

export function stripPids(html: string): string {
  const $ = cheerio.load(html, null, false);
  $('[data-pid]').removeAttr('data-pid');
  return $.html();
}
