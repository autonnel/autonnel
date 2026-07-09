import { describe, it, expect } from 'vitest';
import { tagMediaWithPids, stripPids, randomPid } from './pid-utils';

describe('pid-utils', () => {
  it('randomPid returns "p" prefix + 8 lowercase alnum chars', () => {
    for (let i = 0; i < 20; i++) {
      const pid = randomPid();
      expect(pid).toMatch(/^p[a-z0-9]{8}$/);
    }
  });

  it('tagMediaWithPids adds data-pid to <img> and <video> only', () => {
    const html = '<div><img src="a.jpg"><p>hi</p><video src="v.mp4"></video><span>x</span></div>';
    const out = tagMediaWithPids(html);
    expect(out).toMatch(/<img[^>]+data-pid="p[a-z0-9]{8}"/);
    expect(out).toMatch(/<video[^>]+data-pid="p[a-z0-9]{8}"/);
    expect(out).not.toMatch(/<p[^>]+data-pid/);
    expect(out).not.toMatch(/<span[^>]+data-pid/);
    expect(out).not.toMatch(/<div[^>]+data-pid/);
  });

  it('tagMediaWithPids preserves existing data-pid', () => {
    const html = '<img data-pid="pkeepme00" src="a.jpg">';
    const out = tagMediaWithPids(html);
    expect(out).toContain('data-pid="pkeepme00"');
    expect(out.match(/data-pid="p/g)?.length).toBe(1);
  });

  it('stripPids removes all data-pid attrs', () => {
    const html = '<img data-pid="pabc12345" src="a.jpg"><video data-pid="pdef67890"></video>';
    expect(stripPids(html)).toBe('<img src="a.jpg"><video></video>');
  });
});
