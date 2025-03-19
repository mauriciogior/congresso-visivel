<script setup>
import { ref, computed } from 'vue';
import { formatCurrency, formatPercentage } from '@/utils/formatting';
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
  states: {
    type: Array,
    required: true
  },
  isLoading: {
    type: Boolean,
    required: true
  },
  searchQuery: {
    type: String,
    required: false,
    default: ''
  }
});

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

const sortedStates = computed(() => {
  if (!props.states.length || !sortColumn.value) return props.states;
  
  return [...props.states].sort((a, b) => {
    let valueA, valueB;
    
    // Extract the values based on the sort column
    switch (sortColumn.value) {
      case 'rank':
        valueA = a.rank;
        valueB = b.rank;
        break;
      case 'state':
        valueA = a.state;
        valueB = b.state;
        break;
      case 'count':
        valueA = a.deputy_count;
        valueB = b.deputy_count;
        break;
      case 'total':
        valueA = a.total_spent;
        valueB = b.total_spent;
        break;
      case 'avg':
        valueA = a.avg_per_deputy;
        valueB = b.avg_per_deputy;
        break;
      case 'diff':
        valueA = a.absolute_diff;
        valueB = b.absolute_diff;
        break;
      case 'percent':
        valueA = a.percentage_diff;
        valueB = b.percentage_diff;
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
    <Table>
      <TableCaption>Lista de gastos por estado</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead 
            @click="toggleSort('rank')" 
            class="cursor-pointer hover:bg-gray-50"
          >
            <div class="flex items-center">
              Posição
              <component :is="getSortIcon('rank')" class="ml-1 h-4 w-4" v-if="sortColumn === 'rank'" />
            </div>
          </TableHead>
          <TableHead 
            @click="toggleSort('state')" 
            class="cursor-pointer hover:bg-gray-50"
          >
            <div class="flex items-center">
              Estado
              <component :is="getSortIcon('state')" class="ml-1 h-4 w-4" v-if="sortColumn === 'state'" />
            </div>
          </TableHead>
          <TableHead 
            @click="toggleSort('count')" 
            class="cursor-pointer hover:bg-gray-50"
          >
            <div class="flex items-center">
              Deputados
              <component :is="getSortIcon('count')" class="ml-1 h-4 w-4" v-if="sortColumn === 'count'" />
            </div>
          </TableHead>
          <TableHead 
            @click="toggleSort('total')" 
            class="cursor-pointer hover:bg-gray-50"
          >
            <div class="flex items-center">
              Total Gasto
              <component :is="getSortIcon('total')" class="ml-1 h-4 w-4" v-if="sortColumn === 'total'" />
            </div>
          </TableHead>
          <TableHead 
            @click="toggleSort('avg')" 
            class="cursor-pointer hover:bg-gray-50"
          >
            <div class="flex items-center">
              Média por Deputado
              <component :is="getSortIcon('avg')" class="ml-1 h-4 w-4" v-if="sortColumn === 'avg'" />
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
        <TableRow v-else-if="states.length === 0">
          <TableCell colspan="7" class="h-24 text-center text-gray-500">
            Nenhum resultado encontrado
          </TableCell>
        </TableRow>
        
        <!-- Data rows -->
        <TableRow 
          v-else
          v-for="state in sortedStates" 
          :key="state.state"
          :class="{'bg-yellow-50': searchQuery && state.state.toLowerCase().includes(searchQuery.toLowerCase())}"
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
</template>