<script setup>
import { ref, computed, watch, onBeforeMount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { formatCurrency, formatPercentage, getDiffClass, slugify, toCamelCase } from '../utils/formatting'

// Import shadcn components using direct imports
import Button from '../components/ui/button/Button.vue'
import Input from '../components/ui/input/Input.vue'
import Card from '../components/ui/card/Card.vue'
import CardHeader from '../components/ui/card/CardHeader.vue'
import CardTitle from '../components/ui/card/CardTitle.vue'
import CardContent from '../components/ui/card/CardContent.vue'
import Tabs from '../components/ui/tabs/Tabs.vue'
import TabsList from '../components/ui/tabs/TabsList.vue'
import TabsTrigger from '../components/ui/tabs/TabsTrigger.vue'
import { 
  Table, 
  TableHeader, 
  TableHead, 
  TableBody, 
  TableRow, 
  TableCell, 
  TableCaption 
} from '../components/ui/table'

const route = useRoute()
const router = useRouter()

const API_URL = 'http://localhost:3002/api'

const currentView = ref('deputies')
const expenseTypes = ref([])
const selectedExpenseType = ref('')
const analysis = ref([])
const partyAnalysis = ref([])
const searchQuery = ref('')
const deputyMetric = ref('total')
const partySearchQuery = ref('')
const stateSearchQuery = ref('')
const stateAnalysis = ref([])
const isLoading = ref(false)

// Year filtering
const currentYear = new Date().getFullYear()
const selectedYear = ref(currentYear)
const availableYears = ref([...Array(currentYear - 2018)].map((_, i) => currentYear - i))

// Set the view based on the route parameter
onBeforeMount(async () => {
  if (route.params.view) {
    currentView.value = route.params.view
  }
  
  // Fetch expense types first so we can match slugs
  await fetchExpenseTypes()
  
  // If we have an expense type slug in the URL, find the corresponding expense type
  if (route.params.expenseType) {
    const expenseTypeSlug = route.params.expenseType
    
    // Special case for "all" expenses
    if (expenseTypeSlug === 'all') {
      selectedExpenseType.value = 'all'
    } else {
      // Try to find the expense type from the slug
      if (slugToExpenseType.value.has(expenseTypeSlug)) {
        // We already have this slug mapped
        selectedExpenseType.value = slugToExpenseType.value.get(expenseTypeSlug)
      } else {
        // We need to create mappings for all expense types
        for (const type of expenseTypes.value) {
          const slug = slugify(type.expense_type)
          expenseTypeToSlug.value.set(type.expense_type, slug)
          slugToExpenseType.value.set(slug, type.expense_type)
          
          // Check if this is the slug we're looking for
          if (slug === expenseTypeSlug) {
            selectedExpenseType.value = type.expense_type
          }
        }
      }
    }
  } else {
    // If no expense type in URL, default to 'all'
    selectedExpenseType.value = 'all'
  }
  
  // Get search queries from URL if present
  if (route.query.search) {
    if (currentView.value === 'deputies') {
      searchQuery.value = route.query.search
    } else if (currentView.value === 'parties') {
      partySearchQuery.value = route.query.search
    } else if (currentView.value === 'states') {
      stateSearchQuery.value = route.query.search
    }
  }
  
  if (route.query.metric) {
    deputyMetric.value = route.query.metric
  }
  
  // Get year from URL if present
  if (route.query.year) {
    const yearParam = parseInt(route.query.year)
    if (!isNaN(yearParam) && yearParam >= 2019 && yearParam <= currentYear) {
      selectedYear.value = yearParam
    }
  }
})

// Update URL when view changes
watch(currentView, (newView) => {
  updateRoute()
})

// Update URL when expense type changes
watch(selectedExpenseType, (newType) => {
  updateRoute()
})

// Update URL when search changes
watch([searchQuery, partySearchQuery, stateSearchQuery], () => {
  updateRoute()
})

// Update URL when deputy metric changes
watch(deputyMetric, () => {
  updateRoute()
})

// Update URL when year changes
watch(selectedYear, () => {
  updateRoute()
})

// We now import slugify from utils/formatting.js

// Map between slugs and original names
const slugToExpenseType = ref(new Map())
const expenseTypeToSlug = ref(new Map())

function updateRoute() {
  const query = {}
  
  // Add correct search param based on current view
  if (currentView.value === 'deputies' && searchQuery.value) {
    query.search = searchQuery.value
    if (deputyMetric.value !== 'total') {
      query.metric = deputyMetric.value
    }
  } else if (currentView.value === 'parties' && partySearchQuery.value) {
    query.search = partySearchQuery.value
  } else if (currentView.value === 'states' && stateSearchQuery.value) {
    query.search = stateSearchQuery.value
  }
  
  // Add year to query params if not current year
  if (selectedYear.value !== currentYear) {
    query.year = selectedYear.value
  }
  
  // Create slug from expense type
  let expenseTypeSlug = '';
  if (selectedExpenseType.value && selectedExpenseType.value !== 'all') {
    // Check if we already have a slug for this expense type
    if (!expenseTypeToSlug.value.has(selectedExpenseType.value)) {
      const slug = slugify(selectedExpenseType.value);
      expenseTypeToSlug.value.set(selectedExpenseType.value, slug);
      slugToExpenseType.value.set(slug, selectedExpenseType.value);
    }
    expenseTypeSlug = expenseTypeToSlug.value.get(selectedExpenseType.value);
  }
  
  // If we're viewing "all", use the base path (/expenses/view)
  // Otherwise include the expense type slug in the URL
  const path = expenseTypeSlug
    ? `/expenses/${currentView.value}/${expenseTypeSlug}`
    : `/expenses/${currentView.value}`
  
  router.push({ path, query })
}

const currentAverage = computed(() => {
  if (currentView.value === 'deputies' && analysis.value.length) {
    return deputyMetric.value === 'total' 
      ? analysis.value[0].average_total 
      : analysis.value[0].average_monthly
  }
  if (currentView.value === 'parties' && partyAnalysis.value.length) {
    return partyAnalysis.value[0].overall_average
  }
  if (currentView.value === 'states' && stateAnalysis.value.length) {
    return stateAnalysis.value[0].overall_average
  }
  return 0
})

const filteredAnalysis = computed(() => {
  if (!analysis.value.length) return []
  
  let filtered = [...analysis.value]
  
  // Filter by search query if it exists
  if (searchQuery.value) {
    filtered = filtered.filter(deputy => 
      deputy.name.toLowerCase().includes(searchQuery.value.toLowerCase())
    )
  }
  
  // Sort based on the selected metric
  return filtered.sort((a, b) => {
    if (deputyMetric.value === 'total') {
      return b.total_spent - a.total_spent
    } else {
      return b.monthly_average - a.monthly_average
    }
  })
})

const sortedDeputyAnalysis = computed(() => {
  if (!analysis.value.length) return []
  return [...analysis.value].sort((a, b) => {
    if (deputyMetric.value === 'total') {
      return b.total_spent - a.total_spent
    } else {
      return b.monthly_average - a.monthly_average
    }
  })
})

const filteredPartyAnalysis = computed(() => {
  if (!partySearchQuery.value) return partyAnalysis.value
  return partyAnalysis.value.filter(party => 
    party.party.toLowerCase().includes(partySearchQuery.value.toLowerCase())
  )
})

const filteredStateAnalysis = computed(() => {
  if (!stateSearchQuery.value) return stateAnalysis.value
  return stateAnalysis.value.filter(state => 
    state.state.toLowerCase().includes(stateSearchQuery.value.toLowerCase())
  )
})

async function fetchExpenseTypes() {
  const response = await fetch(`${API_URL}/expense-types`)
  expenseTypes.value = await response.json()
  
  // Create slug mappings for all expense types
  for (const type of expenseTypes.value) {
    const slug = slugify(type.expense_type)
    expenseTypeToSlug.value.set(type.expense_type, slug)
    slugToExpenseType.value.set(slug, type.expense_type)
  }
}

async function fetchAnalysis() {
  if (!selectedExpenseType.value) return
  
  // Set loading state to true and clear existing data
  isLoading.value = true
  
  // Clear the current data based on view type
  if (currentView.value === 'deputies') {
    analysis.value = []
  } else if (currentView.value === 'parties') {
    partyAnalysis.value = []
  } else {
    stateAnalysis.value = []
  }
  
  try {
    const expenseTypeParam = selectedExpenseType.value === 'all' ? 'all' : encodeURIComponent(selectedExpenseType.value)
    const yearParam = `&year=${selectedYear.value}`
    
    if (currentView.value === 'deputies') {
      const response = await fetch(
        `${API_URL}/expenses/analysis?expenseType=${expenseTypeParam}${yearParam}`
      )
      analysis.value = await response.json()
    } else if (currentView.value === 'parties') {
      const response = await fetch(
        `${API_URL}/expenses/party-analysis?expenseType=${expenseTypeParam}${yearParam}`
      )
      partyAnalysis.value = await response.json()
    } else {
      const response = await fetch(
        `${API_URL}/expenses/state-analysis?expenseType=${expenseTypeParam}${yearParam}`
      )
      stateAnalysis.value = await response.json()
    }
  } catch (error) {
    console.error('Error fetching data:', error)
  } finally {
    // Set loading state to false regardless of success or failure
    isLoading.value = false
  }
}

// No need to fetch expense types on mount since we do it in onBeforeMount
watch([selectedExpenseType, currentView, selectedYear], fetchAnalysis)
</script>

<template>
  <div class="min-h-screen bg-gray-100 light">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 class="text-3xl font-bold text-gray-900 mb-8">Análise de Despesas Parlamentares</h1>
      
      <!-- View Toggle using shadcn Tabs -->
      <div class="mb-6">
        <div class="bg-gray-200 rounded-lg p-1 inline-flex w-full">
          <button 
            @click="currentView = 'deputies'"
            :style="{
              flex: 1,
              padding: '0.5rem 1rem',
              borderRadius: '0.375rem',
              fontSize: '0.875rem',
              fontWeight: 500,
              textAlign: 'center',
              transition: 'background-color 0.2s',
              backgroundColor: currentView === 'deputies' ? '#2563eb' : '#f3f4f6',
              color: currentView === 'deputies' ? 'white' : '#374151',
              boxShadow: currentView === 'deputies' ? '0 4px 6px -1px rgba(0, 0, 0, 0.1)' : 'none'
            }"
          >
            Por Deputado
          </button>
          <button 
            @click="currentView = 'parties'"
            :style="{
              flex: 1,
              padding: '0.5rem 1rem',
              borderRadius: '0.375rem',
              fontSize: '0.875rem',
              fontWeight: 500,
              textAlign: 'center',
              transition: 'background-color 0.2s',
              backgroundColor: currentView === 'parties' ? '#2563eb' : '#f3f4f6',
              color: currentView === 'parties' ? 'white' : '#374151',
              boxShadow: currentView === 'parties' ? '0 4px 6px -1px rgba(0, 0, 0, 0.1)' : 'none'
            }"
          >
            Por Partido
          </button>
          <button 
            @click="currentView = 'states'"
            :style="{
              flex: 1,
              padding: '0.5rem 1rem',
              borderRadius: '0.375rem',
              fontSize: '0.875rem',
              fontWeight: 500,
              textAlign: 'center',
              transition: 'background-color 0.2s',
              backgroundColor: currentView === 'states' ? '#2563eb' : '#f3f4f6',
              color: currentView === 'states' ? 'white' : '#374151',
              boxShadow: currentView === 'states' ? '0 4px 6px -1px rgba(0, 0, 0, 0.1)' : 'none'
            }"
          >
            Por Estado
          </button>
        </div>
      </div>

      <!-- Filters -->
      <Card class="mb-6">
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
          <p class="text-muted-foreground">Filtre os dados por diferentes critérios</p>
        </CardHeader>
        <CardContent>
        
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div class="space-y-2">
            <label class="text-sm font-medium">Tipo de Despesa</label>
            <select 
              v-model="selectedExpenseType"
              class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm bg-white text-gray-900"
            >
              <option value="">Selecione um tipo de despesa</option>
              <option value="all">Todas as despesas</option>
              <option v-for="type in expenseTypes" :key="type.expense_type" :value="type.expense_type">
                {{ toCamelCase(type.expense_type) }}
              </option>
            </select>
          </div>

          <div class="space-y-2">
            <label class="text-sm font-medium">Ano</label>
            <select 
              v-model="selectedYear"
              class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm bg-white text-gray-900"
            >
              <option v-for="year in availableYears" :key="year" :value="year">
                {{ year }}
              </option>
            </select>
          </div>
          
          <div v-if="currentView === 'deputies'" class="space-y-2">
            <label class="text-sm font-medium">Buscar Deputado</label>
            <input 
              v-model="searchQuery"
              placeholder="Buscar por nome..."
              class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm bg-white text-gray-900"
            />
          </div>

          <div v-else-if="currentView === 'parties'" class="space-y-2">
            <label class="text-sm font-medium">Buscar Partido</label>
            <input 
              v-model="partySearchQuery"
              placeholder="Buscar por partido..."
              class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm bg-white text-gray-900"
            />
          </div>

          <div v-else class="space-y-2">
            <label class="text-sm font-medium">Buscar Estado</label>
            <input 
              v-model="stateSearchQuery"
              placeholder="Buscar por estado..."
              class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm bg-white text-gray-900"
            />
          </div>
        </div>
        </CardContent>
      </Card>

      <!-- Results -->
      <Card v-if="selectedExpenseType && (analysis.length || partyAnalysis.length || stateAnalysis.length)">
        <CardHeader>
          <CardTitle>
            Resultados da Análise {{ selectedYear }} 
            <span v-if="selectedExpenseType && selectedExpenseType !== 'all'" class="font-normal text-gray-500 text-sm ml-2">
              ({{ toCamelCase(selectedExpenseType) }})
            </span>
          </CardTitle>
          <p class="text-muted-foreground">
            Média de gastos: {{ formatCurrency(currentAverage) }}
          </p>
        </CardHeader>
        <CardContent>

        <!-- Deputies View -->
        <div v-if="currentView === 'deputies'" class="overflow-x-auto">
          <!-- Metric Toggle -->
          <div class="mb-4">
            <div class="flex items-center space-x-4">
              <span class="text-sm font-medium">Visualizar por:</span>
              <div class="bg-gray-100 rounded-lg p-1 inline-flex">
                <button 
                  @click="deputyMetric = 'total'"
                  :style="{
                    padding: '0.5rem 1rem',
                    borderRadius: '0.375rem',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    transition: 'background-color 0.2s',
                    backgroundColor: deputyMetric === 'total' ? '#2563eb' : '#f3f4f6',
                    color: deputyMetric === 'total' ? 'white' : '#374151',
                    boxShadow: deputyMetric === 'total' ? '0 4px 6px -1px rgba(0, 0, 0, 0.1)' : 'none'
                  }"
                >
                  Total Gasto
                </button>
                <button 
                  @click="deputyMetric = 'monthly'"
                  :style="{
                    padding: '0.5rem 1rem',
                    borderRadius: '0.375rem',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    transition: 'background-color 0.2s',
                    backgroundColor: deputyMetric === 'monthly' ? '#2563eb' : '#f3f4f6',
                    color: deputyMetric === 'monthly' ? 'white' : '#374151',
                    boxShadow: deputyMetric === 'monthly' ? '0 4px 6px -1px rgba(0, 0, 0, 0.1)' : 'none'
                  }"
                >
                  Média Mensal
                </button>
              </div>
            </div>
          </div>

          <Table>
            <TableCaption>Lista de gastos por deputado</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>Posição</TableHead>
                <TableHead>Deputado</TableHead>
                <TableHead>Partido/Estado</TableHead>
                <TableHead>{{ deputyMetric === 'total' ? 'Total Gasto' : 'Média Mensal' }}</TableHead>
                <TableHead>Meses Ativos</TableHead>
                <TableHead>Diferença da Média</TableHead>
                <TableHead>% da Média</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <!-- Loading state -->
              <TableRow v-if="isLoading">
                <TableCell colspan="7" class="h-24 text-center">
                  <div class="flex justify-center items-center">
                    <svg class="animate-spin h-8 w-8 text-blue-600 mr-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span class="text-gray-600 text-lg">Carregando dados...</span>
                  </div>
                </TableCell>
              </TableRow>
              
              <!-- No results message -->
              <TableRow v-else-if="filteredAnalysis.length === 0">
                <TableCell colspan="7" class="h-24 text-center text-gray-500">
                  Nenhum resultado encontrado
                </TableCell>
              </TableRow>
              
              <!-- Data rows -->
              <TableRow v-else v-for="deputy in filteredAnalysis" :key="deputy.id">
                <TableCell class="font-medium">
                  {{ deputyMetric === 'total' ? deputy.total_rank : deputy.monthly_rank }}
                </TableCell>
                <TableCell>{{ deputy.name }}</TableCell>
                <TableCell class="text-gray-500">{{ deputy.party }}/{{ deputy.state }}</TableCell>
                <TableCell>
                  {{ formatCurrency(deputyMetric === 'total' ? deputy.total_spent : deputy.monthly_average) }}
                </TableCell>
                <TableCell class="text-gray-500">
                  {{ deputy.months_with_expenses }}
                </TableCell>
                <TableCell :class="getDiffClass(deputyMetric === 'total' ? deputy.total_absolute_diff : deputy.monthly_absolute_diff)">
                  {{ formatCurrency(deputyMetric === 'total' ? deputy.total_absolute_diff : deputy.monthly_absolute_diff) }}
                </TableCell>
                <TableCell :class="getDiffClass(deputyMetric === 'total' ? deputy.total_percentage_diff : deputy.monthly_percentage_diff)">
                  {{ formatPercentage(deputyMetric === 'total' ? deputy.total_percentage_diff : deputy.monthly_percentage_diff) }}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>

        <!-- Parties View -->
        <div v-else-if="currentView === 'parties'" class="overflow-x-auto">
          <Table>
            <TableCaption>Lista de gastos por partido</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>Posição</TableHead>
                <TableHead>Partido</TableHead>
                <TableHead>Deputados</TableHead>
                <TableHead>Total Gasto</TableHead>
                <TableHead>Média por Deputado</TableHead>
                <TableHead>Diferença da Média</TableHead>
                <TableHead>% da Média</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <!-- Loading state -->
              <TableRow v-if="isLoading">
                <TableCell colspan="7" class="h-24 text-center">
                  <div class="flex justify-center items-center">
                    <svg class="animate-spin h-8 w-8 text-blue-600 mr-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span class="text-gray-600 text-lg">Carregando dados...</span>
                  </div>
                </TableCell>
              </TableRow>
              
              <!-- No results message -->
              <TableRow v-else-if="filteredPartyAnalysis.length === 0">
                <TableCell colspan="7" class="h-24 text-center text-gray-500">
                  Nenhum resultado encontrado
                </TableCell>
              </TableRow>
              
              <!-- Data rows -->
              <TableRow 
                v-else
                v-for="party in filteredPartyAnalysis" 
                :key="party.party"
                :class="{'bg-yellow-50': partySearchQuery && party.party.toLowerCase().includes(partySearchQuery.toLowerCase())}"
              >
                <TableCell class="font-medium">{{ party.rank }}</TableCell>
                <TableCell>{{ party.party }}</TableCell>
                <TableCell class="text-gray-500">{{ party.deputy_count }}</TableCell>
                <TableCell>{{ formatCurrency(party.total_spent) }}</TableCell>
                <TableCell>{{ formatCurrency(party.avg_per_deputy) }}</TableCell>
                <TableCell :class="party.absolute_diff > 0 ? 'text-red-600' : 'text-green-600'">
                  {{ formatCurrency(party.absolute_diff) }}
                </TableCell>
                <TableCell :class="party.percentage_diff > 0 ? 'text-red-600' : 'text-green-600'">
                  {{ formatPercentage(party.percentage_diff) }}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>

        <!-- States View -->
        <div v-else-if="currentView === 'states'" class="overflow-x-auto">
          <Table>
            <TableCaption>Lista de gastos por estado</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>Posição</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Deputados</TableHead>
                <TableHead>Total Gasto</TableHead>
                <TableHead>Média por Deputado</TableHead>
                <TableHead>Diferença da Média</TableHead>
                <TableHead>% da Média</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <!-- Loading state -->
              <TableRow v-if="isLoading">
                <TableCell colspan="7" class="h-24 text-center">
                  <div class="flex justify-center items-center">
                    <svg class="animate-spin h-8 w-8 text-blue-600 mr-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span class="text-gray-600 text-lg">Carregando dados...</span>
                  </div>
                </TableCell>
              </TableRow>
              
              <!-- No results message -->
              <TableRow v-else-if="filteredStateAnalysis.length === 0">
                <TableCell colspan="7" class="h-24 text-center text-gray-500">
                  Nenhum resultado encontrado
                </TableCell>
              </TableRow>
              
              <!-- Data rows -->
              <TableRow 
                v-else
                v-for="state in filteredStateAnalysis" 
                :key="state.state"
                :class="{'bg-yellow-50': stateSearchQuery && state.state.toLowerCase().includes(stateSearchQuery.toLowerCase())}"
              >
                <TableCell class="font-medium">{{ state.rank }}</TableCell>
                <TableCell>{{ state.state }}</TableCell>
                <TableCell class="text-gray-500">{{ state.deputy_count }}</TableCell>
                <TableCell>{{ formatCurrency(state.total_spent) }}</TableCell>
                <TableCell>{{ formatCurrency(state.avg_per_deputy) }}</TableCell>
                <TableCell :class="state.absolute_diff > 0 ? 'text-red-600' : 'text-green-600'">
                  {{ formatCurrency(state.absolute_diff) }}
                </TableCell>
                <TableCell :class="state.percentage_diff > 0 ? 'text-red-600' : 'text-green-600'">
                  {{ formatPercentage(state.percentage_diff) }}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
        </CardContent>
      </Card>

      <Card v-else class="text-center py-12">
        <CardContent>
          <p class="text-muted-foreground">
            {{ selectedExpenseType ? 'Carregando dados...' : 'Selecione um tipo de despesa para ver a análise' }}
          </p>
        </CardContent>
      </Card>
    </div>
  </div>
</template>

<style scoped>
/* Override default button styles that might be causing issues */
/* Reset button styles but preserve specificity for our custom styles */
button {
  border: none;
  font-size: inherit;
}

/* Add specific selectors for our navigation buttons */
.bg-gray-200 button,
.bg-gray-100 button {
  border-radius: 0.375rem !important;
  padding: 0.6em 1.2em !important;
}

/* Make sure our background colors are applied with !important */
.bg-blue-600 {
  background-color: #2563eb !important;
}

.bg-gray-100 {
  background-color: #f3f4f6 !important;
}

.bg-gray-300 {
  background-color: #d1d5db !important;
}

/* Ensure inputs have correct styling */
:deep(.input) {
  background-color: white;
  color: #333;
}

/* Fix card background color */
:deep(.card) {
  background-color: white;
  color: #333;
}
</style>