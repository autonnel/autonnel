import React, { type ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';

const HTML_TAG_RE = /<\/?[a-z][\s\S]*?>/i;

export function RichBody({
  value,
  style,
  className,
}: {
  value: string | ReactNode | undefined;
  style?: React.CSSProperties;
  className?: string;
}) {
  if (!value) return null;
  if (typeof value !== 'string') {
    return <div style={style} className={className}>{value}</div>;
  }
  if (HTML_TAG_RE.test(value)) {
    return <div style={style} className={className} dangerouslySetInnerHTML={{ __html: value }} />;
  }
  return <div style={style} className={className}><ReactMarkdown>{value}</ReactMarkdown></div>;
}
