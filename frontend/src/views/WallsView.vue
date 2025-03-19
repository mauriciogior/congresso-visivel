<script setup>
import { ref, computed, watch, onBeforeMount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../components/ui/select'
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '../components/ui/table'
import SpendingGauge from '../components/expense-analysis/SpendingGauge.vue'

const route = useRoute()
const router = useRouter()

const API_URL = 'http://localhost:3002/api'

// Data refs
const deputies = ref([])
const isLoading = ref(false)

// Year handling
const currentYear = new Date().getFullYear()
const selectedYear = ref(currentYear)
const availableYears = ref([...Array(currentYear - 2018)].map((_, i) => currentYear - i))

// For display
const activeTab = ref('shame')
const TOP_COUNT = 40

// OnBeforeMount to set up component based on URL parameters
onBeforeMount(async () => {
  // Get year from URL if present
  if (route.params.year) {
    const yearParam = parseInt(route.params.year)
    if (!isNaN(yearParam) && yearParam >= 2019 && yearParam <= currentYear) {
      selectedYear.value = yearParam
    }
  }
  
  // Fetch deputies data
  await fetchDeputiesData()
})

// Watch for year changes
watch(selectedYear, () => {
  updateRoute()
  fetchDeputiesData()
})

// Update URL when parameters change
function updateRoute() {
  router.push({ 
    path: `/walls/${selectedYear.value}`
  })
}

// Fetch deputies data
async function fetchDeputiesData() {
  isLoading.value = true
  deputies.value = []
  
  try {
    const response = await fetch(
      `${API_URL}/expenses/analysis?expenseType=all&year=${selectedYear.value}`
    )
    deputies.value = await response.json()
  } catch (error) {
    console.error('Error fetching deputies data:', error)
  } finally {
    isLoading.value = false
  }
}

// Computed properties for wall of shame (highest spenders)
const wallOfShame = computed(() => {
  if (!deputies.value.length) return []
  return deputies.value
    .sort((a, b) => b.total_spent - a.total_spent)
    .slice(0, TOP_COUNT)
})

// Computed properties for wall of respect (lowest spenders)
const wallOfRespect = computed(() => {
  if (!deputies.value.length) return []
  // Filter out deputies with zero expenses, then take lowest spenders
  const activeDeputies = deputies.value.filter(d => d.total_spent > 0)
  return activeDeputies
    .sort((a, b) => a.total_spent - b.total_spent)
    .slice(0, TOP_COUNT)
})

const averageSpent = computed(() => {
  if (!deputies.value.length) return 0
  return deputies.value.reduce((sum, deputy) => sum + deputy.total_spent, 0) / deputies.value.length
})

// Format currency values
function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', { 
    style: 'currency', 
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value)
}
</script>

