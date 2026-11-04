import type { WizardContext, WizardStep } from './wizard-runner'
import { applyWslEnvironmentStep } from './steps/wsl/apply-wsl-environment'
import { connectTestStep } from './steps/wsl/connect-test'
import { detectEnvStep } from './steps/wsl/detect-env'
import { doneStep } from './steps/wsl/done'
import { fetchFingerprintStep } from './steps/wsl/fetch-fingerprint'
import { installServerBundleStep } from './steps/wsl/install-server-bundle'
import { pickWslDistroStep } from './steps/wsl/pick-wsl-distro'
import { planWslEnvironmentStep } from './steps/wsl/plan-wsl-environment'
import { writeProfileStep } from './steps/wsl/write-profile'
import { writeSystemdUnitStep } from './steps/wsl/write-systemd-unit'
import { wslSystemdCheckStep } from './steps/wsl/wsl-systemd-check'

const DEFAULT_INSTALL_PATH = '~/.local/bat-server'

/**
 * T0840: wizard log lines go to the main-process logger (debug log file) via
 * `window.electronAPI.debug.log`. Messages carry ids / states / counts only.
 */
export function createWslWizardLogger(): WizardContext['logger'] {
  const write = (level: string, message: string) => {
    try {
      window.electronAPI?.debug?.log?.(`[wsl-wizard] ${level} ${message}`)
    } catch {
      // Logging must never break the wizard.
    }
  }
  return {
    info: (message: string) => write('info', message),
    warn: (message: string) => write('warn', message),
    error: (message: string) => write('error', message),
  }
}

export function buildWslWizardSteps(): WizardStep[] {
  return [
    detectEnvStep,
    pickWslDistroStep,
    // T0840 (PLAN-043 W3): detect -> list -> consent once -> apply; healthy
    // environments get 0 items and both steps finish at once.
    planWslEnvironmentStep,
    applyWslEnvironmentStep,
    wslSystemdCheckStep,
    installServerBundleStep,
    writeSystemdUnitStep,
    fetchFingerprintStep,
    connectTestStep,
    writeProfileStep,
    doneStep,
  ]
}

export function createWslWizardContext(initial: { profileName: string }): WizardContext {
  return {
    targetOS: 'wsl-linux',
    profileDraft: {
      name: initial.profileName,
    },
    warnings: [],
    // T0382 (BUG-091, D128): no preset port. 9876 is the host BAT RemoteServer
    // default and Mirrored mode shares localhost, so write-systemd-unit picks a
    // free Windows-side port (state.serverPort, if set, is a user override).
    state: {},
    networkMode: 'unknown',
    serverInstallPath: DEFAULT_INSTALL_PATH,
    // T0840 (T0831 F4): to the disk log (CLAUDE.md Logging), not the console.
    logger: createWslWizardLogger(),
  }
}
