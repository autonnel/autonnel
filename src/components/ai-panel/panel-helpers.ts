import React from 'react';

export type LlmModelOption = {
  name: string;
  isDefault: boolean;
};

export const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

export const iconButtonStyle: React.CSSProperties = {
  width: 28,
  height: 28,
  border: 0,
  borderRadius: 6,
  background: 'transparent',
  color: '#6b7280',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 0,
};

export function iconButtonHover(e: React.MouseEvent<HTMLButtonElement>) {
  e.currentTarget.style.background = '#f3f4f6';
  e.currentTarget.style.color = '#111827';
}

export function iconButtonLeave(e: React.MouseEvent<HTMLButtonElement>) {
  e.currentTarget.style.background = 'transparent';
  e.currentTarget.style.color = '#6b7280';
}
