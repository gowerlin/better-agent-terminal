# T0238 — 實作:electron-builder 26 打包驗證(EXP-GPUWHIS-001 T-B)

## 元資料

- **編號**:T0238
- **類型**:impl(打包驗證 + 實機安裝測試)
- **狀態**:📋 TODO
- **派發模式**:`--mode on --interactive`(Worker 可問 VM 策略 / 平台優先序)
- **優先級**:🟡 Medium
- **Sizing**:M(2-4h,含 asarUnpack 調整 + 多平台打包 + 至少 1 平台實機安裝驗證)
- **建立時間**:2026-04-23 01:40 (UTC+8)
- **前置條件**:
  - T0237 ✅ DONE(T-A PoC 完成,worktree `exp/gpu-vulkan-poc` 已建,commit `bd27732`)
  - D076 ✅(T-A PARTIAL 接受決策)
  - EXP-GPUWHIS-001 🧪 EXPLORING
- **關聯**:
  - EXP-GPUWHIS-001 — T-B 本工單
  - `_ct-workorders/_spec-gpu-whisper-2026-04.md` §7 T-B、§4.3(postinstall / asarUnpack 影響)
  - T0237 回報區「意外發現 #3」— **asarUnpack 必須補 `@kutalia/whisper-node-addon`**
- **互動限制**:每次提問上限 3 個;禁止一般實作細節
- **預估時間**:2-4 小時
- **Renew 次數**:0

---

## Scope(對照 spec §7 T-B)

在 **T-A 建立的 worktree**(`../bat-gpu-vulkan-poc`)基礎上,跑 `npm run dist`(或對應 electron-builder 指令)確認:

1. **Win NSIS installer 能打包成功**(含 `@kutalia/whisper-node-addon` 的 Vulkan prebuilt `.dll`)
2. **Linux AppImage 打包成功**(若使用者環境允許跨平台打包,否則 defer 到 Linux 分期)
3. **`.node` 與相依 `.dll` 被 asarUnpack 正確解出**(不被塞進 `app.asar` 導致 runtime 找不到)
4. **裝 NSIS installer 到乾淨 Win VM 後 BAT 能啟動且 Vulkan 生效**

> ⚠️ **仍在 worktree,不合主線**。T-D 成功後再統一 PR。

---

## 已知待處理項(從 T0237 繼承)

### 🚨 Must-do:asarUnpack 補規則

`@kutalia/whisper-node-addon` 的 path 尚未加入 `electron-builder` asarUnpack config。若不補:
- `.node` addon 會被塞進 `app.asar`
- Electron 啟動時找不到 native module → `MODULE_NOT_FOUND` crash

**檔案位置**:`package.json` → `build.asarUnpack` 或 `electron-builder.yml`(視專案使用哪種)

**建議 pattern**(Worker 自行實證調整):
```yaml
asarUnpack:
  - "node_modules/@kutalia/whisper-node-addon/**"
  - "node_modules/@kutalia/whisper-node-addon/platform/**/*.dll"
  - "node_modules/@kutalia/whisper-node-addon/platform/**/*.node"
```

### 體積預算

- Win x64:~80 MB 新增(T0237 實測,spec 估算吻合)
- 四平台:Win x64 / Win arm64(若支援)/ Linux x64 / macOS 已有 Metal 不在本 EXP 範圍
- 總 installer 增量預期 +80-160 MB(視支援平台)

---

## 執行步驟

### Step 1:切入 worktree

```bash
cd ../bat-gpu-vulkan-poc
git status  # 確認在 exp/gpu-vulkan-poc branch
```

### Step 2:補 asarUnpack config

- 檢查 `package.json` 的 `build.asarUnpack` 或 `electron-builder.yml`
- 加入 `@kutalia/whisper-node-addon` pattern(見上方「Must-do」)
- commit 訊息:`[T0238 T-B] electron-builder: add @kutalia/whisper-node-addon to asarUnpack`

### Step 3:跑打包

```bash
# Windows 打包(必做)
npm run dist:win  # 或 npx electron-builder --win

# Linux 打包(條件性 — 若 Worker 環境支援跨平台打包)
npm run dist:linux  # 或 npx electron-builder --linux
```

