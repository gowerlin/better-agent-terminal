# T0166-research-remote-security-hardening-port

## 元資料
- **工單編號**：T0166
- **任務名稱**：研究：PLAN-018 Remote 資安加固移植設計與衝突面盤點
- **狀態**：IN_PROGRESS
- **開始時間**：2026-04-18 11:48 (UTC+8)
- **類型**：research
- **互動模式**：enabled
- **Renew 次數**：0
- **建立時間**：2026-04-18 07:50 (UTC+8)
- **預估工時**：1.5-2h（純靜態分析，不實測打包）
- **預估 context cost**：中（~15-25% window）
- **關聯**：PLAN-018（本研究為其前置）、T0164（已 DONE，提供 upstream 同步分析基底）、D058
- **報告檔案**：`_ct-workorders/_report-plan-018-remote-security-port.md`

## 研究目標

讀懂 upstream `tony1223/better-agent-terminal` commits `3a0af80` + `5d9f486` 的 remote 資安加固設計意圖，盤點 fork 側（gowerlin/better-agent-terminal）remote 子系統的既有客製化，產出**4 張實作工單的拆單建議 + 衝突清單 + 依賴順序圖**，讓使用者決策後直接派發。

## 範圍

**納入分析**：
1. `3a0af80` — remote 資安加固主體（TLS + fingerprint pinning + path sandbox + brute-force 防護）
2. `5d9f486` (v2.1.46-pre.1) — selfsigned fingerprint 修復（依附於 `3a0af80`）
3. Fork 側 `electron/remote/` 所有檔案（workspace loader、profile 身份、supervisor routing、`protocol.ts::PROXIED_CHANNELS`）
4. Fork 側 T0134 / T0135 / T0155-T0158 / T0165 C1.2 已引入的 remote 客製化邏輯
5. 兩側 auth / session / TLS 憑證處理流程的語意差異

**排除範圍**：
- 不實測打包、不跑 dev server（Q5.B）
- 不分析 upstream 其他 commits（T0164 已完成）
- 不修改任何實作程式碼（研究型工單）
- 不重做 T0164 已做過的整體分類

## 已知資訊

| 項目 | 值 |
|------|---|
| Upstream source commits | `3a0af80` + `5d9f486` |
| 變更規模 | 16 檔案，+1288 / -285 行 |
| Fork 既有 remote 偏離 | workspace:load、profile 身份、supervisor routing、`PROXIED_CHANNELS`（T0158）、remote bookkeeping（T0165 C1.2 `59a26f8`） |
| Fork electron/remote 結構 | 需 Worker grep 盤點（主檔 `electron/remote/remote-server.ts`、`protocol.ts` 等） |
| 策略決定 | D058 採方案 [A]：Phase 2 獨立 PLAN-018，研究在主線、實作進 EXP worktree |

## 研究指引

### 四大面向分析要求

針對每個面向，報告必須涵蓋：

**A. TLS + Fingerprint pinning**
1. upstream 實作位置與核心設計（憑證管理、fingerprint 儲存、handshake 時機）
2. selfsigned 補強邏輯（`5d9f486` 解了什麼問題）
3. fork 側現有 remote handshake 流程與其是否已有憑證驗證
4. 移植衝突點（fork 客製化 vs upstream 設計差異）
5. 預估實作工時區間

**B. Path Sandbox**
1. upstream 沙盒邊界定義（哪些路徑允許、拒絕邏輯）
2. upstream 是否依賴特定 workspace 結構假設
3. fork 的 `workspace:load` / supervisor routing 是否會破壞這個假設
4. 移植衝突點
5. 預估實作工時區間

**C. Brute-force 防護**
1. upstream 的失敗計數器設計（儲存位置、clear 策略、cooldown 演算法）
2. 是否需要持久化（重啟後保留）
3. fork 的 auth 流程（profile 身份識別）對其影響
4. 移植衝突點
5. 預估實作工時區間

**D. 整合測試策略**
1. upstream 自帶的測試覆蓋（如果有）
2. 需要的 dev / packaged 測試情境清單
3. 測試所需環境（remote server + client 雙端配置）
4. 建議的 smoke test 流程

### 拆單建議要求

報告最後必須產出 **4 張實作工單的拆單草稿**，每張包含：

