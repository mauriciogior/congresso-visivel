<script setup>
import { formatCurrency, formatPercentage } from '@/utils/formatting';
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
</script>

<template>
  <div class="overflow-x-auto">
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
        <TableRow v-else-if="states.length === 0">
          <TableCell colspan="7" class="h-24 text-center text-gray-500">
            Nenhum resultado encontrado
          </TableCell>
        </TableRow>
        
        <!-- Data rows -->
        <TableRow 
          v-else
          v-for="state in states" 
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