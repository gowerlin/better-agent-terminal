import type { WizardContext, WizardStep } from './wizard-runner'
import { configureMountsStep } from './steps/docker/configure-mounts'
import { installDockerServerBundleStep } from './steps/docker/install-server-bundle'
import { pickContainerStep } from './steps/docker/pick-container'
import { startDockerServerStep } from './steps/docker/start-server'
import { connectTestStep } from './steps/wsl/connect-test'
import { detectEnvStep } from './steps/wsl/detect-env'
import { doneStep } from './steps/wsl/done'
import { fetchFingerprintStep } from './steps/wsl/fetch-fingerprint'
import { writeProfileStep } from './steps/wsl/write-profile'

const DEFAULT_SERVER_PORT = 9876
const DEFAULT_IMAGE = 'bat-server:latest'

export function buildDockerWizardSteps(): WizardStep[] {
  return [
    detectEnvStep,
    pickContainerStep,
    configureMountsStep,
    installDockerServerBundleStep,
    startDockerServerStep,
    fetchFingerprintStep,
    connectTestStep,
    writeProfileStep,
    doneStep,
  ]
}

export function createDockerWizardContext(initial: { profileName: string }): WizardContext {
  return {
    targetOS: 'docker-linux',
    profileDraft: { name: initial.profileName },
    warnings: [],
    state: {
      dockerImage: DEFAULT_IMAGE,
      dockerMounts: [],
      containerMode: 'unknown',
      serverPort: DEFAULT_SERVER_PORT,
    },
    serverPort: DEFAULT_SERVER_PORT,
    logger: {
      info: (message: string) => console.info(`[docker-wizard] ${message}`),
      warn: (message: string) => console.warn(`[docker-wizard] ${message}`),
      error: (message: string) => console.error(`[docker-wizard] ${message}`),
    },
  }
}
