<script setup lang="ts">
interface Feature {
  title: string
  body: string
}

// TODO(W2b): 每一格連到 /features 的對應段落（頁面在 W2b 才建立）
const FEATURES: Feature[] = [
  {
    title: '多工作區與獨立視窗',
    body: '每個專案一個工作區，各有自己的終端機、環境變數與預設 Agent；可以把工作區拉出成獨立視窗，重開後自動還原。'
  },
  {
    title: 'Claude Code 面板與狀態列',
    body: '結構化事件、權限確認與對話續接；狀態列顯示模型、Token、快取與費用，項目與顏色都能自訂。'
  },
  {
    title: '遠端 WSL、SSH、Docker',
    body: '在同一個 BAT 視窗裡驅動 WSL、Docker 與 SSH 主機上的 Agent，設定精靈一路帶你裝好、連上、驗證憑證。'
  },
  {
    title: '檔案瀏覽器與 Git 檢視',
    body: '不離開 BAT 就能瀏覽檔案、看 Git 變更；終端機裡的檔案路徑與網址可以直接點開。'
  },
  {
    title: 'Snippet 與語音輸入',
    body: '常用指令存成 Snippet 一鍵插入；也可以用語音輸入提示詞。'
  },
  {
    title: '用量限制自動繼續',
    body: '設定裡打開後，撞到 5 小時用量限制的 yolo 分頁會在解鎖後繼續；預設關閉。'
  }
]
</script>

<template>
  <ul class="features">
    <li v-for="f in FEATURES" :key="f.title" class="feature">
      <h3 class="feature-title">{{ f.title }}</h3>
      <p class="feature-body">{{ f.body }}</p>
    </li>
  </ul>
</template>
