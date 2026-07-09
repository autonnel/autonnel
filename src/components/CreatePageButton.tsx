import * as React from 'react';
import CreatePageModal from './page-create/CreatePageModal';

export default function CreatePageButton() {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center justify-center font-medium rounded-[7px] h-8 px-3 text-[13px] gap-2 bg-ds-ink border border-ds-ink text-ds-card hover:bg-[#1F2937]"
      >
        + Create page
      </button>
      {open && (
        <CreatePageModal
          onClose={() => setOpen(false)}
          onCreated={() => setOpen(false)}
        />
      )}
    </>
  );
}
