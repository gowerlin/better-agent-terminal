---
schema_version: 1
schema_kind: workorder
id: T0681
title: "BUG-168 G3：ssh-start-server／ssh-bundle-uploader／wsl-systemd／wsl-detect 四個舊測試與 vitest 版去重，獨有情境搬進 vitest，刪舊檔"
type: fix
status: TODO
repo: better-agent-terminal
project: BUG-168
priority: P2
sizing: M
created_at: "2026-10-21T20:38:28+0800"
depends_on:
  - "T0679（DONE `6fb40e70`：逐項分類與證據）"
related:
  - "D177（往 vitest 收斂）；BUG-168；T0679 回報區「調查結論」表與「SSH／WSL 安裝路徑的產品端追查」"
  - "規則：CLAUDE.md「Remote 資安」節、`docs/agent-guide/remote-security.md`（安裝根目錄必須絕對、至少兩段）；T0511（systemd unit 帶 `--port`、`enable` + `restart`、launchd 驗證 port 在聽）、T0552／T0554、T0378、T0382"
affects_files:
  - tests/ssh-start-server.test.ts
  - tests/ssh-bundle-uploader.test.ts
  - tests/wsl-systemd.test.ts
  - tests/wsl-detect.test.ts
  - electron/__tests__/ssh-start-server.test.ts
  - electron/__tests__/wsl-systemd.test.ts
  - electron/__tests__/wsl-detect.test.ts
  - electron/__tests__/wsl-install-bundle.test.ts
  - "electron/remote/__tests__/ssh-*.test.ts"
  - _ct-workorders/T0681-bug168-g3-ssh-wsl-tests-dedupe.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 只改測試，不改產品程式。T0679 已判定全部是測試過時；以下舊期望是錯的，**不得**搬進 vitest：安裝路徑用 `~`（T0552 起必須絕對、至少兩段）、systemd unit 用 `Environment=BAT_REMOTE_PORT` 而不是 `--port`（舊寫法就是 BUG-121）、`enable --now`（T0511／T0382 改成 `enable` + `restart`）、`pgrep -x bat-server` 驗證 launchd（T0511 改輪詢 PID + `lsof` 確認 port 在聽）、`~` 路徑的 systemd unit（BUG-087 的錯誤 unit）、不帶使用者的 `loginctl enable-linger`（T0378 先 `id -un`）、「第一次 active 就成功」（T0382 改穩定 3 秒且 NRestarts 不變）。"
  - "🔴 收斂規則（D177）：逐項比對 vitest 版；重複的不搬；獨有且仍有效的搬進對應的 vitest 檔（例如 T0679 提到的 T0297 escapeXml／plist breakout、T0296 BatchMode、sshHost 開頭 `-` 的拒絕），期望值改成現行正確行為；最後 `git rm` 四個舊檔。若某個獨有情境要靠修改產品才能測，記下來不做。"
  - "🔴 測試不得真的連線遠端或啟動 WSL／Docker／SSH；沿用既有的 `setExecFileImplForTests`／`setSpawnImplForTests` 或 vitest 的 mock。"
  - "🔴 不改 `package.json`、`vite.config.ts`、`tests/__mocks__/**`。刪檔後若有 `package.json` script 指向它們，列在回報區，由後續 CI 工單清理。"
  - "🔴 同時有 T0680（G2）與 T0683（CI 第一步）的 Worker 在跑：只動 `affects_files`；commit 用 `git commit --only <檔案>`（刪檔用 `git rm` 後同樣只 commit 自己的路徑），不要 `git add -A`。"
  - "🔴 驗證：`npm run test:unit` 全過（記通過數與檔數）、`npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npx vite build` 成功；刪掉的四個舊檔在 repo 內（`package.json` 以外）沒有其他引用。"
  - "🔴 順帶記錄（不改）：`electron/wsl-systemd.ts` 解析使用者失敗時用 `error.message` 而非 `describeError`（T0679 遭遇問題第 3 點），在回報區寫建議即可。"
  - "🔴 公開 repo：依 `_local-rules.md`「公開 repo 去識別化（D176）」，測試資料用 `demo`／`tester`／代稱。Git：不 push；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；維持 LF；含反斜線的內容用 Write／Edit 工具寫（L129）。不跑 Playwright e2e。yolo：不得問使用者，判讀問題問塔台；不得寫出權杖值。"
---

# T0681 — BUG-168 G3：SSH／WSL 舊測試去重並收進 vitest

## 目標

`tests/` 底下 ssh-start-server、ssh-bundle-uploader、wsl-systemd、wsl-detect 四個檔共 18 項失敗，T0679 判定全部是測試過時，而且和 `electron/__tests__/`、`electron/remote/__tests__/` 的 vitest 版大量重複。依 D177：重複的不搬、獨有且仍有效的搬進 vitest 並更新成現行正確的期望、刪掉舊檔。

## 要做的事

1. 讀 T0679 回報區這四個檔的分類表與「產品端追查」。
2. 逐項比對 vitest 版，搬移獨有情境（期望值依現行工單與 `docs/agent-guide/remote-security.md`）。
3. `git rm` 四個舊檔。
4. 驗證、commit（不 push）。

## 驗收

- 四個舊檔已刪；回報區有對照表（舊項目 → vitest 位置／重複未搬／錯誤期望不搬，附理由）。
- `test:unit` 全過；typecheck 0／0；build 成功。
- 只改 `affects_files`；未 push。

---

## 回報區

### 完成狀態

### 對照表（舊項目 → vitest 位置／重複未搬／錯誤期望不搬）

### 驗證結果

### 因刪檔而失效的 package.json script

### 建議（不在本單範圍）

### Commit

### 遭遇問題

### 回報時間
