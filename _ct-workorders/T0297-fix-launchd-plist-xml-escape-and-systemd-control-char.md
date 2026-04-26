# T0297 — Fix PLAN-007 launchd plist XML escape + systemd unit 控制字元防護（F-005）

## Metadata

| 欄位 | 內容 |
|------|------|
| 工單編號 | T0297 |
| 類型 | fix（v0.4.0 release blocker，最後一張） |
| Phase | PLAN-007 release prep — fix chain 第 4 張（最終 fix） |
| 狀態 | 📋 TODO |
| 建立時間 | 2026-04-26 17:57 (UTC+8) |
| 派發時間 | （待派） |
| 完成時間 | （待） |
| Wall time | （待） |
| Sizing | S（GP099 校準後預期 wall 5-12 min — XML escape helper + plist/unit 套用 + 測試） |
| 依賴 | T0294 ✅、T0295 ✅、T0296 ✅、T0292 review F-005 |
| 後續 | T0298（re-review 自我驗證 → 確認所有 critical/high finding 修復） |
| 工作目錄 | **main repo**，branch **`release/v0.4.0`** |
| Renew 次數 | 0 |
| 互動旗標 | `--mode yolo --no-interactive`（fire-and-forget） |
| `affects_files` | `electron/remote/ssh-start-server.ts`、`tests/ssh-start-server.test.ts` |

## 目標

修復 T0292 F-005（launchd plist 內 installPath / port 未做 XML escape）：

- launchd plist 直接字串插值 `<string>${opts.installPath}/bin/bat-server</string>`，含 `</string><array>...` 字串會破壞 plist 結構，可能讓 launchd 載入任意 ProgramArguments
- systemd unit `ExecStart=${installPath}/bin/bat-server` 同 pattern，雖 T0296 已加 `\r` reject，但 escape 邏輯散在多處，本工單做最後 hardening

**注意**：T0296 `escapeSingleQuotesStrict` 已防 control char + 單引號注入；本工單**互補**做 **XML 結構性 escape**（`& < > " '` → entity references），確保即使內容通過 control char check，仍不會破 plist XML 結構。

## 範圍

### 修改 `electron/remote/ssh-start-server.ts`

1. **新增 `escapeXml` helper**（純函數，inline 或抽到 `electron/remote/xml-escape.ts`）：
   ```ts
   /** 把字串內的 XML special char 轉為 entity reference */
   function escapeXml(s: string): string {
     return s
       .replace(/&/g, '&amp;')
       .replace(/</g, '&lt;')
       .replace(/>/g, '&gt;')
       .replace(/"/g, '&quot;')
       .replace(/'/g, '&apos;')
   }
   ```
2. **`renderLaunchdPlist`** 修法（line ~119, 127, 130, 137 等 string 插值點）：
   - 所有插值到 `<string>...</string>` 的字串走 `escapeXml`：
     ```ts
     return `<?xml version="1.0" encoding="UTF-8"?>
     <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
     <plist version="1.0">
     <dict>
       <key>Label</key><string>${escapeXml(LAUNCHD_LABEL)}</string>
       <key>ProgramArguments</key>
       <array>
         <string>${escapeXml(opts.installPath)}/bin/bat-server</string>
       </array>
       <key>EnvironmentVariables</key>
       <dict>
         <key>BAT_REMOTE_BIND</key><string>localhost</string>
         <key>BAT_REMOTE_PORT</key><string>${escapeXml(String(port))}</string>
       </dict>
       <key>RunAtLoad</key><true/>
       <key>KeepAlive</key>
       <dict>
         <key>SuccessfulExit</key><false/>
         <key>Crashed</key><true/>
       </dict>
       <key>StandardErrorPath</key><string>${escapeXml(opts.installPath)}/log/stderr.log</string>
       <key>StandardOutPath</key><string>${escapeXml(opts.installPath)}/log/stdout.log</string>
     </dict>
     </plist>`
     ```
3. **`renderSystemdUnit`** 修法（line ~109）：
   - systemd unit 的 INI 格式對 `\n` / `=` / `[]` 敏感，T0296 已加 `\r\n` 拒絕；本工單**額外**檢查 `installPath` 不含 `[` `]` `=`（systemd section / key-value 結構性字元）：
     ```ts
     function validateSystemdValue(value: string, fieldName: string): string {
       if (/[\n\r\[\]=]/.test(value)) {
         throw new Error(`${fieldName} contains forbidden char (\\n, \\r, [, ], =) for systemd unit: ${JSON.stringify(value)}`)
       }
       return value
     }
     ```
   - `renderSystemdUnit` 內所有 installPath / serverHome 字串插值前過 validateSystemdValue

### 補測試

