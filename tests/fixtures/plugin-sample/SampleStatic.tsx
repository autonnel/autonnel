import React from 'react';

export interface SampleStaticProps {
  heading: string;
  tone: string;
}

export function SampleStatic({ heading, tone }: SampleStaticProps) {
  return (
    <section data-testid="sample-static" data-tone={tone}>
      <h2>{heading}</h2>
    </section>
  );
}
