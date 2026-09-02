---
schema_version: 1
schema_kind: plan
id: PLAN-032
title: Setup Wizard Error UX Overhaul（含 Stepper `awaiting-input` 擴充 + 通用 error mapping framework）
status: DONE
priority: medium
created_at: "2026-04-27T12:58:00+08:00"
completed_at: "2026-09-02T15:49:04+08:00"
---
# PLAN-032 — Setup Wizard Error UX Overhaul（含 Stepper `awaiting-input` 擴充 + 通用 error mapping framework）

## Metadata

| 欄位 | 內容 |
|------|------|
| PLAN 編號 | PLAN-032 |
| 標題 | Setup Wizard 三平台 (WSL / SSH / Docker) 錯誤訊息友善化、pre-flight 偵測層、Stepper 擴充 `awaiting-input` 狀態、統一 recovery action 設計 |
| 優先級 | 🟡 Medium（不阻擋功能但 dogfood 三同族 BUG 揭露 wizard UX 不直觀；release 前修整體驗） |
| 類型 | 技術改善 + UX 重構（涉及 Stepper 元件 / 三平台 wizard step / error mapping framework） |
| 狀態 | ✅ **DONE**（2026-09-02 結案）— Sprint 2-5 全 12 張工單 DONE；三個 root-cause BUG（072/073/074）於 2026-09-02 以 field evidence 就地結案（非人工 smoke，見各 BUG 文末結案紀錄） |
| 建立時間 | 2026-04-27 12:58 (UTC+8) |
| 報告者 | 使用者（PLAN-030 dogfood 三同族 BUG，screenshot #7/#8/#9） |
| Release target | **v0.4.3 獨立 release**（wizard UX patch；不與 PLAN-031 v0.5.0 綁定） |
| 相關 BUG | BUG-072（WSL systemd linger）/ BUG-073（Docker daemon）/ BUG-074（SSH input step failed）—— 三個 root cause owner |
| 相關 PLAN | PLAN-007（remote dev 路徑，本應交付完整 wizard UX）/ PLAN-030（Stepper 元件原始設計）/ PLAN-031（v0.5.0 同步觀察 BUG-071 互動） |
| 上游交付 | PLAN-030 ✅（Stepper 元件 + setup wizard vertical 重設計，現有 status: idle/running/done/failed/skipped）/ PLAN-031 主體 ✅（三平台 install-bundle step 已實作完成，error path 在此 PLAN 統一處理） |

## 動機 / 背景

### 觸發事件

PLAN-030 完工後使用者實機跑 v0.4.1 三平台 setup wizard，揭露三個同族 UX 問題：

1. **BUG-072**：WSL wizard 跑到 systemd linger 啟用步驟拋 `Could not enable linger: No such device or address`，連帶下游 `Timed out waiting for bat-server.service to become active`。錯誤訊息純技術，使用者不知下一步
2. **BUG-073**：Docker wizard 第 1 步「偵測目標環境」在 daemon 未運作時拋原生 `error during connect... pipe/docker_engine: The system cannot find the file specified`，使用者不知道要安裝 / 啟動 Docker Desktop
3. **BUG-074**：SSH wizard 第 1 步「設定 SSH 主機資訊」是 input step，wizard 開啟時**立即顯示為 failed 狀態**（紅 X + Retry/Skip），使用者誤以為 wizard 已壞

### 共通 root cause

| 維度 | 缺失 |
|------|------|
| Pre-flight 偵測層 | 三平台 step 都沒有 stateful 環境就緒度檢查（Docker daemon 是否啟動 / WSL systemd 是否可用 / SSH input 是否填寫） |
| Error mapping 策略 | Worker 直接 propagate 底層 CLI/API stderr 到 UI，沒做「常見情境特化」的友善訊息映射 |
| Stepper status 設計 | 現有 `idle/running/done/failed/skipped` 不足以表達「等待使用者輸入」語意，input step 被誤等同 failed |
| Recovery action | 「重試」按鈕無上下文意義（重試還是會撞同樣 error）；缺「我已修好」/「開連結下載 / 開設定」/「跳過」等場景化 action |