4. **`tests/ssh-start-server.test.ts`** 補 case：
   - `escapeXml` unit test：
     - `&` → `&amp;`
     - `<` → `&lt;`
     - `>` → `&gt;`
     - `"` → `&quot;`
     - `'` → `&apos;`
     - 組合：`</string><key>X` → `&lt;/string&gt;&lt;key&gt;X`
   - `renderLaunchdPlist` 攻擊測試：
     - `installPath = '/tmp</string><key>Foo</key><string>x'` → 渲染結果應**不**含 unescaped `</string><key>Foo`，而是 `&lt;/string&gt;&lt;key&gt;Foo` entity 形式
     - parser-friendly：渲染結果可被 plist parser 正確解析（mock plist parse 或 regex 確認結構不破）
   - `renderSystemdUnit` 攻擊測試：
     - `installPath = '/tmp\n[Service]\nExecStart=evil'` → throw（`\n` 已被 T0296 拒絕，這 case 確認 fail-fast）
     - `installPath = '/tmp[Foo]'` → throw（`[]` 拒絕）
     - `installPath = '/tmp=oops'` → throw（`=` 拒絕）
   - 至少 8 case

### Out of scope（不做）

- ❌ 不重構整個 plist / unit 渲染邏輯
- ❌ 不引入 plist library（YAGNI，escape 即可）
- ❌ 不修 baseline BUG-061
- ❌ 不擴展 v0.4.1 backlog
- ❌ 不修 systemd Environment= 行的進階 escape（v1 沒這 case）
- ❌ 不寫 plist parser 驗證 round-trip（mock-friendly 即可）

## 前置條件 / 參考文件

| 文件 | 用途 |
|------|------|
| `_ct-workorders/T0292-review-report.md` F-005 | XML escape critical 詳情 + 攻擊範例 + 修法 |
| `electron/remote/ssh-start-server.ts` 現況 | renderLaunchdPlist + renderSystemdUnit 既有實作 |
| `electron/remote/ssh-args.ts`（T0296 產出） | escapeSingleQuotesStrict 互補（control char）+ helper pattern 範本 |
| `tests/ssh-start-server.test.ts` 現況 | 既有 8 case 結構 |

## AC（驗收條件）

| # | 條件 | 驗收方式 |
|---|------|---------|
| AC1 | `escapeXml` helper 存在（inline 或 `electron/remote/xml-escape.ts`），覆蓋 5 個 XML special chars（`& < > " '`） | grep |
| AC2 | `renderLaunchdPlist` 所有 `<string>...</string>` 插值欄位走 `escapeXml`（含 installPath / port 等） | grep + diff |
| AC3 | F-005 攻擊複現：`installPath = '/tmp</string><key>Foo</key><string>x'` 渲染結果**不**含 unescaped `</string>`，而是 entity 形式 | 寫進 ssh-start-server.test.ts |
| AC4 | `renderSystemdUnit` 加 `validateSystemdValue` 檢查 `\n` / `\r` / `[` / `]` / `=`（互補 T0296 control char） | grep |
| AC5 | systemd 攻擊複現：`installPath = '/tmp[Foo]'` throw；`installPath = '/tmp=oops'` throw | 寫進 ssh-start-server.test.ts |
| AC6 | `escapeXml` unit test：5 個 special char 各自 + 組合攻擊 → 至少 6 case | 跑指令 |
| AC7 | 既有 ssh-start-server test 仍綠（zero regression） | 跑指令 |
| AC8 | 既有 ssh-args / ssh-tunnel / ssh-bundle-uploader / ssh-auth-probe / contract / docker-path test 全部仍綠 | 跑全 test |
| AC9 | TypeScript baseline drift = 0 | 跑 tsc |
| AC10 | git diff stat：受影響 ≤ 150 lines net add | 計算 |

## 守則（嚴格）

1. **工作分支**：main repo cwd，**`release/v0.4.0`** branch
2. **commit message**：`fix(remote): T0297 launchd plist XML escape + systemd unit struct char (F-005)\n\n工單：T0297\n依賴：T0292 F-005\n互補 T0296 control char rejection；本工單做 XML 結構性 escape 與 systemd struct char rejection`
3. **工單檔不寫**：Worker 嚴禁修改主線 `_ct-workorders/T0297-*.md`
4. **工具白名單**：Read / Edit / Write / Bash / Grep / Glob
5. **emoji**：除測試輸出外禁用
6. **與 T0296 互補不衝突**：T0296 已防 control char + 單引號；本工單做 XML escape + systemd struct char。**不重複**檢查；插值前先過 T0296 的 escapeSingleQuotesStrict（既有），再過本工單的 escapeXml（plist）或 validateSystemdValue（unit）
7. **fail-fast**：systemd 攻擊 case throw；plist escape 是 silent-safe（escape 後不破結構即可，不 throw）
8. **零 regression**：所有既有 test 必須全綠
9. **不擴範圍**：本工單僅修 F-005；不動其他 finding
10. **completion 判定**：10 AC 全過或 ≥ 8 → `T0297 完成`

## 預期 wall

**5-12 min**（GP099 校準後；S sizing；escapeXml 是 7 行純函數 + plist / unit 各替換 5-7 處 + 8 個 test case；最快的 fix workorder）

## 工單回報區

（Worker 完成後在此補回報；塔台會在收到「T0297 完成」訊息後從本檔讀回報區）
