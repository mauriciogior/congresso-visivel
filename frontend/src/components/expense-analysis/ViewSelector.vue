<script setup>
import { computed } from 'vue';

const props = defineProps({
  currentView: {
    type: String,
    required: true
  }
});

const emit = defineEmits(['update:currentView']);

const updateView = (view) => {
  emit('update:currentView', view);
};
</script>

<template>
  <div class="mb-6">
    <div class="bg-gray-200 rounded-lg p-1 inline-flex w-full">
      <button 
        @click="updateView('deputies')"
        :style="{
          flex: 1,
          padding: '0.5rem 1rem',
          borderRadius: '0.375rem',
          fontSize: '0.875rem',
          fontWeight: 500,
          textAlign: 'center',
          transition: 'background-color 0.2s',
          backgroundColor: currentView === 'deputies' ? '#2563eb' : '#f3f4f6',
          color: currentView === 'deputies' ? 'white' : '#374151',
          boxShadow: currentView === 'deputies' ? '0 4px 6px -1px rgba(0, 0, 0, 0.1)' : 'none'
        }"
      >
        Por Deputado
      </button>
      <button 
        @click="updateView('parties')"
        :style="{
          flex: 1,
          padding: '0.5rem 1rem',
          borderRadius: '0.375rem',
          fontSize: '0.875rem',
          fontWeight: 500,
          textAlign: 'center',
          transition: 'background-color 0.2s',
          backgroundColor: currentView === 'parties' ? '#2563eb' : '#f3f4f6',
          color: currentView === 'parties' ? 'white' : '#374151',
          boxShadow: currentView === 'parties' ? '0 4px 6px -1px rgba(0, 0, 0, 0.1)' : 'none'
        }"
      >
        Por Partido
      </button>
      <button 
        @click="updateView('states')"
        :style="{
          flex: 1,
          padding: '0.5rem 1rem',
          borderRadius: '0.375rem',
          fontSize: '0.875rem',
          fontWeight: 500,
          textAlign: 'center',
          transition: 'background-color 0.2s',
          backgroundColor: currentView === 'states' ? '#2563eb' : '#f3f4f6',
          color: currentView === 'states' ? 'white' : '#374151',
          boxShadow: currentView === 'states' ? '0 4px 6px -1px rgba(0, 0, 0, 0.1)' : 'none'
        }"
      >
        Por Estado
      </button>
    </div>
  </div>
</template>

<style scoped>
button {
  border: none;
  font-size: inherit;
}

.bg-gray-200 button {
  border-radius: 0.375rem !important;
  padding: 0.6em 1.2em !important;
}
</style>