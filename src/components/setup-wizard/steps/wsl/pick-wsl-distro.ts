import type { WizardStep } from '../../wizard-runner'

export const pickWslDistroStep: WizardStep = {
  id: 'pick-wsl-distro',
  title: 'Select WSL distro',
  appliesTo: ['wsl-linux'],
  retryable: true,
  labelKey: 'wizard.wsl.step.pickDistro.label',
  descriptionKey: 'wizard.wsl.step.pickDistro.description',
  groupKey: 'wizard.group.detection',
  editableFromFailure: true,
  async run(ctx) {
    const result = await window.electronAPI.wsl.list()
    ctx.availableDistros = result.distros

    const v2Distros = result.distros.filter((distro) => distro.version === 2)
    if (v2Distros.length === 0) {
      if (result.distros.length === 0) {
        throw new Error('No WSL distros found. Run `wsl --install -d Ubuntu` first.')
      }
      const warning = 'BAT only supports WSL2. Run `wsl --set-version <distro> 2` before continuing.'
      if (!ctx.warnings.includes(warning)) {
        ctx.warnings.push(warning)
      }
      throw new Error('BAT requires WSL2. Upgrade an existing distro to version 2 and retry.')
    }

    if (v2Distros.length === 1) {
      ctx.wslDistro = v2Distros[0].name
      return
    }

    const defaultChoice = result.default && v2Distros.some((distro) => distro.name === result.default)
      ? result.default
      : v2Distros[0].name

    const selected = ctx.requestChoice
      ? await ctx.requestChoice({
          stepId: 'pick-wsl-distro',
          title: 'Choose a WSL2 distro',
          description: 'Select the distro where BAT should install the remote server bundle.',
          options: v2Distros.map((distro) => ({
            value: distro.name,
            label: distro.name,
            description: `${distro.state} • WSL${distro.version}`,
          })),
        })
      : defaultChoice

    ctx.wslDistro = selected ?? defaultChoice
  },
  async rollback(ctx) {
    ctx.wslDistro = undefined
  },
}
