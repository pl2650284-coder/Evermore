'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

export default function Modal({ open, title, onClose, busy = false, children }: {
  open: boolean;
  title: string;
  onClose: () => void;
  busy?: boolean;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (open && dialog && !dialog.open) {
      dialog.showModal();
      dialog.querySelector<HTMLElement>('input, textarea')?.focus();
    }
    if (!open && dialog?.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      className="m-auto max-h-[90vh] max-w-lg overflow-y-auto rounded-3xl border border-gray-200 bg-white p-0 text-foreground shadow-xl backdrop:bg-black/50 dark:border-gray-800 dark:bg-gray-900"
      style={{ width: 'calc(100% - 2rem)' }}
      onCancel={(event) => { if (busy) event.preventDefault(); else onClose(); }}
      onClick={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}
    >
      <div className="p-6 sm:p-8">
        <div className="mb-6 flex items-center justify-between gap-4">
          <h2 id={titleId} className="section-title">{title}</h2>
          <button type="button" onClick={onClose} disabled={busy} aria-label="关闭弹窗" className="rounded-full p-2 transition-colors hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50 dark:hover:bg-gray-800">
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
