; PLAN-063 子項 3 / T0823: ask a running BetterAgentTerminal to quit normally before the files are
; replaced, then fall back to electron-builder's own check (which force-ends what still runs).
;
; Included by electron-builder through `build.nsis.include` (package.json) in the common header of
; both the installer and the uninstaller, BEFORE its templates/nsis/include/allowOnlyOneInstallerInstance.nsh.
; That template calls `customCheckAppRunning` from CHECK_APP_RUNNING when the macro exists (installer:
; install section, not in a UAC inner instance; uninstaller: un.checkAppRunning). Written against
; electron-builder / app-builder-lib 26.8.1 — when upgrading it, re-check the points in
; docs/agent-guide/packaging-release-checks.md「NSIS：安裝前請 BAT 正常結束」.
;
; Fallback = the template's own `_CHECK_APP_RUNNING`, inserted as is (not a copy). Defining
; `customCheckAppRunning` makes the template skip `!include "getProcessInfo.nsh"` and `Var pid`, which
; `_CHECK_APP_RUNNING` needs: both are declared here instead.
;
; What changes for the user (docs/agent-guide/upgrade-interruption.md):
;   - BAT running, BAT installed by a T0823+ installer (marker file): same "is
;     running, OK to close" prompt (silent /S: accepted), then BAT quits normally (saves, stops its
;     Terminal Server) instead of being force-ended. If it is still running after
;     BAT_INSTALLER_QUIT_TIMEOUT_MS (BAT still starting, a quit dialog already open), the template's
;     check runs as before: interactive installs show its prompt a second time, then force-end.
;   - UAC inner instance of a per-machine install (the template does not call this there), BAT installed
;     before T0823 (no marker), or BAT not running: exactly the template's behaviour.
;
; PLAN-065 W4 / T0860 (PTY holder, D286). The same customCheckAppRunning also runs in the uninstaller
; (un.checkAppRunning). Version N's uninstaller runs when N+1 upgrades over it (installUtil.nsh, with
; --updated), and N+1's installer asks the installed N's exe to quit: both are fixed once N is released.
;   - installer, or uninstaller with ${isUpdated} (an upgrade): --installer-quit-request. A BAT whose Terminal
;     Server runs from a valid PTY holder (outside $INSTDIR) keeps it; without a holder: T0823 as above.
;   - uninstaller without ${isUpdated} (a real uninstall): --uninstall-quit-request (when the installed app has
;     its marker): BAT quits and stops the server, holder or not.
;   - customUnInstall: a real uninstall only — asks the holder to end (--uninstall-quit-request, also when no
;     BAT runs), waits, then removes this install scope's holder root when nothing runs from it. An upgrade's
;     uninstall (${isUpdated}) leaves the holder and its directories alone.

!include "getProcessInfo.nsh"
Var pid

; Same string as INSTALLER_QUIT_REQUEST_ARG in electron/installer-quit-request.ts.
!define BAT_INSTALLER_QUIT_ARG "--installer-quit-request"
; Written by this installer (customInstall) into the installed app: "the BAT installed here understands the
; request". A BAT installed before T0823 has no such file and is not asked: it would take the argument as
; "open a new window" (its second-instance handler), save that window, and be force-ended 15 s later anyway.
; The uninstaller removes $INSTDIR (RMDir /r), so a downgrade drops the file with the rest.
!define BAT_INSTALLER_QUIT_MARKER "resources\installer-quit-request.supported"
; How long the installer waits for every process under $INSTDIR to end after the request.
!define BAT_INSTALLER_QUIT_TIMEOUT_MS 15000
!define BAT_INSTALLER_QUIT_POLL_MS 500
; T0860: same string as UNINSTALL_QUIT_REQUEST_ARG in electron/installer-quit-request.ts (a real uninstall).
!define BAT_UNINSTALL_QUIT_ARG "--uninstall-quit-request"
; Written by customInstall like the T0823 marker: "the BAT installed here understands --uninstall-quit-request".
; Without it the argument is never sent (an older BAT would take it as "open a new window").
!define BAT_UNINSTALL_QUIT_MARKER "resources\uninstall-quit-request.supported"
; How long a real uninstall waits for the holder (and the request process) to end before checking its root.
!define BAT_UNINSTALL_QUIT_TIMEOUT_MS 20000

