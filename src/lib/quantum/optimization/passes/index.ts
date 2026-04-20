export * from './algebraic'
export * from './commutation'
export * from './template'
export * from './peephole'
export * from './mathematical'
export * from './analysis'

import { registerAlgebraicPasses } from './algebraic'
import { registerCommutationPasses } from './commutation'
import { registerTemplatePasses } from './template'
import { registerPeepholePasses } from './peephole'
import { registerMathematicalPasses } from './mathematical'
import { registerAnalysisPasses } from './analysis'

let passesRegistered = false

export function registerAllPasses(): void {
  if (passesRegistered) return

  registerAlgebraicPasses()
  registerCommutationPasses()
  registerTemplatePasses()
  registerPeepholePasses()
  registerMathematicalPasses()
  registerAnalysisPasses()

  passesRegistered = true
}
