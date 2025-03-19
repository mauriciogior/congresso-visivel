<script setup>
import { ref, computed } from 'vue';
import { formatCurrency, formatPercentage, getDiffClass } from '@/utils/formatting';
import { ChevronUp, ChevronDown } from 'lucide-vue-next';
import { 
  Table, 
  TableHeader, 
  TableHead, 
  TableBody, 
  TableRow, 
  TableCell, 
  TableCaption 
} from '../ui/table';

const props = defineProps({
  deputies: {
    type: Array,
    required: true
  },
  isLoading: {
    type: Boolean,
    required: true
  },
  deputyMetric: {
    type: String,
    required: true
  }
});

const emit = defineEmits(['update:deputyMetric']);

// Sorting
const sortColumn = ref('');
const sortDirection = ref('asc');

const toggleSort = (column) => {
  if (sortColumn.value === column) {
    // Toggle direction if same column
    sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc';
  } else {
    // New column, default to ascending
    sortColumn.value = column;
    sortDirection.value = 'asc';
  }
};

const getSortIcon = (column) => {
  if (sortColumn.value !== column) return null;
  return sortDirection.value === 'asc' ? ChevronUp : ChevronDown;
};

const sortedDeputies = computed(() => {
  if (!props.deputies.length || !sortColumn.value) return props.deputies;
  
  return [...props.deputies].sort((a, b) => {
    let valueA, valueB;
    
    // Extract the values based on the sort column
    switch (sortColumn.value) {
      case 'position':
        valueA = props.deputyMetric === 'total' ? a.total_rank : a.monthly_rank;
        valueB = props.deputyMetric === 'total' ? b.total_rank : b.monthly_rank;
        break;
      case 'name':
        valueA = a.name;
        valueB = b.name;
        break;
      case 'party':
        valueA = a.party;
        valueB = b.party;
        break;
      case 'value':
        valueA = props.deputyMetric === 'total' ? a.total_spent : a.monthly_average;
        valueB = props.deputyMetric === 'total' ? b.total_spent : b.monthly_average;
        break;
      case 'months':
        valueA = a.months_with_expenses;
        valueB = b.months_with_expenses;
        break;
      case 'diff':
        valueA = props.deputyMetric === 'total' ? a.total_absolute_diff : a.monthly_absolute_diff;
        valueB = props.deputyMetric === 'total' ? b.total_absolute_diff : b.monthly_absolute_diff;
        break;
      case 'percent':
        valueA = props.deputyMetric === 'total' ? a.total_percentage_diff : a.monthly_percentage_diff;
        valueB = props.deputyMetric === 'total' ? b.total_percentage_diff : b.monthly_percentage_diff;
        break;
      default:
        return 0;
    }
    
    // Sort comparison
    if (typeof valueA === 'string' && typeof valueB === 'string') {
      return sortDirection.value === 'asc' 
        ? valueA.localeCompare(valueB)
        : valueB.localeCompare(valueA);
    } else {
      return sortDirection.value === 'asc' 
        ? valueA - valueB
        : valueB - valueA;
    }
  });
});
</script>

<template>
  <div class="overflow-x-auto">
    <!-- Metric Toggle -->
    <div class="mb-4">
      <div class="flex items-center space-x-4">
        <span class="text-sm font-medium">Visualizar por:</span>
        <div class="bg-gray-100 rounded-lg p-1 inline-flex">
          <button 
            @click="emit('update:deputyMetric', 'total')"
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
            Total no ano
          </button>
          <button 
            @click="emit('update:deputyMetric', 'monthly')"
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
          <TableHead 
            @click="toggleSort('position')" 
            class="cursor-pointer hover:bg-gray-50"
          >
            <div class="flex items-center">
              Posição
              <component :is="getSortIcon('position')" class="ml-1 h-4 w-4" v-if="sortColumn === 'position'" />
            </div>
          </TableHead>
          <TableHead 
            @click="toggleSort('name')" 
            class="cursor-pointer hover:bg-gray-50"
          >
            <div class="flex items-center">
              Deputado
              <component :is="getSortIcon('name')" class="ml-1 h-4 w-4" v-if="sortColumn === 'name'" />
            </div>
          </TableHead>
          <TableHead 
            @click="toggleSort('party')" 
            class="cursor-pointer hover:bg-gray-50"
          >
            <div class="flex items-center">
              Partido/Estado
              <component :is="getSortIcon('party')" class="ml-1 h-4 w-4" v-if="sortColumn === 'party'" />
            </div>
          </TableHead>
          <TableHead 
            @click="toggleSort('value')" 
            class="cursor-pointer hover:bg-gray-50"
          >
            <div class="flex items-center">
              {{ deputyMetric === 'total' ? 'Total no ano' : 'Média Mensal' }}
              <component :is="getSortIcon('value')" class="ml-1 h-4 w-4" v-if="sortColumn === 'value'" />
            </div>
          </TableHead>
          <TableHead 
            @click="toggleSort('months')" 
            class="cursor-pointer hover:bg-gray-50"
          >
            <div class="flex items-center">
              Meses Ativos
              <component :is="getSortIcon('months')" class="ml-1 h-4 w-4" v-if="sortColumn === 'months'" />
            </div>
          </TableHead>
          <TableHead 
            @click="toggleSort('diff')" 
            class="cursor-pointer hover:bg-gray-50"
          >
            <div class="flex items-center">
              Diferença da Média
              <component :is="getSortIcon('diff')" class="ml-1 h-4 w-4" v-if="sortColumn === 'diff'" />
            </div>
          </TableHead>
          <TableHead 
            @click="toggleSort('percent')" 
            class="cursor-pointer hover:bg-gray-50"
          >
            <div class="flex items-center">
              % da Média
              <component :is="getSortIcon('percent')" class="ml-1 h-4 w-4" v-if="sortColumn === 'percent'" />
            </div>
          </TableHead>
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
        <TableRow v-else-if="deputies.length === 0">
          <TableCell colspan="7" class="h-24 text-center text-gray-500">
            Nenhum resultado encontrado
          </TableCell>
        </TableRow>
        
        <!-- Data rows -->
        <TableRow v-else v-for="deputy in sortedDeputies" :key="deputy.id">
          <TableCell class="font-medium">
            #{{ deputyMetric === 'total' ? deputy.total_rank : deputy.monthly_rank }}
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
</template>

<style scoped>
button {
  border: none;
  font-size: inherit;
}

.bg-gray-100 button {
  border-radius: 0.375rem !important;
  padding: 0.6em 1.2em !important;
}
</style>