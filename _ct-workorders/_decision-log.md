# 決策日誌 — better-agent-terminal

> 記錄所有影響專案方向的重要決策。
> 建立時間：2026-04-12 (UTC+8)（T0062 遷移產出，從 _tower-state.md 提取）
> 最後更新：2026-04-12 22:14 (UTC+8)（T0065：新增 D029）

---

## 決策索引

| ID | 日期 | 標題 | 相關工單 |
|----|------|------|---------|
| D001-D012 | 2026-04-11 早期 | Phase 1 前置決策（詳見歸檔） | T0001-T0012 |
| D013 | 2026-04-11 | 技術債 Backlog + 派發 T0004/T0005 半平行 | T0004/T0005 |
| D014 | 2026-04-11 | T0005 PARTIAL 接受，runtime 驗證延後到 T0009 | T0005 |
| D015 | 2026-04-11 | Phase 1 驗收第一個 bug，派發 T0013 hotfix | T0013 |
| D016 | 2026-04-11 | T0013 PARTIAL 接受，runtime 驗證延後 | T0013 |
| D017 | 2026-04-11 | BAT agent orchestration 研究記入 Backlog | PLAN-007 |
| D018 | 2026-04-12 | 先修 Redraw 再調查 BUG-012（診斷工具優先） | T0035/T0036 |
| D019 | 2026-04-12 | T0035 v1 修復（禁用 viewport scroll）無效 | T0035 |
| D020 | 2026-04-12 | BUG-012 根因確認：上游 TUI 問題，workaround 策略 | T0041 |
| D021 | 2026-04-12 | T0041 附帶改進保留（canvas addon + CLAUDE_CODE_NO_FLICKER=1） | T0041 |
| D022 | 2026-04-12 | BUG-007 關閉：上游行為，Claude Code CLI 輸出 | — |
| D023 | 2026-04-12 | BUG-013 新增：Tab 切換畫面全黑，100% 重現，High | T0047 |
| D024 | 2026-04-12 | BUG-014/015 新增：xterm v6 副作用 | T0047 |
| D025 | 2026-04-12 | 修復策略：revert xterm v5 + ErrorBoundary 保護網 | T0047 |
| D026 | 2026-04-12 | 版號管理：fork 從 1.0.0 開始，package.json 管理 | T0055 |
| D027 | 2026-04-12 | 上游追蹤：upstream tony1223，fork gowerlin，lastSyncCommit 079810025 | T0055 |
| D028 | 2026-04-12 | 採用 T0061 文件拆分架構（BUG/PLAN/Decision 獨立單據） | T0061/T0062 |
| D029 | 2026-04-12 | BUG 狀態流新增 🧪 VERIFY 中間態（code fix 完成但 runtime 尚未驗收） | T0065 |

---

## 決策紀錄（降序，最新在上）

---

### D029 2026-04-12 — BUG 狀態流新增 🧪 VERIFY 中間態

- **背景**：BUG 報修流程原先缺少「code fix 完成但尚未真人驗收」的中間狀態，導致 FIXED 語義模糊（無法區分「code 修了」和「真人確認修好了」）
- **選項**：
  - 選項 A：讓 FIXED 本身帶備註（runtime 待驗）
  - 選項 B：在 FIXING 和 FIXED 之間新增 VERIFY 狀態（本決策採用）
- **決定**：選項 B，新增 🧪 VERIFY 為中間態
- **細節**：
  - FIXED 維持為最終態（語義不改：真人已確認修好）
  - 歸檔規則不需要修改（FIXED 仍是歸檔觸發狀態）
  - 已歸檔的 FIXED bugs 不受影響
  - 驗收失敗（原問題未解）→ 退回 🔧 FIXING
  - 驗收失敗（衍生問題）→ 原 BUG 升 FIXED，另開新 BUG 單
  - 驗收者：使用者/QA（真人）優先；AI sub-session 可判斷純邏輯場景；E2E/視覺化需真人複驗
- **影響**：`_local-rules.md` 更新狀態流，BUG-001/002 狀態同步為 🧪 VERIFY
- **相關工單**：T0065

---

