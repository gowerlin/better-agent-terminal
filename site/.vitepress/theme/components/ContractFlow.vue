<script setup lang="ts">
// /cases R1：BAT 定契約 → 委派 → Control Tower 照契約 → 版本對照表。
// 沿用 Hero 雷達的線條語彙（同心圓 + 十字線 + 塔台圓點），但跟著頁面維持淺色。
// 紫色只給塔台發出的東西（錨點 A1）：兩個塔台的圓點與「委派單」那一段。靜態，不做動畫。
const SCOPES = [
  { cy: 50, name: 'BAT 的塔台', what: '先把介面定成契約' },
  { cy: 330, name: 'Control Tower 的塔台', what: '照契約更新流程' }
]
const RINGS = [42, 28, 14]
</script>

<template>
  <figure class="contract-flow">
    <svg viewBox="0 0 300 512" class="cf-svg" aria-hidden="true">
      <defs>
        <marker id="cf-arrow-signal" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" class="cf-head is-signal" />
        </marker>
        <marker id="cf-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" class="cf-head" />
        </marker>
      </defs>

      <g v-for="s in SCOPES" :key="s.name">
        <circle v-for="r in RINGS" :key="r" cx="150" :cy="s.cy" :r="r" class="cf-ring" :class="{ 'is-outer': r === RINGS[0] }" />
        <line :x1="150 - RINGS[0]" :y1="s.cy" :x2="150 + RINGS[0]" :y2="s.cy" class="cf-ring" />
        <line x1="150" :y1="s.cy - RINGS[0]" x2="150" :y2="s.cy + RINGS[0]" class="cf-ring" />
        <circle cx="150" :cy="s.cy" r="6" class="cf-tower" />
        <text x="150" :y="s.cy + 64" class="cf-name">{{ s.name }}</text>
        <text x="150" :y="s.cy + 83" class="cf-what">{{ s.what }}</text>
      </g>

      <line x1="150" y1="144" x2="150" y2="168" class="cf-link is-signal" marker-end="url(#cf-arrow-signal)" />
      <text x="162" y="161" class="cf-tag is-signal">委派單</text>

      <rect x="70" y="174" width="160" height="80" rx="8" class="cf-doc" />
      <text x="150" y="197" class="cf-doc-title">介面契約</text>
      <text x="110" y="221" class="cf-doc-item">參數</text>
      <text x="190" y="221" class="cf-doc-item">結束代碼</text>
      <text x="110" y="242" class="cf-doc-item">環境變數</text>
      <text x="190" y="242" class="cf-doc-item">回傳欄位</text>

      <line x1="150" y1="258" x2="150" y2="282" class="cf-link" marker-end="url(#cf-arrow)" />
      <text x="162" y="275" class="cf-tag">只看結束代碼</text>

      <line x1="150" y1="424" x2="150" y2="448" class="cf-link is-dashed" marker-end="url(#cf-arrow)" />

      <rect x="40" y="454" width="220" height="54" rx="8" class="cf-table" />
      <text x="150" y="477" class="cf-doc-title">版本對照表</text>
      <text x="150" y="497" class="cf-what">兩邊的版本都到位才啟用</text>
    </svg>
    <figcaption class="sr-only">
      圖：BAT 的塔台先把介面定成契約，內容是參數、結束代碼、環境變數和回傳欄位，寫成委派單交給 Control Tower 的塔台；
      Control Tower 照契約更新流程，只看結束代碼判斷成敗。兩邊需要的版本記在版本對照表，兩邊都到位才啟用。
    </figcaption>
  </figure>
</template>
