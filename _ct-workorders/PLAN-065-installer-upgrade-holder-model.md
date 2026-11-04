---
schema_version: 1
schema_kind: plan
id: PLAN-065
title: "Windows 升級不中斷終端：holder 模型（ConPTY 持有者放安裝目錄外、跨版本接回）"
status: IDEA
priority: low
created_at: "2026-11-04T15:01:49+0800"
links:
  source: "PLAN-063 子項 4（原 PLAN-059 子項 D）；D281"
  related: [PLAN-063, PLAN-059, T0820, T0823, T0704]
---

# PLAN-065 — Windows 升級不中斷終端的 holder 模型

## 動機

PLAN-063 已讓 NSIS 升級前先請 BAT 正常結束、升級後說明結束了哪些終端並可一鍵接回 claude / codex 分頁（`v0.7.4-pre.6`–`pre.8` 實機驗收 PASS）。但分頁裡的 shell、執行中的指令與 agent 仍會被結束。若使用者確實需要「升級不中斷長任務」，就要讓 ConPTY 的持有者（Terminal Server 或另一個 holder 程序）放在安裝目錄外、不被安裝程式結束，並能被新版接回。

## 範圍（待評估）

- holder 程序放在安裝目錄外（例：`<userData>` 下的版本化副本），NSIS 只結束安裝目錄內的程序。
- 新版主行程與舊版 holder 的協定相容（版本協商、不相容時的退回路徑）。
- 與 Recovery 提示（T0578）、Terminal Server 存活判定（T0704）、安裝程式結束紀錄（T0823）的關係。

## 開始條件

使用者確實需要「升級不中斷長任務」時再評估（PLAN-063 原註記）。規模 L。

## 狀態

- 2026-11-04 15:01（D281）由 PLAN-063 子項 4 移出，IDEA。
