import React from 'react';
import Editor from '@monaco-editor/react';

export interface MonacoFieldProps {
  value: string;
  onChange: (next: string) => void;
  language: 'html' | 'css' | 'javascript' | 'json';
  height?: number | string;
  readOnly?: boolean;
}

export function MonacoField({
  value,
  onChange,
  language,
  height = 400,
  readOnly = false,
}: MonacoFieldProps) {
  return (
    <Editor
      height={height}
      language={language}
      value={value}
      theme="vs"
      onChange={(v) => onChange(v ?? '')}
      options={{
        readOnly,
        minimap: { enabled: false },
        fontSize: 13,
        scrollBeyondLastLine: false,
        wordWrap: 'on',
        tabSize: 2,
        automaticLayout: true,
      }}
    />
  );
}
