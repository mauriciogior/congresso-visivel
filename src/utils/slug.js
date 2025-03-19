/**
 * Create URL-friendly slugs from strings
 * - Removes accents and diacritics
 * - Converts to lowercase
 * - Replaces spaces with dashes
 * - Removes special characters
 */
export function slugify(text) {
  if (!text) return '';
  
  return text
    .toString()
    .normalize('NFD')                 // Normalize accented characters
    .replace(/[\u0300-\u036f]/g, '')  // Remove diacritics
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')         // Remove special chars
    .replace(/[\s_]+/g, '-')          // Replace spaces with dashes
    .replace(/^-+|-+$/g, '');         // Remove leading/trailing dashes
}