<script setup>
import { ref } from 'vue';
import { formatCurrency, formatPercentage, getDiffClass } from '@/utils/formatting';
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
            Total Gasto
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
        <TableRow v-else-if="deputies.length === 0">
          <TableCell colspan="7" class="h-24 text-center text-gray-500">
            Nenhum resultado encontrado
          </TableCell>
        </TableRow>
        
        <!-- Data rows -->
        <TableRow v-else v-for="deputy in deputies" :key="deputy.id">
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