!macro batRequestGracefulQuit
  ; T0860: the argument — the installer's, except in a real uninstall (uninstaller build, not ${isUpdated})
  Push $R8
  StrCpy $R8 "${BAT_INSTALLER_QUIT_ARG}"
  !ifdef BUILD_UNINSTALLER
    ${IfNot} ${isUpdated}
    ${AndIf} ${FileExists} "$INSTDIR\${BAT_UNINSTALL_QUIT_MARKER}"
      StrCpy $R8 "${BAT_UNINSTALL_QUIT_ARG}"
    ${EndIf}
  !endif
  ${GetProcessInfo} 0 $pid $1 $2 $3 $4
  ; not when this process is the app itself (the template's guard). An elevated installer may send it too:
  ; the request process only hands its argv to the running BAT (or stops a kept Terminal Server) and exits,
  ; it never opens a window (electron/main.ts returns at the top of whenReady). Not elevated → it would
  ; never run on machines with UAC off (T0823 CI: GitHub runners are elevated).
  ${If} $3 != "${APP_EXECUTABLE_FILENAME}"
  ${AndIf} ${FileExists} "$INSTDIR\${APP_EXECUTABLE_FILENAME}"
  ${AndIf} ${FileExists} "$INSTDIR\${BAT_INSTALLER_QUIT_MARKER}"
    !insertmacro FIND_PROCESS "${APP_EXECUTABLE_FILENAME}" $R0
    ${If} $R0 == 0
      ${IfNot} ${isUpdated}
        ; the template's prompt and answer (Cancel = quit the installer), asked before anything ends
        MessageBox MB_OKCANCEL|MB_ICONEXCLAMATION "$(appRunning)" /SD IDOK IDOK batGracefulQuitConfirmed
        Quit
      ${EndIf}
      batGracefulQuitConfirmed:
      DetailPrint "$(appClosing)"
      ClearErrors
      Exec `"$INSTDIR\${APP_EXECUTABLE_FILENAME}" $R8`
      ${IfNot} ${Errors}
        System::Call "kernel32::GetTickCount() i .R6"
        batGracefulQuitWait:
          Sleep ${BAT_INSTALLER_QUIT_POLL_MS}
          !insertmacro FIND_PROCESS "${APP_EXECUTABLE_FILENAME}" $R0
          ${If} $R0 == 0
            System::Call "kernel32::GetTickCount() i .R7"
            IntOp $R7 $R7 - $R6
            ${If} $R7 < ${BAT_INSTALLER_QUIT_TIMEOUT_MS}
              Goto batGracefulQuitWait
            ${EndIf}
            DetailPrint `"${PRODUCT_NAME}" did not quit within ${BAT_INSTALLER_QUIT_TIMEOUT_MS} ms.`
          ${EndIf}
      ${EndIf}
    ${EndIf}
  ${EndIf}
  Pop $R8
!macroend

; PLAN-065 W2 / T0858: copy the Windows PTY holder out of the install directory (D286 D2 / D9).
;
; The package carries resources\pty-holder\ (scripts/pty-holder.cjs, afterPack): bat-pty-holder.exe (official
; node.exe), terminal-server.js, node-pty's win32 files and holder-manifest.json. Nothing runs it yet (W3 / T0859).
; Holder root by install scope: per-user $LOCALAPPDATA\BAT-PtyHolder, per-machine $PROGRAMFILES64\BAT-PtyHolder
; (written by the elevated installer, same protection as Program Files). The copy goes to <root>\<key>\, key =
; line 3 of the manifest (`  "key": "<nodeVersion>-<12 hex>",`, a content hash).
;   - root and $INSTDIR overlap as string prefixes either way (the template's FIND_PROCESS / KILL matching is
;     Path.StartsWith('$INSTDIR') without a trailing \) → nothing is copied or removed;
;   - <root>\<key>\holder-manifest.json byte-equal to the packaged one → left as is (same-version reinstall, or a
;     BAT upgrade that changed neither Node nor the holder files);
;   - otherwise copied to <key>.partial, then renamed to <key> (a crash never leaves a half-copied <key>); a
;     different <key> directory is replaced only when no process runs from it;
;   - then every other directory under the root is removed when no process runs from it (D9: keep the one in use
;     and the current one). "Runs from it" = a process whose path starts with `<dir>\`, asked to PowerShell like the
;     template's FIND_PROCESS; PowerShell missing / failing → "cannot tell" → never removed. 🔴 A directory a holder
;     runs from must not be deleted: its mapped files are locked and the rest would go, breaking its later forks.
; No Var (an unused one fails the uninstaller build, warnings are errors): $R0-$R9 are saved and restored.
!define BAT_PTY_HOLDER_ROOT_NAME "BAT-PtyHolder"
!define BAT_PTY_HOLDER_SOURCE "resources\pty-holder"
!define BAT_PTY_HOLDER_MANIFEST "holder-manifest.json"
; exit codes of the PowerShell check below
!define BAT_PTY_HOLDER_IN_USE 10
!define BAT_PTY_HOLDER_UNUSED 11

!macro batPtyHolderInUse _DIR _RETURN
  nsExec::Exec `"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -NonInteractive -Command "if (@(Get-CimInstance -ClassName Win32_Process | ? {$$_.Path -and $$_.Path.StartsWith('${_DIR}\', 'OrdinalIgnoreCase')}).Count -gt 0) { exit ${BAT_PTY_HOLDER_IN_USE} } else { exit ${BAT_PTY_HOLDER_UNUSED} }"`
  Pop ${_RETURN}
!macroend

!macro batInstallPtyHolder
  Push $R0
  Push $R1
  Push $R2
  Push $R3
  Push $R4
  Push $R5
  Push $R6
  Push $R7
  Push $R8
  Push $R9
  StrCpy $R0 "$INSTDIR\${BAT_PTY_HOLDER_SOURCE}"
  ${IfNot} ${FileExists} "$R0\${BAT_PTY_HOLDER_MANIFEST}"
    DetailPrint "PTY holder: not in this package"
    Goto batPtyHolderDone
  ${EndIf}
  ${If} $installMode == "all"
    StrCpy $R1 "$PROGRAMFILES64\${BAT_PTY_HOLDER_ROOT_NAME}"
  ${Else}
    StrCpy $R1 "$LOCALAPPDATA\${BAT_PTY_HOLDER_ROOT_NAME}"
  ${EndIf}

  ; root vs $INSTDIR, string prefixes both ways, ignoring case (== is case-insensitive)
  StrLen $R2 $INSTDIR
  StrCpy $R3 $R1 $R2
  StrLen $R2 $R1
  StrCpy $R4 $INSTDIR $R2
  ${If} $R3 == $INSTDIR
  ${OrIf} $R4 == $R1
    DetailPrint "PTY holder: $R1 overlaps the install directory; not copied"
    Goto batPtyHolderDone
  ${EndIf}

  ; key = line `  "key": "<key>",` of the packaged manifest
  StrCpy $R6 ""
  ClearErrors
  FileOpen $R2 "$R0\${BAT_PTY_HOLDER_MANIFEST}" r
  ${IfNot} ${Errors}
    batPtyHolderKeyLine:
      ClearErrors
      FileRead $R2 $R3
      IfErrors batPtyHolderKeyClose
      StrCpy $R4 $R3 10
      StrCmpS $R4 '  "key": "' 0 batPtyHolderKeyLine
      StrCpy $R3 $R3 "" 10
      StrCpy $R5 0
    batPtyHolderKeyChar:
      StrCpy $R4 $R3 1 $R5
      StrCmp $R4 "" batPtyHolderKeyClose
      StrCmp $R4 '"' batPtyHolderKeyFound
      StrCmp $R4 "\" batPtyHolderKeyClose
      StrCmp $R4 "/" batPtyHolderKeyClose
      IntOp $R5 $R5 + 1
      Goto batPtyHolderKeyChar
    batPtyHolderKeyFound:
      StrCpy $R6 $R3 $R5
    batPtyHolderKeyClose:
    FileClose $R2
  ${EndIf}
  ; <nodeVersion>-<12 hex> is at least 18 characters ("." / ".." / garbage never become a path)
  StrLen $R2 $R6
  ${If} $R2 < 18
    DetailPrint "PTY holder: no valid key in $R0\${BAT_PTY_HOLDER_MANIFEST}; not copied"
    Goto batPtyHolderDone
  ${EndIf}
  StrCpy $R7 "$R1\$R6"

  ; up to date = the installed manifest is byte-equal to the packaged one
  StrCpy $R8 "copy"
  ${If} ${FileExists} "$R7\${BAT_PTY_HOLDER_MANIFEST}"
    ClearErrors
    FileOpen $R2 "$R0\${BAT_PTY_HOLDER_MANIFEST}" r
    ${IfNot} ${Errors}
      FileOpen $R3 "$R7\${BAT_PTY_HOLDER_MANIFEST}" r
      ${IfNot} ${Errors}
        StrCpy $R8 "same"
        batPtyHolderCmpLine:
          ClearErrors
          FileRead $R2 $R4
          IfErrors batPtyHolderCmpEndA
          ClearErrors
          FileRead $R3 $R5
          IfErrors batPtyHolderCmpDiff
          StrCmpS $R4 $R5 batPtyHolderCmpLine batPtyHolderCmpDiff
        batPtyHolderCmpEndA:
          ClearErrors
          FileRead $R3 $R5
          IfErrors batPtyHolderCmpClose
        batPtyHolderCmpDiff:
          StrCpy $R8 "copy"
        batPtyHolderCmpClose:
        FileClose $R3
      ${EndIf}
      FileClose $R2
    ${EndIf}
  ${EndIf}

  ${If} $R8 == "same"
    DetailPrint "PTY holder: $R7 is up to date"
  ${Else}
    ${If} ${FileExists} "$R7\*.*"
      ; same key, other or incomplete content: replace it only when nothing runs from it
      !insertmacro batPtyHolderInUse "$R7" $R2
      ${If} $R2 != ${BAT_PTY_HOLDER_UNUSED}
        DetailPrint "PTY holder: $R7 differs but is in use or cannot be checked ($R2); left as is"
        Goto batPtyHolderCleanup
      ${EndIf}
      RMDir /r "$R7"
    ${EndIf}
    CreateDirectory "$R1"
    RMDir /r "$R7.partial"
    CreateDirectory "$R7.partial"
    ClearErrors
    CopyFiles /SILENT "$R0\*.*" "$R7.partial"
    ${If} ${Errors}
      DetailPrint "PTY holder: copy to $R7.partial failed"
      RMDir /r "$R7.partial"
      Goto batPtyHolderCleanup
    ${EndIf}
    ClearErrors
    Rename "$R7.partial" "$R7"
    ${If} ${Errors}
      DetailPrint "PTY holder: rename to $R7 failed"
      RMDir /r "$R7.partial"
    ${Else}
      DetailPrint "PTY holder: copied to $R7"
    ${EndIf}
  ${EndIf}

  ; D9: remove every other directory under the root that no process runs from
  batPtyHolderCleanup:
  ClearErrors
  FindFirst $R2 $R3 "$R1\*"
  batPtyHolderCleanLoop:
    StrCmp $R3 "" batPtyHolderCleanEnd
    StrCmp $R3 "." batPtyHolderCleanNext
    StrCmp $R3 ".." batPtyHolderCleanNext
    StrCmp $R3 $R6 batPtyHolderCleanNext
    ${If} ${FileExists} "$R1\$R3\*.*"
      !insertmacro batPtyHolderInUse "$R1\$R3" $R4
      ${If} $R4 == ${BAT_PTY_HOLDER_UNUSED}
        RMDir /r "$R1\$R3"
        DetailPrint "PTY holder: removed unused $R1\$R3"
      ${Else}
        DetailPrint "PTY holder: kept $R1\$R3 (in use or cannot be checked: $R4)"
      ${EndIf}
    ${EndIf}
    batPtyHolderCleanNext:
    FindNext $R2 $R3
    Goto batPtyHolderCleanLoop
  batPtyHolderCleanEnd:
  FindClose $R2

  batPtyHolderDone:
  Pop $R9
  Pop $R8
  Pop $R7
  Pop $R6
  Pop $R5
  Pop $R4
  Pop $R3
  Pop $R2
  Pop $R1
  Pop $R0
!macroend

; installSection.nsh inserts customInstall after the files are in place (installer only).
!macro customInstall
  Push $0
  ClearErrors
  FileOpen $0 "$INSTDIR\${BAT_INSTALLER_QUIT_MARKER}" w
  ${IfNot} ${Errors}
    FileWrite $0 "T0823: BetterAgentTerminal.exe accepts ${BAT_INSTALLER_QUIT_ARG}$\r$\n"
    FileClose $0
  ${EndIf}
  Pop $0
  ; T0860: the marker of --uninstall-quit-request, after the T0823 one (which stays exactly as it was)
  Push $0
  ClearErrors
  FileOpen $0 "$INSTDIR\${BAT_UNINSTALL_QUIT_MARKER}" w
  ${IfNot} ${Errors}
    FileWrite $0 "T0860: BetterAgentTerminal.exe accepts ${BAT_UNINSTALL_QUIT_ARG}$\r$\n"
    FileClose $0
  ${EndIf}
  Pop $0
  ; T0858: after the T0823 marker, which stays exactly as it was
  !insertmacro batInstallPtyHolder
!macroend

; PLAN-065 W4 / T0860: a real uninstall ends the PTY holder and removes this install scope's holder root.
; Root by $installMode, same rule and prefix check as batInstallPtyHolder; the other scope's root is never
; touched. The holder is asked to end through BAT (--uninstall-quit-request: server:shutdown with its token,
; and if it does not end, BAT ends its PTY trees and the server process itself). The root is then removed only
; when no process runs from it (batPtyHolderInUse); in use or cannot be checked → kept, with a DetailPrint.
!macro batUninstallPtyHolder
  Push $R0
  Push $R1
  Push $R2
  Push $R3
  Push $R4
  ${If} $installMode == "all"
    StrCpy $R1 "$PROGRAMFILES64\${BAT_PTY_HOLDER_ROOT_NAME}"
  ${Else}
    StrCpy $R1 "$LOCALAPPDATA\${BAT_PTY_HOLDER_ROOT_NAME}"
  ${EndIf}
  ; root vs $INSTDIR, string prefixes both ways, ignoring case (== is case-insensitive)
  StrLen $R2 $INSTDIR
  StrCpy $R3 $R1 $R2
  StrLen $R2 $R1
  StrCpy $R4 $INSTDIR $R2
  ${If} $R3 == $INSTDIR
  ${OrIf} $R4 == $R1
    DetailPrint "PTY holder: $R1 overlaps the install directory; left as is"
    Goto batUninstallPtyHolderDone
  ${EndIf}
  ${IfNot} ${FileExists} "$R1\*.*"
    Goto batUninstallPtyHolderDone
  ${EndIf}

  ${If} ${FileExists} "$INSTDIR\${APP_EXECUTABLE_FILENAME}"
  ${AndIf} ${FileExists} "$INSTDIR\${BAT_UNINSTALL_QUIT_MARKER}"
    ClearErrors
    Exec `"$INSTDIR\${APP_EXECUTABLE_FILENAME}" ${BAT_UNINSTALL_QUIT_ARG}`
    ${IfNot} ${Errors}
      System::Call "kernel32::GetTickCount() i .R2"
      batUninstallPtyHolderWait:
        Sleep ${BAT_INSTALLER_QUIT_POLL_MS}
        ; the holder's root first, then the request process itself (it runs from $INSTDIR)
        !insertmacro batPtyHolderInUse "$R1" $R0
        ${If} $R0 == ${BAT_PTY_HOLDER_UNUSED}
          !insertmacro batPtyHolderInUse "$INSTDIR" $R0
        ${EndIf}
        ${If} $R0 != ${BAT_PTY_HOLDER_UNUSED}
          System::Call "kernel32::GetTickCount() i .R3"
          IntOp $R3 $R3 - $R2
          ${If} $R3 < ${BAT_UNINSTALL_QUIT_TIMEOUT_MS}
            Goto batUninstallPtyHolderWait
          ${EndIf}
          DetailPrint "PTY holder: still in use after ${BAT_UNINSTALL_QUIT_TIMEOUT_MS} ms"
        ${EndIf}
    ${EndIf}
  ${EndIf}

  !insertmacro batPtyHolderInUse "$R1" $R0
  ${If} $R0 == ${BAT_PTY_HOLDER_UNUSED}
    RMDir /r "$R1"
    DetailPrint "PTY holder: removed $R1"
  ${Else}
    DetailPrint "PTY holder: kept $R1 (in use or cannot be checked: $R0)"
  ${EndIf}

  batUninstallPtyHolderDone:
  Pop $R4
  Pop $R3
  Pop $R2
  Pop $R1
  Pop $R0
!macroend

; uninstaller.nsh inserts customUnInstall in the uninstall section before the installed files are removed,
; so $INSTDIR\BetterAgentTerminal.exe still exists. 🔴 ${isUpdated} (an upgrade runs the old uninstaller with
; --updated) → nothing: the holder keeps the terminals across the upgrade.
!macro customUnInstall
  ${IfNot} ${isUpdated}
    !insertmacro batUninstallPtyHolder
  ${EndIf}
!macroend

!macro customCheckAppRunning
  !insertmacro IS_POWERSHELL_AVAILABLE
  !insertmacro batRequestGracefulQuit
  ; electron-builder's check: finds nothing after a normal quit; otherwise its prompt / force-end
  !insertmacro _CHECK_APP_RUNNING
!macroend
