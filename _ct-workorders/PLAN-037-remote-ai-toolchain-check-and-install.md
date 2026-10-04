---
schema_version: 1
schema_kind: plan
id: PLAN-037
title: 遠端（WSL / SSH / Docker）AI 工具套件檢查與一鍵安裝（claude / codex CLI、git、gh 等）
status: PLANNED
priority: medium
created_at: "2026-10-05T02:28:57+08:00"
updated_at: "2026-10-05T02:28:57+08:00"
links:
  research_workorder: T0407
  related: [PLAN-036, PLAN-035, D131]
---

# PLAN-037 — 遠端 AI 工具套件檢查與一鍵安裝

## Metadata

| 欄位 | 內容 |
|------|------|
| PLAN 編號 | PLAN-037 |
| 優先級 | 🟡 Medium |
| 狀態 | 📋 PLANNED（Phase 0 研究 T0407，02:29 開單） |
| 建立時間 | 2026-10-05 02:28 (UTC+8) |
| 決策 | D131（範圍 B：檢查＋一鍵安裝；入口：精靈步驟＋設定頁；與 PLAN-036 平行，實作在 T0405 前完成） |

## 背景與動機

PLAN-036 讓遠端 headless server 有了終端與（進行中的）Agent / git / fs 功能，但遠端機器上**有沒有可用的工具**沒有任何機制處理：

- claude CLI：server bundle 內嵌一份給 Agent 面板用；遠端**終端**內的 `claude` 走系統 PATH，WSL 實測沒有裝、也沒登入（T0386 §4）
- codex CLI：server bundle 不含（T0401 先在遠端隱藏 codex 功能）
- git / gh：PLAN-036 T0405（git / github 上遠端）直接依賴遠端是否安裝

## 使用者裁決（2026-10-05 02:28）

- **範圍 B**：偵測各工具是否安裝、版本、登入狀態；缺的工具以按鈕在**遠端終端分頁**打入官方安裝指令（需 sudo 者使用者在分頁內輸入密碼；不需 sudo 者裝到 `~/.local/bin`）。不打包進 server bundle（C 案否決：安裝檔變大、D094 已超標、版本綁死重演 BUG-083 / 084）
- **入口**：WSL / SSH 精靈最後一步「工具檢查」＋遠端 profile 設定頁可隨時重跑
- **排程**：與 PLAN-036 平行；實作在 T0405 前完成

## 階段

1. **Phase 0**：研究 T0407 —— 工具清單、各平台官方安裝方式與校驗、偵測方式、與 PLAN-035 精靈分工、拆單
2. **Phase 1+**：依 T0407 拆單
