<template>
  <div
    class="inline-flex items-center justify-center gap-3"
    role="status"
    aria-live="polite"
    :aria-label="label || 'Chargement'"
  >
    <span :class="['loading-spinner shrink-0', compact ? 'loading-spinner--compact' : '']">
      <span class="loading-spinner__ring"></span>
      <span class="loading-spinner__ring"></span>
      <span class="loading-spinner__core"></span>
    </span>
    <span v-if="label" :class="compact ? 'text-[11px]' : 'text-xs'" class="font-medium text-slate-300 tracking-wide">
      {{ label }}<span class="loading-dots" aria-hidden="true"><span>.</span><span>.</span><span>.</span></span>
    </span>
  </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  label?: string
  compact?: boolean
}>(), {
  label: '',
  compact: false,
})
</script>
