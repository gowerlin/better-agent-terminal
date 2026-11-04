---
schema_version: 1
schema_kind: plan
id: PLAN-064
title: "Linux：介面語言是中文而系統沒有中文字型時，啟動提示一次並附安裝指令"
status: IDEA
priority: low
created_at: "2026-11-04T08:45:47+0800"
links:
  source: "使用者 2026-11-04 WSL（Ubuntu 24.04，WSLg）執行 AppImage，介面中文與圖示顯示為方框；塔台實測 `fc-list :lang=zh` = 0、emoji 字型 = 0；D270"
  related: [T0826, T0797, T0802, D270]
---

# PLAN-064 — Linux 缺中文字型時的啟動提示

## 動機

- Linux 版 BAT（Chromium）只用該系統的 fontconfig 字型；WSL 與精簡安裝的發行版預設沒有中文與 emoji 字型，zh-TW 介面整片變成方框，使用者看不懂設定與按鈕，也不知道原因（2026-11-04 使用者回報，D270）。
- 文件說明由 T0826 處理；本 PLAN 記錄「BAT 自己發現並提示」的做法，先放 IDEA。

## 方向（未研究）

- 只在 Linux、介面語言為中文（zh-TW / zh-CN 等 CJK）時檢查；其他平台與語言不做任何事。
- 檢查方式比照語音可用性檢查（T0802）：app ready 後背景以 `execFile('fc-list', [':lang=zh', 'family'])` ＋ timeout，`fc-list` 不存在或逾時視為「未知」、不提示；結果只在記憶體。emoji 字型可另查 `fc-list | grep -i emoji` 類條件（只提示、不擋任何功能）。
- 提示：一次性 toast / 通知，文字要能在缺字型時仍可讀 → 提示本身用英文（或中英並列，英文在前），附 `sudo apt install fonts-noto-cjk fonts-noto-color-emoji`；可「不再提示」。
- 不自帶字型（D270：Noto Sans CJK 每個字重約 16–20 MB，終端等寬字型另需處理，安裝檔變大）。
- 遠端視窗（WSL / SSH headless）介面在本機渲染，不受影響；只看本機 Linux。

## 觸發條件

- 再有使用者回報同樣問題，或 Linux 使用者增加時。

## 狀態

- IDEA（D270）。
