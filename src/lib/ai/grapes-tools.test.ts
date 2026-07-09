import { describe, it, expect } from 'vitest';
import { createGrapesTools } from './grapes-tools';

const baseHtml = '<div data-aid="a0"><h1 data-aid="a1">Old</h1></div>';

describe('createGrapesTools', () => {
  it('rewriteText replaces visible text by aid', async () => {
    const t = createGrapesTools(baseHtml, '');
    const res: any = await (t.tools.rewriteText as any).execute({ aid: 'a1', text: 'New' });
    expect(res.rewritten).toBe('a1');
    expect(t.getFinalState().html).toContain('>New<');
  });

  it('rewriteText reports error for missing aid', async () => {
    const t = createGrapesTools(baseHtml, '');
    const res: any = await (t.tools.rewriteText as any).execute({ aid: 'nope', text: 'x' });
    expect(res).toEqual({ error: 'aid nope not found' });
  });

  it('replaceSection swaps outerHTML by aid', async () => {
    const t = createGrapesTools(baseHtml, '');
    const res: any = await (t.tools.replaceSection as any).execute({
      aid: 'a1',
      html: '<h2>Brand new</h2>',
    });
    expect(res.replaced).toBe('a1');
    expect(t.getFinalState().html).toContain('<h2>Brand new</h2>');
    expect(t.getFinalState().html).not.toContain('<h1');
  });

  it('appendCss concatenates with a newline when styling is allowed', async () => {
    const t = createGrapesTools(baseHtml, 'body{margin:0;}', { stylingAllowed: true });
    await (t.tools.appendCss as any).execute({ css: 'h1{color:red;}' });
    expect(t.getFinalState().css).toBe('body{margin:0;}\nh1{color:red;}');
  });

  it('appendCss rejected when stylingAllowed is false (default)', async () => {
    const t = createGrapesTools(baseHtml, 'body{margin:0;}');
    const res: any = await (t.tools.appendCss as any).execute({ css: 'h1{color:red;}' });
    expect(res.error).toMatch(/disabled/i);
    expect(t.getFinalState().css).toBe('body{margin:0;}');
  });

  it('appendCss rejects dangerous CSS even when stylingAllowed', async () => {
    const t = createGrapesTools(baseHtml, '', { stylingAllowed: true });
    const res: any = await (t.tools.appendCss as any).execute({
      css: '.overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); }',
    });
    expect(res.error).toMatch(/full-screen|fixed-position/i);
    expect(t.getFinalState().css).toBe('');
  });

  it('replaceSection rejects HTML containing fixed-position overlay', async () => {
    const t = createGrapesTools(baseHtml, '');
    const res: any = await (t.tools.replaceSection as any).execute({
      aid: 'a1',
      html: '<div style="position: fixed; inset: 0; background: black; opacity: 0.5;"></div>',
    });
    expect(res.error).toMatch(/full-screen|fixed-position/i);
    expect(t.getFinalState().html).toContain('<h1');
  });

  it('getCurrentPage returns html with aids and current css', async () => {
    const t = createGrapesTools(baseHtml, 'a{}');
    const res: any = await (t.tools.getCurrentPage as any).execute({});
    expect(res.html).toContain('data-aid="a1"');
    expect(res.css).toBe('a{}');
  });

  it('getFinalState strips aids', () => {
    const t = createGrapesTools(baseHtml, '');
    expect(t.getFinalState().html).not.toContain('data-aid');
  });

  it('rewriteText returns added/removed character counts', async () => {
    const t = createGrapesTools('<h1 data-aid="a1">Old text</h1>', '');
    const res: any = await (t.tools.rewriteText as any).execute({ aid: 'a1', text: 'Brand new' });
    expect(res.rewritten).toBe('a1');
    expect(res.removed).toBe(8);
    expect(res.added).toBe(9);
    expect(res.unit).toBe('chars');
  });

  it('replaceSection returns added/removed character counts', async () => {
    const t = createGrapesTools('<h1 data-aid="a1">Old</h1>', '');
    const res: any = await (t.tools.replaceSection as any).execute({
      aid: 'a1',
      html: '<h2>New heading</h2>',
    });
    expect(res.replaced).toBe('a1');
    expect(res.removed).toBeGreaterThan(0);
    expect(res.added).toBe('<h2>New heading</h2>'.length);
    expect(res.unit).toBe('chars');
  });

  it('appendCss returns added/removed=0 character count', async () => {
    const t = createGrapesTools('<div></div>', '', { stylingAllowed: true });
    const res: any = await (t.tools.appendCss as any).execute({ css: 'a{color:red;}' });
    expect(res.removed).toBe(0);
    expect(res.added).toBe('a{color:red;}'.length);
    expect(res.unit).toBe('chars');
  });
});