| 欄位 | 要求 |
|------|------|
| 暫訂 ID | T####（編號塔台會最終決定，請用占位） |
| 標題 | 明確動詞 + 範圍 |
| 依賴順序 | 先做誰、後做誰、為何（例：sandbox 可獨立 / 整合測試必須最後） |
| 核心變更清單 | 主要檔案路徑 + 新增/修改/移除 |
| 驗收條件 | 可驗證的具體項目（例：TLS handshake smoke / path traversal 拒絕測試） |
| 預估工時 | 區間 |
| 風險旗 | 🔴 / 🟡 / 🟢 + 一句話風險摘要 |

### 衝突清單要求

逐項列出 fork 客製化 vs upstream 設計的衝突點（至少涵蓋 workspace:load / profile / supervisor / PROXIED_CHANNELS），每項：
- 位置（檔案:行）
- 衝突描述（fork 做什麼 / upstream 做什麼）
- 建議保留方向（keep fork / take upstream / hybrid）
- 影響的實作工單編號

### 依賴順序圖

Mermaid 或 ASCII，標示 4 張工單之間的依賴關係（哪些可並行、哪些必須序列）。

## 互動規則

- Worker 可主動提問（`research_max_questions: 3`）
- 提問必須用選項式：`[A] ... [B] ... [C] ... 其他：________`
- 互動紀錄寫入回報區

**預期可能提問**：
- 遇到某衝突點 fork vs upstream 兩種合理方向 → 請使用者決定方向
- 測試策略若有 trade-off（完整 E2E vs 快速 smoke）→ 請使用者決定
- 若發現 fork 某處客製化與 upstream 設計哲學根本不相容 → 請使用者決定是否調整 PLAN-018 範圍

## 產出

### 主要產出
報告檔案：`_ct-workorders/_report-plan-018-remote-security-port.md`

報告結構：
```
# PLAN-018 Remote Security Hardening Port Research (T0166)

## 總覽
- 調查的 upstream commits / 檔案 / 函式數量
- 總體建議（整包移植可行 / 需分拆 / 需調整範圍）

## 四大面向分析
### A. TLS + Fingerprint Pinning
### B. Path Sandbox
### C. Brute-force 防護
### D. 整合測試策略

## 衝突清單
（表格，逐項列出）

## 4 張實作工單拆單建議
### 工單 1: TLS + Fingerprint
### 工單 2: Path Sandbox
### 工單 3: Brute-force 防護
### 工單 4: 整合測試

## 依賴順序圖

## 下一步選項
- [A] 接受拆單建議，依序派發 4 張實作工單
- [B] 調整拆單（如合併某兩張）
- [C] 研究揭示需要調整 PLAN-018 範圍（例：某面向先 skip）
```

### 回報區要求
- 調查結論三選一（整包移植可行 / 需分拆 / 需調整範圍）+ 理由
- 衝突清單必須具體到檔案:行
- 拆單建議必須可直接成為實作工單骨架
- 下一步選項必須三選一

## 執行注意事項

- 本研究在**主線**執行，不進 worktree（純讀碼）
- 不需要 `git worktree add` 或 `npm install`
- 需要時可 `git fetch upstream` 確認最新狀態（不做 merge/rebase）
- 可使用 `git show 3a0af80 --stat` / `git show 5d9f486 --stat` / `git log --oneline upstream/main` 等命令
- 不需要執行任何會修改 fork repo 檔案的命令

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態
DONE

### 回報時間
2026-04-18 12:00 (UTC+8)

### 互動紀錄
無（研究過程未觸發需使用者決策的提問，所有 A/B/C 候選已在報告「下一步選項」收斂呈現）

### 調查結論
**需分拆（不整包移植）**。理由：

1. 四個面向（TLS/fingerprint、path sandbox、brute-force、整合測試）耦合度低，可分段驗證、失敗可局部 revert
2. Fork `src/types/electron.d.ts`（253 行，含 voice/git-scaffold/terminal-notify 自訂型別）與 upstream 的「改成 type import from preload」硬衝突，整包 cherry-pick 會刪光 fork 自訂型別
3. Fork T0129 auto-start 與 T0165 C1.2 `ALWAYS_LOCAL_CHANNELS` 是 fork 獨有的正交擴充，需拆單時保留
4. 可獨立單位：sandbox、brute-force、TLS/fingerprint 三面向彼此無硬依賴；整合測試必須排在最後

