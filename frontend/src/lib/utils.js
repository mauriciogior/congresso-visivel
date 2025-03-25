import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Use import.meta.env to access environment variables
export const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3002/api';

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export function valueUpdater(updaterOrValue, ref) {
  ref.value =
    typeof updaterOrValue === 'function'
      ? updaterOrValue(ref.value)
      : updaterOrValue;
}
