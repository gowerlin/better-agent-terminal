---
schema_version: 1
schema_kind: workorder
id: T0380
title: "研究：WSL 環境全自動化（PLAN-035）—— 各環節指令 / 提權 / 重開機接續 / 常駐 / 網路模式判定"
type: research
status: TODO
priority: P1
sizing: M
created_at: "2026-10-04T22:04:14+08:00"
updated_at: "2026-10-04T22:04:14+08:00"
started_at: null
completed_at: null
target_version: next
depends_on: []
related:
  - "PLAN-035（本研究服務的計劃）"
  - "BUG-089（網路模式誤判，研究目標 4）"
  - "BUG-087 / T0378 / D126（linger、絕對路徑、不回滾、WSL exit code 偵測）"
  - "BUG-071 / PLAN-031（server bundle 下載與安裝）"
  - "PLAN-032（精靈 Stepper / awaiting-input / error mapping 框架）"
affects_files: []
interaction:
  mode_hint: on
  interactive: true
  intervention_type: context-dependent
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 **研究工單，不改產品程式碼、不 commit 本工單檔以外任何檔案**。實驗腳本放 scratchpad，結束前清乾淨。"
  - "🔴 **不得變更使用者 WSL 環境**：不改 `%USERPROFILE%\\.wslconfig`、不 `wsl --shutdown`、不 `wsl --install` / `--update` / `--unregister`、不改發行版內 `/etc/wsl.conf`、不停用 / 移除 Windows 功能。唯讀查詢（`wsl -l -v`、`wsl --status`、`wsl --version`、`wslinfo`、發行版內唯讀指令）可以。"
  - "⚠️ 對 `Ubuntu-24.04` 執行任何指令會**啟動**該發行版。研究目標 3（常駐）需要觀察閒置關閉行為，啟動 / 觀察前先問使用者（使用者可能正在跑精靈驗收）。"
  - "⚠️ 需要破壞性實驗（例如驗證 `wsl --install` 流程、重開機接續）時，**只做文件 / 官方說明查證**，或提出實驗方案問使用者，不得自行執行。"
---

# T0380 — 研究：WSL 環境全自動化

## 元資料

- **類型**：research
- **互動模式**：enabled（每次 ≤ 3 題）
- **工作量預估**：M
- **Context Window 風險**：中（官方文件 + 精靈程式碼多檔）

## 背景

使用者裁決（D127 / PLAN-035）：WSL 精靈要能從「Windows 未安裝 WSL」一路自動到可用的 BAT 伺服器；環境不符時自動修正。同意模型為**先偵測 → 列清單 → 一次同意**；WSL 未安裝時**全自動含重開機後接續**。本研究為 PLAN-035 Phase 0，產出要能直接拆成實作工單。

## 已知資訊（塔台 2026-10-04 21:58-22:04 檢查，請自行複核）

- WSL 2.7.13.0；唯一發行版 `Ubuntu-24.04`（VERSION 2，預設）
- 使用者 BUG-087 驗收：精靈第 1-5 步 ✓（含「寫入 systemd 使用者服務」），第 6 步「取得 TLS 指紋」進行中顯示 NAT 警告
- 塔台 21:58 查：`Ubuntu-24.04` 為 **`Stopped`**（精靈第 6 步期間）⇒ bat-server 不可能在跑
- `.wslconfig`：`[wsl2] networkingMode=Mirrored`、`[experimental] hostAddressLoopback=true`、`bestEffortDnsParsing=true`
- 本機 `EnableLUA=0`（UAC 停用，BAT 與子 shell 皆提權，見 BUG-085）—— 提權行為與一般使用者環境不同，研究結論須涵蓋 UAC 開啟的情況
- 程式碼入口：
  - `electron/wsl-detect.ts`（`detectNetworkMode` :220-239 為 BUG-089）
  - `electron/wsl-systemd.ts`、`electron/wsl-validate.ts`
  - `src/components/setup-wizard/steps/wsl/`：`detect-env` / `pick-wsl-distro` / `wsl-systemd-check` / `install-server-bundle`（:107 呼叫 detectNetworkMode）/ `write-systemd-unit` / `fetch-fingerprint` / `connect-test` / `write-profile` / `done`
  - 精靈框架（PLAN-032）：runner、awaiting-input、preflight cache、error mapping

