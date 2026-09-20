import { useEffect, useId, useRef, type ReactNode } from 'react';

interface ConfirmDialogProps {
    open: boolean;
    title: string;
    description: ReactNode;
    confirmLabel: string;
    cancelLabel?: string;
    tone?: 'danger' | 'default';
    onConfirm: () => void;
    onCancel: () => void;
}

// Cancel is the default focus so an accidental Enter never triggers the dangerous action.
export function ConfirmDialog({
    open,
    title,
    description,
    confirmLabel,
    cancelLabel = 'ยกเลิก',
    tone = 'danger',
    onConfirm,
    onCancel,
}: ConfirmDialogProps) {
    const titleId = useId();
    const descriptionId = useId();
    const cancelRef = useRef<HTMLButtonElement>(null);
    const confirmRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        if (!open) return;
        const previouslyFocused = document.activeElement as HTMLElement | null;
        cancelRef.current?.focus();
        return () => previouslyFocused?.focus();
    }, [open]);

    if (!open) return null;

    const handleKeyDown = (event: React.KeyboardEvent) => {
        if (event.key === 'Escape') {
            event.stopPropagation();
            onCancel();
            return;
        }
        if (event.key !== 'Tab') return;
        const first = cancelRef.current;
        const last = confirmRef.current;
        if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first?.focus();
        }
    };

    const confirmClass = tone === 'danger'
        ? 'bg-danger text-white hover:bg-danger/90'
        : 'bg-primary text-white hover:bg-primary/90';

    return (
        <div
            className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm animate-fade-in px-4"
            onClick={onCancel}
            onKeyDown={handleKeyDown}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descriptionId}
        >
            <div
                className={`bg-card border ${tone === 'danger' ? 'border-danger/40' : 'border-line'} p-6 rounded-2xl shadow-2xl w-full max-w-md animate-scale-in`}
                onClick={(e) => e.stopPropagation()}
            >
                <h3 id={titleId} className="text-xl font-bold mb-2">{title}</h3>
                <div id={descriptionId} className="text-sm text-muted/80 mb-6">{description}</div>
                <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
                    <button
                        ref={cancelRef}
                        type="button"
                        onClick={onCancel}
                        className="px-4 py-2.5 rounded-lg border border-line hover:bg-white/5 transition-colors font-semibold focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                        {cancelLabel}
                    </button>
                    <button
                        ref={confirmRef}
                        type="button"
                        onClick={onConfirm}
                        className={`px-4 py-2.5 rounded-lg transition-colors font-semibold focus:outline-none focus:ring-2 focus:ring-white/60 ${confirmClass}`}
                    >
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}
