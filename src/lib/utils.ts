import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function toProperCase(str: string): string {
  if (!str) return '';
  return str
    .trim()
    .toLowerCase()
    .split(' ')
    .filter(w => w.trim() !== '')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}
