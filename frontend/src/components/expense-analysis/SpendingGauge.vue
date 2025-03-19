<script setup>
import { computed } from 'vue';

const props = defineProps({
  // Percentile (0-100), where lower is better for spending (0=lowest spending, 100=highest spending)
  percentile: {
    type: Number,
    required: true,
    validator: (value) => value >= 0 && value <= 100
  },
  // Optional custom labels
  labels: {
    type: Object,
    default: () => ({
      excellent: 'Excelente',
      good: 'Bom',
      average: 'Médio',
      poor: 'Ruim',
      terrible: 'Muito Ruim'
    })
  }
});

// Calculate position percentage for the gauge
const position = computed(() => {
  // IMPORTANT - 
  // In our NEW calculation, higher percentile = higher spending = WORSE
  // So we DO NOT need to invert for the gauge (left = good, right = bad)
  // We just directly use the percentile (with clamping)
  return Math.min(Math.max(props.percentile, 0), 100);
});

// Determine where on the gauge the marker should be
const markerPosition = computed(() => {
  return `${position.value}%`;
});

// Determine the category based on percentile
// UPDATED to match new percentile logic (higher % = worse performance)
const category = computed(() => {
  if (props.percentile >= 80) return 'terrible';  // 80-100%: Terrible (top 20% highest spenders)
  if (props.percentile >= 60) return 'poor';      // 60-80%: Poor
  if (props.percentile >= 40) return 'average';   // 40-60%: Average
  if (props.percentile >= 20) return 'good';      // 20-40%: Good
  return 'excellent';                           // 0-20%: Excellent (bottom 20% lowest spenders)
});

// Color for the marker
const markerColor = computed(() => {
  switch (category.value) {
    case 'excellent': return 'bg-green-700';
    case 'good': return 'bg-green-700';
    case 'average': return 'bg-yellow-700';
    case 'poor': return 'bg-orange-700';
    case 'terrible': return 'bg-red-700';
    default: return 'bg-gray-700';
  }
});

// Get label text based on category
const labelText = computed(() => {
  return props.labels[category.value] || '';
});
</script>

<template>
  <div class="spending-gauge mt-2">
    <!-- Title and percentile -->
    <div class="flex justify-between items-center mb-1">
      <div class="text-sm font-medium">Gestão de Recursos</div>
      <div 
        class="text-xs font-medium px-2 py-1 rounded"
        :class="[
          props.percentile <= 40 ? 'bg-green-100 text-green-800' : 
          props.percentile >= 60 ? 'bg-red-100 text-red-800' : 
          'bg-yellow-100 text-yellow-800'
        ]"
      >
        <template v-if="percentile <= 20">
          <span>Super Econômico</span>
        </template>
        <template v-if="percentile > 20 && percentile <= 40">
          <span>Econômico</span>
        </template>
        <template v-if="percentile > 40 && percentile <= 60">
          <span>Na média</span>
        </template>
        <template v-if="percentile > 60 && percentile <= 80">
          <span>Gastão</span>
        </template>
        <template v-if="percentile > 80">
          <span>Super Gastão</span>
        </template>
      </div>
    </div>
    
    <!-- Gauge bar -->
    <div class="gauge-container relative h-6 rounded-full overflow-hidden bg-gray-200">
      <!-- Color segments -->
      <div v-if="percentile <= 20" class="absolute inset-y-0 w-full bg-green-600"></div>
      <div v-if="percentile > 20 && percentile <= 40" class="absolute inset-y-0 w-full bg-green-400"></div>
      <div v-if="percentile > 40 && percentile <= 60" class="absolute inset-y-0 w-full bg-yellow-400"></div>
      <div v-if="percentile > 60 && percentile <= 80" class="absolute inset-y-0 w-full bg-orange-400"></div>
      <div v-if="percentile > 80" class="absolute inset-y-0 w-full bg-red-600"></div>
      
      <!-- Labels -->
      <div class="absolute inset-x-0 bottom-[2px] flex justify-center px-2 text-[12px] text-white font-medium">
        <span>{{ labelText }}</span>
      </div>
      
      <!-- Marker -->
      <div 
        class="absolute top-0 bottom-0 w-1 transform -translate-x-1/2"
        :class="markerColor"
        :style="{ left: markerPosition }"
      >
        <div class="absolute -top-2 left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-[6px] border-r-[6px] border-t-[6px] border-l-transparent border-r-transparent" :class="markerColor"></div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.gauge-container {
  height: 24px;
}
</style>