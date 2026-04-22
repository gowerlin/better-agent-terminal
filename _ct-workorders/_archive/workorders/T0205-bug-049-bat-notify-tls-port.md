# T0205 — BUG-049 修復:port BUG-046 TLS 修復到 bat-notify.mjs

## 元資料
- **類型**:fix(修復型,非互動)
- **狀態**:FIXED
- **關聯**:BUG-049 · BUG-046(已 CLOSED,參考 commits `380fa3c` T0202a + `831234b` T0202b)
- **派發時間**:2026-04-19 10:52 (UTC+8)
- **開始時間**:2026-04-19 10:56 (UTC+8)
- **完成時間**:2026-04-19 11:02 (UTC+8)
- **預估工時**:5-15 min
- **Renew 次數**:0
- **互動**:不啟用

## 塔台決策背景

BUG-049 根因:`bat-notify.mjs` 的 `MinimalWS` 未隨 T0202a/T0202b 升級,仍用 plain `net.createConnection`,導致 server TLS (wss://) FIN close 時 **silent hang**。症狀:Worker YOLO 完成訊息永遠抵達不了塔台 terminal,使用者必須手動貼「T#### 完成」。

**修復策略**:一對一 mirror `bat-terminal.mjs` 的 MinimalWS TLS 部分到 `bat-notify.mjs`(Option A,trivial)。不抽 shared module(那是 PLAN-023 候選)。

## 目標

1. 把 `bat-notify.mjs` 的 MinimalWS 從 plain TCP 升級成 TLS(mirror T0202b)
2. 加入 close-before-upgrade reject(mirror T0202a)
3. 加入 `preUpgradeClose` 判斷(區分 connect-failed / connect-closed-before-upgrade)
4. 驗證:`_bat-logger` 能印出完整 chain(invoke → parsed → send result:ok → exit code:0)

## 修改範圍

### 檔案:`scripts/bat-notify.mjs`(唯一修改點)

參考 `scripts/bat-terminal.mjs` 對應行數作一對一鏡像:

| 項目 | `bat-terminal.mjs` 參考位置 | `bat-notify.mjs` 應用方式 |
|------|---------------------------|--------------------------|
| TLS import | L21 `import { connect as tlsConnect } from 'tls'` | 取代或補充 L32 `import { createConnection } from 'net'`(視 bat-notify 是否還有其他 TCP 用途;若無則改為 tls import) |
| MinimalWS connect | L266-305(tlsConnect 初始化 + SNI edge case) | 替換 L266 的 `createConnection` 區塊 |
| SNI IP literal guard | T0202b 新增邏輯(`isIpLiteral` 偵測) | 一併 port(若 bat-terminal.mjs 有) |
| T0202a close-reject | L326-335(upgrade 時 socket 'close' 事件 reject) | mirror 到 bat-notify.mjs 對應 MinimalWS 位置 |
| T0202a error reason | L448-452(`preUpgradeClose` + `connect-closed-before-upgrade` reason) | mirror 到 bat-notify.mjs 對應 catch/exit 處 |

**不改**:
- ❌ `bat-notify.mjs` 的 CLI 介面(argv 解析、usage、--source/--target/--submit/--pty-write 等)
- ❌ `bat-notify.mjs` 的 logEvent 格式(invoke / parsed / send / exit 順序)
- ❌ `bat-terminal.mjs` 本身(已修,不回調)

## 執行步驟

### Step 1:比對兩個 script 的 MinimalWS 差異

```bash
diff -u scripts/bat-notify.mjs scripts/bat-terminal.mjs | head -200
# 或單獨看 MinimalWS 區塊
sed -n '240,410p' scripts/bat-notify.mjs > /tmp/notify-ws.txt
sed -n '245,455p' scripts/bat-terminal.mjs > /tmp/terminal-ws.txt
diff -u /tmp/notify-ws.txt /tmp/terminal-ws.txt
```

找出需要 port 的具體 chunk(預期主要是 connect 方法、close handler、error reason 判斷)。

### Step 2:實作 port

按 Step 1 diff 結果修改 `bat-notify.mjs`:
- import 調整
- MinimalWS.connect 改用 tlsConnect
- close-before-upgrade reject
- preUpgradeClose 判斷 + 錯誤訊息

### Step 3:驗證

```bash
# 語法檢查(zero-deps CLI,無需 build)
node --check scripts/bat-notify.mjs

# 實際測試:在本 terminal(塔台)裡用 bat-notify 測自己
# 預期:PTY write 到自己的 terminal,console 輸出「✓ Notified ...」,exit 0
node scripts/bat-notify.mjs --target "$BAT_TERMINAL_ID" --source "T0205-test" "T0205 test ping"

# 檢查 log 尾端應有完整 chain
tail -20 "$LOCALAPPDATA/BetterAgentTerminal/Logs/bat-scripts.log"
# 或 Windows: Get-Content "$env:APPDATA/BetterAgentTerminal/Logs/bat-scripts.log" -Tail 20
```

**驗收信號**:
- `send result:ok` + `exit code:0` 出現在 log
- Console 輸出 `✓ Notified ...`
- 塔台 terminal 應看到 "T0205 test ping" 字串出現(PTY write 成功)

### Step 4:git diff 範圍驗證

```bash
git diff --stat
# 應只動到 scripts/bat-notify.mjs,其他零改動
git diff scripts/bat-terminal.mjs  # 應為空
```

### Step 5:Commit

```bash
git add scripts/bat-notify.mjs
git commit -m "fix(bat-notify): port BUG-046 TLS upgrade from bat-terminal.mjs (BUG-049)

bat-notify.mjs MinimalWS was duplicated from bat-terminal.mjs with zero-deps
principle, but missed the T0202a (close-reject) and T0202b (TLS upgrade)
fixes. Result: Worker YOLO completion notifications silent-hang forever
(process stuck in plain TCP connect to wss:// server).

This patch mirrors:
- tlsConnect replacing net.createConnection
- close-before-upgrade reject with descriptive error
- preUpgradeClose branch in error reason

Verification: Worker notify now completes with send result:ok + exit code:0
chain visible in bat-scripts.log; Tower terminal receives PTY write.

Refs: BUG-049, BUG-046 (closed, 380fa3c T0202a + 831234b T0202b)"
```

## 禁止事項

- ❌ 不動 `bat-terminal.mjs`(BUG-046 已閉環)
- ❌ 不抽共用 MinimalWS module(範圍控制,留給 PLAN-023)
- ❌ 不改 CLI 介面(保持向後相容)
- ❌ 不改 `_bat-logger.mjs`
- ❌ 不改 log event 格式

## 驗收標準

- [ ] `node --check scripts/bat-notify.mjs` 通過
- [ ] 本地測試 `bat-notify --target $BAT_TERMINAL_ID --source test "ping"` 成功:
  - console 有 `✓ Notified ...`
  - log 有 `send` + `exit code:0`
  - 塔台 terminal 收到 "ping"
- [ ] `git diff --stat` 僅 `scripts/bat-notify.mjs`
- [ ] `git diff scripts/bat-terminal.mjs` 為空
- [ ] commit hash + 實耗時

## 互動規則

- 不啟用互動
- **必須暫停回塔台**的情境:
  - `bat-terminal.mjs` 的 MinimalWS 範圍不清(無法精準 port) → pause 回報
  - port 後 local smoke test 仍 silent hang → pause 回報 log 尾端

## 交付物

寫入本檔「回報區」:
- [ ] Step 1 diff 摘要(兩個 script 的 MinimalWS 差異)
- [ ] Step 2 實作摘要(改了哪些行)
- [ ] Step 3 smoke test 輸出(console + log tail)
- [ ] Step 4 git diff 範圍驗證
- [ ] commit hash
- [ ] 實耗時 vs 估時

## 回報區

### 完成狀態:FIXED

### Step 1 diff 摘要

`bat-notify.mjs` vs `bat-terminal.mjs` MinimalWS 落差(BUG-046 兩個 fix 未 port):

- L32 import:`net.createConnection` vs `tls.connect`
- L266 connect body:plain TCP 回呼寫 HTTP 升級 vs `tlsConnect` + `once('secureConnect')`;缺 `isIpLiteral` SNI guard
- L297 close handler:只 `clearTimeout` vs `if (!upgraded) reject('closed before upgrade')`
- main() L405 catch:單一 `connect-failed` reason vs `preUpgradeClose` 分支 + `connect-closed-before-upgrade` reason + hint

### Step 2 實作摘要

`scripts/bat-notify.mjs` 三處修改(+42 / -5):

1. **import** (L32):`createConnection from 'net'` → `connect as tlsConnect from 'tls'`
2. **MinimalWS.connect** (L266-298):改寫 connect 區塊
   - 新增 `isIpLiteral` 判斷(IPv4 literal or contains `:`)
   - `tlsConnect({ host, port, rejectUnauthorized: false, ...(isIpLiteral ? {} : { servername: host }) })`
   - `socket` 連線觸發從建構子回呼改為 `once('secureConnect', ...)`
   - close handler 升級為 `if (!#upgraded) reject('connection closed before upgrade ...')`
3. **main() catch** (L405-418):加入 `preUpgradeClose = msg.startsWith('connection closed before upgrade')` 分支,`connect-closed-before-upgrade` reason + hint

### Step 3 smoke test 輸出

```
# 執行
node scripts/bat-notify.mjs --target "$BAT_TERMINAL_ID" --source "T0205-test" "T0205 test ping"
→ ✓ Notified 70a3722b…: T0205 test ping

# Log tail (bat-scripts.log,2026-04-19 02:58:36Z)
bat-notify invoke  pid:26960 argv:[--target, 70a3722b..., --source T0205-test, T0205 test ping]
bat-notify parsed  target:70a3722b... ptyWrite:true submit:false
bat-notify send    channel:terminal:notify result:ok
bat-notify send    channel:pty:write      result:ok appendedCR:false
bat-notify exit    code:0
```

完整 chain 出現 (invoke → parsed → send×2 ok → exit 0);PTY write 寫入自身塔台 terminal 成功。

### Step 4 git diff 範圍驗證

```
$ git diff --stat -- scripts/
 scripts/bat-notify.mjs | 47 ++++++++++++++++++++++++++++++++++++++++++-----
 1 file changed, 42 insertions(+), 5 deletions(-)

$ git diff scripts/bat-terminal.mjs
(empty)
```

唯一 scripts/ 改動為 `bat-notify.mjs`;`bat-terminal.mjs` 零改動。其他 diff(`_ct-workorders/BUG-042`, `BUG-045`, `_bug-tracker.md`)屬工單開始前 session 既有未提交變動,不在本工單範圍。

### 互動紀錄

無

### 遭遇問題

無

### commit hash

`5f10e7e` (scripts/bat-notify.mjs +42/-5)

### 實耗時 vs 估時

實耗時 ~6 分鐘(10:56 → 11:02) / 估時 5-15 min,在預估下緣。

### 回報時間

2026-04-19 11:02 (UTC+8)

---