<template>
  <div class="min-h-screen bg-gray-100 light">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div class="flex justify-between items-center mb-8">
        <div class="flex items-center">
          <h1 class="text-3xl font-bold text-gray-900">Mural da Transparência</h1>
          <router-link to="/expenses/deputies" class="ml-4 text-blue-600 hover:text-blue-800 flex items-center space-x-1">
            <span class="text-sm">← Voltar para análise</span>
          </router-link>
        </div>
        
        <!-- Year selector -->
        <div class="flex items-center space-x-2">
          <span class="text-sm font-medium text-gray-700">Ano:</span>
          <Select v-model="selectedYear">
            <SelectTrigger class="w-32">
              <SelectValue :placeholder="selectedYear" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem 
                v-for="year in availableYears" 
                :key="year" 
                :value="year"
              >
                {{ year }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      
      <!-- Tabs -->
      <Tabs v-model="activeTab" class="w-full">
        <TabsList class="grid w-full grid-cols-2 mb-8">
          <TabsTrigger value="shame" class="text-lg">
            Mural da Vergonha
            <span class="ml-2 text-sm text-red-500">🔥</span>
          </TabsTrigger>
          <TabsTrigger value="respect" class="text-lg">
            Mural do Respeito
            <span class="ml-2 text-sm text-green-500">🌱</span>
          </TabsTrigger>
        </TabsList>
        
        <!-- Loading indicator -->
        <div v-if="isLoading" class="flex justify-center py-12">
          <div class="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
        
        <!-- Wall of shame tab content -->
        <TabsContent value="shame" v-if="!isLoading">
          <Card class="mb-8">
            <CardHeader>
              <CardTitle class="text-xl text-red-800">
                Top {{ TOP_COUNT }} Deputados com Maiores Gastos em {{ selectedYear }}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p class="text-gray-500 mb-4">
                Parlamentares com os maiores gastos totais no ano selecionado.
              </p>
              <Table v-if="wallOfShame.length > 0">
                <TableHeader>
                  <TableRow>
                    <TableHead class="w-12">Rank</TableHead>
                    <TableHead>Parlamentar</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Partido</TableHead>
                    <TableHead class="text-right">Total Gasto</TableHead>
                    <TableHead>Comparação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow v-for="deputy in wallOfShame" :key="deputy.id">
                    <TableCell class="font-medium">#{{ deputy.total_rank }}</TableCell>
                    <TableCell>
                      <div class="flex items-center space-x-2">
                        <img :src="deputy.photo_url" class="w-24 h-24 rounded-lg object-cover">
                        <router-link 
                          :to="`/deputy/${deputy.slug}`" 
                          class="hover:underline text-blue-600"
                        >
                          {{ deputy.name }}
                        </router-link>
                      </div>
                    </TableCell>
                    <TableCell>{{ deputy.state }}</TableCell>
                    <TableCell>{{ deputy.party }}</TableCell>
                    <TableCell class="text-right font-mono">
                      {{ formatCurrency(deputy.total_spent) }}<br>
                      <span class="text-sm text-red-700">{{ parseFloat(deputy.total_percentage_diff).toFixed(2) }}% acima da média</span>
                    </TableCell>
                    <TableCell>
                      <SpendingGauge 
                        :percentile="100 - Math.round((deputy.total_rank / deputies.length) * 100)" 
                        :labels="{
                          excellent: 'Gasto Muito Baixo',
                          good: 'Gasto Baixo',
                          average: 'Gasto Médio',
                          poor: 'Gasto Alto',
                          terrible: 'Gasto Muito Alto'
                        }"
                      />
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
              <div v-else class="text-center py-8 text-gray-500">
                Nenhum dado disponível para o ano selecionado.
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <!-- Wall of respect tab content -->
        <TabsContent value="respect" v-if="!isLoading">
          <Card class="mb-8">
            <CardHeader>
              <CardTitle class="text-xl text-green-800">
                Top {{ TOP_COUNT }} Deputados com Menores Gastos em {{ selectedYear }}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p class="text-gray-500 mb-4">
                Parlamentares com os menores gastos totais no ano selecionado.
              </p>
              <Table v-if="wallOfRespect.length > 0">
                <TableHeader>
                  <TableRow>
                    <TableHead class="w-12">Rank</TableHead>
                    <TableHead>Parlamentar</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Partido</TableHead>
                    <TableHead class="text-right">Total Gasto</TableHead>
                    <TableHead>Comparação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow v-for="deputy in wallOfRespect" :key="deputy.id">
                    <TableCell class="font-medium">#{{ deputy.total_rank }}</TableCell>
                    <TableCell>
                      <div class="flex items-center space-x-2">
                        <img :src="deputy.photo_url" class="w-24 h-24 rounded-lg object-cover">
                        <router-link 
                          :to="`/deputy/${deputy.slug}`" 
                          class="hover:underline text-blue-600"
                        >
                          {{ deputy.name }}
                        </router-link>
                      </div>
                    </TableCell>
                    <TableCell>{{ deputy.state }}</TableCell>
                    <TableCell>{{ deputy.party }}</TableCell>
                    <TableCell class="text-right font-mono">
                      {{ formatCurrency(deputy.total_spent) }}<br>
                      <span class="text-sm text-green-700">{{ parseFloat(deputy.total_percentage_diff).toFixed(2) }}% abaixo da média</span>
                    </TableCell>
                    <TableCell>
                      <SpendingGauge 
                        :percentile="100 - Math.round((deputy.total_rank / deputies.length) * 100)" 
                        :labels="{
                          excellent: 'Gasto Muito Baixo',
                          good: 'Gasto Baixo',
                          average: 'Gasto Médio',
                          poor: 'Gasto Alto',
                          terrible: 'Gasto Muito Alto'
                        }"
                        />
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
              <div v-else class="text-center py-8 text-gray-500">
                Nenhum dado disponível para o ano selecionado.
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      
      <div class="mt-8 text-center">
        <p class="text-sm text-gray-500">
          Nota: Os rankings são baseados nas despesas parlamentares relatadas no portal da Câmara dos Deputados.
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
:deep(.card) {
  background-color: white;
  color: #333;
}

:deep(.tabs-content) {
  margin-top: 0;
}

:deep(.tabs-trigger) {
  padding: 0.75rem;
}

:deep(.tabs-trigger[data-state="active"]) {
  font-weight: bold;
}

:deep(.table-cell) {
  padding: 0.75rem 1rem;
}
</style>