import { buildWslWizardSteps } from '../../wsl-flow'
import { applyWslEnvironmentStep } from './apply-wsl-environment'
import { connectTestStep } from './connect-test'
import { detectEnvStep } from './detect-env'
import { doneStep } from './done'
import { fetchFingerprintStep } from './fetch-fingerprint'
import { installServerBundleStep } from './install-server-bundle'
import { pickWslDistroStep } from './pick-wsl-distro'
import { planWslEnvironmentStep } from './plan-wsl-environment'
import { writeProfileStep } from './write-profile'
import { writeSystemdUnitStep } from './write-systemd-unit'
import { wslSystemdCheckStep } from './wsl-systemd-check'

export const wslWizardSteps = buildWslWizardSteps()

export {
  applyWslEnvironmentStep,
  connectTestStep,
  detectEnvStep,
  doneStep,
  fetchFingerprintStep,
  installServerBundleStep,
  pickWslDistroStep,
  planWslEnvironmentStep,
  writeProfileStep,
  writeSystemdUnitStep,
  wslSystemdCheckStep,
}
