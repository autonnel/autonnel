import * as cheerio from 'cheerio';

export function tagHtmlWithAids(html: string): string {
  const $ = cheerio.load(html, null, false);
  let counter = 0;
  const used = new Set<string>();
  $('[data-aid]').each((_, el) => {
    if ('attribs' in el) used.add(el.attribs['data-aid']);
  });
  $('*').each((_, el) => {
    if (!('attribs' in el)) return;
    if (el.attribs['data-aid']) return;
    while (used.has(`a${counter}`)) counter++;
    el.attribs['data-aid'] = `a${counter}`;
    used.add(`a${counter}`);
    counter++;
  });
  return $.html();
}

export function stripAids(html: string): string {
  const $ = cheerio.load(html, null, false);
  $('[data-aid]').removeAttr('data-aid');
  return $.html();
}
