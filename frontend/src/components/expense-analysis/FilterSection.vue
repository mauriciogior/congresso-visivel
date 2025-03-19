<script setup>
import { computed } from 'vue';
import Card from '../ui/card/Card.vue';
import CardHeader from '../ui/card/CardHeader.vue';
import CardTitle from '../ui/card/CardTitle.vue';
import CardContent from '../ui/card/CardContent.vue';
import { toCamelCase } from '@/utils/formatting';

const props = defineProps({
  expenseTypes: {
    type: Array,
    required: true
  },
  selectedExpenseType: {
    type: String,
    required: true
  },
  currentView: {
    type: String,
    required: true
  },
  searchQuery: {
    type: String,
    required: false,
    default: ''
  },
  partySearchQuery: {
    type: String,
    required: false,
    default: ''
  },
  stateSearchQuery: {
    type: String,
    required: false,
    default: ''
  },
  selectedYear: {
    type: Number,
    required: true
  },
  availableYears: {
    type: Array,
    required: true
  }
});

const emit = defineEmits([
  'update:selectedExpenseType',
  'update:searchQuery',
  'update:partySearchQuery',
  'update:stateSearchQuery',
  'update:selectedYear'
]);
</script>

<template>
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
            :value="selectedExpenseType"
            @input="emit('update:selectedExpenseType', $event.target.value)"
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
            :value="selectedYear"
            @input="emit('update:selectedYear', parseInt($event.target.value))"
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
            :value="searchQuery"
            @input="emit('update:searchQuery', $event.target.value)"
            placeholder="Buscar por nome..."
            class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm bg-white text-gray-900"
          />
        </div>

        <div v-else-if="currentView === 'parties'" class="space-y-2">
          <label class="text-sm font-medium">Buscar Partido</label>
          <input 
            :value="partySearchQuery"
            @input="emit('update:partySearchQuery', $event.target.value)"
            placeholder="Buscar por partido..."
            class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm bg-white text-gray-900"
          />
        </div>

        <div v-else class="space-y-2">
          <label class="text-sm font-medium">Buscar Estado</label>
          <input 
            :value="stateSearchQuery"
            @input="emit('update:stateSearchQuery', $event.target.value)"
            placeholder="Buscar por estado..."
            class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm bg-white text-gray-900"
          />
        </div>
      </div>
    </CardContent>
  </Card>
</template>