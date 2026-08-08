import { defineStore } from 'pinia'
import { ref, shallowRef, computed, watch, markRaw } from 'vue'
import type {
  Category,
  LiveChannel,
  Movie,
  Series,
  PlayableMedia,
  ContinueWatchingItem
} from '@/types/iptv'
import { useAuthStore } from '@/stores/auth'
import { XtreamService } from '@/services/xtream'

const FAVORITES_STORAGE_KEY = 'zkplayer_favorites'
const WATCH_HISTORY_STORAGE_KEY = 'zkplayer_continue_watching'

const DEFAULT_PAGE_SIZE = 48
const MAX_HISTORY_ITEMS = 30
const WATCH_PROGRESS_THRESHOLD_SECONDS = 5
const SEARCH_DEBOUNCE_MS = 250
const GLOBAL_SEARCH_DEBOUNCE_MS = 300

export type ViewType = 'home' | 'live' | 'movies' | 'series' | 'favorites' | 'settings' | 'search'
export type SortOption = 'name_asc' | 'name_desc' | 'rating' | 'added' | 'id'
export type ViewLayout = 'grid' | 'list'

interface SortableItem {
  name?: string
  rating?: string | number
  added?: string
  stream_id?: number
  series_id?: number
}

const NAME_COLLATOR = new Intl.Collator(undefined, {
  sensitivity: 'base',
  numeric: true,
})

