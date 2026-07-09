import * as React from 'react';
import ReactMarkdown from 'react-markdown';

export interface MarkdownProps {
  content: string;
  className?: string;
}

const components = {
  p: (props: React.ComponentPropsWithoutRef<'p'>) => <p className="mb-2 last:mb-0" {...props} />,
  h1: (props: React.ComponentPropsWithoutRef<'h1'>) => <h1 className="text-[15px] font-semibold text-ds-ink mt-3 mb-1.5 first:mt-0" {...props} />,
  h2: (props: React.ComponentPropsWithoutRef<'h2'>) => <h2 className="text-[14px] font-semibold text-ds-ink mt-3 mb-1.5 first:mt-0" {...props} />,
  h3: (props: React.ComponentPropsWithoutRef<'h3'>) => <h3 className="text-[13.5px] font-semibold text-ds-ink mt-3 mb-1.5 first:mt-0" {...props} />,
  h4: (props: React.ComponentPropsWithoutRef<'h4'>) => <h4 className="text-[13px] font-semibold text-ds-ink mt-2.5 mb-1 first:mt-0" {...props} />,
  strong: (props: React.ComponentPropsWithoutRef<'strong'>) => <strong className="font-semibold text-ds-ink" {...props} />,
  em: (props: React.ComponentPropsWithoutRef<'em'>) => <em className="italic" {...props} />,
  ul: (props: React.ComponentPropsWithoutRef<'ul'>) => <ul className="list-disc pl-5 mb-2 space-y-0.5 last:mb-0" {...props} />,
  ol: (props: React.ComponentPropsWithoutRef<'ol'>) => <ol className="list-decimal pl-5 mb-2 space-y-0.5 last:mb-0" {...props} />,
  li: (props: React.ComponentPropsWithoutRef<'li'>) => <li className="pl-0.5" {...props} />,
  code: (props: React.ComponentPropsWithoutRef<'code'>) => (
    <code className="bg-ds-surface2 border border-ds-line rounded px-1 py-0.5 text-[0.9em] font-ds-mono" {...props} />
  ),
  pre: (props: React.ComponentPropsWithoutRef<'pre'>) => (
    <pre className="bg-ds-surface2 border border-ds-line rounded-lg px-3 py-2 overflow-x-auto mb-2 last:mb-0 [&>code]:bg-transparent [&>code]:border-0 [&>code]:p-0" {...props} />
  ),
  a: (props: React.ComponentPropsWithoutRef<'a'>) => <a className="text-ds-accent underline" target="_blank" rel="noreferrer" {...props} />,
  hr: (props: React.ComponentPropsWithoutRef<'hr'>) => <hr className="border-ds-line my-3" {...props} />,
  blockquote: (props: React.ComponentPropsWithoutRef<'blockquote'>) => (
    <blockquote className="border-l-2 border-ds-line pl-3 my-2 text-ds-muted" {...props} />
  ),
};

const Markdown: React.FC<MarkdownProps> = ({ content, className }) => (
  <div className={className}>
    <ReactMarkdown components={components}>{content}</ReactMarkdown>
  </div>
);

export default Markdown;
