<script setup lang="ts">
import { computed } from 'vue'
import { withBase } from 'vitepress'

interface Feature {
  title: string
  body: string
  // 卡片底下的一句註腳（例：BAT 自己就是這樣用）
  note?: string
  // 標題連到的頁面段落（站內路徑，不含 base）
  link?: string
  // 'you'：這一格講的是「你要做的事」，框線用「你 = 藍」
  tone?: 'you'
}

type FeatureSet = 'standalone' | 'learning' | 'messy' | 'loads'

const props = withDefaults(defineProps<{ set?: FeatureSet }>(), { set: 'standalone' })

// 首頁「不用 Control Tower，BAT 也好用」：每一格連到 /features 的對應段落（錨點固定）
const STANDALONE: Feature[] = [
  {
    title: '多工作區與獨立視窗',
    body: '每個專案一個工作區，各有自己的終端機、環境變數與預設 Agent；可以把工作區拉出成獨立視窗，重開後自動還原。',
    link: '/features#workspaces'
  },
  {
    title: 'Claude Code 面板與狀態列',
    body: '結構化事件、權限確認與對話續接；狀態列顯示模型、Token、快取與費用，項目與顏色都能自訂。',
    link: '/features#agents'
  },
  {
    title: '遠端 WSL、SSH、Docker',
    body: '在同一個 BAT 視窗裡驅動 WSL、Docker 與 SSH 主機上的 Agent，設定精靈一路帶你裝好、連上、驗證憑證。',
    link: '/features#remote-dev'
  },
  {
    title: '檔案瀏覽器與 Git 檢視',
    body: '不離開 BAT 就能瀏覽檔案、看 Git 變更；終端機裡的檔案路徑與網址可以直接點開。',
    link: '/features#files-git'
  },
  {
    title: 'Snippet 與語音輸入',
    body: '常用指令存成 Snippet 一鍵插入；也可以用語音輸入提示詞。',
    link: '/features#snippets-voice'
  },
  {
    title: '用量限制自動繼續',
    body: '設定裡打開後，撞到 5 小時用量限制的 yolo 分頁會在解鎖後繼續；預設關閉。',
    link: '/features#usage-limit'
  }
]

// 首頁「越用越懂你的專案」
const LEARNING: Feature[] = [
  {
    title: '說一次，之後每張工單都記得',
    body: '團隊規矩只要跟塔台說一次，例如 API 一律用 POST、review 固定檢查哪幾項。之後派出的每張工單都會帶上相關提醒，不必每開一個 Agent 就重講一遍。'
  },
  {
    title: '教戰手冊：什麼情境用什麼做法',
    body: '規定清單只說規定是什麼；教戰手冊還寫出為什麼這樣做、遇到哪種情況選哪個、哪個檔案就是範例。Worker 照著判斷，寫出來的程式就跟團隊手寫的一致。'
  },
  {
    title: '從程式碼抽出視覺規範',
    body: '讓 Worker 掃描你的樣式設定，整理出色彩、字體、間距和元件樣式，寫成 Agent 讀得懂的視覺規範。之後做畫面的工單都照它走，每個 Agent 做出的頁面不再各是各的顏色。',
    note: '這個網站的設計語言，就是這樣從 BAT 的程式碼抽出來的。'
  }
]

// /control-tower「現實比計劃更混亂時」：有對應案例的格子連到 /cases（「卡住就停」沒有案例，不連）
const MESSY: Feature[] = [
  {
    title: '臨時插隊，原本的工作不會丟',
    body: '規劃到一半，正式站出事了。直接跟塔台說：它先把手上的規劃標成暫停，替緊急事件開一張優先工單，處理完再從暫停的地方接回來。進度存在檔案裡，不是只存在對話裡；已經派出的 Worker 分頁照常執行。',
    link: '/cases#urgent-fix'
  },
  {
    title: '卡住就停，帶著整理好的紀錄回來',
    body: '同一個問題換了三種做法還沒解決（次數可以調整，預設三次），Worker 就停手，不在越來越亂的脈絡裡繞圈。它整理出原始問題、試過什麼、各自為什麼失敗、需要塔台決定什麼，再把工單標成需要協助，交回塔台換個角度重新派工。'
  },
  {
    title: '問題一層一層冒出來時，一層一張工單',
    body: '修好設定檔，服務起來後又冒出另一個錯，接著建置流程也失敗了。還在同一層，就在同一張工單裡繼續；換了一層，Worker 先回報部分完成，由塔台另開一張乾淨的工單。本機能驗證的先在本機做完，需要遠端環境的另外開單。',
    link: '/cases#merge-layers'
  },
  {
    title: '兩邊都要改時，先寫契約，不要照抄',
    body: '一個欄位改名，牽動兩個服務。先寫一份共用契約，列出哪些必須一致、哪些可以各自不同；兩邊各自照契約實作，最後再派一張工單比對兩邊的結果。不要做完一邊，再叫 Agent 照著抄另一邊。',
    link: '/cases#shared-field'
  }
]

// 首頁「把腦力留給判斷」：三種負擔，三種處理（細節在 /why#three-loads）
const LOADS: Feature[] = [
  {
    title: '雜事：BAT 拿掉',
    body: '開分頁、送指令、確認 Agent 真的啟動、標出誰在等誰、把回報送回塔台、收單後回收分頁，都不用你動手。'
  },
  {
    title: '難度：工單切小',
    body: '每張工單寫清楚範圍。Worker 一次做一張，你一次審一張。'
  },
  {
    title: '判斷：留給你',
    body: '範圍要擴大、不可逆的操作、對外發布、需要你的偏好、連續失敗，一定停下來問你。',
    tone: 'you'
  }
]

const SETS: Record<FeatureSet, Feature[]> = { standalone: STANDALONE, learning: LEARNING, messy: MESSY, loads: LOADS }

const features = computed(() => SETS[props.set])
</script>

<template>
  <ul class="features" :class="`is-${set}`">
    <li v-for="f in features" :key="f.title" class="feature" :class="{ 'is-you': f.tone === 'you' }">
      <h3 class="feature-title">
        <a v-if="f.link" :href="withBase(f.link)">{{ f.title }}</a>
        <template v-else>{{ f.title }}</template>
      </h3>
      <p class="feature-body">{{ f.body }}</p>
      <p v-if="f.note" class="feature-note">{{ f.note }}</p>
    </li>
  </ul>
</template>
