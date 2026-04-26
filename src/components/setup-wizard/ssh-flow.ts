import type { WizardContext, WizardStep } from './wizard-runner'
import { configureSshHostStep } from './steps/ssh/configure-host'
import { verifySshAuthStep } from './steps/ssh/verify-auth'
import { installSshServerBundleStep } from './steps/ssh/install-server-bundle'
import { startServerStep } from './steps/ssh/start-server'
import { connectTestStep } from './steps/wsl/connect-test'
import { fetchFingerprintStep } from './steps/wsl/fetch-fingerprint'
import { writeProfileStep } from './steps/wsl/write-profile'
import { doneStep } from './steps/wsl/done'

const DEFAULT_SERVER_PORT = 9876
const DEFAULT_INSTALL_PATH = '~/.local/bat-server'

/**
 * SSH wizard step ordering (T0266 §7 frozen spec):
 *   configure-ssh-host   → user picks host/user/port/key/install path/tunnel
 *   verify-ssh-auth       → BAT_AUTH_OK probe + uname/HOME parse
 *   install-server-bundle → ssh+tar pipe upload
 *   start-server          → T0286: systemd unit / launchd plist + enable + verify
 *   fetch-fingerprint     → existing PLAN-018 step
 *   connect-test          → existing PLAN-018 step
 *   write-profile         → existing PLAN-018 step
 *   done                  → existing PLAN-018 step
 */
export function buildSshWizardSteps(): WizardStep[] {
  return [
    configureSshHostStep,
    verifySshAuthStep,
    installSshServerBundleStep,
    startServerStep,
    fetchFingerprintStep,
    connectTestStep,
    writeProfileStep,
    doneStep,
  ]
}

export function createSshWizardContext(initial: { profileName: string }): WizardContext {
  return {
    targetOS: 'ssh-linux',
    profileDraft: { name: initial.profileName },
    warnings: [],
    state: {
      serverPort: DEFAULT_SERVER_PORT,
      sshTunnelMode: 'tunnel',
      sshInstallPath: DEFAULT_INSTALL_PATH,
    },
    serverInstallPath: DEFAULT_INSTALL_PATH,
    serverPort: DEFAULT_SERVER_PORT,
    logger: {
      info: (message: string) => console.info(`[ssh-wizard] ${message}`),
      warn: (message: string) => console.warn(`[ssh-wizard] ${message}`),
      error: (message: string) => console.error(`[ssh-wizard] ${message}`),
    },
  }
}
