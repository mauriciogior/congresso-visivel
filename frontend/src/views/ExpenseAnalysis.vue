<script setup>
import { ref, computed, watch, onBeforeMount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { slugify } from '../utils/formatting'
import { apiUrl } from '../lib/utils'

// Import custom components
import ViewSelector from '../components/expense-analysis/ViewSelector.vue'
import FilterSection from '../components/expense-analysis/FilterSection.vue'
import ResultsCard from '../components/expense-analysis/ResultsCard.vue'
import Card from '../components/ui/card/Card.vue';
import CardHeader from '../components/ui/card/CardHeader.vue';
import CardTitle from '../components/ui/card/CardTitle.vue';
import CardContent from '../components/ui/card/CardContent.vue';

const route = useRoute()
const router = useRouter()

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

// Mandate filtering (legislatures: 2019-2022, 2023-2026, etc.)
const currentYear = new Date().getFullYear()
// Calculate the start year of the current legislature (2019, 2023, 2027...)
const currentLegislatureStartYear = currentYear - ((currentYear - 2019) % 4)
const selectedYear = ref(currentLegislatureStartYear)
// Create array of available legislature start years (2019, 2023, etc.)
const availableYears = ref([])

// Initialize available years for legislatures
for (let year = 2019; year <= currentYear; year += 4) {
  availableYears.value.push(year)
}

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
  const response = await fetch(`${apiUrl}/expense-types`)
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
        `${apiUrl}/expenses/analysis?expenseType=${expenseTypeParam}${yearParam}`
      )
      analysis.value = await response.json()
    } else if (currentView.value === 'parties') {
      const response = await fetch(
        `${apiUrl}/expenses/party-analysis?expenseType=${expenseTypeParam}${yearParam}`
      )
      partyAnalysis.value = await response.json()
    } else {
      const response = await fetch(
        `${apiUrl}/expenses/state-analysis?expenseType=${expenseTypeParam}${yearParam}`
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
      <div class="flex justify-between items-center mb-8">
        <h1 class="text-3xl font-bold text-gray-900">Análise de Despesas Parlamentares</h1>
        <router-link to="/walls" class="bg-slate-100 hover:bg-slate-200 text-blue-600 border border-blue-600 px-4 py-2 rounded-md flex items-center space-x-2">
          <span>Mural da Transparência</span>
          <span class="text-sm">🔍</span>
        </router-link>
      </div>

      <Card class="mb-6">
        <CardContent class="pt-6">
          <h2 class="mb-2">
            Dados obtidos através da API de Dados Abertos da Câmara dos Deputados. Em breve teremos dados do Senado Federal.<br>Link: <a href="https://dadosabertos.camara.leg.br/swagger/api.html" class="text-blue-500 hover:text-blue-700">https://dadosabertos.camara.leg.br/swagger/api.html</a>
          </h2>
          <p class="text-sm text-gray-500 italic">
            Dados atualizados até 18/03/2025
          </p>
        </CardContent>
      </Card>
      
      <!-- View Toggle -->
      <ViewSelector 
        v-model:currentView="currentView"
      />

      <!-- Filters -->
      <FilterSection
        :expenseTypes="expenseTypes"
        :selectedExpenseType="selectedExpenseType"
        :currentView="currentView"
        :searchQuery="searchQuery"
        :partySearchQuery="partySearchQuery"
        :stateSearchQuery="stateSearchQuery"
        :selectedYear="selectedYear"
        :availableYears="availableYears"
        @update:selectedExpenseType="selectedExpenseType = $event"
        @update:searchQuery="searchQuery = $event"
        @update:partySearchQuery="partySearchQuery = $event"
        @update:stateSearchQuery="stateSearchQuery = $event"
        @update:selectedYear="selectedYear = $event"
      />

      <!-- Results -->
      <ResultsCard
        :selectedExpenseType="selectedExpenseType"
        :currentView="currentView"
        :analysis="analysis"
        :partyAnalysis="partyAnalysis"
        :stateAnalysis="stateAnalysis"
        :isLoading="isLoading"
        :selectedYear="selectedYear"
        :deputyMetric="deputyMetric"
        :filteredAnalysis="filteredAnalysis"
        :filteredPartyAnalysis="filteredPartyAnalysis"
        :filteredStateAnalysis="filteredStateAnalysis"
        :searchQuery="searchQuery"
        :partySearchQuery="partySearchQuery"
        :stateSearchQuery="stateSearchQuery"
        @update:deputyMetric="deputyMetric = $event"
      />
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