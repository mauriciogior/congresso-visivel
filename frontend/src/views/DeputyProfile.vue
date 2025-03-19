<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { formatCurrency } from '../utils/formatting'
import { ArrowLeft, Search } from 'lucide-vue-next'
import SpendingGauge from '../components/expense-analysis/SpendingGauge.vue'

// Import UI components
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem
} from '@/components/ui/select'
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableCaption
} from '@/components/ui/table'

const route = useRoute()
const router = useRouter()
const API_URL = 'http://localhost:3002/api'

// Data
const deputy = ref(null)
const expenses = ref([])
const filters = ref({
  years: [],
  months: [],
  expenseTypes: []
})
const performanceRank = ref(null)

// Form state
const isLoading = ref(false)
const selectedExpenseType = ref('all')
const selectedYear = ref('')
const selectedMonth = ref('all')
const searchQuery = ref('')

// Sort state
const sortColumn = ref('document_date')
const sortDirection = ref('desc')

// Fetch deputy data
async function fetchDeputyData() {
  isLoading.value = true
  console.log('Loading started')

  try {
    const params = new URLSearchParams()
    
    if (selectedExpenseType.value && selectedExpenseType.value !== 'all') {
      params.append('expenseType', selectedExpenseType.value)
    }
    
    if (selectedYear.value) {
      params.append('year', selectedYear.value)
    }
    
    if (selectedMonth.value && selectedMonth.value !== 'all') {
      // Ensure month is properly padded with leading zero if needed
      const formattedMonth = selectedMonth.value.padStart(2, '0')
      params.append('month', formattedMonth)
      console.log('Month filter applied:', formattedMonth)
    }
    
    const requestUrl = `${API_URL}/deputy/${route.params.id}?${params.toString()}`
    console.log('Fetching from:', requestUrl)
    
    const response = await fetch(requestUrl)
    
    if (!response.ok) {
      throw new Error('Failed to fetch deputy data')
    }
    
    // Reset the arrays first to avoid stale data
    expenses.value = []
    
    const data = await response.json()
    console.log('Data received:', {
      deputyReceived: !!data.deputy,
      expensesCount: data.expenses?.length || 0,
      filtersReceived: !!data.filters,
      years: data.filters?.years?.length || 0,
      months: data.filters?.months?.length || 0,
      types: data.filters?.expenseTypes?.length || 0
    })
    
    // Process the response data
    if (data.deputy) {
      deputy.value = data.deputy
    }
    
    // Force Vue to detect changes by creating a new array
    if (Array.isArray(data.expenses)) {
      // Use nextTick to ensure the UI updates
      setTimeout(() => {
        console.log(`Setting ${data.expenses.length} expenses`)
        expenses.value = [...data.expenses]
      }, 0)
    } else {
      console.warn('No expenses array in response')
      expenses.value = []
    }
    
    if (data.filters) {
      filters.value = {
        years: Array.isArray(data.filters.years) ? [...data.filters.years] : [],
        months: Array.isArray(data.filters.months) ? [...data.filters.months] : [],
        expenseTypes: Array.isArray(data.filters.expenseTypes) ? [...data.filters.expenseTypes] : []
      }
    } else {
      filters.value = { years: [], months: [], expenseTypes: [] }
    }
    
    // Set default year if not already set
    if (!selectedYear.value && filters.value.years.length > 0) {
      selectedYear.value = filters.value.years[0]
    }
  } catch (error) {
    console.error('Error fetching deputy data:', error)
  } finally {
    console.log('Loading finished, setting isLoading to false')
    isLoading.value = false
  }
}

