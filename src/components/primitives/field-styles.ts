const focusState =
  "focus:border-ds-accent focus:ring-2 focus:ring-ds-accent/25 " +
  "focus-visible:border-ds-accent focus-visible:ring-2 focus-visible:ring-ds-accent/25";

const fieldShell =
  "w-full rounded-[7px] border border-ds-line bg-ds-card text-sm text-ds-ink " +
  "shadow-sm outline-none transition-colors placeholder:text-ds-faint " +
  "hover:border-ds-linehi " +
  focusState +
  " disabled:cursor-not-allowed disabled:opacity-50";

export const dsFieldClass = `flex h-9 px-3 py-1.5 ${fieldShell}`;

export const dsTextareaClass = `flex min-h-[80px] px-3 py-2 ${fieldShell}`;

export const dsSelectClass = `${dsFieldClass} ds-select-chevron appearance-none bg-no-repeat pr-9 cursor-pointer`;

export const dsFieldErrorClass =
  "border-ds-bad hover:border-ds-bad " +
  "focus:border-ds-bad focus:ring-ds-bad/25 " +
  "focus-visible:border-ds-bad focus-visible:ring-ds-bad/25";

export const dsFieldLabelClass = "block text-sm font-medium text-ds-ink mb-1.5";

export const dsFieldHintClass = "text-xs text-ds-muted mt-1.5";

export const dsFieldErrorTextClass = "text-xs text-ds-bad mt-1.5";
