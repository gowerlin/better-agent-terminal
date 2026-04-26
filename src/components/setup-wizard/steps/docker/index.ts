import { buildDockerWizardSteps } from '../../docker-flow'
import { configureMountsStep } from './configure-mounts'
import { installDockerServerBundleStep } from './install-server-bundle'
import { pickContainerStep } from './pick-container'
import { startDockerServerStep } from './start-server'

export const dockerWizardSteps = buildDockerWizardSteps()

export {
  configureMountsStep,
  installDockerServerBundleStep,
  pickContainerStep,
  startDockerServerStep,
}