// Apply filters and search
const filteredExpenses = computed(() => {
  console.log('Computing filteredExpenses', { 
    expensesLength: expenses.value?.length || 0, 
    isLoading: isLoading.value
  })
  
  if (!expenses.value || !expenses.value.length) {
    console.log('No expenses to filter, returning empty array')
    return []
  }
  
  let filtered = [...expenses.value]
  
  // Apply search filter if present
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    filtered = filtered.filter(expense => 
      (expense.expense_type || '').toLowerCase().includes(query) ||
      (expense.supplier_name || '').toLowerCase().includes(query) ||
      (expense.document_number || '').toLowerCase().includes(query)
    )
    console.log(`After search filter: ${filtered.length} expenses`)
  }
  
  // Sort expenses
  const sorted = filtered.sort((a, b) => {
    // Determine values based on sort column
    let valueA, valueB
    
    switch (sortColumn.value) {
      case 'document_date':
        valueA = a.document_date ? new Date(a.document_date) : new Date(0)
        valueB = b.document_date ? new Date(b.document_date) : new Date(0)
        break
      case 'expense_type':
        valueA = a.expense_type || ''
        valueB = b.expense_type || ''
        break
      case 'value':
        valueA = a.net_value || 0
        valueB = b.net_value || 0
        break
      case 'provider':
        valueA = a.supplier_name || ''
        valueB = b.supplier_name || ''
        break
      default:
        return 0
    }
    
    // Compare based on direction
    if (sortDirection.value === 'asc') {
      return valueA > valueB ? 1 : -1
    } else {
      return valueA < valueB ? 1 : -1
    }
  })
  
  console.log(`Returning ${sorted.length} sorted expenses`)
  return sorted
})

// Toggle sort column
function toggleSort(column) {
  if (sortColumn.value === column) {
    // Toggle direction if same column
    sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc'
  } else {
    // New column, default to descending for dates, ascending for others
    sortColumn.value = column
    sortDirection.value = column === 'document_date' ? 'desc' : 'asc'
  }
}

// Functions for filter buttons removed as they're redundant

// Reset monthly filter when year changes
watch(selectedYear, (newYear) => {
  if (newYear) {
    selectedMonth.value = 'all'
    fetchDeputyData()
    // Update performance ranking when year changes
    fetchRankingData()
  }
})

// Watch for month changes
watch(selectedMonth, (newMonth) => {
  // Only fetch if we have a year and the month is valid
  if (selectedYear.value) {
    console.log('Month changed to:', newMonth)
    fetchDeputyData()
  }
})

// Add expense type watcher
watch(selectedExpenseType, () => {
  fetchDeputyData()
})

// Fetch overall ranking data for the performance indicator
async function fetchRankingData() {
  try {
    // Use year param if we have it
    const yearParam = selectedYear.value ? `?year=${selectedYear.value}` : '';
    
    // Get expenses analysis with all expense types to see how this deputy ranks overall
    const response = await fetch(`${API_URL}/expenses/analysis${yearParam}`);
    if (!response.ok) throw new Error('Failed to fetch ranking data');
    
    const data = await response.json();
    console.log(`Fetched ${data.length} deputies for ranking`);
    
    // Only process if we have deputy data
    if (data.length > 0 && deputy.value) {
      // Find this deputy in the overall ranking
      const currentDeputy = data.find(d => d.id === Number(route.params.id));
      
      if (currentDeputy) {
        console.log('Found current deputy in ranking data:', currentDeputy.name);
        
        // We'll leave the detailed analysis to the compute function
        console.log(`Calculating ranking for ${currentDeputy.name} among ${data.length} deputies...`);
        
        // Calculate performance metrics
        computePerformanceRank(currentDeputy, data);
      } else {
        console.error(`Deputy with ID ${route.params.id} not found in ranking data`);
      }
    }
  } catch (error) {
    console.error('Error fetching ranking data:', error);
  }
}

// Initial data fetch
onMounted(() => {
  fetchDeputyData()
  fetchRankingData()
})

// Format date helper
function formatDate(dateString) {
  if (!dateString) return ''
  const date = new Date(dateString)
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(date)
}

// Navigate back
function goBack() {
  router.back()
}

// Total expenditure for current filter
const totalExpenditure = computed(() => {
  return filteredExpenses.value.reduce((total, expense) => total + expense.net_value, 0)
})