### 衝突清單摘要
- **總數 12 項**（3 🔴 / 5 🟡 / 4 🟢）
- **🔴 需人工決策僅 3 項**：
  - C1：T0129 auto-start 的 bindInterface 預設值（建議 hybrid，顯式傳 `{bindInterface:'localhost'}`）
  - C2：`electron/d.ts` 整包重寫策略（建議 keep fork 手寫，只加 `remoteFingerprint` / `bindInterface` 欄位）
  - C3：PROXIED_CHANNELS 合併策略（建議 hybrid，加 `claude:abort-session`，不加 `claude:account-*`）
- **🟡 中風險 5 項**：機械式修改（PtyManager callback、loadProfileSnapshot 提升、fs handler path-guard 接入、preload 簽名、path-guard 跨平台路徑擴充）
- **🟢 低風險 4 項**：格式同步（UI 表單、tunnel-manager 簽名、fork-only ALWAYS_LOCAL_CHANNELS / profile:list-local 保留）

### 拆單建議摘要

| 工單 | 標題 | 工時 | 風險 | 依賴 |
|------|------|------|------|------|
| T-PLAN018-01 | TLS + Fingerprint Pinning（含 preload、UI、cert 遷移） | 2.5-4h | 🔴 | 獨立 |
| T-PLAN018-02 | Path Sandbox（path-guard + fs handler 接入 + 跨平台路徑） | 1-1.5h | 🟡 | 序列在 01 後（避免 rebase） |
| T-PLAN018-03 | Brute-force 防護 + Max Payload | 1-1.5h | 🟢 | 可與 01 並行 |
| T-PLAN018-04 | 整合測試 + 升級指南 + Regression | 2.5-3h | 🔴 | **必須最後**，依賴 01/02/03 全 merge |

合計 7-10h，建議分 2 天完成。依賴順序圖（Mermaid）見報告。

### 下一步建議
**[A] 接受拆單建議，依序派發 4 張實作工單**

建議派發順序：
1. 先派工單 3（brute-force，🟢 低風險 1-1.5h 暖身 + 驗證 EXP worktree 流程）
2. 派工單 1（🔴 TLS，最大影響面，需使用者決策 C1/C2/C3）
3. 派工單 2（🟡 sandbox，接在工單 1 後避免 rebase）
4. 派工單 4（🔴 整合測試 + 升級指南）

### Commits / 檔案改動
- 新增：`_ct-workorders/_report-plan-018-remote-security-port.md`（主要產出，~11 KB、310+ 行）
- 修改：`_ct-workorders/T0166-research-remote-security-hardening-port.md`（開工/收尾元資料 + 回報區）
- 本工單無 code 改動（純靜態分析）

### Worker 筆記

**關鍵觀察**：
1. **Upstream 明確承認 path-guard 是 harm-reduction 而非完整 sandbox**（`path-guard.ts` 開頭註解：「does NOT sandbox to a workspace root」）。這意味著工單 2 的驗收要務實：檢查是否擋住高危敏感路徑即可，不追求 workspace-scoped。
2. **Upstream 也沒有 `ctx.isRemote` 旗標**（`HandlerContext` 只有 `windowId`），與 fork 一致。path-guard 對 local/remote 一視同仁，這是刻意的設計選擇。
3. **Fork `remoteServer.currentToken` vs upstream `getPersistedToken()`**：T0129 PTY env 注入依賴這個 getter。工單 1 需保留 alias 或修改 PtyManager callback 兩處。
4. **Brute-force 計數器 in-memory 不持久化是 upstream 刻意選擇**（防 DoS 而非帳號鎖定）。fork 無需改。
5. **Fork 缺 `selfsigned` 依賴，`package.json` 要加 `^5.5.0`**（必須 v5 async API，舊版是 sync）。

**後續風險提醒**：
- `src/types/electron.d.ts` 與 `preload.ts` 的型別一致性是長期技術債，當前 fork 手寫，將來可考慮拆獨立工單做全面重構（超出 PLAN-018 範圍）
- 工單 1 的 cert/token 檔遷移建議準備 rollback 腳本（手動刪 `.enc.json` + 清 profile.remoteFingerprint 欄位）
- 工單 4 的 packaged 測試可能揭露 `asarUnpack` 相關 binary 遺漏（參考 electron-builder 26 migration note），預留 buffer

**沒讀到的空白**（不影響決策但工單 1/2 執行時需補）：
- Fork `ProfilePanel.tsx` / `SettingsPanel.tsx` 完整實作
- Fork T0158 PROXIED_CHANNELS 擴充的完整理由（commit hash 未查）
- Windows `%APPDATA%\better-agent-terminal\` 實際路徑字面量確認
