# 決策日誌 — better-agent-terminal

> 記錄所有影響專案方向的重要決策。
> 建立時間：2026-04-12 (UTC+8)（T0062 遷移產出，從 _tower-state.md 提取）
> 最後更新:2026-04-23 05:35 (UTC+8)(新增 D083 — BUG-057 CLOSED,T0245 單行 fix 閉環,session 22 收工條件達成)

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
| D047 | 2026-04-18 | PLAN-001/005 升級可行性研究派發（統籌研究 + 禁互動） | T0159 |
| D048 | 2026-04-18 | T0159 結論採行：新開 PLAN-016 + EXP-ELECTRON41-001 立即試做 | PLAN-016/EXP-ELECTRON41-001 |
| D049 | 2026-04-18 | EXP-ELECTRON41-001 CONCLUDED → 派 T0160 合併 + BUG-038 + T0161 修復 + Phase 3 暫緩 | T0160/T0161/BUG-038 |
| D050 | 2026-04-18 | Electron 41 升級未生效到 runtime + VSCode self-lock 發現 | T0160/T0161/BUG-038 |
| D051 | 2026-04-18 | Electron 41 升級 + BUG-038 runtime 驗收全通過，閉環完成 | T0160/T0161/BUG-038 |
| D052 | 2026-04-18 | PLAN-003 混合分組策略：Group A 暫緩 + Group B 升 vite + Group C WONTFIX | T0162/PLAN-003/PLAN-005 |
| D053 | 2026-04-18 | T0162 Phase 2 結論採路徑 A（vite 7 stable），派 T0163 實作 | T0162/T0163/PLAN-003 |
| D054 | 2026-04-18 | T0163 DONE 閉環 + PLAN-005 啟動（EXP worktree 模式，承接 Group A） | T0163/EXP-BUILDER26-001/PLAN-005/PLAN-003 |
| D055 | 2026-04-18 | PLAN-005 / PLAN-003 全案閉環（electron-builder 26 升級 CONCLUDED + Group A 關閉） | EXP-BUILDER26-001/PLAN-005/PLAN-003 |
| D056 | 2026-04-18 | PLAN-016 全案閉環（Electron 28.3.3 → 41.2.1，三 Phase 全部完成） | PLAN-016/EXP-ELECTRON41-001/T0160/T0161/PLAN-005 |
| D057 | 2026-04-18 | mac 打包採雙 arch dmg，放棄 universal（CI Pre-Release 5 次 run 後修正） | EXP-BUILDER26-001 |
| D058 | 2026-04-18 | Upstream v2.1.42+ 同步採方案 [A]：T0165 Phase 1 cherry-pick + PLAN-018 Phase 2 獨立 | T0164/T0165/PLAN-018 |
| D059 | 2026-04-18 | PLAN-020 yolo 模式插隊啟動，PLAN-018 冷凍作為驗證場景 | PLAN-020/T0167/PLAN-018 |
| D060 | 2026-04-18 | yolo 下一張工單資訊來源採 Q2.A（研究工單 D 區段） | PLAN-020/T0167 |
| D061 | 2026-04-18 | CT-T002 閉環 + v4.2.0 tag，對方塔台已吸收 yolo 功能 | CT-T002/PLAN-020 |
| D062 | 2026-04-18 | Worker 無狀態原則：所有 runtime context 由塔台派單 explicit 傳遞 | BUG-040/BUG-041/T0176+ |
| D063 | 2026-04-19 | BUG-050 階段 1 smoke 通過 → FIXING → VERIFY,觀察 YOLO log 再決策階段 2 | BUG-050/T0215/PLAN-024 |
| D064 | 2026-04-19 | BUG-050 階段 2 暫緩:2 樣本 + 真實 YOLO 工作流驗證零異常,保持 VERIFY 待真實問題觸發 | BUG-050/PLAN-024/T0216/T0217 |
| D065 | 2026-04-19 | PLAN-021 UX 簡化:移除 Test 按鈕(error path 已提供回饋),新增停止伺服器前連線數警告 | PLAN-021/T0218/T0219 |
| D066 | 2026-04-19 | BUG-047 驗收失敗處理:派研究工單 T0220 而非直接修復 | BUG-047/T0220 |
| D067 | 2026-04-19 | T0221 YOLO 回報策略:code-only 必回 PARTIAL 觸發斷點 A | T0221/T0223 |
| D068 | 2026-04-19 | BUG-051 範圍判定:派研究工單深查 consumer + 跨平台 | BUG-051/T0222 |
| D069 | 2026-04-19 | BUG-051 與 BUG-047 關係:不算翻案,獨立編號 | BUG-047/BUG-051 |
| D070 | 2026-04-19 | T0222 附加發現處理:BUG-052 獨立 + T0223 合併修 | BUG-052/T0222/T0223 |
| D071 | 2026-04-20 | PLAN-021 dev smoke 驗收暫緩,UX 另案 | PLAN-021/T0218/T0219 |
| D072 | 2026-04-20 | archive_days 7 → 2 歸檔門檻調整 | _tower-config.yaml / *archive |
| D073 | 2026-04-20 | PLAN-022 結案,Step 3 TOFU fallback 不做 | PLAN-022 / T0217 |
| D074 | 2026-04-22 | BAT 塔台接手 Phase 1-4 派發(T0099-T0106)| PLAN-028 / CT-T010 / T0098 |
| D075 | 2026-04-23 | GPU Whisper 技術方向由雙軌翻轉為 Vulkan-first | T0236 / PLAN-004 / EXP-GPUWHIS-001 |
| D076 | 2026-04-23 | T-A PoC PARTIAL 接受 — 硬體瓶頸非套件缺陷,繼續推進 T-B/C/D 合入主線 | T0237 / EXP-GPUWHIS-001 |
| D077 | 2026-04-23 | EXP-GPUWHIS-001 T-D 合入主線 — Option 1 Squash merge + 刪除 worktree | T0240 / EXP-GPUWHIS-001 |
| D078 | 2026-04-23 | BUG-056 NSIS 打包版啟動崩潰（regression from `cb65614`）— 暫停 T0241 版號 bump，派研究工單定位根因 | BUG-056 / T0241 / cb65614 / EXP-GPUWHIS-001 |
| D079 | 2026-04-23 | T0241 結論吸收 — BUG-056 根因為 main repo 缺 `npm install`；修復拆 T0242（npm install + NSIS 雙 path 驗收）+ T0243（build fail-fast + CI `npm ci`）| T0241 / T0242 / T0243 / BUG-056 |
| D080 | 2026-04-23 | BUG-056 CLOSED — T0242 zero-diff fix via `npm install` + 雙 path 驗收全綠，VERIFY 決策 [1] 直接 CLOSED | BUG-056 / T0242 / `e46932e` |
| D081 | 2026-04-23 | BUG-057 OPEN（第二 regression from `cb65614`）— 語音辨識繁中翻英，走 T0244 研究路線（A/A/A），T0243 延下 session | BUG-057 / T0244 / `cb65614` / T0243 |
| D082 | 2026-04-23 | T0244 結論吸收 — H2 確認：`@kutalia/whisper-node-addon` default `translate: true`（舊套件 false），派 T0245 單行 fix（加 `translate: false`）+ dev mode 驗收 | T0244 / T0245 / BUG-057 / `526b7c1` |
| D083 | 2026-04-23 | BUG-057 CLOSED — T0245 單行 fix `translate: false` 閉環,使用者雙情境(zh+auto)runtime 驗收通過,session 22 收工條件達成 | BUG-057 / T0245 / `b2124b5` |

---

## 決策紀錄（降序，最新在上）

---

### D083 2026-04-23 — BUG-057 CLOSED — T0245 單行 fix 閉環，Session 22 收工

- **背景**：T0245 Worker 10 min wall（05:25-05:35）交付修復（commit `b2124b5`），單行 diff 套用於 `electron/voice-handler.ts:462` 加 `translate: false`（含 BUG-057 inline 註解）。TS 編譯全 green，`@kutalia` 套件 `TranscribeOptions` type 本身含 `translate` 欄位，無需 `as any` cast。使用者回報「驗收通過」（情境 1 繁中 + 情境 2 auto 雙綠）。
- **VERIFY 決策**：
  - [1] 直接 CLOSED（使用者已 runtime 驗收）
  - [2] 進入 VERIFY
  - [3] 派驗收工單
- **決定**：**[1] 直接 CLOSED**
- **理由**：
  1. **使用者雙情境驗收明確**：zh 設定輸出中文 ✅ + auto 設定輸出中文 ✅（auto 情境的通過同時驗證 auto-detect 正常 + translate=false 生效）
  2. **修復範圍精確**：單行 diff 覆蓋 @kutalia default，無副作用可能
  3. **零意外發現**：Worker 回報無其他語言路徑 / GPU 路徑退化
- **本 session（22）收工條件達成**：BUG-056 + BUG-057 雙 CLOSED
- **BUG-057 效率側記**：OPEN → CLOSED 合計 **50 min wall**（04:45-05:35）；對比 BUG-056 **1h 29min**（packaging 複雜度高於純 JS 邏輯）
- **整體 session 22 救火統計**：
  - Wall time：**2h 30min**（03:05-05:35）
  - 兩個 regression 閉環：BUG-056（packaging）+ BUG-057（runtime flag）
  - Worker 效率：4 個實作工單（T0241/T0242/T0244/T0245）平均 15 min wall，全 DONE
  - 零 Renew、零 FAILED、零盲修（T0241 + T0244 皆反轉 / 排除塔台假設）
- **相關工單**：BUG-057 / T0245 / `b2124b5` / T0244 / BUG-056（同源 regression）

---

### D082 2026-04-23 — T0244 結論吸收 — `@kutalia` default 行為差異，T0245 單行 fix

- **背景**：T0244 Worker 9 min wall（05:16-05:25）交付研究結論（commit `526b7c1`），根因 **H2 確認成立**，H1/H3/H4/H5 全數排除（證據鏈完整）。
- **真正根因**：`@kutalia/whisper-node-addon` 套件 **default `translate: true`**；舊 `whisper-node-addon` 套件（session 21 前）default `translate: false`。`cb65614` regression commit 的 import path 變動（`whisper-node-addon` → `@kutalia/whisper-node-addon`）**繼承了新套件的 default 行為**，voice-handler 從未明確覆寫 `translate`，導致升級即退化。
- **關鍵機制**：whisper.cpp 的 `translate` flag 與 `language` 欄位**正交獨立** — 即使傳 `language: 'zh'`，只要 `translate: true` 仍強制翻譯為英文。使用者「沒傳 lang=zh」假設是副作用非主因（auto 模式確實沒傳 language，但 zh 模式有傳卻仍翻譯 → 證明 translate flag 才是主因）。
- **證據鏈**（T0244 提供）：
  - 證據 1：`node_modules/@kutalia/whisper-node-addon/dist/js/index.js:39` 顯示 `defaultParams` 含 `translate: true`
  - 證據 2：`grep -n "translate" electron/voice-handler.ts` 整檔零命中（唯一語言相關字串為 `language`）
  - 證據 3：`voice-handler.ts:457-466` whisperOpts 組裝僅 4 個 explicit 欄位（`model`/`fname_inp`/`use_gpu`/`no_prints`）無 `translate`
  - 證據 4：`git diff cb65614^ cb65614 -- electron/voice-handler.ts` 唯一變動是 `use_gpu` 表達式（T0239 GPU 讀取）+ import path，與 `translate` 正交
- **決定**：**派 T0245 單行 fix（`electron/voice-handler.ts` 加 `translate: false`）+ dev mode 驗收**
- **理由**：
  1. **根因單一明確**：Worker 證據鏈完整覆蓋所有假設，無歧義
  2. **XS sizing**：1 行 diff 解決全部問題（translate=false 後 language 鏈路自動生效，auto 模式也會正確輸出中文因為 @kutalia auto-detect + translate=false 會輸出原語言）
  3. **Dev mode 驗收夠**：本 fix 純 JS 層（voice options 組裝），非 native binary，不需 NSIS 重裝。dev 或 dir mode 可完整驗證 translate 行為
  4. **不暴露 translate flag 到 Settings UI**：YAGNI — 本 bug 無需使用者控制 translate，強制 false 即可。若未來有翻譯需求再開 PLAN 評估
- **執行工單**：T0245（implementation，`--mode on --interactive`，XS sizing）
- **收工條件不變**：BUG-057 🚫 CLOSED（T0245 驗收通過後）
- **Worker 效率側記**：T0241（BUG-056 研究）13 min + T0244（BUG-057 研究）9 min — **兩次研究型工單皆在 10-20 min XS 預估內完成**。研究前對齊愈精準（BUG 描述含現象特徵 + 塔台假設清單 + 建議前置檔），Worker 神速交付率愈高。L103（先研後修 ROI）本 session 第三度驗證
- **相關工單**：T0244 / T0245 / BUG-057 / `526b7c1`（T0244 commit）

---

### D081 2026-04-23 — BUG-057 OPEN — 第二 regression 發現，A/A/A 路線（研究優先 + 救火優先）