### D028 2026-04-12 — 採用模組化文件結構

- **背景**：`_tower-state.md` 膨脹至 2514 行，維護困難，*sync 每次需讀大量無關內容
- **選項**：
  - 選項 A：繼續在單一檔案維護
  - 選項 B：拆分為獨立 BUG/PLAN/Decision 文件系統
- **決定**：選項 B
- **理由**：便於導航、更新局部狀態、未來可能在 UI 中顯示各類別列表
- **相關工單**：T0061（設計）、T0062（遷移）
- **影響**：新增 _local-rules.md 教塔台認識新單據類型

---

### D027 2026-04-12 — 上游追蹤策略

- **背景**：fork 後需管理與上游的同步關係
- **決定**：upstream = tony1223/better-agent-terminal，fork = gowerlin/better-agent-terminal，lastSyncCommit = 079810025，上游版號 2.1.3
- **理由**：明確 fork 關係，方便後續上游更新評估
- **相關工單**：T0055

---

### D026 2026-04-12 — Fork 版號管理

- **背景**：fork 後需獨立版號系統，與上游版號脫鉤
- **決定**：fork 獨立版號從 1.0.0 開始，package.json 管理我們版號，version.json 管理 upstream 元資料
- **理由**：避免與上游版號混淆，清楚表達「這是我們的 release」
- **相關工單**：T0055

---

### D025 2026-04-12 — BUG-013 修復策略

- **背景**：BUG-013（Tab 切換全黑）、BUG-014（Ctrl 滾輪縮放失效）、BUG-015（字體 CJK fallback）均為 xterm v6 副作用
- **選項**：
  - 選項 A：在 xterm v6 上個別修復
  - 選項 B：revert 回 xterm v5 + 加 ErrorBoundary 保護網
  - 選項 C：完全停留 v5，放棄 v6 升級計劃
- **決定**：選項 B+C（revert v5 + ErrorBoundary）
- **理由**：xterm v6 問題多，v5 穩定，ErrorBoundary 保護避免 dispose TypeError 擴散
- **相關工單**：T0047

---

### D024 2026-04-12 — BUG-014/015 新增

- **背景**：xterm v6 升級測試（T0043）後發現額外副作用
- **決定**：新增 BUG-014（Ctrl+滾輪縮放失效）和 BUG-015（字體從黑體變細明體），與 BUG-013 同批處理
- **相關工單**：T0047

---

### D023 2026-04-12 — BUG-013 新增

- **背景**：xterm v6 升級後發現 Tab 切換離開終端時畫面全黑，100% 重現
- **決定**：新增 BUG-013，High 嚴重度，立即派發修復工單
- **推翻假設**：先前排除 xterm v6 為根因，此 Bug 確認 xterm v6 為根因
- **相關工單**：T0047

---

### D022 2026-04-12 — BUG-007 關閉為上游行為

- **背景**：OSC 52 調試訊息（`sent X chars via OSC 52`）來自 Claude Code CLI 本身，所有終端都會顯示
- **決定**：關閉 BUG-007，標記為「上游行為 / by design」，不修復
- **理由**：非本 app 的 bug，修不了也不應該修
- **影響**：BUG-007 狀態更新為 🚫 CLOSED（上游行為）

---

### D021 2026-04-12 — T0041 附帶改進保留

- **背景**：T0041（BUG-012 深度調查）順帶發現可提升性能的附帶改進
- **決定**：保留附帶改進（canvas addon 提升渲染性能、CLAUDE_CODE_NO_FLICKER=1、清理 -51 行無效代碼）
- **理由**：改進有益無害，且已在工單內完成
- **相關工單**：T0041

---

### D020 2026-04-12 — BUG-012 根因確認

- **背景**：T0035 v1 修復失敗後，T0041 深入調查
- **決定**：
  - **根因**：ghost 文字在 xterm.js buffer 中，TUI 用 cursor positioning 跳過行首未清除，屬上游問題
  - **策略**：Redraw 按鈕作為 workaround，upstream issue 已提交（#46898）
- **相關工單**：T0041、T0042（upstream issue）

---

