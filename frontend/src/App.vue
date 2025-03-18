<script setup>
import { ref, computed, onMounted, watch } from 'vue'

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
}

async function fetchAnalysis() {
  if (!selectedExpenseType.value) return
  
  if (currentView.value === 'deputies') {
    const response = await fetch(
      `${API_URL}/expenses/analysis?expenseType=${encodeURIComponent(selectedExpenseType.value)}`
    )
    analysis.value = await response.json()
  } else if (currentView.value === 'parties') {
    const response = await fetch(
      `${API_URL}/expenses/party-analysis?expenseType=${encodeURIComponent(selectedExpenseType.value)}`
    )
    partyAnalysis.value = await response.json()
  } else {
    const response = await fetch(
      `${API_URL}/expenses/state-analysis?expenseType=${encodeURIComponent(selectedExpenseType.value)}`
    )
    stateAnalysis.value = await response.json()
  }
}

function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value)
}

function formatPercentage(value) {
  return `${value > 0 ? '+' : ''}${value.toFixed(2)}%`
}

function getDiffClass(value) {
  return value > 0 ? 'text-red-600' : 'text-green-600'
}

onMounted(fetchExpenseTypes)

watch([selectedExpenseType, currentView], fetchAnalysis)
</script>

<template>
  <div class="min-h-screen bg-gray-100">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 class="text-3xl font-bold text-gray-900 mb-8">Análise de Despesas Parlamentares</h1>
      
      <!-- View Toggle -->
      <div class="mb-6">
        <div class="bg-gray-200 rounded-lg p-1 inline-flex">
          <button 
            @click="currentView = 'deputies'"
            :class="[
              'px-4 py-2 rounded-md text-sm font-medium',
              currentView === 'deputies' 
                ? 'bg-white shadow text-gray-800' 
                : 'text-gray-600 hover:text-gray-800'
            ]"
          >
            Por Deputado
          </button>
          <button 
            @click="currentView = 'parties'"
            :class="[
              'px-4 py-2 rounded-md text-sm font-medium',
              currentView === 'parties' 
                ? 'bg-white shadow text-gray-800' 
                : 'text-gray-600 hover:text-gray-800'
            ]"
          >
            Por Partido
          </button>
          <button 
            @click="currentView = 'states'"
            :class="[
              'px-4 py-2 rounded-md text-sm font-medium',
              currentView === 'states' 
                ? 'bg-white shadow text-gray-800' 
                : 'text-gray-600 hover:text-gray-800'
            ]"
          >
            Por Estado
          </button>
        </div>
      </div>

      <!-- Filters -->
      <div class="bg-white p-4 rounded-lg shadow mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-medium text-gray-700">Tipo de Despesa</label>
          <select 
            v-model="selectedExpenseType"
            class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
          >
            <option value="">Selecione um tipo de despesa</option>
            <option v-for="type in expenseTypes" :key="type.expense_type" :value="type.expense_type">
              {{ type.expense_type }}
            </option>
          </select>
        </div>
        
        <div v-if="currentView === 'deputies'">
          <label class="block text-sm font-medium text-gray-700">Buscar Deputado</label>
          <input 
            type="text"
            v-model="searchQuery"
            placeholder="Buscar por nome..."
            class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
          >
        </div>

        <div v-else-if="currentView === 'parties'">
          <label class="block text-sm font-medium text-gray-700">Buscar Partido</label>
          <input 
            type="text"
            v-model="partySearchQuery"
            placeholder="Buscar por partido..."
            class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
          >
        </div>

        <div v-else>
          <label class="block text-sm font-medium text-gray-700">Buscar Estado</label>
          <input 
            type="text"
            v-model="stateSearchQuery"
            placeholder="Buscar por estado..."
            class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
          >
        </div>
      </div>

      <!-- Results -->
      <div v-if="selectedExpenseType" class="bg-white rounded-lg shadow">
        <div class="p-4 border-b">
          <h2 class="text-xl font-semibold">Resultados da Análise</h2>
          <p class="text-gray-600">
            Média de gastos: {{ formatCurrency(currentAverage) }}
          </p>
        </div>

        <!-- Deputies View -->
        <div v-if="currentView === 'deputies'" class="overflow-x-auto">
          <!-- Metric Toggle -->
          <div class="p-4 border-b">
            <div class="flex items-center space-x-4">
              <span class="text-sm font-medium text-gray-700">Visualizar por:</span>
              <div class="bg-gray-100 rounded-lg p-1 inline-flex">
                <button 
                  @click="deputyMetric = 'total'"
                  :class="[
                    'px-4 py-2 rounded-md text-sm font-medium',
                    deputyMetric === 'total' 
                      ? 'bg-white shadow text-gray-800' 
                      : 'text-gray-600 hover:text-gray-800'
                  ]"
                >
                  Total Gasto
                </button>
                <button 
                  @click="deputyMetric = 'monthly'"
                  :class="[
                    'px-4 py-2 rounded-md text-sm font-medium',
                    deputyMetric === 'monthly' 
                      ? 'bg-white shadow text-gray-800' 
                      : 'text-gray-600 hover:text-gray-800'
                  ]"
                >
                  Média Mensal
                </button>
              </div>
            </div>
          </div>

          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Posição</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Deputado</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Partido/Estado</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {{ deputyMetric === 'total' ? 'Total Gasto' : 'Média Mensal' }}
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Meses Ativos</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Diferença da Média</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">% da Média</th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              <tr v-for="deputy in filteredAnalysis" :key="deputy.id">
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {{ deputyMetric === 'total' ? deputy.total_rank : deputy.monthly_rank }}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{{ deputy.name }}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{{ deputy.party }}/{{ deputy.state }}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {{ formatCurrency(deputyMetric === 'total' ? deputy.total_spent : deputy.monthly_average) }}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {{ deputy.months_with_expenses }}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm" 
                    :class="getDiffClass(deputyMetric === 'total' ? deputy.total_absolute_diff : deputy.monthly_absolute_diff)">
                  {{ formatCurrency(deputyMetric === 'total' ? deputy.total_absolute_diff : deputy.monthly_absolute_diff) }}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm"
                    :class="getDiffClass(deputyMetric === 'total' ? deputy.total_percentage_diff : deputy.monthly_percentage_diff)">
                  {{ formatPercentage(deputyMetric === 'total' ? deputy.total_percentage_diff : deputy.monthly_percentage_diff) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Parties View -->
        <div v-else-if="currentView === 'parties'" class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Posição</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Partido</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Deputados</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Gasto</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Média por Deputado</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Diferença da Média</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">% da Média</th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              <tr v-for="party in filteredPartyAnalysis" :key="party.party"
                  :class="{'bg-yellow-50': partySearchQuery && party.party.toLowerCase().includes(partySearchQuery.toLowerCase())}">
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{{ party.rank }}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{{ party.party }}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{{ party.deputy_count }}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{{ formatCurrency(party.total_spent) }}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{{ formatCurrency(party.avg_per_deputy) }}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm" :class="party.absolute_diff > 0 ? 'text-red-600' : 'text-green-600'">
                  {{ formatCurrency(party.absolute_diff) }}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm" :class="party.percentage_diff > 0 ? 'text-red-600' : 'text-green-600'">
                  {{ formatPercentage(party.percentage_diff) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- States View -->
        <div v-else-if="currentView === 'states'" class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Posição</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Deputados</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Gasto</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Média por Deputado</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Diferença da Média</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">% da Média</th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              <tr v-for="state in filteredStateAnalysis" :key="state.state"
                  :class="{'bg-yellow-50': stateSearchQuery && state.state.toLowerCase().includes(stateSearchQuery.toLowerCase())}">
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{{ state.rank }}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{{ state.state }}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{{ state.deputy_count }}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{{ formatCurrency(state.total_spent) }}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{{ formatCurrency(state.avg_per_deputy) }}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm" :class="state.absolute_diff > 0 ? 'text-red-600' : 'text-green-600'">
                  {{ formatCurrency(state.absolute_diff) }}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm" :class="state.percentage_diff > 0 ? 'text-red-600' : 'text-green-600'">
                  {{ formatPercentage(state.percentage_diff) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div v-else class="text-center py-12 text-gray-500">
        Selecione um tipo de despesa para ver a análise
      </div>
    </div>
  </div>
</template>

<style scoped>
.logo {
  height: 6em;
  padding: 1.5em;
  will-change: filter;
  transition: filter 300ms;
}
.logo:hover {
  filter: drop-shadow(0 0 2em #646cffaa);
}
.logo.vue:hover {
  filter: drop-shadow(0 0 2em #42b883aa);
}
</style>
