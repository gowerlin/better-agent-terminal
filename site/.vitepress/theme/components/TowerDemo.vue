<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

type WorkerId = 'T1024' | 'T1025' | 'T1026'
type WorkerState = 'running' | 'blocked' | 'question' | 'reported' | 'gone'
type Tone = 'signal' | 'blocked' | 'question' | 'reported' | 'muted'

interface WorkerDef {
  id: WorkerId
  agent: string
  kind: 'claude' | 'codex'
  // 雷達上的位置：角度以 +x 為 0、順時針（螢幕座標），半徑以 viewBox 400 為準
  angle: number
  radius: number
}

interface DemoEvent {
  at: number
  worker?: WorkerId
  state?: WorkerState
  tone: Tone
  text: string
}

const SWEEP_MS = 5000
const ROUNDS = 4
const LOOP_MS = SWEEP_MS * ROUNDS
const CENTER = 200
const SCOPE_R = 184

const WORKERS: WorkerDef[] = [
  { id: 'T1024', agent: 'Claude CLI', kind: 'claude', angle: 70, radius: 150 },
  { id: 'T1025', agent: 'Codex CLI', kind: 'codex', angle: 160, radius: 146 },
  { id: 'T1026', agent: 'Claude CLI', kind: 'claude', angle: 304, radius: 140 }
]

const workerById = Object.fromEntries(WORKERS.map((w) => [w.id, w])) as Record<WorkerId, WorkerDef>

// 每個光點的狀態只在掃描線掃過它時改變；事件紀錄同時多一行
function sweptAt(round: number, id: WorkerId) {
  return round * SWEEP_MS + (workerById[id].angle / 360) * SWEEP_MS
}

const SCRIPT: Array<[number, WorkerId, WorkerState, Tone, string]> = [
  [0, 'T1024', 'running', 'signal', '派工 T1024 → Claude CLI · Worker · T1024 已啟動'],
  [0, 'T1025', 'running', 'signal', '派工 T1025 → Codex CLI · Worker · T1025 已啟動'],
  [0, 'T1026', 'running', 'signal', '派工 T1026 → Claude CLI · Worker · T1026 已啟動'],
  [1, 'T1025', 'question', 'question', 'T1025 提問：金額四捨五入還是無條件捨去？'],
  [1, 'T1026', 'blocked', 'blocked', 'T1026 停在權限確認，等你回答'],
  [2, 'T1024', 'reported', 'reported', 'T1024 完成 → 驗收 PASS → 排程回收分頁'],
  [2, 'T1025', 'running', 'signal', '塔台代決 T1025：四捨五入（依專案慣例）'],
  [2, 'T1026', 'running', 'muted', '你允許了 → T1026 繼續執行'],
  [3, 'T1024', 'gone', 'muted', 'T1024 輸出安靜 → 分頁已回收'],
  [3, 'T1025', 'reported', 'reported', 'T1025 完成 → 驗收 PASS'],
  [3, 'T1026', 'reported', 'reported', 'T1026 完成 → 驗收 PASS']
]

const EVENTS: DemoEvent[] = [
  { at: 0, tone: 'signal', text: '塔台開好三張工單，準備派工' },
  ...SCRIPT.map(([round, worker, state, tone, text]) => ({ at: sweptAt(round, worker), worker, state, tone, text }))
].sort((a, b) => a.at - b.at)

// 靜止畫面（reduced motion、SSR、還沒開始播放）：T1024 已回報、T1025 等塔台、T1026 等你
const STILL_MS = 2 * SWEEP_MS + (130 / 360) * SWEEP_MS

const STATE_WORDS: Record<Exclude<WorkerState, 'gone'>, { mark: string; words: string }> = {
  running: { mark: '', words: '執行中' },
  blocked: { mark: '⚠️', words: '在等你' },
  question: { mark: '?', words: '在等塔台答覆' },
  reported: { mark: '✓', words: '已回報' }
}

const elapsed = ref(STILL_MS)
const playing = ref(false)
const userPaused = ref(false)
const reducedMotion = ref(false)
const root = ref<HTMLElement | null>(null)

let frame = 0
let lastTick = 0
let inView = false
let observer: IntersectionObserver | null = null
let motionQuery: MediaQueryList | null = null