### D019 2026-04-12 — T0035 修復策略調整

- **背景**：T0035 v1 修復（禁用 viewport scroll）後 Alt buffer 殘影未改善
- **決定**：T0035 v1 不接受（驗收否決），需要更深層調查
- **相關工單**：T0035、T0041

---

### D018 2026-04-12 — 先修 Redraw 再調查 BUG-012

- **背景**：BUG-012（Alt buffer 捲動殘影）調查困難，缺乏可靠重現方式
- **決定**：先修好 Redraw 按鈕功能（使其真正觸發重繪），再用它輔助 BUG-012 調查
- **理由**：Redraw 是測試工具，工具完備才能有效調查
- **相關工單**：T0036

---

### D017 2026-04-11 — BAT agent orchestration 研究記入 Backlog

- **背景**：使用者要求 auto-session 能整合 BAT 做雙向自動化閉環，且支援所有 AI agent（不限 Claude Code）
- **成果**：產出完整技術文件 `reports/bat-agent-orchestration-research.md`，包含 13 章節 + 8 題決策矩陣 + 風險評估
- **核心架構**：OSC 下行（開新 tab + inject cmd）+ File Watch 上行（監聽工單回報區）
- **決定**：暫不產生工單，先記入 Backlog，等使用者 review 完技術文件再決定 D1-D8
- **相依驗證**：`supervisor:send-to-worker` 的實作必須在開工前驗證（Critical）
- **相關**：PLAN-007（待建立）

---

### D016 2026-04-11 — T0013 PARTIAL 接受

- **背景**：copilot 5 分鐘內完成 code 修復，根因比預期深（`registerVoiceHandlers` 在 module init 就被呼叫，但依賴 `session.defaultSession` 這個 app 還沒 ready 的資源）
- **修復**：新增 `src/types/voice-ipc.ts` 作為 `VOICE_IPC_CHANNELS` 單一常數來源，並把 `registerVoiceHandlers` 移到 `app.whenReady()` 後
- **決定**：接受 PARTIAL，使用者執行 runtime 驗證後再升 DONE
- **學習**：L012 — IPC handler 註冊的時序敏感性
- **相關工單**：T0013

---

### D015 2026-04-11 — 派發 T0013 hotfix（跨工單 IPC drift）

- **背景**：T0011 user testing 第一項，4 個模型一律報 `No handler registered for 'voice:downloadModel'`
- **選項**：
  - 選項 A：直接開 T0013 綜合工單（調研 + 修復 + 驗證）
  - 選項 B：先開 BUG-003 報修單再決定
- **決定**：選項 A
- **理由**：root cause space 很小，範圍集中在 IPC 層，hotfix 模式
- **相關工單**：T0013

---

### D014 2026-04-11 — T0005 PARTIAL 接受

- **背景**：T0005 sub-session 在 CLI 環境無法執行 GUI 麥克風測試
- **選項**：
  - 選項 A：等 runtime 驗證完成才派 T0004
  - 選項 B：直接派 T0004，T0009 聚合 runtime 測試
- **決定**：選項 B（路線 2）
- **理由**：T0005 程式碼層全通過，T0004 獨立不阻塞，T0009 一次測完整個鏈路比多次切換有效率
- **相關工單**：T0005

---

### D013 2026-04-11 — 技術債 Backlog + T0004/T0005 派發策略

- **決定**：技術債記入 Backlog，不阻塞語音功能開發；T0004/T0005 半平行（T0003 完成後同時開始）
- **理由**：Phase 1 優先交付語音功能，技術債非阻塞

---

### D001-D012（歷史決策）

早期 Phase 1 設計階段的前置決策，包含：
- 引擎選型（whisper.cpp）
- 語言支援（繁中為主）
- UI 觸發方式（麥克風按鈕 + Alt+M）
- 結果呈現（預覽框）
- 語音功能範圍（Phase 1 Agent terminal）
- GPU 策略（Phase 1 CPU-only）
- 模型下載策略（Settings 手動下載）

詳細紀錄見：`_archive/checkpoint-2026-04.md`（需求對齊紀錄 + §G 8 題決策）
