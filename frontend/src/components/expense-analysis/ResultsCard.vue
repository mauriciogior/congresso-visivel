<script setup>
import { computed } from 'vue';
import { formatCurrency, toCamelCase } from '@/utils/formatting';
import Card from '../ui/card/Card.vue';
import CardHeader from '../ui/card/CardHeader.vue';
import CardTitle from '../ui/card/CardTitle.vue';
import CardContent from '../ui/card/CardContent.vue';
import DeputyTable from './DeputyTable.vue';
import PartyTable from './PartyTable.vue';
import StateTable from './StateTable.vue';

const props = defineProps({
  selectedExpenseType: {
    type: String,
    required: true
  },
  currentView: {
    type: String,
    required: true
  },
  analysis: {
    type: Array,
    required: true
  },
  partyAnalysis: {
    type: Array,
    required: true
  },
  stateAnalysis: {
    type: Array,
    required: true
  },
  isLoading: {
    type: Boolean,
    required: true
  },
  selectedYear: {
    type: Number,
    required: true
  },
  deputyMetric: {
    type: String,
    required: true
  },
  filteredAnalysis: {
    type: Array,
    required: true
  },
  filteredPartyAnalysis: {
    type: Array,
    required: true
  },
  filteredStateAnalysis: {
    type: Array,
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
  }
});

const emit = defineEmits(['update:deputyMetric']);

const currentAverage = computed(() => {
  if (props.currentView === 'deputies' && props.analysis.length) {
    return props.deputyMetric === 'total' 
      ? props.analysis[0].average_total 
      : props.analysis[0].average_monthly;
  }
  if (props.currentView === 'parties' && props.partyAnalysis.length) {
    return props.partyAnalysis[0].overall_average;
  }
  if (props.currentView === 'states' && props.stateAnalysis.length) {
    return props.stateAnalysis[0].overall_average;
  }
  return 0;
});
</script>

<template>
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
      <DeputyTable
        v-if="currentView === 'deputies'"
        :deputies="filteredAnalysis"
        :isLoading="isLoading"
        :deputyMetric="deputyMetric"
        @update:deputyMetric="(value) => emit('update:deputyMetric', value)"
      />

      <!-- Parties View -->
      <PartyTable 
        v-else-if="currentView === 'parties'"
        :parties="filteredPartyAnalysis"
        :isLoading="isLoading"
        :searchQuery="partySearchQuery"
      />

      <!-- States View -->
      <StateTable 
        v-else-if="currentView === 'states'"
        :states="filteredStateAnalysis"
        :isLoading="isLoading"
        :searchQuery="stateSearchQuery"
      />
    </CardContent>
  </Card>

  <Card v-else class="text-center py-12">
    <CardContent>
      <p class="text-muted-foreground">
        {{ selectedExpenseType ? 'Carregando dados...' : 'Selecione um tipo de despesa para ver a análise' }}
      </p>
    </CardContent>
  </Card>
</template>