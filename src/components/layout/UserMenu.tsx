import * as React from 'react';
import ChangePasswordModal from '@/components/auth/ChangePasswordModal';

interface UserShape {
  email?: string | null;
  username?: string | null;
  name?: string | null;
  avatar?: string | null;
}

interface Props {
  user: UserShape | null;
}

function initialOf(user: UserShape | null): string {
  const source = user?.name || user?.email || user?.username || 'A';
  return source.trim().charAt(0).toUpperCase();
}

export default function UserMenu({ user }: Props) {
  const [open, setOpen] = React.useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const label = user?.email || user?.name || user?.username || 'User';
  const initials = initialOf(user);

  return (
    <>
      <div ref={rootRef} className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label={user?.email ? `Account menu for ${user.email}` : 'Account menu'}
          title={label}
          className="w-8 h-8 rounded-full bg-ds-ink text-ds-card flex items-center justify-center text-[12.5px] font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-ds-accent focus-visible:ring-offset-1"
        >
          {user?.avatar ? (
            <img src={user.avatar} alt="" className="w-8 h-8 rounded-full object-cover" />
          ) : (
            <span>{initials}</span>
          )}
        </button>
        {open && (
          <div
            role="menu"
            className="absolute right-0 mt-1.5 z-30 w-56 bg-ds-card border border-ds-line rounded-[8px] shadow-[0_8px_24px_rgba(17,24,39,0.12)] py-1"
          >
            <div className="px-3 py-2 border-b border-ds-line">
              <div className="text-[12.5px] text-ds-ink font-medium truncate" title={label}>
                {label}
              </div>
            </div>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                setChangePasswordOpen(true);
              }}
              className="block w-full text-left px-3 py-1.5 text-[13px] text-ds-slate hover:bg-ds-surface2 hover:text-ds-ink"
            >
              Change password
            </button>
            <a
              role="menuitem"
              href="/logout"
              className="block px-3 py-1.5 text-[13px] text-ds-slate hover:bg-ds-surface2 hover:text-ds-ink no-underline"
            >
              Sign out
            </a>
          </div>
        )}
      </div>
      <ChangePasswordModal
        open={changePasswordOpen}
        onClose={() => setChangePasswordOpen(false)}
      />
    </>
  );
}