- **背景**：BUG-056 🚫 CLOSED 04:34 後 11 分鐘，使用者立即發現語音辨識繁中設定輸出為精確英文翻譯（非拼音，非音譯）。BAT voice UI 僅提供 auto / zh 兩個語言選項，兩者皆中招，100% 可重現，無 workaround。強懷疑根因 **H2**：whisper `translate: true` 在 Vulkan backend 被誤啟用（「精確翻譯為英文」是 translate mode 招牌特徵）。使用者提示「沒傳 lang=zh」亦相關（H1）。
- **選項**（塔台給三題對齊）：
  - Q1 調查方式：[A] 先研後修 / [B] 直接修 / [C] 探索式合一
  - Q2 與 T0243 順序：[A] BUG-057 優先 / [B] 並行 / [C] T0243 下 session
  - Q3 T0244 sizing：[A] XS / [B] S
- **決定**：**Q1=A（先研後修）+ Q2=A（BUG-057 優先）+ Q3=A（XS 10-20 min）**
- **理由**：
  1. **Q1.A 遵循 L103**：BUG-056 T0241 剛驗證「先研後修 ROI」— 13 min 研究反轉塔台 5 個假設，避免誤派。本次根因空間雖小，但涉及 voice-handler / gpu-detector / Settings UI 三檔鏈路，直接修有風險（例如只改 translate=false 但忽略 language 未傳的問題，或改了 Settings 但 IPC 漏）
  2. **Q2.A core UX > process hardening**：T0243 是「避免未來 BUG-056 類型重演」的預防機制；BUG-057 是「當下繁中使用者核心功能完全不可用」的 P0。L103 原則：使用者可見功能退化 > 未來防呆
  3. **Q3.A XS 預估合理**：根因空間已由使用者提示收斂（精確翻譯 = `translate` mode 特徵 + lang 未傳假設 + cb65614 diff 範圍小）。Worker 10-20 min 可靜態分析收斂，無需大量 grep
- **執行工單**：T0244（research，`--mode on --interactive`，XS sizing）→ T0245（fix，暫定 XS-S，待 T0244 提案定 sizing）
- **本 session 收工條件**：BUG-057 🚫 CLOSED
- **延後事項**（下 session）：
  - T0243（BUG-056 預防對策）
  - T0246 版號 bump + CHANGELOG + Homebrew tap（原 session 21 pending）
  - PLAN-004 狀態更新
  - `*evolve` 批次萃取 L101-L106 候選
- **風險提示**（給使用者）：本 session 已 wall 1h40min（03:05-04:45），若 BUG-057 研究+修復再 30-60 min，合計可能達 2.5-3h。使用者可中途 `*pause` 切下 session。
- **相關工單**：BUG-057 / T0244 / `cb65614` / BUG-056（同源 regression 已 CLOSED）/ T0243（延）

---

### D080 2026-04-23 — BUG-056 CLOSED — T0242 救火完成，零 source diff 修復

- **背景**：T0242 Worker 39 min wall（03:55-04:34，含 2 次使用者互動未觸發 3 題上限）完成修復工單。commit `e46932e` `fix(build): restore @kutalia/whisper-node-addon via npm install (BUG-056)`。
- **修復結果**：
  - Step 1：`npm install` ✅ 補齊 `@kutalia/whisper-node-addon`（8 檔案完整，ggml-vulkan.dll 29.78 MB / whisper.node 413 KB 等）
  - Step 2：SKIPPED（Worker 合理判斷合併至 Step 3/5）
  - Step 3：Path A ✅（`npm run build:dir` 成功，`release/win-unpacked/` `@kutalia` 落地驗證通過）
  - Step 4：✅（NSIS installer 295 MB + signtool 簽章通過，符合 T0238 基準）
  - Step 5：Path B ✅（**使用者完整驗收**：uninstall → install → 啟動 → **Vulkan loader ✅ 偵測到截圖**）
- **VERIFY 決策三選一**：
  - [1] 直接 CLOSED（使用者已驗收）
  - [2] 進入 VERIFY
  - [3] 派驗收工單
- **決定**：**[1] 直接 CLOSED**
- **理由**：
  1. **使用者 runtime 驗收證據強**：Path B Step 5 全程使用者參與 + 明確回報「安裝成功, 正確執行」+ 截圖附件（BAT 設定面板 Voice 頁籤「Vulkan loader: ✅ 偵測到」= ggml-vulkan.dll 成功 load = `@kutalia` native module 工作正常）
  2. **零 source diff 低風險**：T0241 判定 + T0242 證實本 fix 純粹是 `npm install` 補 node_modules，無 code / config 變更，無新 regression 可能
  3. **VERIFY 中間態無新增價值**：VERIFY 用於「code fix 完成但 runtime 尚未驗收」，本次 runtime 已驗收完整，VERIFY 只會增加流程噪音
- **後續**：
  1. T0243（預防對策）排隊待派 — 建議立即派發（fire-and-forget M sizing）
  2. Session 22 pending 恢復：T0243 DONE 後 → T0244 版號 bump + CHANGELOG + Homebrew tap
  3. 意外發現「3 個 zombie `BetterAgentTerminal.exe` 進程」另記為 L 候選 或 BUG-057 另案（不納入 T0243 範圍避免 scope creep）
- **本 session 救火計時**：使用者 03:05 回報 → 04:34 CLOSED = **1h 29min wall**（含塔台對齊 / 研究 / 修復 / 驗收全流程）
- **相關工單**：BUG-056 / T0241 / T0242 / `e46932e` / `cb65614`（regression 源頭）

---

### D079 2026-04-23 — T0241 結論吸收 — BUG-056 修復拆兩張（T0242 修復 + T0243 預防對策）

- **背景**：T0241 Worker 13 min 神速交付（2026-04-23 03:17-03:30），研究結論反轉塔台 H1-H5 預設假設，提出 **H6（塔台未列）**：`cb65614` squash merge 只更新 `package.json` / `package-lock.json`，main repo **從未跑 `npm install`** → `node_modules/@kutalia/` 不存在 → NSIS installer 本質上不含 `@kutalia/whisper-node-addon`。T0238 驗收全綠是因在 **worktree** 打的 installer（worktree node_modules 完整），從 main repo 打是第一次。
- **選項**（使用者提供）：
  - 選項 A：僅修復（T0242 範圍 = npm install + rebuild + 雙 path 驗收）
  - 選項 B：修復 + 預防合一（T0242 merged CI + fail-fast）
  - 選項 C：**拆兩張**（T0242 修復救火 + T0243 預防對策另案）
- **決定**：**Q1=C（拆兩張）+ Q2=B（雙 path 驗收）+ Q3=C（`--mode on --interactive` 保留 NSIS 重裝互動窗口）**
- **理由**：
  1. **Q1.C 救火與治本解耦**：release pipeline 已被 bug 阻塞，T0242 必須最小範圍最快落地；預防對策（CI pipeline 調整 + fail-fast script + CLAUDE.md 文件更新）屬 process 改進，本質 M sizing，硬塞進 T0242 會拖長救火時間。使用者明示「避免以後其他套件加入又發生類似問題」→ T0243 明確預防 BUG-056 類型（多 native module 通用，非僅 `@kutalia`）
  2. **Q2.B 符合 BUG-056 Q3.C 承諾**：T0238 盲點即跳過 NSIS install 路徑，T0242 必須涵蓋 Path A + Path B；跨平台擴展（macOS / Linux）延後到 T0243 評估
  3. **Q3.C 保留互動窗口**：NSIS 重裝需使用者配合 uninstall → install，`--mode on --interactive` 讓 Worker 可在卡關時問使用者（如「可以卸載 BAT 了嗎？」），走 yolo 會卡死
  4. **零 code 修改原則**：T0241 明確驗證 `package.json` asarUnpack / `vite.config.ts` external / `electron/voice-handler.ts` import **全部無需改**。T0242 禁止改 source code，僅補 node_modules + rebuild + 驗收
- **執行工單**：T0242（fix，`--mode on --interactive`，S sizing）→ T0243（prevention，`--mode on`，M sizing，排隊 BUG-056 CLOSED 後派發）
- **成功指標**：
  - T0242：Path A + Path B 雙驗收全綠 → BUG-056 CLOSED
  - T0243：Build fail-fast + CI `npm ci` + CLAUDE.md 更新 → BUG-056 類型重演防護
- **相關工單**：T0241（研究源頭）/ T0242（修復）/ T0243（預防）/ BUG-056（目標 CLOSED）

---

### D078 2026-04-23 — BUG-056 NSIS 打包版啟動崩潰 — 暫停 release pipeline，派研究工單定位根因

- **背景**：Session 21 收工後（2026-04-23 02:45）使用者實機 NSIS installer 測試，啟動瞬間跳 `Cannot find module '@kutalia/whisper-node-addon'`。Require stack 指向 `C:\Program Files\BetterAgentTerminal\resources\app.asar\dist-electron\main.js:1:810`，為 main process 入口。**Regression from `cb65614`**（EXP-GPUWHIS-001 Phase 1 squash merge）。
- **選項**：
  - 選項 A：**開 BUG-056 + 派 research 工單**（根因不明，Worker 靜態分析 + asar 實際內容驗證）
  - 選項 B：先 revert `cb65614` 穩定 main，再從 `exp/` 分支補強 packaging 重新合入
  - 選項 C：直接派修復工單（塔台假設是 `asarUnpack` 缺 `@kutalia/*`，Worker 直接改 `package.json`）
- **決定**：**Q1=B（pause T0241 版號 bump）+ Q2=A（開 BUG-056 + 派 research）+ Q3=C（dir/ 模式 + NSIS 重裝雙路徑驗收）**
- **理由**：
  1. **Q1.B 聚焦 bug**：Release pipeline 已被 bug 阻塞（無法發版），T0241 版號 bump 暫停是自然結果；本 session 完全聚焦 bug 修復避免注意力分散
  2. **Q2.A 拒絕盲修**：塔台已列出 5 個假設（H1-H5），無任一有決定性證據；若直接 revert（選項 B）會浪費 session 21 完整的 Vulkan 整合成果；若直接派修復（選項 C）有盲修風險 — T0238 packaging 驗收剛好是偽陽性前例
  3. **Q3.C 雙路徑驗收**：T0238 驗收盲點正是「用 `ELECTRON_RUN_AS_NODE=1 probe.js` 繞過 Electron main process 的 asar resolver」→ 本次驗收必須涵蓋 NSIS installer 完整重裝路徑，不能再只跑 probe.js
  4. **編號承接**：原 session 21 收工快照預留 T0241 給版號 bump（pending 項目），本次研究工單佔用 T0241 編號；版號 bump 未來用 T0242（或依 bug 修復後實際進度另編）
- **執行工單**：T0241（research，建議 `--mode on --interactive`，`research_max_questions: 3`）
- **成功指標**：
  - 根因收斂到單一或兩個最可能假設
  - 產出可直接派修復工單的提案（具體檔案 / 欄位 / diff 量）
  - 驗收情境涵蓋 NSIS installer 完整重裝路徑
  - T0238 盲點記錄為 L### 學習候選（packaging 驗收必須含 NSIS 路徑）
- **相關工單**：BUG-056 / T0241 / `cb65614` / EXP-GPUWHIS-001 / T0238（盲點來源）/ T0240（squash merge 執行者）

---

### D077 2026-04-23 — EXP-GPUWHIS-001 T-D 合入主線 — Option 1 Squash merge + 刪除 worktree

- **背景**:EXP-GPUWHIS-001 Phase 1 T-A/B/C 全綠交付(commits `bd27732` + `2080880` + `eba79b1` on `exp/gpu-vulkan-poc`)。T-D 最後一張依 spec §7 三選一:(1) 直接 PR 回主線 / (2) BAT 自 fork Kutalia 升 v1.8.4 / (3) 退回紙上評估。
- **決定**:**Q1=A(Option 1 直接 PR)+ Q2=A(Squash merge)+ Q3=A(合入後刪 worktree + branch)+ Q4=B(CHANGELOG/版號下次)**
- **理由**:
  1. **D076 一貫性**:使用者 Q1.A「保留成果合入主線使未來硬體升級零設定自動 enable」,Option 1 是唯一達成此目標的路徑
  2. **Squash merge 歷史乾淨**:3 個 PoC commits(swap / packaging / detection)合為 1 個 feature commit 對未來 bisect/rollback 更友善;PoC 迭代細節在 worktree branch 若有需要可從本 D077 引用的 commit hash 查
  3. **Worktree 刪除符合 EXP CONCLUDED 流程**:本專案 EXP 命名慣例為 worktree 實驗 → 結論後合入主線即刪除 branch(參照 PLAN-004 / EXP-GPUWHIS-001 文件)
  4. **版號與 CHANGELOG 分離降低本 session 複雜度**:本 session 已完成 9+ commits,Q4.B 讓 session 21 收工更乾淨,版號另開工單時可同時處理 CHANGELOG + release pipeline(參照 GP036)
- **執行工單**:T0240(T-D,impl,S sizing)
- **成功指標**:
  - main branch 新增 1 個 feature commit(訊息 `feat(voice): GPU acceleration via Vulkan (EXP-GPUWHIS-001 Phase 1)`)
  - `git worktree list` 不再顯示 `bat-gpu-vulkan-poc`
  - `git branch --list exp/*` 不再顯示 `exp/gpu-vulkan-poc`
  - build + 既有測試在 main 上通過
  - EXP-GPUWHIS-001 狀態 🧪 EXPLORING → 📊 CONCLUDED
- **保留條件(後續可追溯)**:
  - 本 D077 保留 3 個原 worktree commit hash(`bd27732` / `2080880` / `eba79b1`),若未來需對照 T-A/B/C 細節可查 reflog 或重建 branch
  - EXP-GPUWHIS-001 檔案保留在 hot zone,`*archive` 達 `archive_days` 後歸檔到 `_archive/workorders/`
