import { create } from 'zustand';

export type ToastKind = 'info' | 'success' | 'error';

export interface ToastEntry {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastState {
  toasts: ToastEntry[];
  show: (kind: ToastKind, message: string) => void;
  dismiss: (id: number) => void;
}

const VISIBLE_MS = 6_000;
const MAX_TOASTS = 3;
let nextId = 1;

export const useToasts = create<ToastState>()((set, get) => ({
  toasts: [],
  show: (kind, message) => {
    const id = nextId++;
    set({ toasts: [...get().toasts, { id, kind, message }].slice(-MAX_TOASTS) });
    setTimeout(() => {
      get().dismiss(id);
    }, VISIBLE_MS);
  },
  dismiss: (id) => {
    set({ toasts: get().toasts.filter((toast) => toast.id !== id) });
  },
}));