## 研究目標

1. **各環節指令與前提**（PLAN-035 範圍表環節 1-8）：每個環節的偵測指令、修正指令、是否需提權、是否需重開機 / `wsl --shutdown` / `--terminate`、冪等性、失敗型態與 exit code。特別是：
   - `wsl --install --no-distribution` 在 Windows 10 / 11 各版本的行為差異、何時需要重開機、如何偵測「已裝但待重開機」
   - 發行版安裝後**非互動建立預設使用者**的可靠做法（`--no-launch` 後以 root 建使用者 + `/etc/wsl.conf [user] default=`，或其他）
   - 改 `.wslconfig` 時保留既有內容的做法（INI 格式、大小寫、註解）
2. **重開機接續機制**：精靈進度持久化位置與格式；開機後如何回到精靈（BAT 開機自啟？`RunOnce`？使用者下次開 BAT 時偵測未完成精靈？）。比較方案並推薦，評估對既有精靈框架的改動量
3. **常駐（keep-alive）**：
   - **證實或排除**：bat-server 以 systemd user service + linger 執行時，沒有 `wsl.exe` 連線，WSL 會在閒置後關閉發行版（觀察前先問使用者）
   - 若證實：比較方案——`.wslconfig` 的 idle timeout 類設定（查 2.7.x 支援哪些鍵、作用於 VM 還是 instance）、BAT 持有長駐 `wsl.exe -d <distro>` 子行程、Windows 登入排程啟動、其他；考慮 BAT 未執行時遠端是否仍需可用
4. **網路模式判定（BUG-089）**：Mirrored 下 `ip route show default` 實際輸出；`wslinfo --networking-mode` 可用性（哪個版本起）；「`.wslconfig` 已設但未生效」如何偵測；Mirrored / NAT 下 `localhost` 連入 bat-server 的實際差異（決定 NAT 是否真需要修正，還是只要 connect-test 正確處理）
5. **同意清單 UI 與精靈框架整合**：在 PLAN-032 框架上，「偵測 → 清單 → 一次同意 → 執行」應放在哪一步、如何呈現影響範圍（全機 / 單一發行版）、未勾選項目如何影響後續步驟
6. **實作拆單建議**：依 PLAN-035 Phase 1-3 給出工單切分、各單 `affects_files`、依賴順序、測試策略（unit 可測的部分 vs 必須實機的部分）、風險

## 調查範圍

- ✅ 上列程式碼只讀；Microsoft 官方 WSL 文件與 release notes；唯讀 `wsl` 查詢
- ✅ BAT debug log：`%APPDATA%\better-agent-terminal\Logs\debug-<stamp>.log`（L128），可查精靈第 6 步實際發生了什麼
- ❌ 不改 `src/` `electron/` `package*.json`；不改 WSL / Windows 設定；不發 release

## 互動規則

- 每次 ≤ 3 題；能用唯讀查詢或文件回答的不要問
- 啟動 / 觀察 `Ubuntu-24.04` 前先問使用者

## 回報要求

- 研究目標 1-4 每項結論標註 **證實 / 排除 / 無法判定** 並附證據（指令輸出、文件連結、行號）
- 目標 3 若證實，明確建議是否新開 BUG（嚴重度建議）
- 目標 6 的拆單可直接作為塔台開單依據
- 列出需要使用者實機驗證、Worker 無法驗證的項目

## Sub-session 執行指示

1. 讀取本工單全部內容 + `PLAN-035` + `BUG-089`
2. 填入 `started_at`、`status: IN_PROGRESS`（**用 `date "+%Y-%m-%dT%H:%M:%S%z"` 取系統時間，禁止手打**，R-G001）
3. 依研究目標 1 → 6 調查
4. 填寫回報區、更新 `status` / `completed_at` / `updated_at`；完成請寫 **`DONE`**（不是 `FIXED`）
5. commit **僅本工單檔**（`git commit --only _ct-workorders/T0380-research-wsl-environment-automation.md`）
6. 依派發 mode 通知塔台（`bat-notify.mjs`）

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯
