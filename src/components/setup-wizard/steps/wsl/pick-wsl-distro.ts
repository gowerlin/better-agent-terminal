import i18next from 'i18next'
import type { WizardStep } from '../../wizard-runner'

export const pickWslDistroStep: WizardStep = {
  id: 'pick-wsl-distro',
  title: 'Select WSL distro',
  appliesTo: ['wsl-linux'],
  // T0330 (PLAN-032 Sprint 2): when multiple WSL2 distros (T0840: or, with no
  // WSL2 distro, multiple WSL1 distros) exist this step
  // calls ctx.requestChoice — runner flips to awaiting-input while waiting.
  kind: 'input',
  retryable: true,
  labelKey: 'wizard.wsl.step.pickDistro.label',
  descriptionKey: 'wizard.wsl.step.pickDistro.description',
  groupKey: 'wizard.group.detection',
  editableFromFailure: true,
  async run(ctx) {
    const result = await window.electronAPI.wsl.list()
    ctx.availableDistros = result.distros

    const v2Distros = result.distros.filter((distro) => distro.version === 2)
    if (result.distros.length === 0) {
      // T0378 (BUG-086): WSL itself is installed (wsl-detect returns an empty
      // list instead of throwing) — map to the dedicated no-distro guidance.
      const err = new Error(
        'No WSL distros found. Run `wsl --install -d Ubuntu-24.04` first (see `wsl --list --online` for other distros).',
      ) as Error & { code?: string }
      err.code = 'wsl-no-distro'
      throw err
    }
    // T0840 (PLAN-043 W3, P-1): with WSL 2 distros only those are offered, as
    // before. With only WSL 1 distros one of them is picked and
    // plan-wsl-environment offers to convert it to WSL 2 (left unchecked there
    // -> `wsl-requires-wsl2`, the error this step used to throw).
    const candidates = v2Distros.length > 0 ? v2Distros : result.distros

    // T0378: the cached $HOME belongs to the previously picked distro.
    ctx.wslHome = undefined

    if (candidates.length === 1) {
      ctx.wslDistro = candidates[0].name
      return
    }

    const defaultChoice = result.default && candidates.some((distro) => distro.name === result.default)
      ? result.default
      : candidates[0].name

    const selected = ctx.requestChoice
      ? await ctx.requestChoice({
          stepId: 'pick-wsl-distro',
          title: i18next.t('wizard.wsl.pickDistro.title'),
          description: i18next.t('wizard.wsl.pickDistro.description'),
          options: candidates.map((distro) => ({
            value: distro.name,
            label: distro.name,
            description: i18next.t('wizard.wsl.pickDistro.optionDescription', {
              state: i18next.t(`wizard.wsl.pickDistro.state.${distro.state}`, distro.state),
              version: distro.version,
            }),
          })),
        })
      : defaultChoice

    ctx.wslDistro = selected ?? defaultChoice
  },
  async rollback(ctx) {
    ctx.wslDistro = undefined
    ctx.wslHome = undefined
  },
}