### Step 4:驗證打包產物

```bash
# 檢查 installer 體積
ls -lh dist/*.exe dist/*.AppImage

# 檢查 asarUnpack 結果
unzip -l dist/*.exe | grep kutalia  # NSIS 內的檔案清單
# 或解壓到臨時目錄驗證:
7z x dist/BetterAgentTerminal-Setup-*.exe -o/tmp/bat-installer-inspect
ls /tmp/bat-installer-inspect/resources/app.asar.unpacked/node_modules/@kutalia/
```

### Step 5:實機安裝驗證(**Worker 應互動詢問使用者**)

**至少 1 平台必做**(建議 Windows):
- Worker 詢問:是否有乾淨 Windows VM / 是否可接受在本機 dev 環境驗證
- 若使用者同意在本機驗證:
  ```
  - 雙擊 installer 安裝
  - 啟動 BAT
  - 檢查 BAT log 是否仍能載入 Vulkan(initialize log 含 "using Vulkan0 backend")
  - 執行一段音訊轉錄驗證整合完整
  - 解除安裝,確認 uninstaller 清理乾淨
  ```

---

## 成功判準(**至少 3 項達成**)

1. **打包成功**:至少 Win NSIS installer 產生,體積在預期範圍(+80-160 MB)
2. **asarUnpack 正確**:`.node` + 相依 `.dll` 解壓後在 `app.asar.unpacked/` 目錄而非 `app.asar` 內
3. **實機安裝後 BAT 可啟動**:installer 安裝後雙擊 BAT.exe 不崩潰,UI 正常
4. **Vulkan runtime 載入成功**:安裝後的 BAT 仍能載入 Vulkan backend(初始化 log 驗證)
5. **uninstaller 乾淨**(加分項):解除安裝後 `%LOCALAPPDATA%` 等路徑無殘留

> 判準 1-4 必須過;判準 5 若 BAT 原本就有殘留問題(non-EXP scope),不作為 blocker。

---

## 停損條件

任一觸發即 Renew 或建議 ABANDONED:

- ❌ asarUnpack 多種 pattern 嘗試後仍無法讓 `.node` 解出
  - **行動**:Renew,補充已嘗試的 pattern + electron-builder config 細節
- ❌ 安裝後 BAT 啟動崩潰(native module load error),且根因指向 electron-builder 打包機制(非 T-A 的 ABI 問題)
  - **行動**:Renew,補充 crash log + 可能的 package.json 調整方向
- ❌ installer 體積超出預期 2x 以上(>320 MB Win x64)
  - **行動**:Renew,評估壓縮策略或 Path B(fork Kutalia 縮小 binary)

---

## 產出要求

1. **commit hash**:worktree `exp/gpu-vulkan-poc`,訊息含 `[T0238 T-B]` 標記
2. **installer 產物路徑 + 體積**
3. **asarUnpack config 片段**(修改前後對比)
4. **BAT 啟動 log 片段**(證明 Vulkan 仍被載入 after installation)
5. **回報區**:上述資料 + 互動紀錄 + 風險發現 + 下一步建議(T-C 可啟 / Renew / 建議 ABANDONED)

---

## 回報區(Worker 填寫)

### 完成狀態
<!-- DONE / PARTIAL / Renew / ABANDONED -->

### 產出連結
- Worktree:`../bat-gpu-vulkan-poc` on branch `exp/gpu-vulkan-poc`
- commit hash:
- installer 路徑 + 體積:
- asarUnpack config diff:
- 啟動後 Vulkan 載入 log:

### 成功判準達成情況
1. 打包成功:
2. asarUnpack 正確:
3. 實機安裝 BAT 可啟動:
4. Vulkan runtime 載入:
5. uninstaller 乾淨(加分):

### 互動紀錄

### 風險 / 阻塞 / 意外發現

### 下一步建議
- [ ] T-C(runtime detection + CPU fallback)可啟動
- [ ] Renew
- [ ] 建議 ABANDONED

### 回報時間

---

**建立者**:Control Tower(第二十一 session,2026-04-23 01:40)
**派發指令**(塔台自用):
```
派發 T0238 --mode on --interactive
```
