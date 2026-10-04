import type { WizardContext, WizardStep } from './wizard-runner'
import { connectTestStep } from './steps/wsl/connect-test'
import { detectEnvStep } from './steps/wsl/detect-env'
import { doneStep } from './steps/wsl/done'
import { fetchFingerprintStep } from './steps/wsl/fetch-fingerprint'
import { installServerBundleStep } from './steps/wsl/install-server-bundle'
import { pickWslDistroStep } from './steps/wsl/pick-wsl-distro'
import { writeProfileStep } from './steps/wsl/write-profile'
import { writeSystemdUnitStep } from './steps/wsl/write-systemd-unit'
import { wslSystemdCheckStep } from './steps/wsl/wsl-systemd-check'

const DEFAULT_INSTALL_PATH = '~/.local/bat-server'

export function buildWslWizardSteps(): WizardStep[] {
  return [
    detectEnvStep,
    pickWslDistroStep,
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
    logger: {
      info: (message: string) => console.info(`[wsl-wizard] ${message}`),
      warn: (message: string) => console.warn(`[wsl-wizard] ${message}`),
      error: (message: string) => console.error(`[wsl-wizard] ${message}`),
    },
  }
}
