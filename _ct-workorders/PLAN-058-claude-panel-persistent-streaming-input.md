---
schema_version: 1
schema_kind: plan
id: PLAN-058
title: "Claude 面板改用常駐串流輸入：每個面板一個常駐 query，主回合進行中送出也能排隊、不中斷"
status: IN_PROGRESS
priority: low
created_at: "2026-11-02T03:22:26+0800"
links:
  source: "T0768 回報區方案 B；D214 P-4"
  related: [BUG-192, T0768, T0769, T0759, PLAN-059]
---

# PLAN-058 — Claude 面板常駐串流輸入

## 動機

T0768 查證：SDK 0.3.316 的 AsyncIterable prompt 可在同一個 CLI 程序內持續送訊息；主回合進行中送第 2 則時 CLI 會自己排隊（`command_lifecycle`），不必「中斷＋重送」。BUG-192 先以方案 C（只在主回合結束後注入）修正（T0769）；要讓主回合進行中送出也不中斷，需把面板改成常駐串流輸入。

## 方向（T0768 方案 B）

- 每個 session 一個常駐 query＋inbox；決定何時結束 / 重開程序（休眠 `isResting`、worktree、headless）。
- `isStreaming` 語意、`messageQueue` / retry / resume、`setModel` / `effort`（改用 `applyFlagSettings`）、`setPermissionMode`、Cache History 全部重驗。
- 規模 L、回歸面大；每個面板多一個常駐 claude 程序。

## 相關

- PLAN-059（Herdr 對照研究）：互不依賴，可分開排程或並行。PLAN-059 A 改的是終端分頁的 PTY 寫入，本 PLAN 改的是 Claude 面板的 SDK 輸入；helper 派工一律把面板 agent 轉成 CLI（`toTerminalDrivenAgentId`），塔台 / Worker 通知不會進面板。兩邊只共用「agent 忙碌或等待時，送進來的訊息排隊而不是中斷或直接打入」這個處理原則（提示待送、可取消、有上限，沿用 T0769）。

## 狀態

- IDEA（D214：列入後續規劃，本批不做）。
- 2026-11-03 21:11 → IN_PROGRESS（D258，使用者指示開始）：T0813（研究：設計＋原型量測、分階段實作草案）。
- 2026-11-03 21:31 T0813 DONE → **D259**：範圍改為方案 D（主回合中送出改為排進同一個 query，不需常駐程序；Esc 一併取消待送；提問卡等待時排隊並提示）＋W1 前置修正；先 T0814（W1）再 T0815（W0）。常駐程序（方案 B）延後，觸發條件見 T0813〈7〉。