- **後續延伸工作**(**不在 T-D 範圍,另開工單**):
  - 版號 bump + CHANGELOG entry(Q4.B 延後)
  - Phase 2(CUDA advanced tier)— 依使用者硬體反饋決定是否啟動
  - Kutalia upstream 追蹤(fork 停更風險 D076 記錄)
- **關聯**:EXP-GPUWHIS-001(🧪 EXPLORING → 📊 CONCLUDED)/ D076(T-A PARTIAL 接受)/ T0240(執行工單)/ `_spec-gpu-whisper-2026-04.md` §7 T-D

---

### D076 2026-04-23 — T-A PoC PARTIAL 接受 — 硬體瓶頸非套件缺陷,繼續推進 T-B/C/D 合入主線

- **背景**:T0237(EXP-GPUWHIS-001 T-A)13 分鐘交付,commit `bd27732`。**3 項成功判準 2/3 通過**:Vulkan 被選用 ✅、零 crash ✅、但**效能僅 0.99x CPU**(base.en 實測),觸發 spec §6.4 停損 #2。Worker 以 PARTIAL 回報請求塔台拍板 Renew 方向。
- **根因分析**:
  - **套件層完美**:`@kutalia/whisper-node-addon@1.1.0` Vulkan prebuilt 在 BAT Electron 41 / ABI 145 環境**零缺陷載入**,文本輸出正確,10+ 次 inference 無 crash
  - **硬體層瓶頸**:測試環境為 **GTX 1050 Ti(Pascal 2016)**,`fp16: 0` + 無 tensor cores + 無 matrix cores → Vulkan 跑 fp32 kernel 在 12 核 CPU + AVX2 + F16C + FMA + OpenBLAS 面前無優勢
  - **v1.8.3 升級無法解決**:v1.8.3 主要差異在 realtime API 與 VAD,kernel 層未改,Pascal fp16 限制是**物理限制**,非軟體可克服
- **選項**:
  - A. **繼續跑 T-B/C/D 合入主線**(package 能力永久保留,未來硬體升級零設定自動 enable)
  - B. **Worktree 凍結不合主線**(EXP 暫停 EXPLORING,等使用者硬體升級後再跑 T-B/C/D)
  - C. **暫停 EXP 評估其他方案**(Kutalia v1.8.3 升版 / CUDA backend / 保留 legacy 只動 Metal)
  - D. **ABANDONED**(Worker 不推薦 — package 無缺陷,硬體單一樣本不足以否定方向)
- **決定**:**A(繼續跑 T-B/C/D 合入主線)**
- **理由**:
  1. **T-A 證明整合路徑可行**:package 層零缺陷,`use_gpu: true` 在現行套件為 auto-detect,新硬體自動受益、舊硬體走 CPU fallback 不劣化
  2. **未來硬體升級零工作**:使用者明確表達「升級到 4070 之類,自然可開啟支援」→ 唯有 package 進主線才能達成 zero-config enable
  3. **T-B/C/D 不依賴 perf 數據**:T-B(打包)驗證 asarUnpack 與 installer 路徑、T-C(runtime detection)驗證 CPU fallback、T-D(PR 決策)獨立可推進
  4. **ABANDONED 機會成本過高**:package 無缺陷,未來重做一次 PoC 成本高於現在推進成本
- **附帶意外發現(T-A 報告記錄,此處收錄)**:
  1. **Kutalia v1.1.0 API 破壞性變更**:`transcribe()` 回傳值從 `string[][]` 改為 `{ transcription: string[][] | string[] }` → voice-handler 已加 unwrap 邏輯(T0237 `bd27732`)。T-D 合入主線時需在 type 定義補記
  2. **v1.8.3 對 fp16 問題無幫助**:kernel 層未變,Pascal fp16 限制是物理限制
  3. **T-B asarUnpack 需補規則**:`@kutalia/whisper-node-addon` path 需加入 electron-builder asarUnpack config,否則打包後 `.node` 解析路徑失敗
  4. **體積成本實測吻合**:Win x64 ~80 MB / 平台(`whisper.node` 404 KB + `ggml-vulkan.dll` 29 MB + `libopenblas.dll` 49 MB + 其他 ~1.5 MB),四平台約 ~320 MB 總 binary(與 T0236 spec 估算吻合)
- **執行路徑**:
  - T0237 PARTIAL → ✅ DONE(塔台接受,perf caveat 記錄在本 D076)
  - 立即派發 T-B(T0238,electron-builder 打包驗證)
  - T-C(runtime GPU detection + CPU fallback)可與 T-B 平行派發,或依序
  - T-D(PR 正式化)於 T-B/C 全綠後啟動
- **成功指標(合入主線後)**:
  - 使用者硬體升級到 RTX 30/40 系列或同等有 fp16/tensor cores 的 GPU 時,BAT Whisper 自動走 Vulkan 加速,無需任何設定或工單
- **關聯**:T0237(T-A PoC,commit `bd27732`)/ EXP-GPUWHIS-001(🧪 EXPLORING)/ D075(Vulkan-first 決策,本決策接續)/ `_ct-workorders/_spec-gpu-whisper-2026-04.md` §6.4(停損條件參照)

---

### D075 2026-04-23 — GPU Whisper 技術方向由雙軌翻轉為 Vulkan-first

- **背景**:T0236(PLAN-004 研究工單)原假設「CUDA-first + Vulkan fallback 雙軌」(工單建立於 2026-04-23 00:50,基於 T0058 2026-04-12 過時研究)。Worker 在 12 分鐘內完成 2026 年現況調查(commit `f6a2720`,報告 `_spec-gpu-whisper-2026-04.md` 360 行),結論**翻轉原假設**。
- **選項**:
  - A. **維持雙軌**(CUDA-first + Vulkan fallback):忠於原 T0236 假設,完整跨廠商覆蓋
  - B. **Vulkan-first + CUDA 未來 advanced tier**:採 Worker 建議,CUDA 保留延後
  - C. **CUDA-only**:放棄跨 AMD/Intel,僅服務 NVIDIA 使用者
  - D. **暫緩**:延後決策到 PoC 實測後
- **決定**:**B(Vulkan-first + CUDA 未來 advanced tier)**
- **理由**:
  1. **prebuilt 生態現實**:`@kutalia/whisper-node-addon@1.1.0`(2025-07)已 ship Win/Linux Vulkan prebuilt,**零環境配置 + 跨 NVIDIA/AMD/Intel 全覆蓋**;CUDA **沒有**任何 npm 套件同時滿足「Electron ABI 145 + CUDA prebuilt + 零環境配置」
  2. **速度差異不顯著**:CUDA 對 Whisper 場景僅 +20-30% 加速,使用者體感無感
  3. **installer 成本差異懸殊**:Vulkan +30-50 MB vs CUDA +150-300 MB
  4. **UX 衝擊差異**:Vulkan 零衝擊(套件內建 auto-detect) vs CUDA 中等衝擊(使用者需安裝 CUDA Runtime)
  5. **v1.8.3 iGPU 優化加碼**:whisper.cpp v1.8.3(2026-01)專為 iGPU 做 12x 優化,**Stable 非 experimental**,社群實測 ≈ 10x CPU
  6. **CUDA 延後不失**:未來若使用者明確反饋速度不足,可加做 CUDA advanced tier,Vulkan-first 不阻斷 CUDA 路徑
- **執行路徑**:
  - 建 EXP-GPUWHIS-001 `vulkan-first-integration`,合併 Worker 建議的 T-A/B/C/D 四張拆單統一追蹤
  - Phase 1 以 Vulkan(Kutalia fork)為主,CUDA 完全延後到 Phase 2+
  - EXP worktree 隔離實驗,PoC 成功後 PR 回主線(成功路徑)或丟棄(失敗路徑)
- **已識別風險**(EXP 追蹤):
  - Kutalia fork 9 個月未更新(whisper.cpp submodule 停在 v1.7.6)→ 若 Vulkan 效能不如預期,升級路徑為 BAT 自 fork Kutalia + rebase upstream v1.8.4
  - Electron 41 ABI 145 與 node-addon-api 8.3.1 相容性 → PoC 第一件事驗證
  - Intel iGPU compute feature 不支援 → 已設計 CPU fallback
- **關聯**:T0236(研究工單,commit `f6a2720`)/ PLAN-004(IN_PROGRESS)/ EXP-GPUWHIS-001(本決策產生)/ `_spec-gpu-whisper-2026-04.md`(Worker 產出技術選型報告)

---

### D074 2026-04-22 — BAT 塔台接手 Phase 1-4 派發(T0099-T0106)

- **背景**:CT-T010(2026-04-22 11:25 ✅ DONE,commit `e362ed1`)交付 BMad-Guide 主 PLAN T0098 + Phase 1-4 骨架 8 張(T0099-T0106,全 📋 TODO)。原本 CLT 對齊 6 項改良預期由 BMad-Guide 自行推進,BAT 僅作 dogfood 驗證場 #1。
- **選項**:
  - A. BAT 僅 dogfood,Phase 1-4 交還 BMad-Guide 自行派發
  - B. BAT 塔台接手 Phase 1-4 派發,透過 CT-T### DELEGATE 工單逐張推進 T0099-T0106
- **決定**:B(BAT 接手派發)
- **理由**:
  1. **consumer 感最強**:BAT 已是 CT skill 成熟 consumer,對 6 項改良(intervention_type / affects_files / spec_level_check / *evolve distillation 等)在真實工作流的痛點最清楚
  2. **double-loop 第一 loop 就地承擔**:BAT dogfood + 2026_Cooperative 激進驗證的雙 loop 架構下,第一 loop 直接主導派發能壓縮回饋路徑
  3. **DELEGATE 模式已熟**:CT-T008/T009/T010 連續三張 DELEGATE 都順利交付(含 yolo 模式),pattern 已驗證
  4. **skill 改動風險可控**:T0098 骨架 sanitize 零命中,BMad-Guide worker 執行時 BAT 塔台僅做協調與驗收,不寫 CT skill 檔
- **執行模式**:
  - 每個 Phase 以 CT-T### DELEGATE 工單派發(mode 依 Phase 風險決定,Phase 1 可 yolo、Phase 2 建議 non-yolo)
  - 派發順序:Phase 1(audit,低風險熱身)→ Phase 2(template 最高衝擊)→ Phase 3(*evolve 輸出拆分)→ Phase 4(doctrine 文件)
  - BAT 本地 dogfood 在每個 Phase 交付後立即做(`*sync` / `*evolve --status` / 新工單驗證 template v3.7 等)
- **時機**:等 T0229(PLAN-027 research)回報後評估 — 若 T0229 結論明確且 PLAN-027 Phase 1 派發不急,可先啟 CT v4.4 Phase 1;若 PLAN-027 需立即推進,CT v4.4 Phase 1 延後
- **關聯**:PLAN-028(主 PLAN 接手登記)/ CT-T010(骨架交付)/ T0098(BMad-Guide meta-PLAN)/ L089(跨專案 DELEGATE 降格模式)
- **⚠️ 過時標記**(2026-04-22 20:50,session 20):對端塔台 BMad-Guide 在 2026-04-22 下午(12:10-22:40)自主執行並完成 Phase 1-2 全部(T0099-T0104 + T0108 bootstrap 順修),push 到 `origin/dev-main`。BAT 未派發任何 CT-T### DELEGATE 工單。**本決策實際未執行**。Phase 3-4(T0105/T0106)處理方式需重新決策(由對端續作 / BAT 派發 / 暫緩),候選為 D075。

---

### D073 2026-04-20 — PLAN-022 結案,Step 3 TOFU fallback 不做

- **背景**:PLAN-022 dispatcher fingerprint pinning,Step 1+2(T0217,2026-04-19 DONE)採 fail-close 模式(`server-cert.json` 讀失敗即拒絕連線)。Step 3 TOFU fallback 原標「選用」,規格預留作延伸。第十七 session 使用者 review 時提問「做 Step 3 有什麼好處?」,塔台作利弊分析後使用者決策結案。
- **選項**:
  - A. Step 3 不做,PLAN-022 直接 DONE
  - B. 補 Step 3(20-30 min 工單,新增 `~/.bat-dispatcher/trust.json` TOFU 機制)
- **決定**:A(Step 3 不做,結案)
- **理由**:
  1. **安全性倒退**:TOFU 第一次若被惡意 process 騙就永久失陷;fail-close 每次讀最新 cert,無此風險
  2. **好處不成立**:TOFU 主要好處(dispatcher 脫離 BAT 路徑假設、跨機器使用)在當前威脅模型**不存在** — dispatcher 限 localhost、BAT 是 Electron 單機 app、無 portable 模式計畫
  3. **與實作決策衝突**:T0217 當時**刻意**選 fail-close(「BAT app 已啟動」是隱含前提,cert 讀失敗 = BAT 未準備好 = 應拒絕),回退等於推翻刻意決策
  4. **對稱性 ≠ 正確**:PLAN-018 server 端 TOFU 面對任意 client,dispatcher 面對本機 cert,威脅模型不同,不需機械式對稱
  5. **錯誤訊息已足夠**:fail-close 的 mismatch log 含「Possible MITM or BAT app reinstalled」,使用者可自行清 cache
- **未來重啟條件**(任一觸發才重新評估 Step 3):
  - BAT 要支援 portable 模式或非標準安裝路徑
  - Dispatcher 要跨機器使用
  - 收到 UX 回報「cert mismatch 訊息看不懂」
