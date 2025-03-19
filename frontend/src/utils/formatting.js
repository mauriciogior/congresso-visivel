export function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value)
}

export function formatPercentage(value) {
  return `${value > 0 ? '+' : ''}${value.toFixed(2)}%`
}

export function getDiffClass(value) {
  return value > 0 ? 'text-red-600' : 'text-green-600'
}

/**
 * Create URL-friendly slugs from strings
 * - Removes accents and diacritics
 * - Converts to lowercase
 * - Replaces spaces with dashes
 * - Removes special characters
 */
export function slugify(text) {
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

/**
 * Format text from uppercase to camelCase
 * - Converts text like "EXPENSE TYPE" to "Expense Type"
 * - Capitalizes first letter of each word
 * - Preserves spacing
 */
export function toCamelCase(text) {
  if (!text) return '';
  return text
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}