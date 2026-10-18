<script setup lang="ts">
// /remote/ 的示意圖：BAT 視窗留在你的電腦，Agent 在遠端環境執行，中間是一條加密連線。
// 沿用 ContractFlow 的雷達線條（同心圓 + 十字線），跟著頁面深淺色。這裡沒有塔台，所以不用紫色（錨點 A1）。
// 桌面是左右排，窄螢幕改上下排（兩張 SVG 擇一顯示，共用同一段文字說明）。靜態，不做動畫。
const TARGETS = [
  { name: 'WSL 發行版', what: '同一台 Windows 裡的 Linux' },
  { name: 'SSH 主機', what: '另一台 Linux 或 macOS' },
  { name: 'Docker 容器', what: '本機 Docker 裡的 Linux 容器' }
]
const RINGS = [64, 42, 20]
// 左右排：目標框的上緣 y
const WIDE_Y = [28, 128, 228]
// 上下排：目標框的上緣 y
const TALL_Y = [300, 386, 472]
</script>

<template>
  <figure class="remote-bridge">
    <svg viewBox="0 0 680 330" class="rb-svg is-wide" aria-hidden="true">
      <circle v-for="r in RINGS" :key="r" cx="120" cy="140" :r="r" class="rb-ring" :class="{ 'is-outer': r === RINGS[0] }" />
      <line :x1="120 - RINGS[0]" y1="140" :x2="120 + RINGS[0]" y2="140" class="rb-ring" />
      <line x1="120" :y1="140 - RINGS[0]" x2="120" :y2="140 + RINGS[0]" class="rb-ring" />
      <rect x="92" y="126" width="56" height="28" rx="6" class="rb-bat" />
      <text x="120" y="145" class="rb-bat-label">BAT</text>
      <text x="120" y="236" class="rb-name">你的電腦</text>
      <text x="120" y="258" class="rb-what">BAT 的視窗與分頁</text>

      <line x1="184" y1="140" x2="300" y2="140" class="rb-link" />
      <text x="242" y="124" class="rb-tag">加密連線</text>
      <text x="242" y="166" class="rb-tag is-muted">核對憑證指紋</text>
      <path
        v-for="(y, i) in WIDE_Y"
        :key="'w' + i"
        :d="`M300 140 C 330 140, 330 ${y + 36}, 360 ${y + 36} L 400 ${y + 36}`"
        class="rb-link"
      />
      <circle cx="300" cy="140" r="4" class="rb-joint" />

      <g v-for="(t, i) in TARGETS" :key="'wt' + i">
        <rect x="400" :y="WIDE_Y[i]" width="260" height="72" rx="10" class="rb-target" />
        <text x="420" :y="WIDE_Y[i] + 30" class="rb-target-name">{{ t.name }}</text>
        <text x="420" :y="WIDE_Y[i] + 54" class="rb-what is-left">{{ t.what }}</text>
        <rect x="604" :y="WIDE_Y[i] + 16" width="40" height="40" rx="6" class="rb-server" />
        <text x="624" :y="WIDE_Y[i] + 41" class="rb-server-label">&gt;_</text>
      </g>
      <text x="530" y="322" class="rb-what">三種都執行同一個 BAT 伺服器，Agent 在這裡執行</text>
    </svg>

    <svg viewBox="0 0 300 568" class="rb-svg is-tall" aria-hidden="true">
      <circle v-for="r in RINGS" :key="r" cx="150" cy="78" :r="r" class="rb-ring" :class="{ 'is-outer': r === RINGS[0] }" />
      <line :x1="150 - RINGS[0]" y1="78" :x2="150 + RINGS[0]" y2="78" class="rb-ring" />
      <line x1="150" :y1="78 - RINGS[0]" x2="150" :y2="78 + RINGS[0]" class="rb-ring" />
      <rect x="122" y="64" width="56" height="28" rx="6" class="rb-bat" />
      <text x="150" y="83" class="rb-bat-label">BAT</text>
      <text x="150" y="168" class="rb-name">你的電腦</text>
      <text x="150" y="190" class="rb-what">BAT 的視窗與分頁</text>

      <line x1="150" y1="204" x2="150" y2="282" class="rb-link" />
      <text x="162" y="236" class="rb-tag is-left">加密連線</text>
      <text x="162" y="258" class="rb-tag is-muted is-left">核對憑證指紋</text>
      <circle cx="150" cy="282" r="4" class="rb-joint" />
      <path
        v-for="(y, i) in TALL_Y"
        :key="'t' + i"
        :d="`M150 282 L 24 282 L 24 ${y + 36} L 30 ${y + 36}`"
        class="rb-link"
      />

      <g v-for="(t, i) in TARGETS" :key="'tt' + i">
        <rect x="30" :y="TALL_Y[i]" width="250" height="72" rx="10" class="rb-target" />
        <text x="46" :y="TALL_Y[i] + 30" class="rb-target-name">{{ t.name }}</text>
        <text x="46" :y="TALL_Y[i] + 54" class="rb-what is-left">{{ t.what }}</text>
        <rect x="228" :y="TALL_Y[i] + 16" width="40" height="40" rx="6" class="rb-server" />
        <text x="248" :y="TALL_Y[i] + 41" class="rb-server-label">&gt;_</text>
      </g>
    </svg>

    <figcaption class="sr-only">
      圖：BAT 的視窗與分頁留在你的電腦上，透過一條加密連線接到遠端環境，連線時核對憑證指紋。
      遠端環境可以是同一台 Windows 裡的 WSL 發行版、另一台 Linux 或 macOS 的 SSH 主機，或本機 Docker 裡的 Linux 容器；
      每一種都執行同一個 BAT 伺服器，Agent 與 shell 在那裡執行。
    </figcaption>
  </figure>
</template>
