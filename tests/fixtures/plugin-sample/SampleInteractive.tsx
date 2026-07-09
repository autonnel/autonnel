import React from 'react';

export interface SampleInteractiveProps {
  buttonLabel: string;
}

export function SampleInteractive({ buttonLabel }: SampleInteractiveProps) {
  const [clicked, setClicked] = React.useState(false);
  return (
    <div data-testid="sample-interactive">
      <button type="button" onClick={() => setClicked(true)}>
        {clicked ? 'clicked' : buttonLabel}
      </button>
    </div>
  );
}
