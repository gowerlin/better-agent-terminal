import type { WizardContext, WizardStep } from './wizard-runner'
import { configureMountsStep } from './steps/docker/configure-mounts'
import { installDockerServerBundleStep } from './steps/docker/install-server-bundle'
import { DEFAULT_DOCKER_BASE_IMAGE } from './steps/docker/base-image'
import { pickContainerStep } from './steps/docker/pick-container'
import { startDockerServerStep } from './steps/docker/start-server'
import { connectTestStep } from './steps/wsl/connect-test'
import { detectEnvStep } from './steps/wsl/detect-env'
import { doneStep } from './steps/wsl/done'
import { fetchFingerprintStep } from './steps/wsl/fetch-fingerprint'
import { writeProfileStep } from './steps/wsl/write-profile'

// T0853 (D283 U2): a base image; the server bundle goes into a volume. `bat-server:latest` (bundle
// baked in) can still be typed into the base image field (U3).
const DEFAULT_IMAGE = DEFAULT_DOCKER_BASE_IMAGE

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
    // T0649 (BUG-156): no preset port. 9876 is the host BAT RemoteServer
    // default on the same 127.0.0.1 the container is published on, so
    // start-server picks the host port (state.serverPort, if set, is a user override).
    state: {
      dockerImage: DEFAULT_IMAGE,
      dockerMounts: [],
      containerMode: 'unknown',
    },
    logger: {
      info: (message: string) => console.info(`[docker-wizard] ${message}`),
      warn: (message: string) => console.warn(`[docker-wizard] ${message}`),
      error: (message: string) => console.error(`[docker-wizard] ${message}`),
    },
  }
}
