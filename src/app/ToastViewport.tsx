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
            onDismiss: () => {
              dismiss(toast.id);
            },
          }}
        />
      ))}
    </div>
  );
}