### 為何要獨立 PLAN（不純 BUG fix 群）

- 涉及**通用 framework**（error mapping + pre-flight + Stepper 擴充）影響三平台所有 step，不只 BUG 提到的特定 step
- Stepper `awaiting-input` 擴充影響 PLAN-030 已交付的元件（T0307 Stepper），需設計規範文件同步更新
- 三 BUG 修法若各自實作會 drift（每個平台一套 error mapping），統一 framework 才能 long-term 維護
- v0.4.3 patch release 期望單一交付主題（wizard UX），surface 小可獨立驗收

## 目標（驗收條件，PLAN 級）

### 必達

- AC-1：Stepper 元件新增 `awaiting-input` status，視覺與 `failed` 明確區分（藍色 + 不顯示 Retry/Skip）
- AC-2：通用 `WizardErrorMapper` framework：將底層 stderr / Error 物件映射為 `{ title, body, actions }` 結構，三平台共用
- AC-3：通用 `WizardPreflight` framework：每個 step 可選定義 pre-flight check（同步 / 非同步），失敗時不執行 main action 而顯示友善訊息
- AC-4：BUG-072 修復 — WSL linger 失敗顯示「無法自動啟用 systemd lingering（WSL2 distro 限制）」+ 命令引導 + 「我已執行，重試」按鈕
- AC-5：BUG-073 修復 — Docker daemon 未啟動顯示「未偵測到 Docker daemon」+ 「下載 Docker Desktop」連結 + 「我已啟動，重試」+ 詳細錯誤可展開
- AC-6：BUG-074 修復 — SSH wizard 第 1 步顯示為 `awaiting-input`（藍色 + 輸入框 + 繼續/取消），不再顯示紅 X + Retry
- AC-7：PLAN-030 設計規範文件（`docs/design/bat-stepper-design-language.md`）同步更新 `awaiting-input` 規範
- AC-8：所有現有 input step（不只 SSH，需盤點 WSL / Docker / Codex Profile 等）統一改用 `awaiting-input` status

### 期望

- AC-9：error mapping 字典可被本地化（i18n） — 即使本 PLAN 只交付 zh-TW，framework 設計時保留 i18n hook
- AC-10：開發者寫新 step 時的 boilerplate 降到最小：定義 step 時可選 `preflight` / `errorMap` / `inputDef` 三個 field
- AC-11：unit tests 覆蓋 framework 核心（error mapping / preflight resolver / status transition），>90% line coverage

### 不在範圍（OOS）

- 不重新設計 wizard 整體 flow（stepper 順序、step 命名）
- 不處理 BUG-071（PLAN-031 owner，已 IN_PROGRESS）
- 不對所有 step 都導入 pre-flight（只對 root cause owner step + 明顯需要的 step；其餘 follow-up）
- 不做 error reporting / telemetry（單純 UI 友善化）

## 拆單表（T0328 研究結論 finalized）

> 來源：T0328 § Phase D。Spec 文件：`_ct-workorders/_spec-wizard-error-ux.md`（T0328 commit `d89d867`）

### Sprint 1：研究 ✅ DONE

- **T0328**（research）— ✅ DONE @2026-04-27 — Phase A-E 完整盤點 + 8 拍板項 + spec 落地

### Sprint 2：Framework 基礎建設（5 工單）

| 工單 | 標題 | Sizing | 依賴 | 平行可? | OOS | 狀態 |
|------|------|--------|------|--------|-----|------|
| T0330 | Stepper + WizardRunner `awaiting-input` 狀態擴充 | M | — | 否（多票依賴） | 不做視覺 token 重構 | ✅ DONE @2026-04-27 22:47 `e0a23e5` |
| T0331 | `WizardErrorMapper` framework（registry + fallback） | M | — | 是 | 不一次清完所有字典 | ✅ DONE @2026-04-27 22:59 `85eb8ff` |
| T0332 | `WizardPreflight` hook + cache | M | — | 是 | 不抽成獨立 visual step | ✅ DONE @2026-04-27 23:09 `8bb972e` |
| T0333 | Recovery actions schema + `SetupWizardShell` wiring | M | T0330 | 部分 | 不做 arbitrary plugin actions | ✅ DONE @2026-04-27 23:30 `a24ba4a` |
| T0334 | 設計規範 / tests 更新（Stepper + Shell） | S | T0330 | 是 | 不做多語文案落地 | ✅ DONE @2026-04-27 23:43 `4b43a4f` |

