import { writable } from 'svelte/store';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  timeout: number;
}

function createToastStore() {
  const { subscribe, update } = writable<Toast[]>([]);

  function addToast(message: string, type: ToastType = 'info', timeout: number = 3000) {
    const id = Math.random().toString(36).substr(2, 9);
    update(toasts => [
      ...toasts,
      { id, message, type, timeout }
    ]);

    if (timeout > 0) {
      setTimeout(() => {
        removeToast(id);
      }, timeout);
    }

    return id;
  }

  function removeToast(id: string) {
    update(toasts => toasts.filter(t => t.id !== id));
  }

  return {
    subscribe,
    success: (message: string, timeout?: number) => addToast(message, 'success', timeout),
    error: (message: string, timeout?: number) => addToast(message, 'error', timeout),
    warning: (message: string, timeout?: number) => addToast(message, 'warning', timeout),
    info: (message: string, timeout?: number) => addToast(message, 'info', timeout),
    remove: removeToast
  };
}

export const toastStore = createToastStore();