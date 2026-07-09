import { useEffect, useRef, useState } from 'react';
import type { Editor } from 'grapesjs';
import { ImageAiPanel } from './ImageAiPanel';
import { tagMediaWithPids, randomPid } from '@/lib/ai/pid-utils';

interface Props {
  editorRef: React.MutableRefObject<Editor | null>;
  containerRef: React.RefObject<HTMLDivElement | null>;
  pageId: string;
}

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface HoverState {
  el: HTMLImageElement | HTMLVideoElement;
  rect: Rect;
}

interface OpenState {
  pid: string;
  el: HTMLImageElement | HTMLVideoElement;
  rect: Rect;
}

const HIDE_DELAY_MS = 150;

function ensurePidOnElement(el: HTMLImageElement | HTMLVideoElement): string {
  let pid = el.getAttribute('data-pid');
  if (!pid) {
    pid = randomPid();
    el.setAttribute('data-pid', pid);
  }
  return pid;
}

function computeRect(
  el: HTMLElement,
  frame: HTMLIFrameElement,
  container: HTMLDivElement,
): Rect {
  const elRect = el.getBoundingClientRect();
  const frameRect = frame.getBoundingClientRect();
  const containerRect = container.getBoundingClientRect();
  return {
    top: frameRect.top + elRect.top - containerRect.top,
    left: frameRect.left + elRect.left - containerRect.left,
    width: elRect.width,
    height: elRect.height,
  };
}

export function ImageAiOverlay({ editorRef, containerRef, pageId }: Props) {
  const [hover, setHover] = useState<HoverState | null>(null);
  const [open, setOpen] = useState<OpenState | null>(null);
  const rafRef = useRef<number | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const openRef = useRef<OpenState | null>(null);

  openRef.current = open;

  const clearHideTimer = () => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  };

  const scheduleHide = () => {
    clearHideTimer();
    hideTimerRef.current = setTimeout(() => {
      setHover(null);
      hideTimerRef.current = null;
    }, HIDE_DELAY_MS);
  };

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const setupCanvas = () => {
      const doc = editor.Canvas.getDocument();
      const frame = editor.Canvas.getFrameEl();
      const container = containerRef.current;
      if (!doc || !frame || !container) return;

      const html = editor.getHtml();
      const tagged = tagMediaWithPids(html);
      if (tagged !== html) {
        editor.setComponents(tagged);
      }

      const updateHover = (target: EventTarget | null) => {
        if (openRef.current) return;
        if (!(target instanceof Element)) return;
        const media = target.closest('img, video') as HTMLImageElement | HTMLVideoElement | null;
        if (!media) return;
        ensurePidOnElement(media);
        clearHideTimer();
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(() => {
          setHover({ el: media, rect: computeRect(media, frame, container) });
        });
      };

      const onOver = (e: MouseEvent) => updateHover(e.target);
      const onMove = (e: MouseEvent) => updateHover(e.target);
      const onOut = (e: MouseEvent) => {
        if (openRef.current) return;
        const next = e.relatedTarget as Element | null;
        if (next && next.closest && next.closest('img, video')) return;
        scheduleHide();
      };
      const onScroll = () => {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(() => {
          setHover((cur) => {
            if (!cur) return cur;
            return { ...cur, rect: computeRect(cur.el, frame, container) };
          });
        });
      };

      const onDblClick = (e: MouseEvent) => {
        if (!(e.target instanceof Element)) return;
        const media = e.target.closest('img, video') as
          | HTMLImageElement
          | HTMLVideoElement
          | null;
        if (!media) return;
        e.preventDefault();
        e.stopPropagation();
        const pid = ensurePidOnElement(media);
        clearHideTimer();
        setHover(null);
        setOpen({ pid, el: media, rect: computeRect(media, frame, container) });
      };

      doc.addEventListener('mouseover', onOver, true);
      doc.addEventListener('mousemove', onMove, true);
      doc.addEventListener('mouseout', onOut, true);
      doc.addEventListener('dblclick', onDblClick, true);
      doc.defaultView?.addEventListener('scroll', onScroll, true);
      window.addEventListener('resize', onScroll);

      return () => {
        doc.removeEventListener('mouseover', onOver, true);
        doc.removeEventListener('mousemove', onMove, true);
        doc.removeEventListener('mouseout', onOut, true);
        doc.removeEventListener('dblclick', onDblClick, true);
        doc.defaultView?.removeEventListener('scroll', onScroll, true);
        window.removeEventListener('resize', onScroll);
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
      };
    };

    let teardown: (() => void) | undefined;
    const wire = () => {
      teardown?.();
      teardown = setupCanvas();
    };
    wire();
    editor.on('load', wire);
    editor.on('canvas:frame:load:body', wire);
    return () => {
      editor.off('load', wire);
      editor.off('canvas:frame:load:body', wire);
      teardown?.();
      clearHideTimer();
    };
  }, [editorRef, containerRef]);

  if (!hover && !open) return null;

  return (
    <>
      {hover && !open && (
        <button
          type="button"
          className="autonnel-img-ai-button"
          onMouseEnter={clearHideTimer}
          onMouseLeave={scheduleHide}
          onClick={(e) => {
            e.stopPropagation();
            clearHideTimer();
            const pid = ensurePidOnElement(hover.el);
            setOpen({ pid, el: hover.el, rect: hover.rect });
            setHover(null);
          }}
          aria-label="Generate image with AI"
          title="Generate with AI"
          style={{
            position: 'absolute',
            top: hover.rect.top + 6,
            left: hover.rect.left + hover.rect.width - 36,
            width: 30,
            height: 30,
            borderRadius: '50%',
            background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
            color: '#fff',
            border: 0,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 14px rgba(99,102,241,0.45)',
            zIndex: 50,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3l2.4 5.4L20 11l-5.6 2.6L12 19l-2.4-5.4L4 11l5.6-2.6L12 3z" />
          </svg>
        </button>
      )}

      {open && (
        <div
          style={{
            position: 'absolute',
            top: open.rect.top,
            left: (() => {
              const container = containerRef.current;
              const containerWidth = container?.clientWidth ?? Infinity;
              const PANEL_W = 320;
              const rightEdge = open.rect.left + open.rect.width + 8 + PANEL_W;
              if (rightEdge <= containerWidth) {
                return open.rect.left + open.rect.width + 8;
              }
              const leftFlipped = open.rect.left - PANEL_W - 8;
              if (leftFlipped >= 0) return leftFlipped;
              return Math.max(0, containerWidth - PANEL_W - 8);
            })(),
            zIndex: 60,
          }}
        >
          <ImageAiPanel
            pid={open.pid}
            pageId={pageId}
            currentSrc={open.el.getAttribute('src') || ''}
            onApplyUrl={(url) => {
              const editor = editorRef.current;
              if (!editor) return;
              const comp = editor.getWrapper()?.find(`[data-pid="${open.pid}"]`)?.[0];
              if (comp) {
                // GrapesJS image/video components store src as a model property;
                // getHtml() renders from the model, not from attributes. Update both.
                comp.set('src', url);
                comp.addAttributes({ src: url });
                const count = (editor as any).get('changesCount') || 0;
                (editor as any).set('changesCount', count + 1);
              } else {
                open.el.setAttribute('src', url);
                editor.setComponents(editor.getHtml());
              }
            }}
            onClose={() => setOpen(null)}
          />
        </div>
      )}
    </>
  );
}