### Sprint 3：三平台 BUG 修復（套用 framework，3 工單）

| 工單 | 標題 | Sizing | 依賴 | 平行可? | BUG |
|------|------|--------|------|--------|-----|
| T0335 | BUG-074 SSH input-step `awaiting-input` 落地 | M | T0330+T0333 | 是 | BUG-074 → VERIFY @2026-04-28 03:10 `94733d7` |
| T0336 | BUG-073 Docker detect-env mapping + download/start actions | M | T0331 | 是 | BUG-073 → VERIFY @2026-04-28 03:21 `a8b2363` |
| T0337 | BUG-072 WSL linger/systemd mapping + fixed-and-retry flow | M | T0331+T0333 | 是 | BUG-072 → VERIFY @2026-04-28 03:32 `57896e7` |

### Sprint 4：跨平台抽象（1 工單）

| 工單 | 標題 | Sizing | 依賴 |
|------|------|--------|------|
| T0338 | Cross-platform input step abstraction（choice vs form prompt） | M/L | T0335 |

### Sprint 5：整合 + 驗收（2 工單）

| 工單 | 標題 | Sizing | 依賴 |
|------|------|--------|------|
| T0339 | Integration tests: transition matrix + mapped UX cases | M | All Sprint 3 |
| T0340 | Audit / release notes / docs polish | S | All |

**總量**：11 工單（落 T0328 預估 10-12 範圍中）。

### 依賴圖

```text
T0328 ✅
  │
  ├── Sprint 2 foundation
  │    ├─ T0330 awaiting-input state ──┐
  │    ├─ T0331 ErrorMapper             │
  │    ├─ T0332 Preflight hook          │
  │    ├─ T0333 Recovery actions ◄──────┘
  │    └─ T0334 spec + tests ◄──────────┘
  │
  ├── Sprint 3 platform fixes (parallel after S2)
  │    ├─ T0335 BUG-074 SSH input  ◄─── T0330+T0333
  │    ├─ T0336 BUG-073 Docker     ◄─── T0331
  │    └─ T0337 BUG-072 WSL        ◄─── T0331+T0333
  │
  ├── Sprint 4: T0338 input abstraction ◄─── T0335 learning
  │
  └── Sprint 5: T0339 tests + T0340 audit
```

## 風險與緩解

| 風險 | 影響 | 緩解 |
|------|------|------|
| Stepper `awaiting-input` 改動破壞 PLAN-030 既有套用點 | High（影響所有 wizard） | T0328 spike 先列出所有 callsite + status transition 圖；Sprint 2 第 1 張工單先擴充元件 + tests，再進大宗 |
| Error mapping framework 過度設計 | Medium | T0328 拆單 reachability matrix 列「目前實際需要的 error 種類」，超出範圍標 deferred |
| Pre-flight 引入額外 latency（每個 step 開頭多一次 IO） | Low-Medium | preflight 設計為可選 + cache（同 wizard session 內結果可重用） |
| BUG-072 fallback 策略（linger vs SSH tunnel temp spawn）爭議 | Medium | T0328 拍板項列入；Worker 提 [A]/[B]/[C] 三方案，塔台選 |
| v0.4.3 surface 變大拖累 release | Medium | Sprint 切到 5 段 + ship gate 在 Sprint 3 結束（必達 BUG fix）；Sprint 4-5 可 follow-up |

## 拍板項（T0328 後 finalized — D102 ~ D109）

> 全部採納 T0328 Phase E 推薦方案；塔台無翻案。