- **相關**:PLAN-022、T0217(Step 1+2 實作)、PLAN-018 T0182(server TOFU 基建)、BUG-046(延伸議題)

---

### D072 2026-04-20 — archive_days 7 → 2(歸檔門檻)

- **背景**:第十六 session `*sync` 後熱區累積 73 T + 17 BUG + 19 PLAN。`*archive` 在 7 天門檻下 0 候選(所有 T 工單都在 7 天內被後續 session meta commit 動到,計時重置)。
- **選項**:
  - A. `archive_days: 3` — 嚴格 `>3` 邏輯下仍 0 候選(最老 T 工單剛好 3 天)
  - B. `archive_days: 2` — `>2` 邏輯抓到 ≥3 天前,實測 4 張候選
  - C. 維持 7 天,熱區自然成長
- **決定**:B(`archive_days: 2`)
- **理由**:
  1. 對齊第十五 session 歷史決策「歸檔閾值降為 2 日」
  2. 本專案 session 密度高(3 天 ≈ 3-4 sessions),2 天冷卻足夠
  3. 比先前 dogfood `archive_days: 1` 保守,避免 L066「過度頻繁觸發」
  4. 歸檔只是 `git mv`,可用 `*archive --restore` 取回
- **執行結果**:歸檔 T0149/T0150/T0154/BUG-034 共 4 張(commit `cd3b0d8`)
- **相關**:`_tower-config.yaml`、L066、`*archive`、`*sync`

---

### D071 2026-04-20 — PLAN-021 dev smoke 驗收暫緩,UX 另案

- **背景**:第十六 session 收尾後,塔台列出 T0218+T0219 合併 dev smoke 9 情境清單,使用者審視後識別「UX 體驗設計不佳」。
- **選項**:
  - A. 硬著跑 9 情境,驗收通過閉環 PLAN-021
  - B. 暫緩 smoke,另開議題討論 UX refactor
  - C. 直接 drop PLAN-021
- **決定**:B(暫緩 + UX 另案)
- **理由**:
  1. T0218/T0219 code 本身正確(已 commit),功能無錯
  2. 使用者識別整體 Settings Remote 區塊 UX 有改進空間(非單一按鈕問題)
  3. smoke 通過不等於 UX 好,硬驗反而掩蓋問題
- **後續**:PLAN-021 保留 code 不退版,UX 另案待使用者開議題時討論
- **相關**:PLAN-021、T0218、T0219

---

### D070 2026-04-19 — T0222 附加發現處理:BUG-052 獨立 + T0223 合併修

- **背景**:T0222(BUG-051 研究工單)完成時,Worker 從 `install.cjs` 挖出額外發現:`main.ts:1882` + `tests/claude-code-path.test.ts` 假設 POSIX 檔名為 `claude`(實際跨平台永遠叫 `claude.exe`),影響非 Windows 平台。
- **選項**:
  - A. 併入 BUG-051/T0223,不獨立編號
  - B. 開 BUG-052 獨立追蹤 + T0223 一次修兩處
  - C. 開 BUG-052 + 獨立 T0224 修
- **決定**:B(獨立編號 + 合併修)
- **理由**:
  1. 同族 root cause(對 CLI binary 的錯誤假設)→ 適合同工單修
  2. Min-diff 仍成立(~2 行 code + 2 行 test),不需拆工單
  3. 獨立編號便於追蹤(macOS/Linux 樣本出現時好找)
  4. 沿用 T0221 Worker 品質亮點「同 pattern 一併修」
- **執行結果**:T0223 4 min 完成,commit `42b45b0`,BUG-051 + BUG-052 雙 CLOSED(smoke pass)
- **相關**:BUG-052、T0222、T0223

---

### D069 2026-04-19 — BUG-051 與 BUG-047 關係:不算翻案,獨立編號

- **背景**:BUG-047 驗收通過後,使用者立即回報新 bug(claude-cli preset 終端 `node <claude.exe>` 失敗)。需判定是翻案還是新 bug。
- **選項**:
  - A. 翻案 BUG-047 → FIXING(認定 T0221 修復不完整)
  - B. 獨立開 BUG-051(BUG-047 root 已修,此為 downstream consumer bug)
- **決定**:B(獨立追蹤)
- **理由**:
  1. BUG-047 的 SDK 側 resolve path 已由 T0221 完全修正(smoke pass 驗證)
  2. 新 bug 是 T0221 修改回傳值後,consumer(`WorkspaceView.tsx:684`)未跟著調整的 downstream 影響
  3. 兩個 bug 現象、影響範圍、修復位置不同
  4. 獨立編號便於後續樣本追蹤和歸檔
- **相關**:BUG-047、BUG-051

---

### D068 2026-04-19 — BUG-051 範圍判定:派研究工單深查

- **背景**:BUG-051 根因看似明確(`WorkspaceView.tsx:684` 無條件 prefix `node`),但使用者補充「要考慮相容 dev server 執行」,牽動 dev/packaged × Windows/POSIX 4 象限驗證。
- **選項**(需求對齊 Q2):
  - A. Min-diff 直修(去 `'node'` prefix 1 行)
  - B. 加 unit test regression guard
  - C. 深查 — 派研究工單調查所有 consumer 假設 + dev/packaged 相容性
- **決定**:C(派研究工單 T0222)
- **理由**:
  1. 使用者特別提「相容 dev server」→ 不只是 packaged 問題
  2. 避免 BUG-047 重演「只驗某面沒驗另一面」
  3. 研究成本低(Worker 壓縮比通常 5-10x),翻車風險高於直修
- **執行結果**:T0222 3 min 完成,壓縮 ~7-13x(研究工單破紀錄),交付 4 象限驗證結論 + α 方案推薦
- **相關**:BUG-051、T0222

---

### D067 2026-04-19 — T0221 YOLO 回報策略:code-only 必回 PARTIAL 觸發斷點 A

- **背景**:T0221(BUG-047 code 修復)在 YOLO 模式派發,Worker 完成 code + build + unit test 後,需決定是否直接回報 DONE 或 PARTIAL。
- **選項**:
  - A. DONE(Worker 完成所有可做的事)
  - B. PARTIAL(code-only 不含 packaged smoke,需使用者驗機)
- **決定**:B(PARTIAL 觸發斷點 A)
- **理由**:
  1. Packaged smoke 屬於「需人介入」類型,YOLO 無法自動化
  2. 若直接 DONE,使用者必須手動翻 PARTIAL,多一步
  3. 原則明確化:「可自動化 → YOLO / 需人介入 → 斷點」
- **通用化**:此決策作為本專案 YOLO + 驗收類工單的回報約定,後續 T0223 沿用
- **相關**:T0221、T0223

---

### D066 2026-04-19 — BUG-047 驗收失敗處理策略:派研究工單而非直接修復

- **背景**:BUG-047 T0198/T0199 修復後 Rico 驗證仍失敗(v0.2.2-pre.1),後 Gower 裝 v0.2.2-pre.1 也複現同路徑錯誤,樣本 2 人跨版本 100% 阻擋。嚴重度升 High。
- **選項**(需求對齊 Q2):
  - A. 退 FIXING + 派研究工單 T0220 調查根因
  - B. 直接派修復工單(根據 Rico 錯誤訊息推測 asar resolve 問題)
  - C. 翻案 T0197 + T0198/T0199,重新評估
- **決定**:A(先研究)
- **理由**:
  1. T0197/T0198/T0199 已嘗試多種修復都未生效,直接再修風險高
  2. 根因不明時先研究,避免重蹈 T0198「驗證缺口」覆轍(當時只驗檔案位置沒跑 packaged smoke)
  3. 研究成本低(Worker 壓縮 5-10x),收斂後再派修復工單風險更低
- **執行結果**:T0220 6 min 完成(壓縮 ~3x),定位根因為 `resolveClaudeCodePath()` `require.resolve('cli.js')` 在 v2.1.113 拋 MODULE_NOT_FOUND → 回空字串
- **相關**:BUG-047、T0220、T0221

---

### D065 2026-04-19 — PLAN-021 UX 簡化:移除 Test 按鈕(error path 已提供回饋),新增停止前連線數警告

