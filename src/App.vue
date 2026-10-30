<script setup>
import { ref, computed, nextTick } from 'vue'

// Initial task list is empty (no pre-filled tasks)
const tasks = ref([])

const inputTask = ref('')

// Modal state for adding a task with due date & category selection
const isModalOpen = ref(false)
const pendingTitle = ref('')
const pendingDueDate = ref('')
const pendingDateIso = ref('')
const pendingCategories = ref(['Personal'])
const dueDateInputRef = ref(null)

// Helpers for Natural Language Parsing
const extractDueDate = (text) => {
  const patterns = [
    // ISO date YYYY-MM-DD
    /(?:^|\s)due:\s*(\d{4}-\d{1,2}-\d{1,2})/i,
    // Slash date MM/DD or MM/DD/YYYY
    /(?:^|\s)due:\s*(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)/i,
    // Month + Day (e.g. Oct 26, October 26th)
    /(?:^|\s)due:\s*([a-zA-Z]{3,9}\.?\s+\d{1,2}(?:st|nd|rd|th)?(?:\s+\d{4})?)/i,
    // Day + Month (e.g. 26 Oct, 26th October)
    /(?:^|\s)due:\s*(\d{1,2}(?:st|nd|rd|th)?\s+[a-zA-Z]{3,9}\.?(?:\s+\d{4})?)/i,
    // Relative words: today, tomorrow, yesterday, next week, Monday...
    /(?:^|\s)due:\s*(today|tomorrow|yesterday|next\s+\w+|monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i,
    // Fallback: 1-2 words right after due:
    /(?:^|\s)due:\s*([a-zA-Z0-9]+(?:\s+[a-zA-Z0-9]+)?)/i
  ]

  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match) {
      return {
        fullMatch: match[0].trim(),
        dateStr: match[1].trim()
      }
    }
  }
  return null
}

const formatDueDate = (rawDate) => {
  if (!rawDate) return ''
  const trimmed = rawDate.trim()
  const lower = trimmed.toLowerCase()

  if (lower === 'today') return 'Today'
  if (lower === 'tomorrow') return 'Tomorrow'
  if (lower === 'yesterday') return 'Yesterday'

  // ISO Date YYYY-MM-DD
  const isoMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (isoMatch) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const m = parseInt(isoMatch[2], 10) - 1
    const d = parseInt(isoMatch[3], 10)
    if (months[m]) return `${months[m]} ${d}`
  }

  // Capitalize each word (e.g. "oct 26" -> "Oct 26")
  return trimmed
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

const inferCategory = (text) => {
  const lower = text.toLowerCase()
  if (/\b(work|pr|prs|deploy|refactor|api|meeting|sync|dashboard|v2|v3|release|bento|bug|feature|client|office|kantor|proyek|kerja)\b/i.test(lower)) {
    return 'Work'
  }
  if (/\b(learn|learning|research|study|read|course|tutorial|trends|book|doc|docs|belajar|buku|kursus)\b/i.test(lower)) {
    return 'Learning'
  }
  return 'Personal'
}