| D | 主題 | 採納方案 | 理由 |
|---|------|---------|------|
| D102 | Stepper 狀態擴充 | **A** — 新增獨立 `awaiting-input` status | 狀態機才是缺口，flag 只會把語意藏到 callsite |
| D103 | Error mapping 策略 | **B** — `errorCode + regex` 混合 | SSH 已現成；Docker/WSL 可漸進補齊 |
| D104 | Pre-flight 形態 | **A** — `step.preflight` hook | 最小侵入；便於 cache + 統一 failure UX |
| D105 | Recovery actions 模型 | **C** — hybrid typed actions（7 內建 kinds：retry / fixed-and-retry / open-link / edit-config / skip / cancel / custom） | 規範共用 UX + 保留 open-link / custom 擴充 |
| D106 | BUG-072 fallback 策略 | **C** — try linger，失敗時 manual fix hint + optional fallback | 保留 deployment 設計，降低卡死率 |
| D107 | input step 範圍 | **先 A 後 B** — Sprint 3 修 SSH（T0335），Sprint 4 抽象（T0338） | 先止血 + 再一般化，風險低 |
| D108 | i18n 範圍 | **A** — 只留 `messageKey` hook，不補翻譯 | 先固化 API，比寫大量 copy 更重要 |
| D109 | v0.4.3 ship gate | **B** — 三 BUG 都補齊才出貨 | 同族 UX overhaul，拆半套出貨會讓使用者更混亂 |

**Pre-flight cache 策略補充**：依 T0328 § B.3 推薦，cache 範圍為 **per-wizard-session**（同 wizard run 內結果可重用，wizard 重新啟動則 invalidate）。寫入 T0332 工單 spec。

## Session 安排

- **Session 36（本 session）**：PLAN-032 spec freeze + T0328 派發
- **Session 37+**：依 T0328 拆單表，YOLO 鏈式派發 Sprint 2-5
- **預期節奏**：研究 ~15 min wall + 實作 ~80-120 min wall（GP110 PLAN 級研究 + YOLO 鏈式預期 5-8x 神速）

## 後續處理

- T0328 完成後塔台拍板 + 拆 Sprint 2-5 工單
- BUG-072/073/074 持續維持 OPEN，直到對應 Sprint 3 工單 DONE 後改 FIXED → VERIFY
- 與 PLAN-031 互不阻擋（v0.4.3 ship 不依賴 PLAN-031 v0.5.0 進度）

---

**狀態**：📐 PLANNED
**下一步**：派發 T0328 研究工單

---

## 結案紀錄（2026-09-02 15:49 UTC+8）— DONE

本 PLAN 的實作在 2026-04-28 即全數落地（Sprint 2-5 共 12 張工單全 DONE），
唯一未閉合的閘門是 BUG-072 / 073 / 074 的**人工 smoke**。

### 為什麼改以 field evidence 結案

| 項目 | 內容 |
|------|------|
| 修復上線 | `v0.5.0-pre.x` 起，歷經 `v0.5.8`（2026-05-24）至 `v0.5.9-pre.2` |
| 實際使用期 | 自 `v0.5.8` 起約 **101 天** |
| 期間回饋 | **零** —— 除 `v0.5.9` 系列自身修的 BUG-082 外無相關回報 |
| 使用者裁決 | 2026-09-02「版本差太多…可以就地結案，日後有發現 bug 另外再提」 |

### ⚠️ 證據強度聲明

三個 BUG 屬 setup wizard **錯誤路徑** UX（低頻但使用者可見）。本次結案依據為
**負面訊號的缺席**，不等同工單原定的正面 smoke 驗收。此處誠實記錄，不將兩者混同。

⇒ **PLAN-032 的 AC-4 / AC-5 / AC-6 未經人工實機確認**，僅有整合測試（T0338）與程式碼稽核（T0341）覆蓋。

### 後續

日後若實際踩到 wizard 錯誤路徑問題，**另開新 BUG 單**，不重開 BUG-072/073/074，亦不重開本 PLAN。