function normalizeSearch(q: string): string {
  return q.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

function safeReviver(_key: string, value: unknown): unknown {
  if (
    value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.keys(value).some((k) => k === '__proto__' || k === 'constructor' || k === 'prototype')
  ) {
    return undefined
  }
  return value
}

function indexNames(items: readonly SortableItem[]) {
  for (const item of items) {
    const raw = item as any
    if (raw && raw._zkName === undefined) {
      raw._zkName = normalizeSearch(item.name ?? '')
    }
  }
}

function matchesName(item: SortableItem, q: string): boolean {
  const raw = item as any
  const normalized = raw?._zkName ?? normalizeSearch(item.name ?? '')
  return normalized.includes(q)
}

function useDebouncedSearch(delay = SEARCH_DEBOUNCE_MS) {
  const query = ref('')
  const debounced = ref('')
  let timeout: ReturnType<typeof setTimeout> | null = null

  watch(query, (q) => {
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(() => {
      debounced.value = q
    }, delay)
  })

  function clear() {
    if (timeout) clearTimeout(timeout)
    query.value = ''
    debounced.value = ''
  }

  return { query, debounced, clear }
}

export const useIptvStore = defineStore('iptv', () => {
  const authStore = useAuthStore()

  const currentView = ref<ViewType>('home')
  const layoutMode = ref<ViewLayout>('grid')
  const sortBy = ref<SortOption>('name_asc')

  // Master Cache: shallowRef avoids deep Vue reactivity overhead for large external data arrays.
  const allLiveChannels = shallowRef<LiveChannel[]>([])
  const allVodMovies = shallowRef<Movie[]>([])
  const allSeriesList = shallowRef<Series[]>([])
  let liveChannelsByCategory = new Map<string, LiveChannel[]>()
  let moviesByCategory = new Map<string, Movie[]>()
  let seriesByCategory = new Map<string, Series[]>()
  const sortedItemsCache = new WeakMap<object, Map<SortOption, SortableItem[]>>()

  // Active Category & Filtered Lists
  const liveCategories = shallowRef<Category[]>([])
  const liveChannels = shallowRef<LiveChannel[]>([])
  const selectedLiveCategory = ref<string>('all')
  const liveCategorySearch = useDebouncedSearch()

  const vodCategories = shallowRef<Category[]>([])
  const vodMovies = shallowRef<Movie[]>([])
  const selectedVodCategory = ref<string>('all')
  const vodCategorySearch = useDebouncedSearch()

  const seriesCategories = shallowRef<Category[]>([])
  const seriesList = shallowRef<Series[]>([])
  const selectedSeriesCategory = ref<string>('all')
  const seriesCategorySearch = useDebouncedSearch()

  // Favorites & Watch progress
  const favorites = ref<PlayableMedia[]>([])
  const continueWatching = ref<ContinueWatchingItem[]>([])

  // Global search & Pagination
  const searchQuery = useDebouncedSearch(GLOBAL_SEARCH_DEBOUNCE_MS)
  const isLoadingData = ref<boolean>(false)
  const displayLimit = ref<number>(DEFAULT_PAGE_SIZE)

  // Local folder content search inputs
  const liveSearch = useDebouncedSearch()
  const vodSearch = useDebouncedSearch()
  const seriesSearch = useDebouncedSearch()

  // Reset pagination when any search term changes
  watch(
    [
      () => liveSearch.debounced.value,
      () => vodSearch.debounced.value,
      () => seriesSearch.debounced.value,
      () => searchQuery.debounced.value,
    ],
    () => {
      displayLimit.value = DEFAULT_PAGE_SIZE
    }
  )

  // Saved local data
  const savedFavs = localStorage.getItem(FAVORITES_STORAGE_KEY)
  if (savedFavs) {
    try {
      favorites.value = JSON.parse(savedFavs, safeReviver)
    } catch {}
  }

  const savedWatch = localStorage.getItem(WATCH_HISTORY_STORAGE_KEY)
  if (savedWatch) {
    try {
      continueWatching.value = JSON.parse(savedWatch, safeReviver)
    } catch {}
  }

  // Throttle localStorage writes to avoid I/O churn on rapid mutations.
  const PERSIST_DELAY_MS = 1000
  let favsTimeout: ReturnType<typeof setTimeout> | null = null
  let watchTimeout: ReturnType<typeof setTimeout> | null = null

  function scheduleFavoritesPersist() {
    if (favsTimeout) clearTimeout(favsTimeout)
    favsTimeout = setTimeout(() => {
      localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favorites.value))
    }, PERSIST_DELAY_MS)
  }

  function scheduleWatchHistoryPersist() {
    if (watchTimeout) clearTimeout(watchTimeout)
    watchTimeout = setTimeout(() => {
      localStorage.setItem(WATCH_HISTORY_STORAGE_KEY, JSON.stringify(continueWatching.value))
    }, PERSIST_DELAY_MS)
  }

  watch(favorites, () => {
    scheduleFavoritesPersist()
  }, { deep: true })

  watch(continueWatching, () => {
    scheduleWatchHistoryPersist()
  }, { deep: true })

  // Auto switch to global search view when user types in global search bar
  watch(() => searchQuery.query.value, (q) => {
    if (q.trim()) {
      currentView.value = 'search'
    } else if (currentView.value === 'search') {
      currentView.value = 'home'
    }
  })

  // Full Indexing & Pre-caching at Login
  function groupByCategory<T extends { category_id?: string }>(items: readonly T[]): Map<string, T[]> {
    const grouped = new Map<string, T[]>()
    for (const item of items) {
      const categoryId = item.category_id ?? ''
      const category = grouped.get(categoryId)
      if (category) {
        category.push(item)
      } else {
        grouped.set(categoryId, [item])
      }
    }
    return grouped
  }

  function rebuildCategoryIndexes() {
    liveChannelsByCategory = groupByCategory(allLiveChannels.value)
    moviesByCategory = groupByCategory(allVodMovies.value)
    seriesByCategory = groupByCategory(allSeriesList.value)
  }

  async function loadInitialData() {
    isLoadingData.value = true
    try {
      if (authStore.authMode === 'm3u' && authStore.parsedM3uData) {
        const parsed = authStore.parsedM3uData
        // Mark external parsed data as raw to avoid deep reactivity conversion.
        liveCategories.value = markRaw(parsed.liveCategories)
        vodCategories.value = markRaw(parsed.vodCategories)
        seriesCategories.value = markRaw(parsed.seriesCategories)

        allLiveChannels.value = markRaw(parsed.liveChannels)
        allVodMovies.value = markRaw(parsed.movies)
        allSeriesList.value = markRaw(parsed.series)

        indexNames(allLiveChannels.value)
        indexNames(allVodMovies.value)
        indexNames(allSeriesList.value)
        rebuildCategoryIndexes()

        liveChannels.value = allLiveChannels.value
        vodMovies.value = allVodMovies.value
        seriesList.value = allSeriesList.value
      } else if (authStore.credentials) {
        // Fetch all categories and master items in parallel
        const [liveCats, vodCats, serCats, channels, movies, series] = await Promise.all([
          XtreamService.getLiveCategories(authStore.credentials).catch(() => []),
          XtreamService.getVodCategories(authStore.credentials).catch(() => []),
          XtreamService.getSeriesCategories(authStore.credentials).catch(() => []),
          XtreamService.getLiveChannels(authStore.credentials, 'all').catch(() => []),
          XtreamService.getMovies(authStore.credentials, 'all').catch(() => []),
          XtreamService.getSeries(authStore.credentials, 'all').catch(() => []),
        ])

        liveCategories.value = markRaw(liveCats)
        vodCategories.value = markRaw(vodCats)
        seriesCategories.value = markRaw(serCats)

        allLiveChannels.value = markRaw(channels)
        allVodMovies.value = markRaw(movies)
        allSeriesList.value = markRaw(series)

        indexNames(allLiveChannels.value)
        indexNames(allVodMovies.value)
        indexNames(allSeriesList.value)
        rebuildCategoryIndexes()

        liveChannels.value = allLiveChannels.value
        vodMovies.value = allVodMovies.value
        seriesList.value = allSeriesList.value
      }
    } finally {
      isLoadingData.value = false
    }
  }

  // Instant Folder Filtering from Cache (0ms latency!)
  function loadLiveChannels(catId = 'all') {
    selectedLiveCategory.value = catId
    displayLimit.value = DEFAULT_PAGE_SIZE
    liveChannels.value = catId === 'all'
      ? allLiveChannels.value
      : markRaw(liveChannelsByCategory.get(catId) ?? [])
  }

  function loadMovies(catId = 'all') {
    selectedVodCategory.value = catId
    displayLimit.value = DEFAULT_PAGE_SIZE
    vodMovies.value = catId === 'all'
      ? allVodMovies.value
      : markRaw(moviesByCategory.get(catId) ?? [])
  }

  function loadSeries(catId = 'all') {
    selectedSeriesCategory.value = catId
    displayLimit.value = DEFAULT_PAGE_SIZE
    seriesList.value = catId === 'all'
      ? allSeriesList.value
      : markRaw(seriesByCategory.get(catId) ?? [])
  }

  function loadMore() {
    displayLimit.value += DEFAULT_PAGE_SIZE
  }

  function toggleFavorite(media: PlayableMedia) {
    const idx = favorites.value.findIndex((item) => item.id === media.id)
    if (idx >= 0) {
      favorites.value.splice(idx, 1)
    } else {
      favorites.value.unshift(media)
    }
  }

  function isFavorite(id: string): boolean {
    return favorites.value.some((item) => item.id === id)
  }

  function saveWatchProgress(media: PlayableMedia, currentTime: number, duration: number) {
    if (!media?.id || !Number.isFinite(duration) || duration <= 0 || !Number.isFinite(currentTime) || currentTime < WATCH_PROGRESS_THRESHOLD_SECONDS) return
    const existingIdx = continueWatching.value.findIndex((i) => i.id === media.id)
    const newItem: ContinueWatchingItem = {
      id: media.id,
      media,
      currentTime,
      duration,
      lastWatched: Date.now(),
    }
    if (existingIdx >= 0) {
      continueWatching.value.splice(existingIdx, 1)
    }
    continueWatching.value.unshift(newItem)
    if (continueWatching.value.length > MAX_HISTORY_ITEMS) {
      continueWatching.value.pop()
    }
  }

  const filteredLiveCategories = computed(() => {
    const q = normalizeSearch(liveCategorySearch.query.value)
    if (!q) return liveCategories.value
    return liveCategories.value.filter((c) => normalizeSearch(c.category_name).includes(q))
  })

  const filteredVodCategories = computed(() => {
    const q = normalizeSearch(vodCategorySearch.query.value)
    if (!q) return vodCategories.value
    return vodCategories.value.filter((c) => normalizeSearch(c.category_name).includes(q))
  })

  const filteredSeriesCategories = computed(() => {
    const q = normalizeSearch(seriesCategorySearch.query.value)
    if (!q) return seriesCategories.value
    return seriesCategories.value.filter((c) => normalizeSearch(c.category_name).includes(q))
  })


  function filterByName<T extends SortableItem>(items: readonly T[], q: string): T[] {
    // Always return a shallow copy so downstream sorting cannot mutate the source cache.
    if (!q) return items.slice()
    return items.filter((item) => matchesName(item, q))
  }

  function filterAndSort<T extends SortableItem>(
    items: readonly T[],
    query: string,
    sortType: SortOption
  ): T[] {
    if (query) {
      const filtered = filterByName(items, query)
      sortItems(filtered, sortType)
      return filtered
    }

    let bySort = sortedItemsCache.get(items as object)
    const cached = bySort?.get(sortType)
    if (cached) return cached as T[]

    const sorted = items.slice()
    sortItems(sorted, sortType)
    if (!bySort) {
      bySort = new Map<SortOption, SortableItem[]>()
      sortedItemsCache.set(items as object, bySort)
    }
    bySort.set(sortType, sorted)
    return sorted
  }

  const filteredChannels = computed(() => {
    const globalQ = normalizeSearch(searchQuery.debounced.value)
    const localQ = normalizeSearch(liveSearch.debounced.value)

    // Global search takes precedence: scan entire catalog
    const source = globalQ ? allLiveChannels.value : liveChannels.value
    return markRaw(filterAndSort(source, globalQ || localQ, sortBy.value))
  })

  const pagedChannels = computed(() => {
    return filteredChannels.value.slice(0, displayLimit.value)
  })

  const filteredMovies = computed(() => {
    const globalQ = normalizeSearch(searchQuery.debounced.value)
    const localQ = normalizeSearch(vodSearch.debounced.value)

    const source = globalQ ? allVodMovies.value : vodMovies.value
    return markRaw(filterAndSort(source, globalQ || localQ, sortBy.value))
  })

  const pagedMovies = computed(() => {
    return filteredMovies.value.slice(0, displayLimit.value)
  })

  const filteredSeries = computed(() => {
    const globalQ = normalizeSearch(searchQuery.debounced.value)
    const localQ = normalizeSearch(seriesSearch.debounced.value)

    const source = globalQ ? allSeriesList.value : seriesList.value
    return markRaw(filterAndSort(source, globalQ || localQ, sortBy.value))
  })

  const pagedSeries = computed(() => {
    return filteredSeries.value.slice(0, displayLimit.value)
  })

  function getSortableId(item: SortableItem): number {
    return Number(item.stream_id || item.series_id || 0)
  }

  function sortItems(arr: SortableItem[], sortType: SortOption) {
    arr.sort((a, b) => {
      if (sortType === 'name_asc') {
        return NAME_COLLATOR.compare(a.name || '', b.name || '')
      } else if (sortType === 'name_desc') {
        return NAME_COLLATOR.compare(b.name || '', a.name || '')
      } else if (sortType === 'rating') {
        return (Number(b.rating) || 0) - (Number(a.rating) || 0)
      } else if (sortType === 'added') {
        return (Number(b.added) || 0) - (Number(a.added) || 0)
      } else if (sortType === 'id') {
        return getSortableId(b) - getSortableId(a)
      }
      return 0
    })
  }

  async function refreshContent() {
    XtreamService.clearDetailCache()
    await loadInitialData()
  }

  function clearAllSearches() {
    searchQuery.clear()
    liveSearch.clear()
    vodSearch.clear()
    seriesSearch.clear()
    liveCategorySearch.clear()
    vodCategorySearch.clear()
    seriesCategorySearch.clear()
  }

  return {
    currentView,
    layoutMode,
    sortBy,
    allLiveChannels,
    allVodMovies,
    allSeriesList,
    liveCategories,
    liveChannels,
    selectedLiveCategory,
    liveCategorySearch: liveCategorySearch.query,
    filteredLiveCategories,
    vodCategories,
    vodMovies,
    selectedVodCategory,
    vodCategorySearch: vodCategorySearch.query,
    filteredVodCategories,
    seriesCategories,
    seriesList,
    selectedSeriesCategory,
    seriesCategorySearch: seriesCategorySearch.query,
    filteredSeriesCategories,
    favorites,
    continueWatching,
    searchQuery: searchQuery.query,
    searchQueryDebounced: computed(() => searchQuery.debounced.value),
    isLoadingData,
    displayLimit,
    liveSearch: liveSearch.query,
    vodSearch: vodSearch.query,
    seriesSearch: seriesSearch.query,
    filteredChannels,
    pagedChannels,
    filteredMovies,
    pagedMovies,
    filteredSeries,
    pagedSeries,
    loadInitialData,
    refreshContent,
    loadLiveChannels,
    loadMovies,
    loadSeries,
    loadMore,
    toggleFavorite,
    isFavorite,
    saveWatchProgress,
    clearAllSearches,
  }
})
