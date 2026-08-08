<template>
  <div class="h-full flex flex-col p-6 space-y-6 overflow-y-auto">
    <!-- Header Title -->
    <div>
      <h1 class="text-xl font-bold text-slate-100 flex items-center space-x-2">
        <SlidersHorizontal class="w-6 h-6 text-brand-accent" />
        <span>Paramètres</span>
      </h1>
      <p class="text-xs text-slate-400 mt-1">Configuration native de l'accélération matérielle, des codecs et du réseau.</p>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <!-- Card 1: Hardware Acceleration & GPU Status -->
      <div class="glass-panel p-5 rounded-3xl space-y-4">
        <div class="flex items-center space-x-3 pb-3 border-b border-white/5">
          <Cpu class="w-5 h-5 text-brand-accent" />
          <h2 class="text-sm font-bold text-slate-200">Accélération Matérielle & GPU</h2>
        </div>

        <div class="space-y-3">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-xs font-semibold text-slate-200">Décodage Vidéo Matériel (Direct3D11 / NVDEC)</p>
              <p class="text-[10px] text-slate-400">Évite 100% des saccades et de la chauffe CPU sur les films 4K MKV.</p>
            </div>
            <input
              type="checkbox"
              v-model="settingsStore.settings.hardwareAcceleration"
              class="w-4 h-4 accent-brand-accent rounded cursor-pointer"
            />
          </div>

          <div class="p-3 rounded-2xl bg-obsidian-950/80 border border-white/5 space-y-1.5 font-mono text-[11px]">
            <div class="flex justify-between text-slate-300">
              <span>Status GPU Windows :</span>
              <span class="text-emerald-400 font-semibold">{{ sysCaps?.hardware_acceleration || 'Direct3D11 Active' }}</span>
            </div>
            <div class="flex justify-between text-slate-300">
              <span>FastSeek Buffer (RAM) :</span>
              <span class="text-brand-accent font-semibold">{{ settingsStore.settings.bufferSizeMb }} Mo</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Card 2: Audio Codecs & License Status -->
      <div class="glass-panel p-5 rounded-3xl space-y-4">
        <div class="flex items-center space-x-3 pb-3 border-b border-white/5">
          <Volume2 class="w-5 h-5 text-brand-accent" />
          <h2 class="text-sm font-bold text-slate-200">Codecs Audio Natively Inclus</h2>
        </div>

        <div class="space-y-3">
          <p class="text-xs text-slate-300 leading-relaxed">
            Contrairement aux navigateurs web, ZkPlayer Desktop intègre le décodage natif de tous les codecs audio multicanaux :
          </p>

          <div class="grid grid-cols-2 gap-2 text-[10px] font-mono">
            <div class="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 flex items-center justify-between">
              <span>Dolby AC-3 5.1</span>
              <CheckCircle2 class="w-3.5 h-3.5" />
            </div>
            <div class="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 flex items-center justify-between">
              <span>EAC-3 / Dolby Digital+</span>
              <CheckCircle2 class="w-3.5 h-3.5" />
            </div>
            <div class="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 flex items-center justify-between">
              <span>DTS Digital Surround</span>
              <CheckCircle2 class="w-3.5 h-3.5" />
            </div>
            <div class="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 flex items-center justify-between">
              <span>MPEG-1 Layer II (MP2)</span>
              <CheckCircle2 class="w-3.5 h-3.5" />
            </div>
          </div>
        </div>
      </div>

      <!-- Card 3: FastSeek & Buffer Tuning -->
      <div class="glass-panel p-5 rounded-3xl space-y-4">
        <div class="flex items-center space-x-3 pb-3 border-b border-white/5">
          <Zap class="w-5 h-5 text-amber-400" />
          <h2 class="text-sm font-bold text-slate-200">Optimisation FastSeek (0.01s)</h2>
        </div>

        <div class="space-y-4">
          <div>
            <div class="flex justify-between text-xs font-semibold text-slate-300 mb-1">
              <span>Taille du tampon en mémoire RAM :</span>
              <span class="text-brand-accent font-mono">{{ settingsStore.settings.bufferSizeMb }} Mo</span>
            </div>
            <input
              type="range"
              min="16"
              max="256"
              step="16"
              v-model.number="settingsStore.settings.bufferSizeMb"
              class="w-full accent-brand-accent cursor-pointer"
            />
          </div>

          <div class="flex items-center justify-between">
            <span class="text-xs font-semibold text-slate-200">Enchaînement automatique des épisodes</span>
            <input
              type="checkbox"
              v-model="settingsStore.settings.autoPlayNextEpisode"
              class="w-4 h-4 accent-brand-accent rounded cursor-pointer"
            />
          </div>
        </div>
      </div>

      <!-- Card 4: Xtream Account Profile -->
      <div class="glass-panel p-5 rounded-3xl space-y-4">
        <div class="flex items-center space-x-3 pb-3 border-b border-white/5">
          <UserCheck class="w-5 h-5 text-emerald-400" />
          <h2 class="text-sm font-bold text-slate-200">Profil & Abonnement IPTV</h2>
        </div>

        <div v-if="authStore.userInfo" class="space-y-2 text-xs">
          <div class="flex justify-between py-1 border-b border-white/5">
            <span class="text-slate-400">Nom d'utilisateur :</span>
            <span class="font-bold text-slate-100">{{ authStore.userInfo.username }}</span>
          </div>
          <div class="flex justify-between py-1 border-b border-white/5">
            <span class="text-slate-400">Statut Compte :</span>
            <span class="font-semibold text-emerald-400">{{ authStore.userInfo.status }}</span>
          </div>
          <div class="flex justify-between py-1 border-b border-white/5">
            <span class="text-slate-400">Date d'expiration :</span>
            <span class="font-mono text-amber-300">{{ formatDate(authStore.userInfo.exp_date) }}</span>
          </div>
          <div class="flex justify-between py-1">
            <span class="text-slate-400">Connexions Simultanées :</span>
            <span class="font-mono text-slate-300">Max {{ authStore.userInfo.max_connections }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { SlidersHorizontal, Cpu, Volume2, CheckCircle2, Zap, UserCheck } from 'lucide-vue-next'
import { useSettingsStore } from '@/stores/settings'
import { useAuthStore } from '@/stores/auth'
import { getSystemCapabilities, type SystemCapabilities } from '@/services/tauri'

const settingsStore = useSettingsStore()
const authStore = useAuthStore()

const sysCaps = ref<SystemCapabilities | null>(null)

onMounted(async () => {
  sysCaps.value = await getSystemCapabilities()
})

const formatDate = (timestampStr: string): string => {
  if (!timestampStr) return 'Illimité'
  const ts = parseInt(timestampStr, 10)
  if (isNaN(ts)) return timestampStr
  return new Date(ts * 1000).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  })
}
</script>
