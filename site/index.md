---
layout: home

hero:
  name: Better Agent Terminal
  text: 跨平台終端機聚合器
  tagline: 在同一個視窗管理多個專案的終端機，內建 Claude Code、Gemini CLI、GitHub Copilot CLI、Codex CLI 與自訂 CLI Agent。
  image:
    src: /logo.svg
    alt: Better Agent Terminal
  actions:
    - theme: brand
      text: 下載最新版
      link: '#download'
    - theme: alt
      text: GitHub
      link: https://github.com/gowerlin/better-agent-terminal

features:
  - icon: 🖥️
    title: 多工作區
    details: 每個專案一個工作區，各自擁有終端機、Agent 對話、環境變數與預設 Agent；可拖放排序、分組、封存，也能把工作區拉出成獨立視窗，重開後自動還原。
  - icon: 🤖
    title: 內建 Agent 面板
    details: Claude Code 面板提供結構化事件、權限確認與對話續接，旁邊就是持久的終端機分頁；搭配狀態列即時顯示模型、Token、快取與費用。
  - icon: 🛰️
    title: 與 Control Tower 協作
    details: BMad Control Tower 是以檔案驅動的多 Agent 開發流程：一個分頁當塔台負責開單、派工與決策，其他分頁當 Worker 執行工單並回報。BAT 提供派工、回報、分頁回收與狀態查詢這些基礎設施。
---

<!-- TODO(W3): 主畫面截圖 / 派工短片 -->

## 下載 {#download}

<DownloadLinks />

macOS 版只支援 Apple Silicon（arm64）。安裝步驟與首次執行的注意事項見[安裝](./install)。
