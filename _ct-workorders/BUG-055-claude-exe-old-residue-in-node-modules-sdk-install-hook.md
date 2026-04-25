# BUG-055 — `node_modules/@anthropic-ai/claude-code/bin/` 殘留 `claude.exe.old.XXX`(SDK install hook)

## 元資料

- **編號**:BUG-055
- **狀態**:🔁 REOPEN → BLOCKED-BY: T0251(2026-04-25 — T0250 反組譯確認與 BUG-059 同根因,方案 A spawn env 注入可同時解。原 WONTFIX 推測「upstream install hook bug」錯誤,實際是 update flow 不認得 BAT 路徑。等 T0251 DONE 後合併 CLOSED)
- **舊狀態**:⛔ WONTFIX(2026-04-23,推測根因錯誤,見 T0250 § 6 合併修復可行性)
- **原狀態**:🐛 OPEN
- **嚴重度**:🟢 Low(install hook 小瑕疵,單次觀測,有手動 workaround)
- **建立時間**:2026-04-22 20:32 (UTC+8)
- **發現來源**:T0235(hotfix BUG-053/054 過程中,`tests/claude-code-path.test.ts` 1/4 失敗)
- **關聯**:
  - T0235 遭遇問題 #1(記錄此殘留)
  - BUG-047(SDK install guard 測試)
  - `@anthropic-ai/claude-code` ^2.1.111(本地安裝 2.1.113)
- **範圍判定**:疑為 **upstream `@anthropic-ai/claude-code` SDK install 腳本**的 Windows in-use-file rename 殘留(非 BAT 自家代碼問題),但需驗證
- **可重現**:**只出現一次**(T0235 當下觀測,前次 SDK 版本升級/reinstall 時產生;尚未發現必現條件)
- **workaround**:手動刪除 `claude.exe.old.XXX` 檔案

## 現象

本地 `node_modules/@anthropic-ai/claude-code/bin/` 目錄下:

```
claude.exe.old.1776856737641*   # <-- 殘留,預期為 claude.exe
```

數字後綴 `1776856737641` 疑為 Windows 重命名當下的 timestamp(ms)。預期檔名應為 `claude.exe`。

## 影響

1. **測試層**:`tests/claude-code-path.test.ts` 預期 `claude.exe` 存在 → **1/4 測試失敗**(T0235 實測)
2. **版本偵測層**:`claude-resolver.ts` 找不到 embedded binary → 可能觸發 fallback 路徑或健康檢查失敗
3. **磁碟**:每次升級若都殘留,會累積舊檔案(本次僅 1 個,未觀測到累積)
4. **正式使用**:目前**未影響正式功能**(fallback-to-embedded + system claude 都可用)

## 可能根因(待驗證)

Windows 無法 rename/delete 正在執行的 `.exe`。SDK install 腳本(或 npm postinstall hook)在升級時:
1. 偵測到 `claude.exe` 存在且可能被占用 → rename 成 `claude.exe.old.<timestamp>`
2. 寫入新的 `claude.exe`
3. (**疑似跳過**)清理舊的 `.old.*` 檔案

若此判斷正確 → 屬於 `@anthropic-ai/claude-code` install hook 需要補清理邏輯。

## 調查建議(若要處理)

開研究工單 `research` 類型,驗證:
1. 觸發條件:哪種 npm 動作(install / update / rebuild / ci)會產生殘留?
2. 上游狀態:`@anthropic-ai/claude-code` 是否已有 issue/PR 處理?
3. Workaround 層級:是否可加 BAT postinstall hook 清理(`rm claude.exe.old.*`)作為短期解?
4. 長期方案:回報 Anthropic upstream(若 issue 尚未存在)

## 回報區(Worker 填寫)

<!-- 尚未派工 -->

---

**建立者**:Control Tower(第二十 session,2026-04-22 20:32)
**下一步建議**:
- 短期:保持 OPEN 觀察是否再次發生(若只是單次 → 可能直接標 WONTFIX)
- 中期:若累積 2-3 次 → 考慮加 BAT `postinstall` 清理 hook
- 長期:回報 `@anthropic-ai/claude-code` upstream
