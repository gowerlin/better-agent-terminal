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
;   - BAT running, installer not elevated, BAT new enough (T0823+): same "is running, OK to close"
;     prompt (silent /S: accepted), then BAT quits normally (saves, stops its Terminal Server) instead
;     of being force-ended. If it is still running after BAT_INSTALLER_QUIT_TIMEOUT_MS (old BAT that
;     ignores the argument, BAT still starting, a quit dialog already open), the template's check runs
;     as before: interactive installs show its prompt a second time, then force-end.
;   - Elevated installer (per-machine), or BAT not running: exactly the template's behaviour.

!include "getProcessInfo.nsh"
Var pid

; Same string as INSTALLER_QUIT_REQUEST_ARG in electron/installer-quit-request.ts.
!define BAT_INSTALLER_QUIT_ARG "--installer-quit-request"
; How long the installer waits for every process under $INSTDIR to end after the request.
!define BAT_INSTALLER_QUIT_TIMEOUT_MS 15000
!define BAT_INSTALLER_QUIT_POLL_MS 500

!macro batRequestGracefulQuit
  ${GetProcessInfo} 0 $pid $1 $2 $3 $4
  ; not when this process is the app itself (the template's guard), not elevated: the request would
  ; start BetterAgentTerminal.exe as administrator
  ${If} $3 != "${APP_EXECUTABLE_FILENAME}"
  ${AndIfNot} ${UAC_IsAdmin}
  ${AndIf} ${FileExists} "$INSTDIR\${APP_EXECUTABLE_FILENAME}"
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
      Exec `"$INSTDIR\${APP_EXECUTABLE_FILENAME}" ${BAT_INSTALLER_QUIT_ARG}`
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
!macroend

!macro customCheckAppRunning
  !insertmacro IS_POWERSHELL_AVAILABLE
  !insertmacro batRequestGracefulQuit
  ; electron-builder's check: finds nothing after a normal quit; otherwise its prompt / force-end
  !insertmacro _CHECK_APP_RUNNING
!macroend
