import { X } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useEffect, useRef, type ReactNode } from 'react';
import { useI18n } from '../i18n';

export function Dialog({ open, title, children, onClose, tone = 'default' }: { open: boolean; title: string; children: ReactNode; onClose: () => void; tone?: 'default' | 'danger' }) {
  const { t } = useI18n();
  const reduced = useReducedMotion();
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.classList.add('dialog-open');
    return () => { document.removeEventListener('keydown', onKey); document.body.classList.remove('dialog-open'); };
  }, [onClose, open]);
  return <AnimatePresence>
    {open && <motion.div className="dialog-backdrop" role="presentation" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: .18 }} onMouseDown={(e) => e.currentTarget === e.target && onClose()}>
      <motion.section
        role="dialog" aria-modal="true" aria-labelledby="dialog-title"
        className={`dialog-panel ${tone === 'danger' ? 'dialog-danger' : ''}`}
        initial={reduced ? { opacity: 0 } : { opacity: 0, transform: 'translateY(24px) scale(.97)' }}
        animate={{ opacity: 1, transform: 'translateY(0) scale(1)' }}
        exit={reduced ? { opacity: 0 } : { opacity: 0, transform: 'translateY(16px) scale(.98)' }}
        transition={{ duration: .24, ease: [.23, 1, .32, 1] }}
      >
        <header className="dialog-header"><h2 id="dialog-title">{title}</h2><button ref={closeRef} className="icon-button" onClick={onClose} aria-label={t('Close dialog')}><X /></button></header>
        {children}
      </motion.section>
    </motion.div>}
  </AnimatePresence>;
}