- **背景**:T0218 Worker 忠實照 PLAN-021 原始設計實作 Step 1+2+3+4(含 Test 按鈕 + OS-specific 佔用查詢)。使用者跑 7 情境 smoke 中,提出 UX 觀察:
  1. **啟動伺服器時若 port 衝突會直接 EACCES 報錯**(Image #5:port 80 `listen EACCES: permission denied`)→ 使用者已獲清楚回饋
  2. **熱切換失敗時 Worker 實作有 rollback + 錯誤訊息** → 同樣提供清楚回饋
  3. **兩個 error path 加總 = Test 按鈕功能** → Test 按鈕成為**多餘的中介步驟**,增加使用者心智負擔(要先 Test 再 Save,雙重操作)
  4. **真正 UX 缺口**:停止伺服器時無警告,可能誤斷他人活躍連線(現況一點就停)
- **選項**:
  - [A] 保留 Test 按鈕 + 現有 UI,不改
  - [B] 移除 Test 按鈕 + 相關邏輯,改加停止前警告 dialog
  - [C] 兩者都做:保留 Test 但加停止警告(UI 越來越複雜)
- **決定**:[B] 簡化設計
- **理由**:
  1. **KISS**:error path 已存在時,獨立「測試 helper」反增摩擦
  2. **使用者真實痛點**:未警告的停止比未預驗的 port 更有風險(前者可能影響他人,後者只會在 local 報錯)
  3. **減少維護**:移除 IPC handler `settings:test-port` + OS-specific 查詢(Windows netstat / Unix lsof)+ 相關 22 i18n key 的一部分
  4. **對齊 error UX**:使用者習慣「試了再說」而非「先 simulate」(PLAN-021 原設計受 Nmap 等網路工具習慣影響,但 app settings 不是網工場景)
- **落地範圍**(T0219 執行):
  - **移除**:
    - UI Test 按鈕 + 相關 state(`portTestResult`, `portTesting`)
    - IPC handler `settings:test-port`
    - `electron/remote/port-test.ts` 的 OS-specific 查詢邏輯(保留 `testPort` helper 供未來他用,或整個刪除)
    - preload `window.electronAPI.settings.testPort` bridge
    - i18n:`remotePortTest`, `remotePortTesting`, `remotePortTestHint`, `remotePortAvailable`, `remotePortInUse`, `remotePortInUseBy`, `remotePortPermissionDenied`, `remotePortInvalid`, `remotePortUnknown`(9 key × 3 locales = 27 行)
  - **新增**:
    - 停止伺服器 confirm dialog:「即將停止伺服器,將中斷 N 個活躍連線。確定?」(N = `serverStatus.clients.length`)
    - N=0 時可選:不彈 dialog 直接停(UX 順)或仍彈 dialog 統一行為(安全)
  - **保留**:
    - Port editor + Save & hot-switch + Reset + URL preview
    - 改 port 時的 active conn 警告(已在)
    - hot-switch rollback + restartError 回傳
- **UX 原則衍生**:「error path 已提供回饋時,勿另加『測試 helper』中介步驟」— 候選 Global GP,待 T0219 完成後 `*evolve` 評估
- **影響**:
  - PLAN-021 狀態:IDEA → IN_PROGRESS(Step 1+2+4 DONE T0218,Step 3 UI 簡化由 T0219 接手)
  - T0218 狀態:PARTIAL → DONE(技術實作 + backend + 核心 smoke 6/7 通過,UX 改動為後續迭代)
  - T0219 待開:UX 簡化工單
- **相關工單**:PLAN-021 / T0218 / T0219(待開)/ T0215(T0217 smoke 回歸驗證 backend 不破壞)

---

### D064 2026-04-19 — BUG-050 階段 2 暫緩:2 樣本 + 真實 YOLO 工作流驗證零異常,保持 VERIFY 待真實問題觸發

- **背景**:D063 決議 VERIFY + 觀察 3-5 張 YOLO log 再決策階段 2 啟動 vs CLOSED。第十三 session 派了 T0216(PLAN-023 階段 3)與 T0217(PLAN-022 Step 1+2)作為 YOLO 樣本 #1/#2。兩張全 clean,writeResp payload 結構 100% 符合預期(`hasError:false` + `payload.ok:true` + `reason:"queued"`),未觀察到 BUG-050 描述的 silent drop 或異常。T0217 更進一步:真實 YOLO 工作流 end-to-end 驗證(Worker smoke 1 訊息 + auto-submit 都直接到塔台 terminal,非剪貼簿 fallback)。
- **證據質量**:
  - 樣本 #1(T0216):Worker 開工 + auto-submit 全鏈路 OK,Step 0 banner 正常,CT_MODE=yolo env 注入正確
  - 樣本 #2(T0217):更強驗證 — Worker 主動改 bat-notify.mjs + 跑 smoke match 情境 + auto-submit,三次經過新 notify 鏈路都正常
  - 樣本量:2 張(下限目標 3 張未達)但**證據質量 > 數量**
  - 0 個異常跡象,與樣本數的距離不具實質價值
- **選項**:
  - [A] 再派 1-2 張樣本湊滿下限 3(保守)
  - [B] 階段 2 暫緩,保持 VERIFY,階段 2 待真實問題觸發再啟動
  - [C] 直接 CLOSED + 清理 `[T0215-DEBUG-REMOVE]` debug log + PLAN-024 階段 2 ABANDONED(激進)
- **決定**:[B] 階段 2 暫緩
- **理由**:
  1. **證據質量支持**:2 樣本全 clean + 真實工作流 end-to-end 通過,比單純 smoke 更有價值
  2. **避免「解決不存在的問題」**:階段 2 目標是修 refork race(#2/#6/#7),但這些在真實工作流中未觸發 — 推測性修改有引入新問題風險(階段 1 本身就是先修後觀察的實證)
  3. **GP058 區分**:GP058 警告「偶發症狀複測正常不等於根因消除」,但本案是**完全無症狀**(連偶發都沒有),不適用該警告情境
  4. **保留階段 2 選擇權**:PLAN-024 階段 2 仍 PLANNED,未來若觀察到 refork race 真實觸發(如 BAT 重啟場景、多 Worker 並發)可立即啟動,不是 ABANDONED
  5. **debug log 保留**:`[T0215-DEBUG-REMOVE]` 3 處標記暫不清理,可繼續觀察自然累積的 YOLO log 樣本
- **後續觀察策略**:
  - BUG-050 保持 🧪 VERIFY 狀態
  - 每張 YOLO 派發自然累積樣本(免專門派測試工單)
  - 若觀察到異常 payload(非 `{ok:true,reason:"queued"}`)→ 立即轉 FIXING + 啟動 PLAN-024 階段 2
  - 若連續 10+ 張 YOLO 樣本全 clean → 下次決策點考慮 CLOSED + 清理 debug log
- **相關工單**:BUG-050(VERIFY 保持)/ PLAN-024 階段 2(PLANNED 保持)/ T0216 / T0217 / D063

---

### D063 2026-04-19 — BUG-050 階段 1 smoke 通過,FIXING → VERIFY,觀察 YOLO log 再決策階段 2

- **背景**:T0215 交付 BUG-050 Option C 階段 1 方案 A(`38725e9`)— `writeWithResult` 新 API + `bat-notify.mjs` 嚴格 `ok === false` 阻斷,覆蓋 9 個 silent drop 點中的 6 個(#1/#3/#4/#5/#8/#9)。第十三 session 啟動後使用者重啟 BAT 載入新 server,跑 smoke 場景 1(正常 target,預期 ok:true)+ 場景 2(不存在 target,預期 ok:false + 顯性錯誤)。
- **smoke 結果**:場景 1 `exit=0` + `{ok:true,reason:"queued"}` + 訊息到達;場景 2 `exit=1` + `{ok:false,reason:"pty-not-found"}` + stderr `Error: PTY write failed: pty-not-found`。兩場景 100% 符合 T0215 預期。
- **F-13 三選項**:
  - [A] VERIFY + 觀察 YOLO log(3-5 張樣本)
  - [B] 直接 CLOSED
  - [C] 派 AI 驗收工單
- **決定**:[A] VERIFY + 觀察 YOLO log
- **理由**:
  1. 階段 1 方案 A 僅覆蓋 6/9 silent drop 點,refork race(#2/#6/#7)要階段 2 correlation id
  2. smoke 只驗 happy path + 1 error path,不等於真實 YOLO 工作流全覆蓋
  3. 第十二 session 快照明確指引「連續觀察 3-5 張 YOLO log 樣本」— 這是評估階段 2 必要性的關鍵資料
  4. PLAN-024 雙階段包裹已 PLANNED,VERIFY 期間累積的 log 樣本直接餵給階段 2 決策
- **觀察目標**(3-5 張 YOLO log):
  - `[T0215-DEBUG-REMOVE]` 出現頻率與 payload 結構穩定性
  - 是否有 `ok:false` 以外的非預期 reason
  - refork race(#2/#6/#7)是否在真實 YOLO 流程中觸發
  - 若階段 1 已足夠 → CLOSED + 清理 debug log;若 refork race 出現 → 啟動階段 2
- **下一步**:
  - 階段 1 留 VERIFY,累積 YOLO 派發樣本
  - `[T0215-DEBUG-REMOVE]` 3 處標記供未來 grep 清理(CLOSED 或 階段 2 完成時)
  - PLAN-024 階段 2(correlation id)等觀察期結論
- **相關工單**:BUG-050 / T0214(research)/ T0215(fix 方案 A)/ PLAN-024

---

### D062 2026-04-18 — Worker 無狀態原則：runtime context 由塔台派單 explicit 傳遞

- **背景**：T0175 研究 DONE 後，使用者觀察 Worker 回報「auto-session 未設 → 預設 ask → 跳過 Step 8.5」，但塔台 project config 明明是 `auto-session: yolo`。實證 Worker 側沒讀到或讀錯 config 檔，yolo 自動化鏈路斷半（Worker 走 Step 11 剪貼簿而非 Step 8.5 自動 submit）。
- **問題**：BUG-040（workspace 錯派）和 yolo gap 是**同一設計缺失的兩個症狀** — Worker 依賴「共享狀態」（config 檔 / activeWorkspaceId UI 焦點）推斷 runtime context。
- **選項**：
  - [A] Worker 讀 config 檔（現狀延續）
  - [B] Worker 讀環境變數，由塔台派發時注入
  - [C] Worker 讀 flag，由塔台派發時傳遞
  - [D] 混合：flag + env
- **決定**：[D] Worker 無狀態，所有 runtime context（`workspaceId`、`yolo` 旗標、其他 mode flags）由塔台派單當下透過 flag/env **explicit** 傳遞
- **理由**：
  1. **防止中途設定異動**：工單派發後使用者改 config 不應影響執行中 Worker
  2. **單因子除錯**：失敗時只需檢查「派單當下傳了什麼」，不用追跨 session 共享狀態
  3. **與 T0173 方案 A 同哲學**：`--workspace` flag 就是此原則的第一個應用實例
  4. **race condition 防護**：多塔台/多 Worker 平行時不會互相污染 config
  5. **跨環境一致**：本機 vs Remote Desktop vs BAT 內部終端皆同行為
- **落地規則**：
  - Worker skill（`/ct-exec`）**不應讀** `_tower-config.yaml` 或 `~/.claude/control-tower-config.yaml`
  - Worker 判斷 mode 一律走「塔台派單時注入的 env 或 flag」
  - 塔台派發指令模板（`SKILL.md` + `auto-session.md`）需補上所有 mode flags
  - BAT 端（`bat-terminal.mjs`）負責接收 flag → 注入 env 給 Worker PTY
- **影響範圍**：
  - 現有：BUG-040 `--workspace` flag（Phase 1 修復中）
  - 新增：BUG-041 yolo flag 傳遞（Phase 2）
  - 未來：任何新 mode / 新 runtime context 都遵循此原則
- **反模式警告**：Worker 絕不讀 `_tower-config.yaml`。若未來發現 Worker 需要「全局偏好」（非 runtime context），另開 PLAN 討論是否該提升為 explicit 傳遞。
- **相關工單**：BUG-040 / BUG-041（待開）/ T0175 / T0176（Phase 1）/ CT-T004（Phase 1 DELEGATE）/ T0179+（Phase 2）
- **衍生學習候選**（L068）：「Worker 無狀態」為 CT 通用設計原則，值得晉升 Global playbook

---

### D061 2026-04-18 — CT-T002 閉環 + v4.2.0 tag，對方塔台已吸收 yolo 功能

- **背景**：CT-T002 Worker 首次執行完成技術實作 commit `bfc4ba5` 後回報 PARTIAL（remote 是 Forgejo 非 GitHub，無法 `gh pr create`）。塔台 Renew #1 指示沿用 CT-T001 先例 push + snapshot + CHANGELOG 流程。Worker 第二次執行時 F-11 範圍守衛觸發：前提失真，對方塔台（BMad-Guide）已透過 CP-T0094/CP-T0095 自行吸收 yolo 功能（`def3053` 重做 + `d65f451` CHANGELOG + `3a93952` source sync + ZIP 已產出）。
- **選項**：
  - [A] 直接 DONE，不補 tag
  - [B] 打 v4.2.0 tag + DONE
  - [C] 比對 `def3053` vs `bfc4ba5` 等價性
  - [D] 保持 PARTIAL，開新 CP-T00XX 只處理 tag
- **決定**：[B] 補打 v4.2.0 tag + DONE
- **理由**：極小動作（單 tag）閉環乾淨；未來引用 v4.2.0 可精準回溯；不重複對方塔台已做的事
- **執行結果**：Worker Renew #2 執行 `git tag -a v4.2.0 -m "feat: yolo autonomous mode (PLAN-020)" d65f451 && git push origin v4.2.0` 成功（15:09:10 UTC+8）
- **附帶收穫**：
  - Worker F-11 範圍守衛行為正確（避免衝突操作，紀錄學習候選）
  - 對方塔台 source sync 已完成（T0172 驗證 [OK]），本機 `~/.claude/skills/` yolo 可用
  - 對方塔台實作比 Worker 草稿更嚴謹（yolo 硬鉤子失敗**不跑 Step 11**，避免狀態重複）
- **跨專案學習候選**：「長時差異 DELEGATE 的 Renew 前置驗證」值得晉升為 playbook
- **相關工單**：CT-T002 / T0172 / PLAN-020

---

### D060 2026-04-18 — yolo 下一張工單資訊來源採 Q2.A（研究工單 D 區段）

- **背景**：T0167 研究工單回報區針對「塔台如何判斷下一張工單」列出 Q2 A/B/C 三選項，Worker 刻意不推薦、要求塔台出面決策。工單 3（塔台 skill 自主決策規格）與工單 4（上游 COORDINATED）卡在此決策。
- **選項**：
  - [A] 研究工單 D 區段：重用現有機制，零模板升級
  - [B] PLAN 檔案結構化工單清單：語意最正確，模板升級成本高
  - [C] `_yolo-queue.md` 專用檔：獨立乾淨，但與 PLAN/工單資訊重複
- **決定**：[A] 研究工單 D 區段
- **理由**：
  1. 立即可用，零模板升級（B 需回填 PLAN-018/020 等所有現有 PLAN）
  2. T0164/T0166/T0167 三張研究工單都穩定產出結構化 D 區段 — Worker 產能已驗證
  3. 失敗可回退 ask 模式（斷點 A 觸發即可）
  4. B 可作為未來演進（非本 PLAN 範圍，需另開 PLAN）
- **影響**：
  - 工單 3 規格收斂為單一分支（A 分支），可立即開工（依賴工單 2 完成）
  - 工單 4 上游 COORDINATED 可啟動
  - 未來若要升級到 B，需新開 PLAN 處理模板遷移
- **相關工單**：PLAN-020 / T0167 / 未派工單 3 / 未派工單 4

---

### D059 2026-04-18 — PLAN-020 yolo 模式插隊啟動，PLAN-018 冷凍作為驗證場景

- **背景**：使用者在 PLAN-018 對齊 Q1/Q2 中途（T0166 研究 DONE 後）觀察 `auto_session: on` 反向通道（Worker→塔台）未觸發，提出 yolo 模式提案：Worker 自動送出 + 塔台自主決策多工單 PLAN。此為跨 skill + BAT code 的架構改善，直接影響 PLAN-018 剩下 4 張實作工單的效率。
- **對齊結果**（Q1-Q3）：
  - Q1.B：開 PLAN-020 + 立刻派研究工單（T0167）
  - Q2.B：skill + BAT 同時改（整合 bat-notify 基礎設施）
  - Q3.C：PLAN-018 冷凍，yolo 完成後用 PLAN-018 剩下 4 張工單作驗證
- **決定**：
  1. 建立 PLAN-020（🔴 High）
  2. 立刻派 T0167 研究工單（~1.5-2h）
  3. PLAN-018 進入 PAUSED 狀態，保留 T0166 研究產出完整性
  4. yolo 完成後 `*resume` PLAN-018 → 用 yolo 跑剩下 4 張驗收
- **理由**：yolo 的投資報酬率高（後續每張工單省 1 輪人工介入），且 PLAN-018 正好是 4 張工單的驗證場景（dogfood）
- **關鍵技術發現**（見 T0167 研究結論）：
  - env 注入鏈路完整（本 session 實測 `BAT_TOWER_TERMINAL_ID=c8a43b...` 有值）
  - 真正根因是 ct-exec Step 8.5 被標為「可選/靜默跳過」+ `pty:write` 不加 `\r` + Step 11 剪貼簿蓋過 Step 8.5
- **跨專案邊界**：BAT code 改動走本專案，skill 改動需先本地草稿 → 上游 `CT-T###` COORDINATED 工單，遵循 PLAN-011 先例
- **相關工單**：PLAN-020 / T0167 / PLAN-018（冷凍）

---

### D058 2026-04-18 — Upstream v2.1.42+ 同步採方案 [A]：T0165 Phase 1 cherry-pick + PLAN-018 Phase 2 獨立

- **背景**：T0164 研究工單（2026-04-18 06:49-07:08）評估 upstream `tony1223/better-agent-terminal` 自 `8d23e6e` (lastSync 2026-04-16) 後的 13 個新 commit（v2.1.42 → v2.1.46-pre.1）。產出詳細報告 `_report-upstream-sync-v2.1.42-plus.md`。
- **分類結果**（扣除 2 個 merge 後實質 11 包）：
  - cherry-pick 2 包（Phase 1）：C1.1 = Opus 4.7 + SDK/CLI 2.1.111 + EFFORT_LEVELS + xhigh（`357b868` + `9c3daf8`）/ C1.2 = remote workspace:load + profile:list-local（`0bc3bc1`）
  - 移植 1 包（Phase 2）：P2.1 = remote TLS + fingerprint pinning + path sandbox + brute-force 防護（`3a0af80` + `5d9f486`，16 檔 +1288/-285）
  - skip 4 包：WorkerPanel TDZ（架構不同）/ account-manager keychain（fork 無此檔）/ perf 優化（BAT 客製化環境有 regression 風險，使用者明確指示）/ PowerShell launch（同 WorkerPanel 架構）
- **選項**：
  - [A] Phase 1 + Phase 2 獨立 PLAN（Worker 推薦）
  - [B] 只 C1.1（Opus 4.7）
  - [C] 全部延後
  - [D] 先 Phase 2 再 Phase 1
- **決定**：**[A]** — 立即派 T0165（Phase 1 ~2h）+ 開 PLAN-018 規劃 Phase 2（6-10h，排下週）
- **理由**：
  1. **T0165 當天可完成**：2h 範圍明確，Opus 4.7 可立即在 BAT 內使用
  2. **PLAN-018 獨立推進不阻塞**：remote 資安加固是 P0，但 6-10h 工時本週負荷已滿（PLAN-016/005/003 剛全閉環）
  3. **使用者關鍵補充已納入**：C1.1 必須按 ①-⑨ 順序執行（SDK/CLI 先於 Opus 4.7 builtin），否則 `model-not-supported`
  4. **Phase 3 skip 理由已留存報告**：日後 upstream 若再改動可回看，不重複分析
- **關鍵對應**：v2.1.46-pre.1（`5d9f486`）的 selfsigned fix 屬於 Phase 2 範圍，C1.1 的 SDK/CLI 目標版本（`^0.2.111` / `^2.1.111`）來自 v2.1.45（`9c3daf8`）
- **衍生工單**：T0165（Phase 1 cherry-pick）/ PLAN-018（Phase 2 remote 資安加固）
- **相關工單**：T0164/T0165/PLAN-018
- **相關報告**：`_report-upstream-sync-v2.1.42-plus.md`

---

### D057 2026-04-18 — mac 打包採雙 arch dmg，放棄 universal

- **觸發事件**：EXP-BUILDER26-001 CONCLUDED 後首次觸發 GitHub Actions Pre-Release workflow，CI 環境暴露本地 Windows dry-run 沒抓到的多層失敗（schema → universal merge 地獄）。共 5 次 run 修正，最後改雙 arch dmg 才全綠。

- **失敗序列**（run ID / 層次 / 關鍵錯誤）：
  1. `24588171923` — Linux schema：`configuration.mac.x64ArchFiles should be: null | string`
  2. `24588953832` — mac universal merge：`claude-agent-sdk/vendor/ripgrep/arm64-darwin/rg ... not covered`
  3. `24589124101` — mac universal merge：`claude-code/vendor/audio-capture/arm64-darwin/audio-capture.node`
  4. `24589233714` — mac universal merge：`@img/sharp-darwin-arm64/lib/sharp-darwin-arm64.node`
  5. `24589344537` — mac universal merge：`@lydell/node-pty-darwin-arm64/pty.node`
  6. `24589510949` — **全綠**（改雙 arch dmg 後），tag `v0.0.16-pre.1`

- **根因**：
  - electron-builder 26 在 Linux host 下 normalize `mac.target.arch: "universal"` 會填入 `x64ArchFiles` 預設值並觸發 schema 驗證（與 Windows host `--dir` 路徑行為不同，EXP 工單 Step 5.5 沒暴露）。
  - `@electron/universal` 合併 x64 / arm64 ASAR 時，對所有 `asarUnpack` 內 bit-identical 的檔案都要求 `x64ArchFiles` / `arm64ArchFiles` 規則覆蓋。
  - 本專案 `asarUnpack` 帶了 `@anthropic-ai/claude-code/**`、`@anthropic-ai/claude-agent-sdk/**`、`@img/**`，加上 `optionalDependencies` 的 `@lydell/node-pty-*`，每個 package 都 ship 全平台 binary（arm64-darwin / x64-darwin 各一份），x64 / arm64 build 都會帶入全部。每加一條 pattern 就跳下一個 package，典型 whack-a-mole。

- **決策**：`mac.target.arch` 從 `"universal"` 改為 `["x64", "arm64"]`，產出 `BetterAgentTerminal-*-x64.dmg` + `-arm64.dmg` 兩個 dmg，繞過整個 universal merge 檢查路徑。

- **Commit**：`28fc637`（此輪 CI 修復期間另含 `d0822b1`、`368e0ca`、`3aa3ac5` 過渡嘗試，保留於歷史作為教訓，不 squash）。

- **Side effect**：
  - ✅ 解除 universal merge 地獄 — 新增 optionalDependency 不會再 break mac 打包。
  - ✅ mac 打包時間略縮（2m14s vs universal 預估 3m+，實測沒到 universal 完成過）。
  - ⚠️ macOS 下載頁變成兩個檔案（x64 / arm64），使用者需自行選對 CPU（Apple Silicon 選 arm64）。
  - ⚠️ 檔案大小各自比原 universal 小（不含另一 arch 拷貝），總下載頻寬不變。

- **後續**：
  - CLAUDE.md「electron-builder 26 migration notes」已更新，明確標注不要改回 universal（本輪一併 commit）。
  - EXP-BUILDER26-001 工單補記「CI 實戰後續（2026-04-18）」完整記錄（本輪一併 commit）。
  - Homebrew tap（若有）未來需要同步支援雙 arch dmg，下個正式 tag 釋出時處理（backlog 候選）。

- **關聯**：EXP-BUILDER26-001 / PLAN-005（delivery）；不改動 D055（EXP 工單依然 CONCLUDED，只是多一層 CI 實戰補記）。

---

### D056 2026-04-18 — PLAN-016 全案閉環（Electron 28.3.3 → 41.2.1，三 Phase 全部完成）

- **觸發事件**：使用者主動詢問「PLAN-016 可以做了嗎」，塔台盤點後發現**三個 Phase 全部已達成 Success Criteria**，PLAN-016 狀態應直接升為 DONE
- **Phase 對照表**：

| Phase | 原定目標 | 實際執行 | 完成時間 | 關聯決策 |
|-------|---------|---------|---------|---------|
| Phase 1 | EXP worktree 試做 | EXP-ELECTRON41-001（27 分鐘 CONCLUDED，遠低於 4-8h 預估） | 2026-04-18 02:16 | D049 |
| Phase 2 | EXP 合併 main + runtime VERIFY | T0160 + T0161 + BUG-038 閉環（含 VSCode self-lock 繞道 D050） | 2026-04-18 03:01 | D050 / D051 |
| Phase 3 | 順便帶 PLAN-005 electron-builder 26 | EXP-BUILDER26-001 CONCLUDED + merge `75bb77f` | 2026-04-18 05:25 | D055 |

- **Success Criteria 6/6 全綠驗收**：
  1. ✅ `npm install` 無錯 — T0160 + EXP-BUILDER26-001 Step 3
  2. ✅ Native modules rebuild 成功 — ABI 145 better-sqlite3 + @lydell/node-pty 驗證
  3. ✅ `npm run dev` 啟動主視窗 — T0161 修復 ELECTRON_RUN_AS_NODE pollution 後通過
  4. ✅ `npm run build:dir` 可打包 — EXP-BUILDER26-001 Step 5.2
  5. ✅ BAT core flows smoke test — D051 runtime UAT + EXP-BUILDER26-001 Step 5.4（使用者實機驗收）
  6. ✅ 無 regression — 使用者 05:25 確認 CT panel / 終端 / Sidebar / IPC 全綠
- **塔台決策**：
  1. PLAN-016 🔄 IN_PROGRESS → ✅ DONE（不需派新工單，三 Phase 產出已滿足全部 Success Criteria）
  2. 執行期資料版本鎖定：**Electron 41.2.1** + **electron-builder 26.8.1** + **Node 24** + **Chromium M146**
  3. EoL 窗口紀錄：Electron 41 EoL 2026-08-25（約 4 個月保護期），下次主升級窗口在 Q3 2026 考慮 Electron 43+
  4. 備案方案 Electron 43 **不執行**（門檻已過，無迫切性；保守策略 N-2 已達成）
- **累積成果彙整**（本輪「安全升級日」）：
  - Electron 28.3.3 → 41.2.1（Chromium M120 → M146，兩年 CVE 一次清理）
  - electron-builder 24.13.3 → 26.8.1（Group A 9 CVE 清除）
  - Vite 5.4.21 → 7.3.2（Group B 2 CVE 清除）
  - **npm audit**：27 → 3（減少 88.9%；剩 Group C whisper-node-addon 鏈 WONTFIX）
  - **CLAUDE.md**：Electron Runtime 段（PLAN-016）+ Build Toolchain 段（T0163 + EXP-BUILDER26-001）完整記錄
  - **相關 commits（2026-04-18 單日）**：`ef3624f`、`e7eab33`、`ae6063c`、`9d734a8`、`ea10b8a`、`ead9166`、`edf913a`、`8be4e5a`、`51201d1`、`58ca621`、`83ae7cf`、`ca8057b`、`f79f735`、`d146c9a`、`f105eb9`、`75bb77f`、`31612d5`（+本輪 D056 meta commit）
- **重大發現 / 修正歷程**：
  - **D050 VSCode self-lock**：npm install 期間 VSCode 鎖定 node_modules，本次全 session 都在外部終端跑（新規範 L040）
  - **BUG-038 ELECTRON_RUN_AS_NODE**：BAT 環境變數 pollution 導致 renderer 起不來，T0161 修復後寫入 CLAUDE.md Electron Runtime 段（L039）
  - **D054 EXP worktree 策略實證**：相較 T0160 直接 merge，EXP 模式在不確定性高的 major 升級情境下風險對沖效果顯著，本次 Worker time 34 分鐘（vs 原估 4-6h）
- **learning 候選**（本輪總共累積 L039-L053 共 15 條，待 `*evolve` 系統性晉升）：
  - **L054**（🟢 global 候選）：「安全升級日」集中作業模式 — 單日連續 3 條 major 升級鏈（Electron + builder + vite）全綠，相較分散到多個 sprint 的優點：工具鏈記憶熱、測試驗收可疊加、CLAUDE.md 同時段寫入一致；風險：單日 context load 高，需嚴格用 EXP 隔離避免混淆
  - **L055**（🟢 global 候選）：Success Criteria 寫得具體（如 PLAN-016 的 6 條可驗收項目）時，PLAN 結案判定可在塔台 session 內 5 分鐘完成；相較模糊的「升級完成」更容易追蹤真實完結狀態
  - **L056**（🟡 本專案）：跨 PLAN 的依賴關係（PLAN-016 Phase 3 ← PLAN-005）要在 PLAN 元資料中明寫（如「Phase 3 綁定 PLAN-005」），否則結案時易漏判
- **副作用**：
  - 主線目前有 5 commits unpushed（本輪累積），Git 狀態乾淨
  - `_backlog.md` 需補 PLAN-016 到 Completed 區塊（首次加入，因原本優先級 High 跳過 backlog 直接走工單）
  - 下一輪候選更加明確：PLAN-004 / PLAN-009 / PLAN-014
- **相關 PLAN**：PLAN-016（DONE）、PLAN-005（DONE，作為 Phase 3 載體）、PLAN-003（DONE）
- **相關工單**：EXP-ELECTRON41-001（CONCLUDED）、T0159 / T0160 / T0161 / T0162 / T0163（全部 DONE）、EXP-BUILDER26-001（CONCLUDED）

---

### D055 2026-04-18 — PLAN-005 / PLAN-003 全案閉環（electron-builder 26 升級 CONCLUDED + Group A 關閉）

- **觸發事件**：EXP-BUILDER26-001 Step 5.4 使用者手動 installer 安裝 + app smoke test **驗收通過**（05:25），Worker 可控範圍（Step 1-8、5.5）於 04:59 已完成
- **實際執行耗時**：
  - Worker 實作 + 自測：34 分鐘（04:25 派發 → 04:59 完成）
  - 使用者驗收間隔：26 分鐘（04:59 → 05:25）
  - **總 wall-clock**：60 分鐘，遠低於 4-6h 預估（超過一個量級的偏差）
- **Worker 表現亮點**：
  - P1 自排：`mac.notarize` 物件 → boolean schema 衝突，自行定位 breaking change 並修復，將 migration notes 寫入 CLAUDE.md
  - P2 邊界守護：識別 `.github/workflows/pre-release.yml` 缺 `APPLE_*` secrets 的 soft warning，但**不越權修改 CI 工作流**，只在 CLAUDE.md 記錄（塔台授權範圍內）
  - Linux dry-run 意外完整打包成功（v26 允許 Windows → Linux cross-build），超出工單驗收範圍但無副作用
  - 工單互動紀錄、執行紀錄、遭遇問題三區完整填寫
- **閉環成果**：
  - **PLAN-005** 🔄 → ✅ DONE（主 commit `f79f735`，merge commit `75bb77f`）
  - **PLAN-003 Group A** 🔄 → ✅ 關閉（9 個 CVE 100% 清除）
  - **PLAN-003 整體** 🔄 → ✅ DONE（Group A 本 PLAN + Group B T0163 + Group C WONTFIX）
  - **EXP-BUILDER26-001** 🧪 → 📊 CONCLUDED
  - **CLAUDE.md**：新增「electron-builder 26 migration notes」段（`mac.notarize` 格式、環境變數、CI soft warning、Windows host-platform 限制）
  - **npm audit**：11 → 3（全部 Group C WONTFIX 鏈，符合 D052）
- **塔台決策**：
  1. `git merge --no-ff exp/builder26` → main（`75bb77f`），保留分支拓撲供日後追溯
  2. 本輪 meta commit 統一批次處理（EXP 工單 + PLAN-003 / PLAN-005 + tower-state + backlog + 本 D055）
  3. Worktree 清理：`git worktree remove ../better-agent-terminal-builder26 && git branch -d exp/builder26`
  4. **不 push**（依規範；Git 狀態乾淨後由使用者決定推送時機）
- **安全邊界觀察**：
  - 本次是 **D051 Electron 41 閉環後 2.5 小時內**的第二次主線依賴升級閉環
  - Electron 41 + builder 26 組合首次驗收通過（runtime 無 regression、installer 可用）
  - 工具鏈「趁熱打鐵」策略（D054 時機決策）實證有效
- **learning 候選**（累積給下次 `*evolve` 評估）：
  - **L049**（🟢 global 候選）：EXP worktree 模式的 Worker 完成率實證 — 當前置條件滿足（semVerMajor + config 不明 + 主線乾淨）時，EXP 實作成本 ≤ 研究工單成本；本次 Worker 34 分鐘結束，比研究工單通常 1-2h 更快，且直接產出可驗證成果
  - **L050**（🟢 global 候選）：`auto-session: on` + `auto_commit: ask` 組合在深度依賴升級鏈（vite 7 + builder 26）中的實戰 — 兩個 EXP/實作工單連續執行，使用者僅需決策不需手動操作終端
  - **L051**（🟡 本專案）：升級鏈估時應分開 Worker time 和 wall-clock time — Worker 可控 time 常大幅優於預估（P95 偏樂觀），真正變數是使用者驗收間隔
  - **L052**（🟢 global 候選）：Worker 遇 schema breaking 時應優先查 release notes 定位精確 migration path（如 `mac.notarize` v26 變更），而非盲目 rollback 或 bypass
  - **L053**（🟡 本專案）：Step 5.4 這類需使用者實機驗收的 checkpoint，工單應明確標示 **CONCLUDED-PENDING-X** 中間狀態的回報格式；本次使用者創「CONCLUDED-PENDING-5.4」精準表達，塔台應將此模式納入 EXP / 實作工單模板
- **副作用**：
  - Worktree `../better-agent-terminal-builder26` 需清理（塔台執行）
  - 分支 `exp/builder26` 需刪除（塔台執行，因為 merge 完已整合）
  - 主線多 4 commits unpushed（`83ae7cf`、`ca8057b`、`75bb77f` merge、本輪 meta commit）
- **相關工單**：EXP-BUILDER26-001（CONCLUDED）
- **相關 PLAN**：PLAN-003（DONE）、PLAN-005（DONE）
- **下一輪候選**（backlog 剩餘 Active）：
  - PLAN-004 📋 GPU Whisper 加速（Win/Linux）🟡 Medium
  - PLAN-009 📋 Sprint 儀表板 UI 🟡 Medium
  - PLAN-014 📋 BAT 內建 Git 圖形介面（方向 B）🟡 Medium
  - PLAN-016 🔄 Electron runtime 升級（Phase 3 暫緩）🔴 High

---

### D054 2026-04-18 — T0163 DONE 閉環 + PLAN-005 啟動（EXP worktree 模式，承接 Group A）

- **觸發事件**：
  1. T0163 Worker 回報完成（commit `83ae7cf`，04:18）— vite 5.4.21 → 7.3.2 + 3 plugin 連動 + CLAUDE.md Build Toolchain 段，10/10 smoke test checklist 全綠
  2. T0163 執行過程特殊狀況：前任 Worker 在 Step 5 驗收前中斷（「把自己 kill 了」，package.json + node_modules 已達目標版本），續接 Worker 從 Step 1 盤點驗證接手、Step 4（無需修改）→ Step 5-8 收尾，13 分鐘完成
  3. PLAN-003 Group B 實證結果：npm audit 13 → 11（esbuild SSRF + vite path traversal 2 moderate 清除），vite.config.ts 零 breaking changes 命中
  4. 使用者決定延續升級慣性，啟動 PLAN-005（Group A）
- **PLAN-005 執行方案**（使用者對齊 A/C/C/A）：
  - **Q1-A 時機**：立刻動（趁 vite 升級工具鏈熱度）。接受「Electron 41 穩定 0 輪」的風險，用 EXP worktree 隔離作為風險對沖
  - **Q2-C 形式**：EXP worktree 模式（`exp/builder26`），成功則 merge 回主線，失敗則 `git worktree remove` 主線零污染
  - **Q3-C 驗收範圍**：Windows 完整打包（`npm run compile` + NSIS installer + 手動重裝 smoke test）+ macOS/Linux YAML dry-run（`electron-builder --dir`）
  - **Q4-A 版本策略**：`electron-builder: ^24.0.0 → ^26.8.1`（npm audit 指向的精確 fix 版本）
- **塔台決策**：**採 EXP worktree 模式，派發 EXP-BUILDER26-001**
  - **為何用 EXP 而非 T#### 直接實作**：
    1. Electron 41 主線穩定 0 輪（剛 D051 閉環 1 小時前），失敗風險對沖需求高
    2. electron-builder 24→26 semVerMajor，config 格式不確定性（未研究即實作）
    3. 當前主線 commit `83ae7cf` 乾淨，不容污染
  - **為何不先派研究工單（B 選項）**：
    1. 升級範圍已收斂（npm audit 指向 26.8.1，不需研究找目標版本）
    2. 研究工單的成本（1-2h）可直接進 EXP worktree 的 Step 1 盤點內，邊做邊查
    3. EXP 模式本身就是「邊實作邊學」的保守結構
  - **為何驗收不含 macOS 打包**：本機為 Windows，無 macOS 機器；notarization / universal binary 即使成功也無法驗收，僅做 YAML config parse 確認格式合法
- **狀態轉移**：
  - **T0163** → ✅ DONE（commit `83ae7cf`）
  - **PLAN-003 Group B** → ✅ DONE
  - **PLAN-003** 維持 🔄 IN_PROGRESS（等 Group A EXP 完結）
  - **PLAN-005** 💡 IDEA → 🔄 IN_PROGRESS
  - **EXP-BUILDER26-001** 新建 → 🧪 EXPLORING（等使用者建 worktree）
- **PLAN-003 完結路徑**：EXP-BUILDER26-001 CONCLUDED → PLAN-005 DONE → PLAN-003 Group A 關閉 → PLAN-003 整體 ✅ DONE
- **learning 候選**（累積給下次 `*evolve` 評估）：
  - **L046**（🟢 global 候選）：Worker 中斷續接的成本極低前提 — 工單「執行紀錄」結構完整、Step 分界明確時，續接 Worker 可從中斷點無縫接棒（T0163 前任 Worker kill 後 13 分鐘即收尾）；反之若工單結構鬆散，續接成本會變高
  - **L047**（🟡 本專案）：npm audit 指向具體 fix 版本（如 `electron-builder@26.8.1`）時，可跳過研究工單直接進實作 EXP；研究工單適用於「目標版本不明」或「多路徑選擇」
  - **L048**（🟢 global 候選）：EXP worktree 模式適合「semVerMajor + config 格式不明 + 主線乾淨」三條件同時滿足時，作為風險對沖機制；若研究成本明確 < EXP 實作成本，才該派研究工單
- **副作用**：
  - 主線將出現未 commit 的 meta 檔（PLAN-005 / PLAN-003 / tower-state / decision-log / EXP-BUILDER26-001），塔台將批次 commit
  - 使用者需自行執行 `git worktree add ../better-agent-terminal-builder26 -b exp/builder26` 建立 worktree
- **相關工單**：T0163（DONE）→ EXP-BUILDER26-001（EXPLORING）
- **相關 PLAN**：PLAN-003（IN_PROGRESS，Group A 承接中）、PLAN-005（IN_PROGRESS）

---

### D053 2026-04-18 — T0162 Phase 2 結論採路徑 A（vite 7 stable），派 T0163 實作

- **觸發事件**：T0162 Phase 2（Renew #1）完成（commits `8be4e5a` + `51201d1`，實耗 7 分鐘 vs 預算 15-30 分鐘），三個 OQ 全部解決
- **Phase 2 關鍵結論**：
  - **OQ1**：`vite-plugin-electron@0.29.1` stable **明確支援 vite 7/8**（上游 README 宣告 "stable and production-ready"）；`vite-plugin-electron-renderer@0.14.6` **無 peerDependencies 限制**（透過 dynamic import 載入 vite）
  - **Phase 1 peer 判斷修正**：Phase 1 誤將 `vite-plugin-electron@0.28.8` 的上游 devDependencies 當 peerDependencies，實際兩個 plugin 皆無對 vite major 的硬限制 → D052 當初「升 vite 8 會破壞 3 個 plugin」的憂慮被證偽
  - **OQ2（electron-vite）** 跳過但紙上評估：遷移成本過高（`vite.config.ts` 完全改寫 + scripts 重配），**不建議切換**，僅保留為最壞情境備案
  - **OQ3（vite 6/7/8 breaking changes）**：
    - 5→7 改動小：僅 `splitVendorChunkPlugin`（移除）、`transformIndexHtml` hook API（若有）、`resolve.conditions`（若有 custom）
    - 5→8 改動重：Oxc 替換 esbuild、Rolldown 替換 Rollup、CJS interop 行為變更（**Electron main 重度依賴 CJS**，有 regression 風險）
- **兩條路徑摘要**：
  - **路徑 A（保守）**：vite 7 stable + 全 stable plugin channel，3-5h，清除 2 個 moderate CVE
  - **路徑 B（激進）**：vite 8 + `vite-plugin-electron@1.0.0-beta.3`，6-10h，相同漏洞清除但吃 plugin beta + Oxc/Rolldown migration + CJS 風險
- **塔台決策**：**採路徑 A（vite 7）**
  - **使用者選擇**：A（路徑 A，Worker 推薦同意）
  - **理由**：
    1. 兩路徑清除的漏洞完全相同（都是 esbuild SSRF + vite path traversal 2 個 moderate），路徑 B 無額外安全收益
    2. 路徑 B 需吃 `vite-plugin-electron` beta channel，production app 不適合
    3. 路徑 B 核心引擎剛換（Oxc/Rolldown），社群磨合期尚短，回歸風險未充分 battle-tested
    4. Electron main process 密集使用 CJS `require`，vite 8 CJS interop 變更若踩中需重度 debug，投資報酬低
  - **未來升級目標**：vite 8 等 `vite-plugin-electron@1.0.0` 脫離 beta（正式 GA），預估 6-12 個月後排新 PLAN 處理
- **T0163 工單範圍**（使用者對齊 1B / 2B / 3A）：
  - 1B：vite 5→7 + 3 plugin 連動 + smoke test + npm audit 驗證 + **CLAUDE.md 更新（新增 Build Toolchain 段）**
  - 2B：主要功能逐項 smoke test（CT panel / 終端機 / Sidebar / IPC 通道）+ 基本 smoke（dev/HMR/compile）
  - 3A：塔台先批次 commit 凍結的 meta 檔（T0162 結案 + PLAN-003 狀態 + D052 + D053 + T0163 派發），Worker T0163 實作後另外獨立 commit
- **狀態轉移**：
  - **T0162** → ✅ DONE（Worker 已自行 commit `51201d1`）
  - **PLAN-003** 📋 PLANNED → 🔄 IN_PROGRESS（Group B 實作中）
  - **T0163** 新建 → 📋 PENDING（等使用者派 sub-session）
- **learning 候選**（累積給下次 `*evolve` 評估）：
  - **L044**（🟡 本專案）：Phase 1 靜態查 `node_modules/vite-plugin-electron/package.json` 的 devDependencies 當 peerDependencies 判斷升級限制 → 不精確；應查 npm registry 官方宣告 peer + 讀上游 README；靜態 node_modules 只反映本地當時安裝決策，不代表上游對外相容性承諾
  - **L045**（🟡 本專案）：跨 major 升級研究需分階段（Phase 1 盤點 + Phase 2 解 OQ），Phase 1 的「保守擔憂」常在 Phase 2 被證偽，塔台應允許 Renew 機制而非直接派實作
- **副作用**：無（路徑 A 維持 plugin stable channel，無引入 beta 風險）
- **相關工單**：T0162（DONE）→ T0163（PENDING）
- **相關 PLAN**：PLAN-003（IN_PROGRESS）

---

### D052 2026-04-18 — PLAN-003 npm audit 殘餘漏洞：混合分組策略

- **觸發事件**：Electron 41 升級完成（D051）觸發 PLAN-003 重新盤點，T0162 研究完成（commit `edf913a`，11 分鐘，含 1 輪使用者互動釐清）
- **T0162 關鍵發現**：
  - `npm audit` 當前 **13 個**（0 critical / 7 high / 2 moderate / 4 low），比 T0060 時期 17 個減少 4 個
  - **13 個全部無 runtime 攻擊面**（dev-time / build-time / postinstall only，不進 bundle）
  - 殘餘漏洞集中在三群：electron-builder 鏈（9）+ vite/esbuild（2）+ whisper/tar（2）
- **使用者決策（Worker 互動中確認）**：
  - **Q1-A**（Group A 9 個 electron-builder 鏈漏洞）：**暫緩**，等 PLAN-005 一併處理。理由：electron-builder 24→26 升級需重測 NSIS / DMG / auto-update / ASAR 壓縮，風險成本遠高於 dev-only 漏洞的實質影響；D049 暫緩決策維持有效
  - **Q2-B**（Group B 2 個 vite/esbuild 漏洞）：**升 vite 5→8**（使用者主動指定，Worker 原推薦 Q2-A 保守）。理由：vite 5 線已無 patch（5.4.21 為最終版本），dev server SSRF + path traversal 需處理
  - **Q3-B**（Group C 2 個 whisper/tar 漏洞）：**WONTFIX**。理由：tar 僅 postinstall 階段下載 whisper 模型時使用，runtime 無暴露；whisper-node-addon 上游無乾淨升級路徑（audit 建議的 0.0.1 是降級，強拉 tar 7 破壞 cmake-js peer）
- **Group B 實作前置條件（T0162 Renew #1）**：
  - **關鍵風險識別**：vite-plugin-electron@0.28 + vite-plugin-electron-renderer@0.14 peer 僅宣告 vite 5 → 升 vite 8 會破壞 3 個 plugin
  - Renew 範圍：
    1. npm registry 查 vite-plugin-electron / vite-plugin-electron-renderer 最新版本 peer 支援
    2. 評估 `electron-vite`（替代方案）是否合理
    3. vite 6/7/8 各 major breaking changes 摘要
  - Renew 結論後再派實作工單（預估 4-8h，若改用 electron-vite 加 2-4h）
- **重新評估的副產品**：
  - **PLAN-003 優先級 🟡 Medium → 🟢 Low**（實際 runtime 風險為零，非帳面的 Medium）
  - **PLAN-003 狀態 💡 IDEA → 📐 PLANNED**（有明確 action plan 等待實作）
  - **PLAN-003 預估規模 大→中**（不再需要 Electron major bump，剩 vite stack 升級）
- **learning 候選**（下次 `*evolve` 評估）：
  - **L042**（🟡 本專案）：npm audit 漏洞數字 ≠ 實際風險；dev-only / build-only / postinstall-only 的漏洞 runtime 無攻擊面，應另列評估
  - **L043**（🟡 本專案）：大 framework stack 跨 major 升級前，先查所有依賴 plugin 的 peer 支援版本（本次識別 vite-plugin-electron peer 鎖 vite 5 為關鍵風險）
- **關聯工單**：T0162（研究）/ PLAN-003 / PLAN-005（Group A 寄存）
- **副作用**：**PLAN-001（Vite v5→v6）標記 🚫 DROPPED**（2026-04-18 03:44）— 被 PLAN-003 Group B 吸收，避免重複做兩次 plugin stack 升級。PLAN-001 檔案保留作為歷史紀錄

---

### D051 2026-04-18 — Electron 41 升級 + BUG-038 runtime 驗收全通過，閉環完成

- **觸發事件**：使用者關閉 VSCode 在 Windows Terminal 外部終端重跑 `npm install` + `npm run build` + 手動重裝成功
- **驗收結果**：
  - `node_modules/electron/package.json` version = **41.2.1**（D050 EBUSY 解除，rename 成功）
  - `npm run build` 產物 = Windows NSIS installer，封裝 electron 41.2.1
  - 使用者手動重裝測試通過，BAT 內 terminal 可正常啟動 Electron app（BUG-038 修復生效）
  - `postinstall` 的 `npm rebuild better-sqlite3`（T0160 新增）自動為 ABI 145 重 build，啟動無 NODE_MODULE_VERSION mismatch
- **狀態轉移**：
  - **T0160** DONE（repo 層） + runtime 驗收通過 → 閉環完成
  - **T0161** FIXED → **DONE**（runtime 驗收通過，回報區補執行期驗證結果）
  - **BUG-038** FIXED → **CLOSED**（元資料補關閉時間 + 驗收結果）
  - **PLAN-016 Phase 2** 正式完結，Phase 3（electron-builder 24→26）依 D049 暫緩
- **D050 教訓確認有效**：L040（Electron IDE self-lock）+ L041（repo+runtime 雙軌驗證）獲得實戰驗證，待 `*evolve` 寫入時 candidate 升 🟢 reliable
- **塔台 meta 批次 commit**：本輪同步修正 tower-state 上輪誤寫的 `npm run build:win`（正確為 `npm run build`，Windows NSIS 由 electron-builder 預設處理）
- **關聯工單**：T0160 / T0161 / BUG-038 / PLAN-016

---

### D050 2026-04-18 — Electron 41 升級未生效到 runtime + VSCode self-lock 發現

- **觸發事件**：使用者 `npm run build` 產物仍為 `electron=28.3.3`，與 T0160 宣告的 41.2.1 不符
- **診斷過程**：
  1. 排查 process → 無 `electron.exe` / `crashpad-handler.exe` / `BetterAgentTerminal.exe` 殘留
  2. `npm install` 顯示 `EBUSY: resource busy or locked, rename 'node_modules/electron/dist/icudtl.dat' -> '.electron-lcQ2wttq/...'`
  3. 確認鎖定源為 VSCode 本身（VSCode 是 Electron 應用，file watcher / language server / 檔案總管展開 node_modules 時會 touch `icudtl.dat`，Windows file locking 比 Unix 嚴格，read handle 就擋 rename）
- **結論**：
  - T0160 Worker 交付正確（repo 層 electron=41.2.1 已 merge 到 main）→ 維持 DONE
  - 但 runtime/build 層從未更新，因為 `npm install` 在 T0160 合併後**從未成功執行過**（本次 EBUSY 為實證）
  - BUG-038 的 FIXED 宣告雖屬實（code 層 `pty-manager.ts` + `terminal-server/server.ts` 修對了），但未經 runtime 驗證，需等 install 成功後再驗收
- **行動**：
  - 使用者關閉 VSCode，改用 Windows Terminal 重跑 `rm -rf node_modules/electron node_modules/.electron-*` + `npm install` + `npm run build`
  - 本次塔台 session 在使用者執行前先完成 meta 更新後退出
  - 下一輪 Fast Path 恢復，先驗證 `node_modules/electron/package.json` version 欄位，決定走 VERIFY 或重排查
- **learning 候選**：
  - **L040**（🟢 global 候選，跨專案通用）：開發 Electron 應用時，Electron-based IDE（VSCode / Cursor / Windsurf）會鎖住 `node_modules/electron/dist/icudtl.dat`，升級 Electron 必須關 IDE 在外部終端做。這是 self-bootstrap 陷阱 — IDE 用的是它自己安裝的 Electron（不是專案 node_modules 的），但 file watcher 仍會 read-lock node_modules 下的 Electron binary
  - **L041**（🟡 本專案 playbook 候選）：宣告 deps 升級 DONE 前應雙軌驗證 —「repo 層通過」（merge commit + package-lock 正確）+「runtime 層通過」（`cat node_modules/<pkg>/package.json | grep version` 確認 + build 產物版號確認）。單看 merge commit 不夠
- **未完成事項**：D049 定義的「升級與 BUG-038 修復生效」仍待 install 成功後完整驗收
- **關聯工單**：T0160 / T0161 / BUG-038

---

### D049 2026-04-18 — EXP-ELECTRON41-001 CONCLUDED → 合併派發 + BUG-038 同步處理

- **背景**：EXP-ELECTRON41-001 耗時 27 分鐘 CONCLUDED（遠低於 4-8h 預估），所有悲觀假設被證偽
- **實驗結果**：
  - Electron 28.3.3 → 41.2.1（ABI 119→145，Chromium M146，Node 24）
  - 4 個 native modules 全數相容（better-sqlite3 rebuild、@lydell/node-pty / whisper-node-addon / sharp 直接載入）
  - TypeScript error diff = 0
  - Build + dev + smoke test 全通過
  - 變動極簡：僅 `package.json` + `package-lock.json`
  - commit `ef3624f` on `exp/electron41`
- **發現衍生 BUG**：`ELECTRON_RUN_AS_NODE=1` 洩漏至 BAT 內 terminal 子 shell（既有問題，Electron 28 時代就存在），EXP 中顯現化
- **使用者選項 [A/A/A]**：立即派 T0160 合併 + 立即建 BUG-038+T0161 修復 + 收 L037/L038/L039
- **決定**：
  1. **T0160**（🔴 High）：merge `exp/electron41` → main + `npm rebuild better-sqlite3` postinstall + CLAUDE.md Electron Runtime 區塊 + worktree 清理
  2. **BUG-038**（🟡 Medium）+ **T0161** 修復：方案 A/B/C 由 Worker 評估後選，推薦 A（源頭不污染）或 C（雙管齊下）
  3. **PLAN-016 Phase 3（PLAN-005 builder 26）暫緩**：等 T0160 merged + 主線穩定 1-2 輪後再啟動 EXP-BUILDER26-001
  4. **Learning 候選收納**（L037/L038/L039）：下次 `*evolve` 寫入
- **T0160 / T0161 可並行**（不相依）

---

### D048 2026-04-18 — T0159 結論採行：PLAN-016 + EXP-ELECTRON41-001 即刻試做

- **背景**：T0159 研究（commit `4e5af2f`）完成，結論清晰
- **關鍵發現**：
  1. **Electron 28.3.3 已 EOL 2024-06-11**（近 2 年無安全更新），當前 latest 43，建議目標 41（N-2）
  2. **PLAN-001（Vite 5→6）延後**：`vite-plugin-electron` 生態無穩定 v6 路徑
  3. **PLAN-005（builder 24→26）綁 Electron**：本專案改動面窄（僅 Mac notarize 1 欄位），需 Node 22
  4. **鐵律**：git log `b5b3d1a` 一次性大批升級 → `d8ee82a` revert(+7557/-813)證明「三合一升級 = 失敗」，EXP 必須逐項獨立 worktree
- **使用者選項 [A]**：立即派 EXP worktree 試做（不阻擋 PLAN-014 主線）
- **決定**：
  1. 新開 **PLAN-016**（🔴 High）：Electron 28→41 runtime 升級
  2. Phase 1 = **EXP-ELECTRON41-001**（worktree `exp/electron41`，已建檔）
  3. PLAN-005 降級綁定 PLAN-016 Phase 3 尾聲（native module 重建後順便升 builder）
  4. PLAN-001 保持延後（🟢 Low，等 plugin 1.0 穩定）
- **Success criteria**（EXP→CONCLUDED）：npm install 無錯 / 所有 native modules rebuild 成功 / dev+build:dir 可跑 / 手動 smoke test 8 項通過
- **最大風險**：`whisper-node-addon@1.0.2` 對 Electron 41（Node 24）的 NODE_MODULE_VERSION 相容性未知，允許 Worker 遇此決策點主動問塔台

---

### D047 2026-04-18 — PLAN-001/005 升級可行性研究派發（T0159）

- **背景**：使用者提問「PLAN-001 + PLAN-005 若風險不高是否開分支試做」。塔台初評 PLAN-001 中低風險適合 EXP、PLAN-005 綁 PLAN-003 才有意義但 PLAN-003 實際是 npm audit（PLAN-005 內備註誤記），專案無獨立 Electron runtime 升級 PLAN
- **對齊結果**：Q1.C'（Vite + builder 聯動 + 評估新開 Electron PLAN）/ Q2.A（僅文件分析不試 build）/ Q3.A（一張統籌）/ Q4.B（禁用 Worker 互動）/ Q5.A（研究完塔台直接決策）/ Q6.A（需引用 source URL）
- **決定**：派發 T0159 統籌研究工單，5 個 Block 盤點（Vite v5→v6 / electron-builder 24→26 / Electron runtime 28→latest / 三者相依順序 / 風險總評），硬限制禁止執行 `npm install` 和試 build
- **當前版本鎖定**：electron@28.3.3 / electron-builder@24.0.0 / vite@5.0.0 / vite-plugin-electron@0.28.0
- **決策依據**：本專案目前處 PLAN-014 Phase 3 Git GUI 主線收官階段，技術債升級屬低優先級；透過研究工單先盤清面積再決策排入時機，比盲試 EXP 更保守

---

### D031 2026-04-13 — PLAN-008 Phase 2 可配置參數

- **背景**：Terminal Server 架構需要兩個關鍵參數，使用者要求可在 Settings UI 調整
- **決定**：
  - Scroll buffer：預設 1000 行，Settings UI 可調，安全上限 5000 行（~500KB/terminal）
  - Server idle timeout：預設 30 分鐘，Settings UI 可調，含「永不關閉」選項
  - 兩者均透過 Settings 面板操作，存入 settings.json
- **相關工單**：T0109（Config 實作 + Settings UI）

---

### D030 2026-04-13 — 索引架構改革

- **背景**：CT 工單系統維護多個 index（_workorder-index.md / _bug-tracker.md / _backlog.md），與源文件雙重維護導致持續偏差
- **診斷**：T0102 靜態分析確認各頁籤資料來源
- **決定**：(1) _workorder-index.md 直接移除（BAT UI 不讀）(2) _bug-tracker.md 改為 *sync 自動重建 (3) _backlog.md 改為 *sync 自動重建 (4) _decision-log.md 保留人工維護 (5) sprint-status.yaml 精簡保留
- **額外發現**：_bmad-output/ 未被 file watch 監聽 → BUG-026
- **相關工單**：T0102 / T0103

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