const parseTaskInput = (rawInput) => {
  let text = rawInput.trim()
  if (!text) return null

  let dueDate = null
  let category = null

  // 1. Detect Category Tag: (w), (p), (l), (work), (personal), (learning), #work, cat:work, etc.
  const catMatch = text.match(/(?:\(|#|\bcat:)(work|personal|learning|w|p|l)(?:\)|(?=\s|$))/i)
  if (catMatch) {
    const code = catMatch[1].toLowerCase()
    if (code === 'w' || code === 'work') category = 'Work'
    else if (code === 'p' || code === 'personal') category = 'Personal'
    else if (code === 'l' || code === 'learning') category = 'Learning'
  }

  // 2. Detect Due Date: robust natural language pattern extraction
  const dueInfo = extractDueDate(text)
  let cleanTitle = text
  if (dueInfo) {
    dueDate = formatDueDate(dueInfo.dateStr)
    cleanTitle = text.replace(dueInfo.fullMatch, ' ').replace(/\s+/g, ' ').trim()
  }

  // If no category tag provided, infer from keywords
  if (!category) {
    category = inferCategory(cleanTitle)
  }

  return {
    title: cleanTitle,
    dueDate,
    category
  }
}

// Convert YYYY-MM-DD to formatted string like "Oct 26"
const formatIsoToDate = (isoStr) => {
  if (!isoStr) return ''
  const parts = isoStr.split('-')
  if (parts.length !== 3) return isoStr
  const month = parseInt(parts[1], 10) - 1
  const day = parseInt(parts[2], 10)
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  if (months[month]) {
    return `${months[month]} ${day}`
  }
  return isoStr
}

// Convert "Oct 26" or relative text to YYYY-MM-DD for date picker input
const parseDateToIso = (dateStr) => {
  if (!dateStr) return ''
  const trimmed = dateStr.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed

  const now = new Date()
  const lower = trimmed.toLowerCase()

  if (lower === 'today' || lower === 'hari ini') {
    const y = now.getFullYear()
    const m = String(now.getMonth() + 1).padStart(2, '0')
    const d = String(now.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
  if (lower === 'tomorrow' || lower === 'besok') {
    const tmrw = new Date(now)
    tmrw.setDate(now.getDate() + 1)
    const y = tmrw.getFullYear()
    const m = String(tmrw.getMonth() + 1).padStart(2, '0')
    const d = String(tmrw.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }

  const mMatch = trimmed.match(/^([a-zA-Z]{3,9})\.?\s+(\d{1,2})$/)
  if (mMatch) {
    const months = {
      jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
      jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
    }
    const mPrefix = mMatch[1].toLowerCase().slice(0, 3)
    const monthNum = months[mPrefix]
    if (monthNum) {
      const dayNum = mMatch[2].padStart(2, '0')
      const year = now.getFullYear()
      return `${year}-${monthNum}-${dayNum}`
    }
  }

  return ''
}

const onDateIsoChange = () => {
  if (pendingDateIso.value) {
    pendingDueDate.value = formatIsoToDate(pendingDateIso.value)
  } else {
    pendingDueDate.value = ''
  }
}

const clearDate = () => {
  pendingDateIso.value = ''
  pendingDueDate.value = ''
}

const setQuickDate = (type) => {
  const now = new Date()
  if (type === 'today') {
    const y = now.getFullYear()
    const m = String(now.getMonth() + 1).padStart(2, '0')
    const d = String(now.getDate()).padStart(2, '0')
    pendingDateIso.value = `${y}-${m}-${d}`
  } else if (type === 'tomorrow') {
    now.setDate(now.getDate() + 1)
    const y = now.getFullYear()
    const m = String(now.getMonth() + 1).padStart(2, '0')
    const d = String(now.getDate()).padStart(2, '0')
    pendingDateIso.value = `${y}-${m}-${d}`
  } else if (type === 'next-week') {
    now.setDate(now.getDate() + 7)
    const y = now.getFullYear()
    const m = String(now.getMonth() + 1).padStart(2, '0')
    const d = String(now.getDate()).padStart(2, '0')
    pendingDateIso.value = `${y}-${m}-${d}`
  }
  pendingDueDate.value = formatIsoToDate(pendingDateIso.value)
}

// Open modal pop-up when adding task
const openAddModal = (title) => {
  if (!title || !title.trim()) return

  const parsed = parseTaskInput(title)
  if (!parsed || !parsed.title) return

  pendingTitle.value = parsed.title
  pendingDueDate.value = parsed.dueDate || ''
  pendingDateIso.value = parseDateToIso(parsed.dueDate || '')
  pendingCategories.value = parsed.category
    ? (Array.isArray(parsed.category) ? parsed.category : [parsed.category])
    : ['Personal']
  isModalOpen.value = true

  nextTick(() => {
    dueDateInputRef.value?.focus()
  })
}

// Close modal pop-up
const closeModal = () => {
  isModalOpen.value = false
  pendingTitle.value = ''
  pendingDueDate.value = ''
  pendingDateIso.value = ''
  pendingCategories.value = ['Personal']
}

// Confirm and save task from modal
const confirmAddTask = () => {
  if (!pendingTitle.value || !pendingTitle.value.trim()) return

  let finalDueDate = null
  if (pendingDateIso.value) {
    finalDueDate = formatIsoToDate(pendingDateIso.value)
  } else if (pendingDueDate.value.trim()) {
    finalDueDate = formatDueDate(pendingDueDate.value.trim())
  }

  const finalCategories = pendingCategories.value.length > 0 ? [...pendingCategories.value] : ['Personal']

  const newTask = {
    id: Date.now(),
    title: pendingTitle.value.trim(),
    dueDate: finalDueDate,
    category: finalCategories,
    status: false
  }

  tasks.value.unshift(newTask)
  inputTask.value = ''
  closeModal()
}

// Toggle Task completion handler
const toggleTask = (id) => {
  const task = tasks.value.find((item) => item.id === id)
  if (task) {
    task.status = !task.status
  }
}

// Delete Task handler
const deleteTask = (id) => {
  tasks.value = tasks.value.filter((item) => item.id !== id)
}

// Filtered tasks lists
const activeTasks = computed(() => {
  return tasks.value.filter((item) => !item.status)
})

const completedTasks = computed(() => {
  return tasks.value.filter((item) => item.status)
})

// Clear all completed tasks handler
const clearCompletedTasks = () => {
  tasks.value = tasks.value.filter((item) => !item.status)
}

// Quick Stats Computations
const activeCount = computed(() => {
  return tasks.value.filter((item) => !item.status).length
})

const completedCount = computed(() => {
  return tasks.value.filter((item) => item.status).length
})

const totalTasks = computed(() => {
  return tasks.value.length
})

const completionRate = computed(() => {
  if (totalTasks.value === 0) return 0
  return Math.round((completedCount.value / totalTasks.value) * 100)
})

// SVG Circular Progress calculation (r = 40, circumference = 251.327)
const ringCircumference = 251.327
const ringOffset = computed(() => {
  const rate = completionRate.value
  return ringCircumference * (1 - rate / 100)
})

// Category Percentages Computations
const getCategoryPercentage = (catName) => {
  const catTasks = tasks.value.filter((item) => {
    if (Array.isArray(item.category)) {
      return item.category.includes(catName)
    }
    return item.category === catName
  })
  const total = catTasks.length
  if (total === 0) return 0
  const completed = catTasks.filter((item) => item.status).length
  return Math.floor((completed / total) * 100)
}

const workPercentage = computed(() => getCategoryPercentage('Work'))
const personalPercentage = computed(() => getCategoryPercentage('Personal'))
const learningPercentage = computed(() => getCategoryPercentage('Learning'))

// Badge styling helper
const categoryBadgeClass = (cat) => {
  switch (cat) {
    case 'Work':
      return 'bg-blue-50 text-blue-700 border border-blue-200/80'
    case 'Personal':
      return 'bg-emerald-50 text-emerald-700 border border-emerald-200/80'
    case 'Learning':
      return 'bg-purple-50 text-purple-700 border border-purple-200/80'
    default:
      return 'bg-slate-100 text-slate-700 border border-slate-200'
  }
}
</script>

<template>
  <div class="min-h-screen bg-[#9eaab7] py-8 px-4 sm:px-6 lg:px-8 font-sans antialiased text-slate-800">
    <div class="max-w-5xl mx-auto">
      <!-- Bento Grid Container: 2fr 1fr desktop, stacking mobile -->
      <main class="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-5 items-start">
        
        <!-- LEFT COLUMN (2fr desktop): Header + Input & Combined Tasks List -->
        <div class="flex flex-col gap-5">
          
          <!-- Top-Left Card: Header + Input + Tambah Button -->
          <section class="rounded-2xl bg-[#f1f4f8] p-6 shadow-sm border border-slate-200/60">
            <h1 class="text-xl font-bold text-slate-900 mb-4">Taskify Vue - Dashboard</h1>
            <form @submit.prevent="openAddModal(inputTask)" class="flex gap-3">
              <input
                v-model="inputTask"
                type="text"
                placeholder="Masukkan tugas baru..."
                aria-label="Tugas baru"
                class="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent transition"
              />
              <button
                type="submit"
                class="rounded-lg bg-[#4f5b66] hover:bg-[#3d4750] px-6 py-2.5 text-sm font-medium text-white transition cursor-pointer shadow-sm active:scale-95"
              >
                Tambah
              </button>
            </form>
          </section>

          <!-- Active Tasks Card (Tasks pending completion) -->
          <section class="rounded-2xl bg-[#f1f4f8] p-6 shadow-sm border border-slate-200/60">
            <div class="flex items-center justify-between mb-3">
              <div class="flex items-center gap-2">
                <h2 class="text-lg font-bold text-slate-900">Active Tasks</h2>
                <span v-if="activeTasks.length > 0" class="text-xs font-semibold text-blue-700 bg-blue-100 px-2.5 py-0.5 rounded-full">
                  {{ activeTasks.length }} aktif
                </span>
              </div>
            </div>

            <!-- Active Task Items -->
            <ul v-if="activeTasks.length > 0" class="divide-y divide-slate-200/70 max-h-[300px] overflow-y-auto pr-1" v-auto-animate>
              <li
                v-for="task in activeTasks"
                :key="task.id"
                class="flex items-center justify-between py-2.5 text-sm gap-3 group"
              >
                <!-- Checkbox & Task Title -->
                <label class="flex items-center gap-3 cursor-pointer flex-1 min-w-0">
                  <input
                    type="checkbox"
                    v-model="task.status"
                    class="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer shrink-0"
                  />
                  <span class="truncate text-slate-800 font-medium">
                    {{ task.title }}
                  </span>
                </label>

                <!-- Metadata Badges (Due Date & Categories) & Delete Action -->
                <div class="flex items-center gap-1.5 shrink-0">
                  <!-- Due Date Badge -->
                  <span
                    v-if="task.dueDate"
                    class="inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200/80"
                  >
                    📅 {{ task.dueDate }}
                  </span>

                  <!-- Category Badges -->
                  <span
                    v-for="cat in (Array.isArray(task.category) ? task.category : [task.category])"
                    :key="cat"
                    class="inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-md"
                    :class="categoryBadgeClass(cat)"
                  >
                    {{ cat }}
                  </span>

                  <!-- Delete Button -->
                  <button
                    type="button"
                    @click="deleteTask(task.id)"
                    class="inline-flex items-center gap-1 text-red-600 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded-md text-xs font-medium transition cursor-pointer"
                    title="Hapus tugas"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    <span>Hapus</span>
                  </button>
                </div>
              </li>
            </ul>

            <!-- Empty State -->
            <div v-else class="text-center py-6">
              <p class="text-sm text-slate-400 italic">Tidak ada tugas aktif. Masukkan tugas baru di atas untuk memulai.</p>
            </div>
          </section>

          <!-- New Section: Completed Tasks (Where completed tasks move, can be removed later) -->
          <section class="rounded-2xl bg-[#f1f4f8] p-6 shadow-sm border border-slate-200/60">
            <div class="flex items-center justify-between mb-3">
              <div class="flex items-center gap-2">
                <h2 class="text-lg font-bold text-slate-900">Completed Tasks</h2>
                <span v-if="completedTasks.length > 0" class="text-xs font-semibold text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full">
                  {{ completedTasks.length }} selesai
                </span>
              </div>

              <!-- Clear all completed button -->
              <button
                v-if="completedTasks.length > 0"
                type="button"
                @click="clearCompletedTasks"
                class="text-xs font-semibold text-red-600 hover:text-red-700 hover:bg-red-50 px-2.5 py-1 rounded-lg transition cursor-pointer"
                title="Hapus semua tugas selesai"
              >
                Hapus Semua Selesai
              </button>
            </div>

            <!-- Completed Task Items -->
            <ul v-if="completedTasks.length > 0" class="divide-y divide-slate-200/70 max-h-[300px] overflow-y-auto pr-1" v-auto-animate>
              <li
                v-for="task in completedTasks"
                :key="task.id"
                class="flex items-center justify-between py-2.5 text-sm gap-3 group opacity-85 hover:opacity-100 transition-opacity"
              >
                <!-- Checkbox (Checked) & Task Title with line-through -->
                <label class="flex items-center gap-3 cursor-pointer flex-1 min-w-0">
                  <input
                    type="checkbox"
                    v-model="task.status"
                    class="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer shrink-0"
                  />
                  <span class="truncate line-through text-slate-500 font-normal">
                    {{ task.title }}
                  </span>
                </label>

                <!-- Metadata Badges & Delete Button -->
                <div class="flex items-center gap-1.5 shrink-0">
                  <!-- Due Date Badge -->
                  <span
                    v-if="task.dueDate"
                    class="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-md bg-slate-200/60 text-slate-500 line-through"
                  >
                    📅 {{ task.dueDate }}
                  </span>

                  <!-- Category Badges -->
                  <span
                    v-for="cat in (Array.isArray(task.category) ? task.category : [task.category])"
                    :key="cat"
                    class="inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-md"
                    :class="categoryBadgeClass(cat)"
                  >
                    {{ cat }}
                  </span>

                  <!-- Delete Button to remove completed task -->
                  <button
                    type="button"
                    @click="deleteTask(task.id)"
                    class="inline-flex items-center gap-1 text-red-600 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded-md text-xs font-medium transition cursor-pointer"
                    title="Hapus tugas ini"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    <span>Hapus</span>
                  </button>
                </div>
              </li>
            </ul>

            <!-- Empty State -->
            <div v-else class="text-center py-6">
              <p class="text-sm text-slate-400 italic">Belum ada tugas yang selesai. Centang tugas di atas saat selesai.</p>
            </div>
          </section>

        </div>

        <!-- RIGHT COLUMN (1fr desktop): Quick Stats & Categories -->
        <div class="flex flex-col gap-5">
          
          <!-- Top-Right Card: Quick Stats completion ring & active/completed counts -->
          <section class="rounded-2xl bg-[#f1f4f8] p-6 shadow-sm border border-slate-200/60 flex flex-col items-center">
            <h2 class="text-lg font-bold text-slate-900 self-start mb-2">Quick Stats</h2>
            
            <!-- Completion Donut Ring -->
            <div class="relative flex items-center justify-center my-1">
              <svg class="w-24 h-24 transform -rotate-90" viewBox="0 0 100 100">
                <!-- Background track circle -->
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  stroke="#e2e8f0"
                  stroke-width="12"
                  fill="transparent"
                />
                <!-- Animated completion circle -->
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  stroke="#3b82f6"
                  stroke-width="12"
                  stroke-linecap="round"
                  fill="transparent"
                  :stroke-dasharray="ringCircumference"
                  :stroke-dashoffset="ringOffset"
                  class="transition-all duration-700 ease-out"
                />
              </svg>
            </div>

            <!-- Completion label -->
            <p class="text-xs text-slate-600 font-medium mt-1">Completion: {{ completionRate }}%</p>

            <!-- Active / Completed counts -->
            <div class="grid grid-cols-2 w-full mt-4 text-center">
              <div>
                <p class="text-xs text-slate-500 font-medium">Active:</p>
                <p class="text-3xl font-bold text-slate-900 leading-tight mt-1">{{ activeCount }}</p>
              </div>
              <div>
                <p class="text-xs text-slate-500 font-medium">Completed:</p>
                <p class="text-3xl font-bold text-slate-900 leading-tight mt-1">{{ completedCount }}</p>
              </div>
            </div>
          </section>

          <!-- Bottom-Right Card: Categories Progress Bars -->
          <section class="rounded-2xl bg-[#f1f4f8] p-6 shadow-sm border border-slate-200/60">
            <h2 class="text-lg font-bold text-slate-900 mb-4">Categories</h2>
            
            <div class="space-y-4">
              <!-- Work Category -->
              <div>
                <div class="flex justify-between text-sm font-semibold text-slate-900 mb-1.5">
                  <span>Work ({{ workPercentage }}%)</span>
                </div>
                <div class="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                  <div
                    class="bg-blue-600 h-2 rounded-full transition-all duration-500 ease-out"
                    :style="{ width: workPercentage + '%' }"
                  ></div>
                </div>
              </div>

              <!-- Personal Category -->
              <div>
                <div class="flex justify-between text-sm font-semibold text-slate-900 mb-1.5">
                  <span>Personal ({{ personalPercentage }}%)</span>
                </div>
                <div class="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                  <div
                    class="bg-blue-600 h-2 rounded-full transition-all duration-500 ease-out"
                    :style="{ width: personalPercentage + '%' }"
                  ></div>
                </div>
              </div>

              <!-- Learning Category -->
              <div>
                <div class="flex justify-between text-sm font-semibold text-slate-900 mb-1.5">
                  <span>Learning ({{ learningPercentage }}%)</span>
                </div>
                <div class="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                  <div
                    class="bg-blue-600 h-2 rounded-full transition-all duration-500 ease-out"
                    :style="{ width: learningPercentage + '%' }"
                  ></div>
                </div>
              </div>
            </div>
          </section>

        </div>

      </main>
    </div>

    <!-- Pop-up Modal: Set Due Date & Category Checkboxes -->
    <teleport to="body">
      <transition
        enter-active-class="transition duration-200 ease-out"
        enter-from-class="opacity-0 scale-95"
        enter-to-class="opacity-100 scale-100"
        leave-active-class="transition duration-150 ease-in"
        leave-from-class="opacity-100 scale-100"
        leave-to-class="opacity-0 scale-95"
      >
        <div
          v-if="isModalOpen"
          class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs"
          @click.self="closeModal"
          @keydown.esc="closeModal"
        >
          <div
            class="bg-white rounded-2xl p-6 shadow-2xl max-w-md w-full border border-slate-200 font-sans"
            role="dialog"
            aria-modal="true"
          >
            <div class="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 class="text-lg font-bold text-slate-900">Detail Tugas Baru</h3>
              <button
                type="button"
                @click="closeModal"
                class="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition cursor-pointer text-sm"
              >
                ✕
              </button>
            </div>

            <form @submit.prevent="confirmAddTask" class="mt-4 space-y-4">
              <!-- Task Title -->
              <div>
                <label class="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                  Nama Tugas
                </label>
                <input
                  v-model="pendingTitle"
                  type="text"
                  required
                  class="w-full rounded-lg border border-slate-300 bg-slate-50/50 px-3.5 py-2 text-sm text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-slate-400 focus:bg-white transition"
                />
              </div>

              <!-- Due Date with Date Picker -->
              <div>
                <div class="flex items-center justify-between mb-1.5">
                  <label class="block text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Tanggal Tenggat (Date Picker)
                  </label>
                  <button
                    v-if="pendingDateIso || pendingDueDate"
                    type="button"
                    @click="clearDate"
                    class="text-xs text-red-500 hover:text-red-700 font-medium cursor-pointer"
                  >
                    Hapus Tanggal
                  </button>
                </div>

                <!-- Date Picker Input -->
                <div class="relative">
                  <input
                    ref="dueDateInputRef"
                    v-model="pendingDateIso"
                    @change="onDateIsoChange"
                    type="date"
                    class="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400 cursor-pointer shadow-2xs"
                  />
                </div>

                <!-- Selected Date Preview & Quick Shortcuts -->
                <div class="flex flex-wrap items-center justify-between gap-2 mt-2">
                  <div class="flex items-center gap-1.5">
                    <span class="text-xs text-slate-400">Pilihan cepat:</span>
                    <button
                      type="button"
                      @click="setQuickDate('today')"
                      class="text-xs px-2 py-0.5 rounded-md border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                    >
                      Hari Ini
                    </button>
                    <button
                      type="button"
                      @click="setQuickDate('tomorrow')"
                      class="text-xs px-2 py-0.5 rounded-md border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                    >
                      Besok
                    </button>
                    <button
                      type="button"
                      @click="setQuickDate('next-week')"
                      class="text-xs px-2 py-0.5 rounded-md border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                    >
                      Minggu Depan
                    </button>
                  </div>

                  <span v-if="pendingDueDate" class="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200/60">
                    📅 {{ pendingDueDate }}
                  </span>
                </div>
              </div>

              <!-- Category Selection with Checkboxes -->
              <div>
                <label class="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
                  Pilih Kategori (Work, Personal, Learning)
                </label>
                <div class="grid grid-cols-3 gap-2.5">
                  <label
                    v-for="cat in ['Work', 'Personal', 'Learning']"
                    :key="cat"
                    class="flex items-center justify-center gap-2 p-2.5 rounded-xl border cursor-pointer text-sm font-medium transition select-none"
                    :class="pendingCategories.includes(cat)
                      ? 'bg-blue-50 border-blue-400 text-blue-700 font-semibold shadow-xs'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-800'"
                  >
                    <input
                      type="checkbox"
                      :value="cat"
                      v-model="pendingCategories"
                      class="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                    <span>{{ cat }}</span>
                  </label>
                </div>
              </div>

              <!-- Action Buttons -->
              <div class="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  @click="closeModal"
                  class="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  class="px-5 py-2 text-sm font-semibold text-white bg-[#4f5b66] hover:bg-[#3d4750] rounded-lg shadow-sm transition cursor-pointer active:scale-95"
                >
                  Simpan Tugas
                </button>
              </div>
            </form>
          </div>
        </div>
      </transition>
    </teleport>
  </div>
</template>
