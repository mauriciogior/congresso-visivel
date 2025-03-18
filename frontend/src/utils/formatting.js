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