// Calculate performance rank - completely rewritten to ensure correct ranking
function computePerformanceRank(currentDeputy, allDeputies) {
  console.log("COMPUTING RANK FOR:", currentDeputy.name);

  console.log("ALL DEPUTIES:", allDeputies);
  
  // First, calculate monthly average for all deputies
  const deputiesWithMonthlyAvg = allDeputies.map(d => {
    const monthlyAvg = d.months_with_expenses > 0 
      ? d.total_spent / d.months_with_expenses 
      : 0;
    
    return {
      ...d,
      monthlyAvg
    };
  });
  
  // Sort by monthly average - BUT REVERSE IT - higher values first
  // We want rank 1 to be highest spender (worst)
  const sortedByMonthly = [...deputiesWithMonthlyAvg].sort((a, b) => b.monthlyAvg - a.monthlyAvg);
  
  // Sort by total spent - higher values first
  const sortedByTotal = [...deputiesWithMonthlyAvg].sort((a, b) => b.total_spent - a.total_spent);

  console.log("SORTED BY MONTHLY:", sortedByMonthly);
  console.log("SORTED BY TOTAL:", sortedByTotal);
  
  // Find this deputy in each sorted list
  const monthlyRank = sortedByMonthly.findIndex(d => d.id === currentDeputy.id) + 1;
  const totalRank = sortedByTotal.findIndex(d => d.id === currentDeputy.id) + 1;

  console.log("MONTHLY RANK:", monthlyRank);
  console.log("TOTAL RANK:", totalRank);
  
  // Total number of deputies
  const totalDeputies = allDeputies.length;
  
  // Log for debugging - top 3 highest spenders
  console.log("TOP 3 HIGHEST MONTHLY SPENDERS:");
  sortedByMonthly.slice(0, 3).forEach((d, i) => {
    console.log(`${i+1}. ${d.name}: R$${d.monthlyAvg.toFixed(2)} per month`);
  });
  
  // Log for debugging - bottom 3 lowest spenders
  console.log("TOP 3 LOWEST MONTHLY SPENDERS:");
  sortedByMonthly.slice(-3).forEach((d, i) => {
    const rank = totalDeputies - 2 + i;
    console.log(`${rank}. ${d.name}: R$${d.monthlyAvg.toFixed(2)} per month`);
  });
  
  // Calculate percentile where 100 = worst (highest spending), 0 = best (lowest spending)
  // This makes more intuitive sense for the gauge (right = bad, left = good)
  const monthlyPercentile = Math.round((monthlyRank / totalDeputies) * 100);
  const totalPercentile = Math.round((totalRank / totalDeputies) * 100);

  console.log("MONTHLY RANK:", monthlyRank);
  console.log("TOTAL RANK:", totalRank);
  console.log("MONTHLY PERCENTILE:", monthlyPercentile, "TOTAL PERCENTILE:", totalPercentile);
  
  // Log this deputy's ranks
  console.log(`${currentDeputy.name}'s ranks:`, {
    monthlyRank,
    monthlyAvg: currentDeputy.months_with_expenses > 0 
      ? currentDeputy.total_spent / currentDeputy.months_with_expenses 
      : 0,
    totalRank,
    totalSpent: currentDeputy.total_spent,
    monthlyPercentile,
    totalPercentile
  });
  
  // Determine if deputy is good or bad spender
  const isGood = monthlyRank > totalDeputies / 2;
  
  // Generate text description
  let rankText = '';
  if (isGood) {
    // Lower spenders (bottom half of list = good)
    const goodRank = totalDeputies - monthlyRank + 1;
    rankText = `${goodRank}º melhor em economia (gasto mensal)`;
  } else {
    // Higher spenders (top half of list = bad)
    rankText = `${monthlyRank}º pior em economia (gasto mensal)`;
  }
  
  // Add total for context
  rankText += ` de ${totalDeputies} deputados`;
  
  // Create result object
  performanceRank.value = {
    // Ranks
    monthlyRank,
    totalRank,
    totalDeputies,
    
    // For gauge: we use the calculated percentile directly
    // Since we sorted with highest spenders first, this gives us
    // 100 = worst (highest spending), 0 = best (lowest spending)
    gaugePercentile: 100 - monthlyPercentile,
    
    // For display
    text: rankText,
    isGood
  };
}

