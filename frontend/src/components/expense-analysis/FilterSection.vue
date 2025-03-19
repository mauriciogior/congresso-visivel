<script setup>
import { computed } from 'vue';
import Card from '../ui/card/Card.vue';
import CardHeader from '../ui/card/CardHeader.vue';
import CardTitle from '../ui/card/CardTitle.vue';
import CardContent from '../ui/card/CardContent.vue';
import Input from '../ui/input/Input.vue';
import { 
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel
} from '../ui/select';
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
          <Select 
            :model-value="selectedExpenseType"
            @update:model-value="emit('update:selectedExpenseType', $event)"
          >
            <SelectTrigger class="w-full">
              <SelectValue placeholder="Selecione um tipo de despesa" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Tipos de Despesa</SelectLabel>
                <SelectItem value="all">Todas as despesas</SelectItem>
                <SelectItem 
                  v-for="type in expenseTypes" 
                  :key="type.expense_type" 
                  :value="type.expense_type"
                >
                  {{ toCamelCase(type.expense_type) }}
                </SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

        <div class="space-y-2">
          <label class="text-sm font-medium">Ano</label>
          <Select 
            :model-value="selectedYear.toString()"
            @update:model-value="emit('update:selectedYear', parseInt($event))"
          >
            <SelectTrigger class="w-full">
              <SelectValue placeholder="Selecione um ano" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Anos Disponíveis</SelectLabel>
                <SelectItem 
                  v-for="year in availableYears" 
                  :key="year" 
                  :value="year.toString()"
                >
                  {{ year }}
                </SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        
        <div v-if="currentView === 'deputies'" class="space-y-2">
          <label class="text-sm font-medium">Buscar Deputado</label>
          <Input 
            :model-value="searchQuery"
            @update:model-value="emit('update:searchQuery', $event)"
            placeholder="Buscar por nome..."
            class="w-full"
          />
        </div>

        <div v-else-if="currentView === 'parties'" class="space-y-2">
          <label class="text-sm font-medium">Buscar Partido</label>
          <Input 
            :model-value="partySearchQuery"
            @update:model-value="emit('update:partySearchQuery', $event)"
            placeholder="Buscar por partido..."
            class="w-full"
          />
        </div>

        <div v-else class="space-y-2">
          <label class="text-sm font-medium">Buscar Estado</label>
          <Input 
            :model-value="stateSearchQuery"
            @update:model-value="emit('update:stateSearchQuery', $event)"
            placeholder="Buscar por estado..."
            class="w-full"
          />
        </div>
      </div>
    </CardContent>
  </Card>
</template>