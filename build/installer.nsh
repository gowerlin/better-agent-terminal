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

!macro batRequestGracefulQuit
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
!macroend

!macro customCheckAppRunning
  !insertmacro IS_POWERSHELL_AVAILABLE
  !insertmacro batRequestGracefulQuit
  ; electron-builder's check: finds nothing after a normal quit; otherwise its prompt / force-end
  !insertmacro _CHECK_APP_RUNNING
!macroend