// Format expense type to be camelCase (capitalize each word)
function formatExpenseType(type) {
  if (!type) return '';
  if (type === 'all') return 'Todos os tipos';
  
  return type
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

// Helper function to format month names
function getMonthName(month) {
  if (month === 'all') {
    return 'Todos os meses'
  }
  
  try {
    // Convert string month number to integer month index (0-11)
    const monthIndex = parseInt(month, 10) - 1
    if (isNaN(monthIndex) || monthIndex < 0 || monthIndex > 11) {
      return `Mês ${month}`
    }
    
    const monthNames = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 
      'Maio', 'Junho', 'Julho', 'Agosto', 
      'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ]
    
    return monthNames[monthIndex]
  } catch (error) {
    console.error('Error formatting month:', error)
    return `Mês ${month}`
  }
}
</script>

<template>
  <div class="min-h-screen bg-gray-100 light">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <!-- Back button -->
      <Button 
        variant="outline" 
        class="mb-4" 
        @click="goBack"
      >
        <ArrowLeft class="h-4 w-4 mr-2" />
        Voltar
      </Button>
      
      <!-- Initial loading state -->
      <div v-if="isLoading && !deputy" class="flex justify-center items-center h-64">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <span class="ml-3">Carregando perfil...</span>
      </div>
      
      <!-- Deputy data -->
      <div v-else-if="deputy">
        <!-- Deputy profile card -->
        <Card class="mb-6">
          <CardHeader>
            <CardTitle class="text-2xl font-bold flex items-center">
              {{ deputy.name }}
              <span class="ml-2 text-sm font-normal bg-gray-200 text-gray-700 rounded-full px-3 py-1">
                {{ deputy.party }}/{{ deputy.state }}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div class="flex flex-col md:flex-row">
              <!-- Deputy photo -->
              <div class="mb-4 md:mb-0 md:mr-6">
                <img 
                  v-if="deputy.photo_url" 
                  :src="deputy.photo_url" 
                  :alt="deputy.name"
                  class="w-32 h-32 object-cover rounded-md"
                />
                <div v-else class="w-32 h-32 bg-gray-200 rounded-md flex items-center justify-center">
                  <span class="text-gray-500">Sem foto</span>
                </div>
              </div>
              
              <!-- Deputy info -->
              <div>
                <h3 class="text-lg font-semibold mb-2">Informações</h3>
                <div class="space-y-2">
                  <p><span class="font-medium">Partido:</span> {{ deputy.party }}</p>
                  <p><span class="font-medium">Estado:</span> {{ deputy.state }}</p>
                  <p v-if="deputy.email">
                    <span class="font-medium">Email: </span> 
                    <a :href="`mailto:${deputy.email}`" class="text-blue-600 hover:underline">
                      {{ deputy.email }}
                    </a>
                  </p>
                  
                  <!-- Performance indicator with gauge -->
                  <div v-if="performanceRank" class="mt-4 pt-4 border-t border-gray-200">
                    <div class="flex items-center mb-2">
                      <h4 class="font-medium">{{ performanceRank.text }}</h4>
                    </div>
                    <SpendingGauge 
                      :percentile="performanceRank.gaugePercentile"
                      :labels="{
                        excellent: 'Gasto Muito Baixo',
                        good: 'Gasto Baixo',
                        average: 'Gasto Médio',
                        poor: 'Gasto Alto',
                        terrible: 'Gasto Muito Alto'
                      }"
                    />
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <!-- Filters -->
        <Card class="mb-6">
          <CardHeader>
            <CardTitle>Filtrar Despesas</CardTitle>
          </CardHeader>
          <CardContent>
            <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
              <!-- Expense type filter -->
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Tipo de Despesa</label>
                <Select v-model="selectedExpenseType">
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os tipos</SelectItem>
                    <SelectItem 
                      v-for="type in filters.expenseTypes" 
                      :key="type" 
                      :value="type"
                    >
                      {{ formatExpenseType(type) }}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <!-- Year filter -->
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Ano</label>
                <Select v-model="selectedYear">
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o ano" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem 
                      v-for="year in filters.years" 
                      :key="year" 
                      :value="year"
                    >
                      {{ year }}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <!-- Month filter -->
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Mês</label>
                <Select v-model="selectedMonth" :disabled="!selectedYear">
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o mês" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os meses</SelectItem>
                    <SelectItem 
                      v-for="month in filters.months" 
                      :key="month" 
                      :value="month"
                    >
                      {{ getMonthName(month) }}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <!-- Search -->
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Buscar</label>
                <div class="relative">
                  <Input 
                    v-model="searchQuery"
                    type="text" 
                    placeholder="Busque por tipo, fornecedor ou documento"
                    @input="() => console.log('Search query changed')"
                  />
                  <Search class="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                </div>
              </div>
            </div>
            
            <!-- Filter actions removed as they're redundant -->
          </CardContent>
        </Card>
        
        <!-- Expenses list -->
        <Card>
          <CardHeader>
            <CardTitle class="flex justify-between items-center">
              <span>Despesas</span>
              <span class="text-lg font-normal">
                {{ searchQuery ? 'Total filtrado: ' : 'Total: ' }}{{ formatCurrency(totalExpenditure) }}
                <span v-if="searchQuery" class="text-sm text-gray-500 ml-2">
                  ({{ filteredExpenses.length }} {{ filteredExpenses.length === 1 ? 'resultado' : 'resultados' }})
                </span>
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <!-- Debug info removed -->
            
            <!-- Conditional rendering for table -->
            <template v-if="isLoading">
              <!-- Loading indicator -->
              <div class="flex justify-center items-center h-64">
                <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                <span class="ml-3">{{ expenses.length > 0 ? 'Atualizando despesas...' : 'Carregando despesas...' }}</span>
              </div>
            </template>
            
            <template v-else>
              <!-- Empty state -->
              <div v-if="filteredExpenses.length === 0" class="text-center py-12">
                <p class="text-gray-500">
                  {{ searchQuery ? 'Nenhuma despesa corresponde à sua busca.' : 'Nenhuma despesa encontrada para os filtros selecionados.' }}
                </p>
              </div>
              
              <!-- Expenses table -->
              <div v-else class="overflow-x-auto">
              <Table>
                <TableCaption>Lista de despesas de {{ deputy.name }}</TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead 
                      @click="toggleSort('document_date')" 
                      class="cursor-pointer hover:bg-gray-50"
                    >
                      <div class="flex items-center">
                        Data
                        <span v-if="sortColumn === 'document_date'" class="ml-1">
                          {{ sortDirection === 'asc' ? '↑' : '↓' }}
                        </span>
                      </div>
                    </TableHead>
                    <TableHead 
                      @click="toggleSort('expense_type')" 
                      class="cursor-pointer hover:bg-gray-50"
                    >
                      <div class="flex items-center">
                        Tipo de Despesa
                        <span v-if="sortColumn === 'expense_type'" class="ml-1">
                          {{ sortDirection === 'asc' ? '↑' : '↓' }}
                        </span>
                      </div>
                    </TableHead>
                    <TableHead 
                      @click="toggleSort('provider')" 
                      class="cursor-pointer hover:bg-gray-50"
                    >
                      <div class="flex items-center">
                        Fornecedor
                        <span v-if="sortColumn === 'provider'" class="ml-1">
                          {{ sortDirection === 'asc' ? '↑' : '↓' }}
                        </span>
                      </div>
                    </TableHead>
                    <TableHead>Documento</TableHead>
                    <TableHead 
                      @click="toggleSort('value')" 
                      class="cursor-pointer hover:bg-gray-50"
                    >
                      <div class="flex items-center">
                        Valor
                        <span v-if="sortColumn === 'value'" class="ml-1">
                          {{ sortDirection === 'asc' ? '↑' : '↓' }}
                        </span>
                      </div>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow v-for="expense in filteredExpenses" :key="expense.id">
                    <TableCell>{{ formatDate(expense.document_date) }}</TableCell>
                    <TableCell>{{ formatExpenseType(expense.expense_type) }}</TableCell>
                    <TableCell>{{ expense.supplier_name || '-' }}</TableCell>
                    <TableCell>
                      <div class="text-sm">
                        <div>{{ expense.document_type || '-' }}</div>
                        <div v-if="expense.document_number" class="text-gray-500">
                          {{ expense.document_number }}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell class="font-medium">
                      {{ formatCurrency(expense.net_value) }}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
            </template>
          </CardContent>
        </Card>
      </div>
      
      <!-- Not found state -->
      <Card v-else class="text-center py-12">
        <CardContent>
          <p class="text-gray-500">Deputado não encontrado</p>
          <Button class="mt-4" @click="goBack">Voltar</Button>
        </CardContent>
      </Card>
    </div>
  </div>
</template>

<style scoped>
/* Fix card background color */
:deep(.card) {
  background-color: white;
  color: #333;
}
</style>