const loopTime = computed(() => elapsed.value % LOOP_MS)
const sweepAngle = computed(() => ((loopTime.value % SWEEP_MS) / SWEEP_MS) * 360)

const passed = computed(() => EVENTS.filter((e) => e.at <= loopTime.value))

const workerStates = computed(() => {
  const states = new Map<WorkerId, WorkerState>()
  for (const e of passed.value) {
    if (e.worker && e.state) states.set(e.worker, e.state)
  }
  return states
})

const visibleWorkers = computed(() =>
  WORKERS.filter((w) => {
    const s = workerStates.value.get(w.id)
    return s !== undefined && s !== 'gone'
  }).map((w) => {
    const state = workerStates.value.get(w.id) as Exclude<WorkerState, 'gone'>
    const rad = (w.angle * Math.PI) / 180
    const x = CENTER + w.radius * Math.cos(rad)
    const y = CENTER + w.radius * Math.sin(rad)
    // 掃描線掃過之後的餘暉：剛掃過最亮，轉 120° 後消失
    const since = (sweepAngle.value - w.angle + 360) % 360
    const glow = since < 120 ? 1 - since / 120 : 0
    return {
      ...w,
      state,
      x,
      y,
      left: (x / 400) * 100,
      top: (y / 400) * 100,
      side: x < CENTER ? 'start' : 'end',
      glow,
      ...STATE_WORDS[state]
    }
  })
)

function clockFor(ms: number) {
  // 一輪 = demo-shop 的一個早上：09:00 → 12:30
  const minutes = 9 * 60 + Math.round((ms / LOOP_MS) * 210)
  const h = String(Math.floor(minutes / 60)).padStart(2, '0')
  const m = String(minutes % 60).padStart(2, '0')
  return `${h}:${m}`
}

const logLines = computed(() =>
  passed.value.slice(-3).map((e) => ({ key: `${e.at}-${e.text}`, clock: clockFor(e.at), tone: e.tone, text: e.text }))
)

const wedges = computed(() => {
  // 幾片疊起來的扇形，越往後越淡
  const slices = 6
  const span = 7
  return Array.from({ length: slices }, (_, i) => {
    const from = -(i + 1) * span
    const to = -i * span
    const p = (deg: number) => {
      const r = (deg * Math.PI) / 180
      return `${(CENTER + SCOPE_R * Math.cos(r)).toFixed(2)} ${(CENTER + SCOPE_R * Math.sin(r)).toFixed(2)}`
    }
    return { d: `M${CENTER} ${CENTER} L${p(to)} A${SCOPE_R} ${SCOPE_R} 0 0 0 ${p(from)} Z`, opacity: 0.34 * (1 - i / slices) }
  })
})

function tick(now: number) {
  if (!playing.value) return
  if (lastTick) elapsed.value += Math.min(now - lastTick, 100)
  lastTick = now
  frame = requestAnimationFrame(tick)
}

function updatePlayback() {
  const shouldPlay = inView && !userPaused.value && !reducedMotion.value && document.visibilityState === 'visible'
  if (shouldPlay === playing.value) return
  playing.value = shouldPlay
  if (shouldPlay) {
    lastTick = 0
    frame = requestAnimationFrame(tick)
  } else {
    cancelAnimationFrame(frame)
  }
}

function togglePause() {
  userPaused.value = !userPaused.value
  updatePlayback()
}

function onMotionChange() {
  reducedMotion.value = !!motionQuery?.matches
  if (reducedMotion.value) elapsed.value = STILL_MS
  updatePlayback()
}

onMounted(() => {
  motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
  reducedMotion.value = motionQuery.matches
  motionQuery.addEventListener('change', onMotionChange)
  document.addEventListener('visibilitychange', updatePlayback)
  observer = new IntersectionObserver(
    (entries) => {
      inView = entries.some((e) => e.isIntersecting)
      updatePlayback()
    },
    { threshold: 0.15 }
  )
  if (root.value) observer.observe(root.value)
})

onBeforeUnmount(() => {
  cancelAnimationFrame(frame)
  observer?.disconnect()
  motionQuery?.removeEventListener('change', onMotionChange)
  document.removeEventListener('visibilitychange', updatePlayback)
})
</script>

