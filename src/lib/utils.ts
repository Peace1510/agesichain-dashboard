import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge Tailwind classes safely, resolving conflicts via tailwind-merge
 * and handling conditional classes via clsx.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** Format a number to fixed decimal places with a trailing unit label. */
export function fmt(value: number, decimals = 2, unit = ""): string {
  return `${value.toFixed(decimals)}${unit ? " " + unit : ""}`;
}

/** Format a viability fraction (0–1) as a percentage string. */
export function fmtViability(v: number): string {
  return `${(v * 100).toFixed(2)} %`;
}

/** Format a Unix timestamp (seconds) to a short HH:MM:SS local string. */
export function fmtTimestamp(unix_s: number): string {
  return new Date(unix_s * 1000).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}
