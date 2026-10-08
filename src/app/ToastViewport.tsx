import { ThemeSlot } from '@/themes/ThemeSlot';
import { useToasts } from '@/ui/toast-store';

export function ToastViewport() {
  const toasts = useToasts((state) => state.toasts);
  const dismiss = useToasts((state) => state.dismiss);
  return (
    <div className="toast-viewport">
      {toasts.map((toast) => (
        <ThemeSlot
          key={toast.id}
          name="Toast"
          props={{
            kind: toast.kind,
            message: toast.message,
            action: toast.action && {
              label: toast.action.label,
              onAction: () => {
                dismiss(toast.id);
                toast.action?.onAction();
              },
            },
            onDismiss: () => {
              dismiss(toast.id);
            },
          }}
        />
      ))}
    </div>
  );
}
