import { create } from 'zustand';

export type ToastKind = 'info' | 'success' | 'error';

export interface ToastAction {
  label: string;
  onAction: () => void;
}

export interface ToastEntry {
  id: number;
  kind: ToastKind;
  message: string;
  action?: ToastAction;
}

interface ToastState {
  toasts: ToastEntry[];
  show: (kind: ToastKind, message: string, action?: ToastAction) => void;
  dismiss: (id: number) => void;
}

const VISIBLE_MS = 6_000;
/** Toasts with an action stay longer, so there is time to use it. */
const VISIBLE_WITH_ACTION_MS = 12_000;
const MAX_TOASTS = 3;
let nextId = 1;

export const useToasts = create<ToastState>()((set, get) => ({
  toasts: [],
  show: (kind, message, action) => {
    const id = nextId++;
    set({ toasts: [...get().toasts, { id, kind, message, action }].slice(-MAX_TOASTS) });
    setTimeout(
      () => {
        get().dismiss(id);
      },
      action ? VISIBLE_WITH_ACTION_MS : VISIBLE_MS,
    );
  },
  dismiss: (id) => {
    set({ toasts: get().toasts.filter((toast) => toast.id !== id) });
  },
}));
