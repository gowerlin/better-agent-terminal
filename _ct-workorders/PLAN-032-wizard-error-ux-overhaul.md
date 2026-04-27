# PLAN-032 — Setup Wizard Error UX Overhaul（含 Stepper `awaiting-input` 擴充 + 通用 error mapping framework）

## Metadata

| 欄位 | 內容 |
|------|------|
| PLAN 編號 | PLAN-032 |
| 標題 | Setup Wizard 三平台 (WSL / SSH / Docker) 錯誤訊息友善化、pre-flight 偵測層、Stepper 擴充 `awaiting-input` 狀態、統一 recovery action 設計 |
| 優先級 | 🟡 Medium（不阻擋功能但 dogfood 三同族 BUG 揭露 wizard UX 不直觀；release 前修整體驗） |
| 類型 | 技術改善 + UX 重構（涉及 Stepper 元件 / 三平台 wizard step / error mapping framework） |
| 狀態 | 📐 PLANNED |
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

## 拆單方向（待 T0328 研究工單細化）

> ⚠️ 以下為塔台粗略構想，**最終拆單以 T0328 research 結論為準**

### Sprint 1：方案拍板 + 設計

- **T0328**（research）— PLAN-032 方案探索 + Stepper spike + error mapping spike + 拆單建議 + reachability matrix

### Sprint 2：Framework 基礎建設

- T03xx — Stepper 元件擴充 `awaiting-input` status（含 visual + a11y + tests）
- T03xx — `WizardErrorMapper` framework（核心型別 + dictionary 結構 + matcher 邏輯 + tests）
- T03xx — `WizardPreflight` framework（核心型別 + resolver + tests）
- T03xx — 設計規範文件更新（`bat-stepper-design-language.md` 補 `awaiting-input` 章節）

### Sprint 3：三平台 BUG 修復（套用 framework）

- T03xx — BUG-072 WSL linger error UX（pre-flight + error map）
- T03xx — BUG-073 Docker daemon error UX（pre-flight + error map）
- T03xx — BUG-074 SSH input step 改用 `awaiting-input`（含 alias dropdown / host input / port / user / 認證方式）

### Sprint 4：跨平台 input step 統一

- T03xx — 盤點所有現有 input step，統一改用 `awaiting-input`（WSL / Docker / Codex Profile / SSH 進階設定等）

### Sprint 5：整合 + e2e + verification

- T03xx — Integration tests（三平台 wizard E2E happy path + error path）
- T03xx — `*fieldguide audit` 對 setup-wizard 模組做一致性掃描
- T03xx — v0.4.3 release notes / CHANGELOG 草稿

> 預估總工單數：~12-15（Sprint 1 × 1 + Sprint 2 × 4 + Sprint 3 × 3 + Sprint 4 × 1-2 + Sprint 5 × 3）。最終以 T0328 拆單表為準。

## 風險與緩解

| 風險 | 影響 | 緩解 |
|------|------|------|
| Stepper `awaiting-input` 改動破壞 PLAN-030 既有套用點 | High（影響所有 wizard） | T0328 spike 先列出所有 callsite + status transition 圖；Sprint 2 第 1 張工單先擴充元件 + tests，再進大宗 |
| Error mapping framework 過度設計 | Medium | T0328 拆單 reachability matrix 列「目前實際需要的 error 種類」，超出範圍標 deferred |
| Pre-flight 引入額外 latency（每個 step 開頭多一次 IO） | Low-Medium | preflight 設計為可選 + cache（同 wizard session 內結果可重用） |
| BUG-072 fallback 策略（linger vs SSH tunnel temp spawn）爭議 | Medium | T0328 拍板項列入；Worker 提 [A]/[B]/[C] 三方案，塔台選 |
| v0.4.3 surface 變大拖累 release | Medium | Sprint 切到 5 段 + ship gate 在 Sprint 3 結束（必達 BUG fix）；Sprint 4-5 可 follow-up |

## 拍板項（T0328 完成後塔台填）

> 待 T0328 研究結論回報後，塔台在此填具體拍板。預期 5-8 項。

- D102 候選：Stepper `awaiting-input` 視覺風格定案（藍色 outline / 藍色 fill / 淡灰 + 藍邊框？）
- D103 候選：`WizardErrorMapper` matcher 策略（regex / errorCode / class instanceof / hybrid？）
- D104 候選：BUG-072 WSL linger 修法（提示重試 / fallback temp spawn / hybrid？）
- D105 候選：所有現有 input step 統一改用 `awaiting-input` 是否在本 PLAN 完成（vs follow-up PLAN）
- D106 候選：error mapping i18n 是否本 PLAN 落地（vs 留 hook 給未來 i18n PLAN）
- D107 候選：v0.4.3 release ship gate 切點（Sprint 3 必達 / Sprint 5 全達）
- D108 候選：Pre-flight cache 策略（per-wizard-session / per-app-session / 不 cache）

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
