---
schema_version: 1
schema_kind: bug
id: BUG-199
title: "`nvm-login-profile.test.ts` 的真 bash 測試在整套 `test:unit` 負載下逾時 5 s（BUG-195 同類，第五支）"
status: FIXED
severity: low
reproducibility: rare
created_at: "2026-11-02T22:12:53+0800"
updated_at: "2026-11-02T22:58:26+0800"
fixed_at: "2026-11-02T22:58:26+0800"
fix_commit: f03adbd6
impact:
  - test-infra
links:
  discovered_in: "第一百零七 session `0.7.3-pre.9` 聯合驗證 @ `5ebcc71f`"
  related: [BUG-195, T0786, T0556]
---
# BUG-199 — `nvm-login-profile.test.ts` 在整套負載下逾時

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🟢 low（只影響測試；產品行為無關。CI Test gate 若撞到會擋發版） |
| 可重現 | 偶發：整套 1 次中 1 次；單檔 3 / 3 通過（7.2–8.7 s），整套重跑通過 |
| **狀態** | ✅ FIXED（T0793 `f03adbd6`，待 CI Test gate 驗收） |
| 回報者 | 塔台（聯合驗證） |

## 現象

- 預期：`npm run test:unit` 一次全綠。
- 實際：`src/lib/remote-tools/__tests__/nvm-login-profile.test.ts` › `nvm login profile block under real shells (T0556)` › `login shells find nvm's node` › `~/.profile layout: bash -lc finds it; bash -lic loads nvm once (from ~/.bashrc, the block skips)`（第 193 行）`Test timed out in 5000ms`。
- 同一次整套：384 / 385 files、6781 passed；verify-native-modules、typecheck 0 / 0、vite build、legacy 472 / 33 皆綠。
- 單檔重跑 3 次：24 passed，每次 7.2–8.7 s（整檔），單一測試接近 5 s 預設上限。整套重跑：385 / 385、6782 passed。

## 判斷

- 與 BUG-195（T0786）同一類：真子程序（這裡是 `bash -lc` / `bash -lic`）在整套平行負載下均勻變慢 2–3 倍。T0786 修了 4 檔並寫明「第五支以上再出現先回報」，這是第五支。
- 與 T0791（`electron/terminal-blocked-state.ts`）無關，檔案自 T0556 後未變更。

## 修正方向

- 比照 T0786：量測後對該 `describe` 設 per-describe timeout（附量測），或減少每個測試的 shell 呼叫；不改全域 `testTimeout`、不改產品。
- 另可評估：把真子程序測試集中到一個共用 helper / 標記，避免逐檔追加。

## 處理紀錄

- 2026-11-02 22:12 開單（OPEN，low）。`0.7.3-pre.9` 聯合驗證發現；整套重跑綠，不擋 pre.9（比照 BUG-195 首次出現時的處置）。
- 2026-11-02 22:40 → FIXING：開 T0793（P3，S，D234），比照 T0786 先量再改；共用 helper / 標記只評估、不實作。
- 2026-11-02 22:58 → FIXED（T0793 `f03adbd6`）。

## T0793 結果

- **根因**：這個檔案的每個測試都依序開真 shell —— append 指令（`sh` + subshell + `grep`）、每次登入（`sh -c 'exec "$@"'` → `bash` / `sh` / `dash` 的登入 profile，含 Git Bash 的 `/etc/profile`）。整檔 58 次 spawn（append 32、`bash -lc` 9、`sh -lc` 8、`dash -lc` 7、`bash -lic` 2）。單檔每次 spawn 0.1–0.5 s，最慢的測試 1.0 s（第 193 行那支約 0.4 s）；整套下每次 spawn 均勻變慢 2–4 倍，偶有單次 1.2–1.6 s 的尖峰，沒有單一慢步驟。與產品程式碼無關。
- **縮短評估**：`sh -c exec` 包裝每次約 10–20 ms（直接 spawn `bash.exe -lc` 中位數 123 ms vs 經 `sh` 201 ms，雜訊大），主要成本是登入 profile 本身與 `NVM_PROFILE_COMMAND`，都是測試要驗的東西 → 沒有可省而不減少覆蓋的工作。
- **修法**：替 `nvm login profile block under real shells (T0556)` 這個 `describe` 設 `{ timeout: 30_000 }`（與 T0786 一致），註解寫量測值。沒改產品程式碼與常數、`vite.config.ts` 全域 `testTimeout`，沒有 skip / retry。
- **量測**：修改前整套 3 次 exit 0（本檔最慢 2.6 / 2.7 / 2.3 s）；修改後整套 3 次 exit 0（本檔最慢 3.8 / 3.7 / 1.7 s，第 193 行 1.0 / 3.7 / 0.9 s）；兩個 `test:unit` 同時跑，本檔最慢 3.8 / 5.2 s 與 4.7 / 5.4 s（超過舊的 5 s 上限，修改後通過）；`test:unit` ＋ 8 個 CPU 忙迴圈 exit 0（本檔最慢 2.1 s）。
- **範圍外**：兩個 `test:unit` 同時跑時，整套都 exit 1，失敗全在範圍外（見 T0793 回報區清單：`server-bundle-install-script`、`node-libatomic-shell`、`headless-git`、`git-scaffold-env`、`terminal-blocked-state` T0657 逾時；`terminal-blocked-state` T0790 / T0791 的兩個真 hook 程序回報順序顛倒；`worktree-status-after-close` 超過 30 s）。依 T0793 不擴大範圍，交塔台決定。
