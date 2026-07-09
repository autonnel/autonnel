import React, { useCallback, useEffect, useRef } from 'react';
import { registerOverlayPortal, setDeep, useGetPuck, type FieldTransforms } from '@puckeditor/core';
import type { TextFieldValue } from './TextField';

function InlineEditableSpan({
  text,
  propPath,
  componentId,
  isReadOnly,
}: {
  text: string;
  propPath: string;
  componentId: string;
  isReadOnly: boolean;
}) {
  const getPuck = useGetPuck();
  const ref = useRef<HTMLSpanElement | null>(null);
  const lastSeenRef = useRef(text);

  useEffect(() => {
    if (!ref.current) return;
    const cleanup = registerOverlayPortal(ref.current, { disableDragOnFocus: true });
    return () => cleanup?.();
  }, []);

  useEffect(() => {
    if (!ref.current) return;
    if (document.activeElement === ref.current) return;
    if (ref.current.textContent !== text) {
      ref.current.textContent = text;
      lastSeenRef.current = text;
    }
  }, [text]);

  const handleInput = useCallback(() => {
    if (!ref.current) return;
    let next = ref.current.textContent ?? '';
    if (next.includes('\n')) {
      next = next.replace(/\n+/g, ' ');
      ref.current.textContent = next;
    }
    if (next === lastSeenRef.current) return;
    lastSeenRef.current = next;

    const puck = getPuck();
    const item = puck.getItemById(componentId);
    if (!item) return;
    const selector = puck.getSelectorForId(componentId);
    if (!selector) return;

    const nextProps = setDeep(item.props, `${propPath}.text`, next);
    puck.dispatch({
      type: 'replace',
      destinationIndex: selector.index,
      destinationZone: selector.zone,
      data: { ...item, props: nextProps },
    });
  }, [getPuck, componentId, propPath]);

  if (isReadOnly) return <>{text}</>;

  // never reconciles the children — typing keeps the caret stable.
  return (
    <span
      ref={(el) => {
        ref.current = el;
        if (el && el.textContent !== text) el.textContent = text;
      }}
      contentEditable="plaintext-only"
      suppressContentEditableWarning
      onInput={handleInput}
      onPointerDownCapture={(e) => e.stopPropagation()}
      onClickCapture={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.preventDefault();
      }}
      style={{
        outline: 'none',
        cursor: 'text',
        minWidth: '1ch',
        display: 'inline-block',
      }}
    />
  );
}

export const autonnelFieldTransforms: FieldTransforms = {
  custom: ({ value, field, propPath, componentId, isReadOnly }) => {
    if (!(field as { metadata?: { autonnelEditable?: boolean } }).metadata?.autonnelEditable) {
      return value;
    }
    if (!value || typeof value !== 'object') return value;
    const v = value as TextFieldValue;
    if (typeof v.text !== 'string') return value;
    return {
      ...v,
      text: (
        <InlineEditableSpan
          text={v.text}
          propPath={propPath}
          componentId={componentId}
          isReadOnly={isReadOnly}
        />
      ),
    };
  },
};