<template>
  <figure ref="root" class="tower-demo" aria-labelledby="tower-demo-desc">
    <figcaption id="tower-demo-desc" class="sr-only">
      BAT 視窗示意：分頁列有塔台分頁「Claude CLI · Tower」與三個 Worker 分頁（T1024、T1025、T1026）。
      雷達幕的圓心是塔台，三個光點是 Worker。塔台派工後分頁出現；T1025 提問時標「?」在等塔台答覆，
      塔台依專案慣例代為回答；T1026 停在權限確認時標「⚠️」在等你；完成後標「✓」已回報，
      驗收通過的分頁在輸出安靜後回收。下方的事件紀錄依序列出這些事件。
    </figcaption>

    <div class="td-window" aria-hidden="true">
      <div class="td-body">
        <div class="td-tabs">
          <span class="td-tab is-tower">
            <span class="td-agent is-claude">▶</span>
            <span>Claude CLI · Tower</span>
          </span>
          <TransitionGroup name="td-tab">
            <span v-for="w in visibleWorkers" :key="w.id" class="td-tab" :class="`is-${w.state}`">
              <span class="td-agent" :class="`is-${w.kind}`">▶</span>
              <span class="td-tab-name">
                <span class="td-tab-prefix">{{ w.agent }} · Worker ·</span>
                <span class="td-tab-id">{{ w.id }}</span>
              </span>
              <span v-if="w.mark" class="td-tab-mark">{{ w.mark }}</span>
            </span>
          </TransitionGroup>
        </div>

        <div class="td-scope">
          <svg viewBox="0 0 400 400" class="td-scope-svg">
            <circle :cx="CENTER" :cy="CENTER" :r="SCOPE_R" class="td-ring is-outer" />
            <circle :cx="CENTER" :cy="CENTER" :r="SCOPE_R * 0.75" class="td-ring" />
            <circle :cx="CENTER" :cy="CENTER" :r="SCOPE_R * 0.5" class="td-ring" />
            <circle :cx="CENTER" :cy="CENTER" :r="SCOPE_R * 0.25" class="td-ring" />
            <line :x1="CENTER - SCOPE_R" :y1="CENTER" :x2="CENTER + SCOPE_R" :y2="CENTER" class="td-ring" />
            <line :x1="CENTER" :y1="CENTER - SCOPE_R" :x2="CENTER" :y2="CENTER + SCOPE_R" class="td-ring" />
            <g :transform="`rotate(${sweepAngle.toFixed(2)} ${CENTER} ${CENTER})`">
              <path v-for="(w, i) in wedges" :key="i" :d="w.d" class="td-wedge" :fill-opacity="w.opacity" />
              <line :x1="CENTER" :y1="CENTER" :x2="CENTER + SCOPE_R" :y2="CENTER" class="td-sweep" />
            </g>
            <g v-for="w in visibleWorkers" :key="w.id" :class="`td-blip is-${w.state}`">
              <circle :cx="w.x" :cy="w.y" r="14" class="td-blip-halo" :fill-opacity="(0.35 * w.glow).toFixed(3)" />
              <circle :cx="w.x" :cy="w.y" r="5" class="td-blip-dot" />
            </g>
            <circle :cx="CENTER" :cy="CENTER" r="7" class="td-tower-dot" />
          </svg>
          <span class="td-tower-label">Tower</span>
          <span
            v-for="w in visibleWorkers"
            :key="w.id"
            class="td-label"
            :class="[`is-${w.state}`, `is-${w.side}`]"
            :style="{ left: `${w.left}%`, top: `${w.top}%` }"
          >
            <span v-if="w.mark" class="td-label-mark">{{ w.mark }}</span>
            <span class="td-label-id">{{ w.id }}</span>
            <span>{{ w.words }}</span>
          </span>
        </div>
      </div>

      <ol class="td-log">
        <li v-for="line in logLines" :key="line.key" :class="`is-${line.tone}`">
          <span class="td-log-clock">{{ line.clock }}</span>
          <span class="td-log-text">{{ line.text }}</span>
        </li>
      </ol>
    </div>

    <div class="td-controls">
      <button v-if="!reducedMotion" type="button" class="td-pause" :aria-pressed="userPaused" @click="togglePause">
        {{ userPaused ? '繼續播放' : '暫停動畫' }}
      </button>
      <span v-else class="td-still-note">已依你的系統設定停止動畫</span>
    </div>
  </figure>
</template>