const baseHtmlWithImage =
  '<div data-aid="a0"><img data-aid="a1" data-pid="pexisting" src="old.jpg"><h1 data-aid="a2">T</h1></div>';

describe('setImagePrompt', () => {
  it('writes prompt to imagePrompts keyed by existing data-pid', async () => {
    const t = createGrapesTools(baseHtmlWithImage, '');
    const res: any = await (t.tools.setImagePrompt as any).execute({
      aid: 'a1',
      prompt: 'a cozy room',
    });
    expect(res.ok).toBe('pexisting');
    expect(t.getFinalState().imagePrompts).toEqual({ pexisting: 'a cozy room' });
  });

  it('auto-assigns a data-pid when missing and uses it as key', async () => {
    const html = '<div data-aid="a0"><img data-aid="a1" src="old.jpg"></div>';
    const t = createGrapesTools(html, '');
    const res: any = await (t.tools.setImagePrompt as any).execute({
      aid: 'a1',
      prompt: 'new pic',
    });
    expect(res.ok).toMatch(/^p[a-z0-9]{8}$/);
    const final = t.getFinalState();
    expect(Object.keys(final.imagePrompts)).toHaveLength(1);
    expect(final.imagePrompts[res.ok]).toBe('new pic');
  });

  it('rejects non-media elements', async () => {
    const t = createGrapesTools(baseHtmlWithImage, '');
    const res: any = await (t.tools.setImagePrompt as any).execute({
      aid: 'a2',
      prompt: 'x',
    });
    expect(res.error).toMatch(/not an image or video/i);
  });

  it('rejects unknown aid', async () => {
    const t = createGrapesTools(baseHtmlWithImage, '');
    const res: any = await (t.tools.setImagePrompt as any).execute({
      aid: 'nope',
      prompt: 'x',
    });
    expect(res.error).toMatch(/not found/);
  });

  it('latest prompt overwrites earlier prompt for the same pid', async () => {
    const t = createGrapesTools(baseHtmlWithImage, '');
    await (t.tools.setImagePrompt as any).execute({ aid: 'a1', prompt: 'first' });
    await (t.tools.setImagePrompt as any).execute({ aid: 'a1', prompt: 'second' });
    expect(t.getFinalState().imagePrompts).toEqual({ pexisting: 'second' });
  });

  it('getFinalState strips both data-aid and data-pid', () => {
    const t = createGrapesTools(baseHtmlWithImage, '');
    const html = t.getFinalState().html;
    expect(html).not.toContain('data-aid');
    expect(html).not.toContain('data-pid');
  });

  it('setImagePrompt returns added/removed prompt character counts', async () => {
    const t = createGrapesTools(
      '<div><img data-aid="a1" data-pid="pexist" src="x"></div>',
      '',
    );
    let res: any = await (t.tools.setImagePrompt as any).execute({
      aid: 'a1',
      prompt: 'first',
    });
    expect(res.added).toBe(5);
    expect(res.removed).toBe(0);
    expect(res.unit).toBe('chars');

    res = await (t.tools.setImagePrompt as any).execute({
      aid: 'a1',
      prompt: 'second longer prompt',
    });
    expect(res.added).toBe('second longer prompt'.length);
    expect(res.removed).toBe(5);
  });
});
