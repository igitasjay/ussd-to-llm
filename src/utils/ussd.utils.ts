/**
 * USSD Utilities for sanitization, chunking and breadcrumb parsing
 */

/**
 * Sanitizes a string for Africa's Talking USSD (GSM 7-bit compatible)
 * Strips characters that might break the session or are not standard GSM.
 */
export const sanitizeForUssd = (text: string): string => {
  if (!text) return "";

  // Replace common non-GSM characters
  let sanitized = text
    .replace(/[₦]/g, "N") // Replace Naira with N
    .replace(/[&]/g, "and") // Replace &
    .replace(/[#*]/g, "")   // Strip # and * as they are USSD delimiters
    .replace(/[^\x00-\x7F]/g, ""); // Remove non-ASCII/extended characters

  // GSM 7-bit basic character set is mostly ASCII 0-127, 
  // but we should be extra careful about special symbols.
  return sanitized.trim();
};

/**
 * Splits a long response into chunks of up to 160 characters.
 * If there are multiple chunks, appends "1. Next" to all but the last one.
 */
export const chunkResponse = (text: string, maxLen: number = 145): string[] => {
  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxLen) {
      chunks.push(remaining);
      break;
    }

    // Try to break at a space to avoid cutting words
    let sliceEnd = maxLen;
    const lastSpace = remaining.lastIndexOf(" ", maxLen);
    if (lastSpace > maxLen * 0.8) {
      sliceEnd = lastSpace;
    }

    let chunk = remaining.substring(0, sliceEnd).trim();
    remaining = remaining.substring(sliceEnd).trim();

    // Add pagination indicator if there's more
    if (remaining.length > 0) {
      chunk += "\n1. Next";
    }

    chunks.push(chunk);
  }

  return chunks;
};

/**
 * Parses the star-delimited USSD text into an array of steps.
 * Handles the "power user" breadcrumb skipping.
 */
export const parseBreadcrumbs = (text: string | undefined): string[] => {
  if (!text || typeof text !== "string") return [];
  return text.split("*").filter(step => step.length > 0);
};

// Helper to get the last user input from breadcrumbs
export const getLatestInput = (text: string | undefined): string => {
  if (!text || typeof text !== "string") return "";
  const steps = parseBreadcrumbs(text);
  const latest = steps[steps.length - 1];
  return latest ?? "";
};
