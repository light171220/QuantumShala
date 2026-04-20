import type { CircuitGate, GateType } from '@/types/simulator'
import type { ParsedCircuit, ParsedGate } from '../parsers/types'

export type DiagnosticSeverity = 'error' | 'warning' | 'info' | 'hint'

export interface Diagnostic {
  id: string
  severity: DiagnosticSeverity
  code: string
  message: string
  line?: number
  column?: number
  gateIds?: string[]
  suggestion?: string
  autoFixAvailable?: boolean
}

export interface DiagnosticResult {
  diagnostics: Diagnostic[]
  errors: Diagnostic[]
  warnings: Diagnostic[]
  hints: Diagnostic[]
  hasErrors: boolean
  hasWarnings: boolean
}

export const ERROR_CODES = {
  E001: 'Invalid qubit index',
  E002: 'Duplicate gate ID',
  E003: 'Missing parameters',
  E004: 'Invalid control (control == target)',
  E005: 'Invalid gate type',
  E006: 'Syntax error',
  E007: 'Register not defined',
  E008: 'Invalid parameter value',
  E009: 'Unsupported operation',
  E010: 'Circuit structure error',
} as const

export const WARNING_CODES = {
  W001: 'Unused qubit',
  W002: 'No measurement',
  W003: 'Deep circuit',
  W004: 'High 2q gate ratio',
  W005: 'Non-Clifford gates present',
  W006: 'Disconnected qubits',
  W007: 'Redundant gate pattern',
  W008: 'Suboptimal gate order',
  W009: 'Register size mismatch',
  W010: 'Deprecated syntax',
} as const

export const SUGGESTION_CODES = {
  S001: 'Identity pair can be removed',
  S002: 'Rotations can be merged',
  S003: 'SWAP before measure can use CNOTs',
  S004: 'Toffoli can be decomposed',
  S005: 'Redundant barrier',
  S006: 'Gates can be reordered',
  S007: 'Use native gate instead',
  S008: 'Simplify gate sequence',
  S009: 'Remove global phase',
  S010: 'Use more efficient decomposition',
} as const

let diagnosticIdCounter = 0

function createDiagnostic(
  severity: DiagnosticSeverity,
  code: string,
  message: string,
  options?: Partial<Diagnostic>
): Diagnostic {
  return {
    id: `diag-${++diagnosticIdCounter}`,
    severity,
    code,
    message,
    ...options,
  }
}

export function runDiagnostics(circuit: ParsedCircuit): DiagnosticResult {
  const diagnostics: Diagnostic[] = []


  diagnostics.push(...checkQubitIndices(circuit))
  diagnostics.push(...checkDuplicateGateIds(circuit))
  diagnostics.push(...checkMissingParameters(circuit))
  diagnostics.push(...checkInvalidControls(circuit))
  diagnostics.push(...checkUnusedQubits(circuit))
  diagnostics.push(...checkMeasurements(circuit))
  diagnostics.push(...checkCircuitDepth(circuit))
  diagnostics.push(...checkTwoQubitRatio(circuit))
  diagnostics.push(...checkCliffordGates(circuit))
  diagnostics.push(...checkIdentityPairs(circuit))
  diagnostics.push(...checkRotationMerging(circuit))
  diagnostics.push(...checkRedundantBarriers(circuit))
  diagnostics.push(...checkGatesAfterMeasurement(circuit))
  diagnostics.push(...checkDisconnectedQubits(circuit))
  diagnostics.push(...checkClassicalRegisterSize(circuit))
  diagnostics.push(...checkQubitCount(circuit))
  diagnostics.push(...checkResetGates(circuit))
  diagnostics.push(...checkEmptyCircuit(circuit))
  diagnostics.push(...checkInvalidGateTypes(circuit))
  diagnostics.push(...checkInvalidParameters(circuit))
  diagnostics.push(...checkNegativeQubitIndices(circuit))
  diagnostics.push(...checkMultipleMeasurements(circuit))
  diagnostics.push(...checkSmallRotations(circuit))
  diagnostics.push(...checkLargeRotations(circuit))
  diagnostics.push(...checkUnbalancedCircuit(circuit))
  diagnostics.push(...checkTGateCount(circuit))
  diagnostics.push(...checkSwapBeforeMeasurement(circuit))
  diagnostics.push(...checkHadamardSandwich(circuit))
  diagnostics.push(...checkCnotLadder(circuit))
  diagnostics.push(...checkConstantControl(circuit))

  const errors = diagnostics.filter((d) => d.severity === 'error')
  const warnings = diagnostics.filter((d) => d.severity === 'warning')
  const hints = diagnostics.filter((d) => d.severity === 'hint' || d.severity === 'info')

  return {
    diagnostics,
    errors,
    warnings,
    hints,
    hasErrors: errors.length > 0,
    hasWarnings: warnings.length > 0,
  }
}

function checkQubitIndices(circuit: ParsedCircuit): Diagnostic[] {
  const diagnostics: Diagnostic[] = []
  const { numQubits, gates } = circuit

  for (const gate of gates) {
    for (const qubit of [...gate.qubits, ...gate.controlQubits]) {
      if (qubit < 0 || qubit >= numQubits) {
        diagnostics.push(
          createDiagnostic('error', 'E001', `Qubit index ${qubit} exceeds register size (${numQubits})`, {
            line: gate.line,
            column: gate.column,
            gateIds: [gate.id],
            suggestion: `Use qubit indices 0 to ${numQubits - 1}`,
          })
        )
      }
    }
  }

  return diagnostics
}

function checkDuplicateGateIds(circuit: ParsedCircuit): Diagnostic[] {
  const diagnostics: Diagnostic[] = []
  const seenIds = new Set<string>()

  for (const gate of circuit.gates) {
    if (seenIds.has(gate.id)) {
      diagnostics.push(
        createDiagnostic('error', 'E002', `Duplicate gate ID: ${gate.id}`, {
          gateIds: [gate.id],
        })
      )
    }
    seenIds.add(gate.id)
  }

  return diagnostics
}

function checkMissingParameters(circuit: ParsedCircuit): Diagnostic[] {
  const diagnostics: Diagnostic[] = []
  const parameterizedGates: GateType[] = ['Rx', 'Ry', 'Rz', 'Phase', 'U', 'U1', 'U2', 'U3', 'CRx', 'CRy', 'CRz', 'CPhase']

  for (const gate of circuit.gates) {
    if (parameterizedGates.includes(gate.type)) {
      const requiredParams = getRequiredParamCount(gate.type)
      const actualParams = gate.parameters?.length || 0

      if (actualParams < requiredParams) {
        diagnostics.push(
          createDiagnostic('error', 'E003', `Gate ${gate.type} requires ${requiredParams} parameter(s), got ${actualParams}`, {
            line: gate.line,
            column: gate.column,
            gateIds: [gate.id],
          })
        )
      }
    }
  }

  return diagnostics
}

function checkInvalidControls(circuit: ParsedCircuit): Diagnostic[] {
  const diagnostics: Diagnostic[] = []

  for (const gate of circuit.gates) {
    if (gate.controlQubits.length > 0) {
      for (const control of gate.controlQubits) {
        if (gate.qubits.includes(control)) {
          diagnostics.push(
            createDiagnostic('error', 'E004', `Control qubit ${control} is also a target qubit`, {
              line: gate.line,
              column: gate.column,
              gateIds: [gate.id],
              suggestion: 'Control and target qubits must be different',
            })
          )
        }
      }
    }
  }

  return diagnostics
}

function checkUnusedQubits(circuit: ParsedCircuit): Diagnostic[] {
  const diagnostics: Diagnostic[] = []
  const usedQubits = new Set<number>()

  for (const gate of circuit.gates) {
    gate.qubits.forEach((q) => usedQubits.add(q))
    gate.controlQubits.forEach((q) => usedQubits.add(q))
  }

  for (const measurement of circuit.measurements) {
    usedQubits.add(measurement.qubit)
  }

  const unusedQubits: number[] = []
  for (let q = 0; q < circuit.numQubits; q++) {
    if (!usedQubits.has(q)) {
      unusedQubits.push(q)
    }
  }

  if (unusedQubits.length > 0) {
    const newSize = circuit.numQubits - unusedQubits.length
    diagnostics.push(
      createDiagnostic('warning', 'W001', `${unusedQubits.length} unused qubit(s): q${unusedQubits.join(', q')}`, {
        suggestion: `Reduce register size to ${newSize} qubits:\n\n**Qiskit:** QuantumCircuit(${newSize})\n**OpenQASM:** qreg q[${newSize}];\n**Cirq:** cirq.LineQubit.range(${newSize})\n**PennyLane:** qml.device('default.qubit', wires=${newSize})`,
      })
    )
  }

  return diagnostics
}

function checkMeasurements(circuit: ParsedCircuit): Diagnostic[] {
  const diagnostics: Diagnostic[] = []

  if (circuit.gates.length > 0 && circuit.measurements.length === 0) {
    const usedQubits = new Set<number>()
    for (const gate of circuit.gates) {
      gate.qubits.forEach((q) => usedQubits.add(q))
      gate.controlQubits.forEach((q) => usedQubits.add(q))
    }
    const qubitsToMeasure = [...usedQubits].sort((a, b) => a - b)

    const suggestions = generateMeasurementSuggestions(qubitsToMeasure, circuit)

    diagnostics.push(
      createDiagnostic('warning', 'W002', 'Circuit has no measurements', {
        suggestion: suggestions.message,
        line: circuit.gates.length > 0 ? circuit.gates[circuit.gates.length - 1].line + 1 : undefined,
      })
    )
  }

  if (circuit.measurements.length > 0) {
    const measuredQubits = new Set(circuit.measurements.map((m) => m.qubit))
    const usedQubits = new Set<number>()
    for (const gate of circuit.gates) {
      gate.qubits.forEach((q) => usedQubits.add(q))
      gate.controlQubits.forEach((q) => usedQubits.add(q))
    }

    const unmeasuredActiveQubits = [...usedQubits].filter((q) => !measuredQubits.has(q))
    if (unmeasuredActiveQubits.length > 0) {
      diagnostics.push(
        createDiagnostic('info', 'W002b', `${unmeasuredActiveQubits.length} qubit(s) with gates are not measured: q${unmeasuredActiveQubits.join(', q')}`, {
          suggestion: `Add measurements for qubits ${unmeasuredActiveQubits.join(', ')} if their final state is needed`,
        })
      )
    }
  }

  return diagnostics
}

function generateMeasurementSuggestions(qubits: number[], circuit: ParsedCircuit): { message: string } {
  const qubitList = qubits.join(', ')
  const lastGateLine = circuit.gates.length > 0 ? circuit.gates[circuit.gates.length - 1].line : 0

  // Build the suggestion message with examples for different languages
  let message = `Add measurements after line ${lastGateLine} for qubits [${qubitList}].\n\n`

  message += `**Qiskit:**\n`
  if (qubits.length <= 3) {
    message += qubits.map((q) => `qc.measure(${q}, ${q})`).join('\n')
  } else {
    message += `qc.measure_all()  # or qc.measure(qr, cr)`
  }

  message += `\n\n**OpenQASM:**\n`
  message += qubits.map((q) => `measure q[${q}] -> c[${q}];`).join('\n')

  message += `\n\n**Cirq:**\n`
  message += `cirq.measure(${qubits.map((q) => `q${q}`).join(', ')}, key='result')`

  message += `\n\n**PennyLane:**\n`
  message += `return qml.counts()  # or qml.probs(wires=[${qubitList}])`

  return { message }
}

function checkCircuitDepth(circuit: ParsedCircuit): Diagnostic[] {
  const diagnostics: Diagnostic[] = []
  const DEPTH_WARNING = 100
  const DEPTH_ERROR = 1000

  if (circuit.metadata.circuitDepth > DEPTH_ERROR) {
    diagnostics.push(
      createDiagnostic('warning', 'W003', `Circuit depth (${circuit.metadata.circuitDepth}) is very high`, {
        suggestion: `High depth increases error accumulation. To reduce depth:\n\n1. Enable optimization: Use 'deep' optimization preset\n2. Parallelize gates: Place independent gates in same time step\n3. Decompose differently: Some decompositions have lower depth\n4. Remove identity pairs: H-H, X-X, CNOT-CNOT cancel out\n5. Merge rotations: Rz(a) + Rz(b) = Rz(a+b)`,
      })
    )
  } else if (circuit.metadata.circuitDepth > DEPTH_WARNING) {
    diagnostics.push(
      createDiagnostic('info', 'W003', `Circuit depth is ${circuit.metadata.circuitDepth}`, {
        suggestion: `Consider running the optimizer to reduce circuit depth. Current depth may cause noticeable errors on real hardware.`,
      })
    )
  }

  return diagnostics
}

function checkTwoQubitRatio(circuit: ParsedCircuit): Diagnostic[] {
  const diagnostics: Diagnostic[] = []
  const TWO_QUBIT_WARNING = 0.5
  const TWO_QUBIT_HIGH = 0.7

  if (circuit.gates.length === 0) return diagnostics

  const twoQubitGates = circuit.gates.filter(
    (g) => g.qubits.length + g.controlQubits.length > 1
  )
  const ratio = twoQubitGates.length / circuit.gates.length

  if (ratio > TWO_QUBIT_HIGH) {
    const twoQTypes = [...new Set(twoQubitGates.map((g) => g.type))]
    diagnostics.push(
      createDiagnostic('warning', 'W004', `Very high 2-qubit gate ratio: ${twoQubitGates.length}/${circuit.gates.length} (${(ratio * 100).toFixed(0)}%)`, {
        suggestion: `2-qubit gates (${twoQTypes.join(', ')}) have ~10x higher error rates.\n\nTo reduce:\n1. Cancel adjacent CNOTs on same qubits\n2. Use KAK decomposition for optimal 2q sequences\n3. Check if algorithm can use fewer entangling gates\n4. Run optimizer with 'deep' preset`,
        gateIds: twoQubitGates.slice(0, 5).map((g) => g.id),
      })
    )
  } else if (ratio > TWO_QUBIT_WARNING) {
    diagnostics.push(
      createDiagnostic('info', 'W004', `2-qubit gate ratio: ${(ratio * 100).toFixed(0)}%`, {
        suggestion: `${twoQubitGates.length} two-qubit gates detected. Consider optimization if running on noisy hardware.`,
      })
    )
  }

  return diagnostics
}

function checkCliffordGates(circuit: ParsedCircuit): Diagnostic[] {
  const diagnostics: Diagnostic[] = []
  const CLIFFORD_GATES: GateType[] = ['H', 'S', 'Sdg', 'X', 'Y', 'Z', 'CNOT', 'CX', 'CZ', 'CY', 'SWAP']

  const nonCliffordGates = circuit.gates.filter((g) => !CLIFFORD_GATES.includes(g.type))

  if (nonCliffordGates.length > 0) {
    const nonCliffordTypes = [...new Set(nonCliffordGates.map((g) => g.type))]
    diagnostics.push(
      createDiagnostic('info', 'W005', `Circuit contains non-Clifford gates: ${nonCliffordTypes.join(', ')}`, {
        suggestion: 'Non-Clifford gates (T, rotations) require more resources for fault-tolerant execution',
        gateIds: nonCliffordGates.map((g) => g.id),
      })
    )
  }

  return diagnostics
}

function checkIdentityPairs(circuit: ParsedCircuit): Diagnostic[] {
  const diagnostics: Diagnostic[] = []
  const SELF_INVERSE_GATES: GateType[] = ['H', 'X', 'Y', 'Z', 'CNOT', 'CX', 'CZ', 'SWAP']

  const sortedGates = [...circuit.gates].sort((a, b) => a.position - b.position)

  for (let i = 0; i < sortedGates.length - 1; i++) {
    const g1 = sortedGates[i]
    const g2 = sortedGates[i + 1]

    if (
      SELF_INVERSE_GATES.includes(g1.type) &&
      g1.type === g2.type &&
      arraysEqual(g1.qubits, g2.qubits) &&
      arraysEqual(g1.controlQubits, g2.controlQubits)
    ) {
      const allQubits = [...g1.qubits, ...g1.controlQubits]
      const hasInterference = sortedGates.slice(i + 1, sortedGates.indexOf(g2)).some(
        (g) => g.qubits.some((q) => allQubits.includes(q)) || g.controlQubits.some((q) => allQubits.includes(q))
      )

      if (!hasInterference) {
        diagnostics.push(
          createDiagnostic('hint', 'S001', `Adjacent ${g1.type} gates cancel (identity pair)`, {
            line: g1.line,
            gateIds: [g1.id, g2.id],
            suggestion: 'Remove both gates to simplify circuit',
            autoFixAvailable: true,
          })
        )
      }
    }
  }

  return diagnostics
}

function checkRotationMerging(circuit: ParsedCircuit): Diagnostic[] {
  const diagnostics: Diagnostic[] = []
  const ROTATION_GATES: GateType[] = ['Rx', 'Ry', 'Rz', 'Phase', 'U1']

  const rotationsByQubit: Map<number, ParsedGate[]> = new Map()

  for (const gate of circuit.gates) {
    if (ROTATION_GATES.includes(gate.type) && gate.qubits.length === 1) {
      const qubit = gate.qubits[0]
      if (!rotationsByQubit.has(qubit)) {
        rotationsByQubit.set(qubit, [])
      }
      rotationsByQubit.get(qubit)!.push(gate)
    }
  }

  for (const [qubit, rotations] of rotationsByQubit.entries()) {
    const byType: Map<GateType, ParsedGate[]> = new Map()
    for (const rot of rotations) {
      if (!byType.has(rot.type)) {
        byType.set(rot.type, [])
      }
      byType.get(rot.type)!.push(rot)
    }

    for (const [gateType, gates] of byType.entries()) {
      if (gates.length > 1) {
        diagnostics.push(
          createDiagnostic('hint', 'S002', `${gates.length} ${gateType} gates on qubit ${qubit} can be merged`, {
            gateIds: gates.map((g) => g.id),
            suggestion: `Merge into single ${gateType} with combined angle`,
            autoFixAvailable: true,
          })
        )
      }
    }
  }

  return diagnostics
}

function checkGatesAfterMeasurement(circuit: ParsedCircuit): Diagnostic[] {
  const diagnostics: Diagnostic[] = []
  if (circuit.measurements.length === 0) return diagnostics

  const sortedGates = [...circuit.gates].sort((a, b) => a.position - b.position)
  const measurementPositions = new Map<number, number>()

  for (const m of circuit.measurements) {
    const existing = measurementPositions.get(m.qubit)
    if (!existing || m.position < existing) {
      measurementPositions.set(m.qubit, m.position)
    }
  }

  for (const gate of sortedGates) {
    for (const qubit of [...gate.qubits, ...gate.controlQubits]) {
      const measurePos = measurementPositions.get(qubit)
      if (measurePos !== undefined && gate.position > measurePos) {
        diagnostics.push(
          createDiagnostic('warning', 'W007', `Gate ${gate.type} on qubit ${qubit} after measurement`, {
            line: gate.line,
            gateIds: [gate.id],
            suggestion: `Move this gate before the measurement on qubit ${qubit}, or remove it if not needed.\n\nGates after measurement have no effect on measured outcomes.`,
          })
        )
      }
    }
  }

  return diagnostics
}

function checkDisconnectedQubits(circuit: ParsedCircuit): Diagnostic[] {
  const diagnostics: Diagnostic[] = []
  if (circuit.gates.length < 2) return diagnostics

  const connections = new Map<number, Set<number>>()
  for (let i = 0; i < circuit.numQubits; i++) {
    connections.set(i, new Set([i]))
  }

  for (const gate of circuit.gates) {
    const allQubits = [...gate.qubits, ...gate.controlQubits]
    if (allQubits.length > 1) {
      const merged = new Set<number>()
      for (const q of allQubits) {
        connections.get(q)?.forEach((x) => merged.add(x))
      }
      for (const q of merged) {
        connections.set(q, merged)
      }
    }
  }

  const groups = new Set<string>()
  for (const [, connected] of connections) {
    groups.add([...connected].sort().join(','))
  }

  if (groups.size > 1) {
    const groupList = [...groups].map((g) => `[${g}]`).join(', ')
    diagnostics.push(
      createDiagnostic('info', 'W006', `Circuit has ${groups.size} disconnected qubit groups: ${groupList}`, {
        suggestion: `These qubit groups are not entangled. Consider:\n- Adding entangling gates (CNOT, CZ) between groups if entanglement is needed\n- Splitting into separate circuits for efficiency\n- This is fine for parallel independent operations`,
      })
    )
  }

  return diagnostics
}

function checkClassicalRegisterSize(circuit: ParsedCircuit): Diagnostic[] {
  const diagnostics: Diagnostic[] = []

  if (circuit.measurements.length > circuit.numClassicalBits && circuit.numClassicalBits > 0) {
    diagnostics.push(
      createDiagnostic('warning', 'W009', `More measurements (${circuit.measurements.length}) than classical bits (${circuit.numClassicalBits})`, {
        suggestion: `Increase classical register size:\n\n**Qiskit:** ClassicalRegister(${circuit.measurements.length})\n**OpenQASM:** creg c[${circuit.measurements.length}];`,
      })
    )
  }

  const maxClassicalBit = Math.max(...circuit.measurements.map((m) => m.classicalBit), -1)
  if (maxClassicalBit >= circuit.numClassicalBits && circuit.numClassicalBits > 0) {
    diagnostics.push(
      createDiagnostic('error', 'E007', `Classical bit index ${maxClassicalBit} exceeds register size (${circuit.numClassicalBits})`, {
        suggestion: `Increase classical register to at least ${maxClassicalBit + 1} bits`,
      })
    )
  }

  return diagnostics
}

function checkQubitCount(circuit: ParsedCircuit): Diagnostic[] {
  const diagnostics: Diagnostic[] = []

  if (circuit.numQubits > 20 && circuit.numQubits <= 27) {
    diagnostics.push(
      createDiagnostic('info', 'W010', `Circuit has ${circuit.numQubits} qubits (requires cloud simulation)`, {
        suggestion: `Browser simulation supports up to 20 qubits. This circuit will use cloud resources.\n\nTo reduce qubit count:\n- Remove unused qubits\n- Use circuit cutting for separable subcircuits\n- Simplify the algorithm if possible`,
      })
    )
  } else if (circuit.numQubits > 27) {
    diagnostics.push(
      createDiagnostic('warning', 'W010', `Circuit has ${circuit.numQubits} qubits (may be slow/expensive)`, {
        suggestion: `Large circuits require significant resources. Consider:\n- Clifford-only simulation if applicable\n- Tensor network methods\n- Circuit cutting to split the circuit\n- Reducing qubit count through optimization`,
      })
    )
  }

  return diagnostics
}

function checkResetGates(circuit: ParsedCircuit): Diagnostic[] {
  const diagnostics: Diagnostic[] = []

  const resetGates = circuit.gates.filter((g) => g.type === 'Reset')
  for (const reset of resetGates) {
    const gatesBefore = circuit.gates.filter(
      (g) => g.position < reset.position && g.qubits.some((q) => reset.qubits.includes(q))
    )

    if (gatesBefore.length === 0) {
      diagnostics.push(
        createDiagnostic('hint', 'S006', `Reset on qubit ${reset.qubits[0]} at start is redundant`, {
          line: reset.line,
          gateIds: [reset.id],
          suggestion: `Qubits start in |0⟩ state by default. This Reset can be removed.`,
          autoFixAvailable: true,
        })
      )
    }
  }

  return diagnostics
}

function checkEmptyCircuit(circuit: ParsedCircuit): Diagnostic[] {
  const diagnostics: Diagnostic[] = []

  if (circuit.numQubits > 0 && circuit.gates.length === 0 && circuit.measurements.length === 0) {
    diagnostics.push(
      createDiagnostic('info', 'W008', 'Circuit is empty (no gates or measurements)', {
        suggestion: `Start building your circuit:\n\n**Qiskit:**\nqc.h(0)  # Hadamard gate\nqc.cx(0, 1)  # CNOT gate\nqc.measure_all()\n\n**OpenQASM:**\nh q[0];\ncx q[0], q[1];\nmeasure q -> c;`,
      })
    )
  }

  return diagnostics
}

function checkInvalidGateTypes(circuit: ParsedCircuit): Diagnostic[] {
  const diagnostics: Diagnostic[] = []
  const VALID_GATES: GateType[] = [
    'H', 'X', 'Y', 'Z', 'S', 'T', 'Sdg', 'Tdg',
    'Rx', 'Ry', 'Rz', 'U', 'U1', 'U2', 'U3',
    'CNOT', 'CX', 'CZ', 'CY', 'SWAP', 'iSWAP',
    'CRx', 'CRy', 'CRz', 'Phase', 'CPhase',
    'Toffoli', 'Fredkin', 'Reset', 'Barrier', 'Custom'
  ]

  for (const gate of circuit.gates) {
    if (!VALID_GATES.includes(gate.type)) {
      diagnostics.push(
        createDiagnostic('error', 'E005', `Unknown gate type: ${gate.type}`, {
          line: gate.line,
          gateIds: [gate.id],
          suggestion: `Valid gates: H, X, Y, Z, S, T, Rx, Ry, Rz, CNOT, CZ, SWAP, etc.\n\nDid you mean: ${findSimilarGate(gate.type)}?`,
        })
      )
    }
  }

  return diagnostics
}

function checkInvalidParameters(circuit: ParsedCircuit): Diagnostic[] {
  const diagnostics: Diagnostic[] = []

  for (const gate of circuit.gates) {
    if (!gate.parameters || gate.parameters.length === 0) continue

    for (let i = 0; i < gate.parameters.length; i++) {
      const param = gate.parameters[i]

      if (Number.isNaN(param)) {
        diagnostics.push(
          createDiagnostic('error', 'E008', `Parameter ${i + 1} of ${gate.type} is NaN`, {
            line: gate.line,
            gateIds: [gate.id],
            suggestion: `Check the calculation that produces this parameter value.`,
          })
        )
      } else if (!Number.isFinite(param)) {
        diagnostics.push(
          createDiagnostic('error', 'E008', `Parameter ${i + 1} of ${gate.type} is infinite`, {
            line: gate.line,
            gateIds: [gate.id],
            suggestion: `Rotation angles must be finite numbers.`,
          })
        )
      }
    }
  }

  return diagnostics
}

function checkNegativeQubitIndices(circuit: ParsedCircuit): Diagnostic[] {
  const diagnostics: Diagnostic[] = []

  for (const gate of circuit.gates) {
    for (const qubit of [...gate.qubits, ...gate.controlQubits]) {
      if (qubit < 0) {
        diagnostics.push(
          createDiagnostic('error', 'E009', `Negative qubit index: ${qubit}`, {
            line: gate.line,
            gateIds: [gate.id],
            suggestion: `Qubit indices must be non-negative (0, 1, 2, ...).`,
          })
        )
      }
    }
  }

  for (const m of circuit.measurements) {
    if (m.qubit < 0) {
      diagnostics.push(
        createDiagnostic('error', 'E009', `Negative qubit index in measurement: ${m.qubit}`, {
          line: m.line,
          suggestion: `Qubit indices must be non-negative.`,
        })
      )
    }
    if (m.classicalBit < 0) {
      diagnostics.push(
        createDiagnostic('error', 'E009', `Negative classical bit index: ${m.classicalBit}`, {
          line: m.line,
          suggestion: `Classical bit indices must be non-negative.`,
        })
      )
    }
  }

  return diagnostics
}

function checkMultipleMeasurements(circuit: ParsedCircuit): Diagnostic[] {
  const diagnostics: Diagnostic[] = []
  const measurementsByQubit = new Map<number, number>()

  for (const m of circuit.measurements) {
    const count = (measurementsByQubit.get(m.qubit) || 0) + 1
    measurementsByQubit.set(m.qubit, count)
  }

  for (const [qubit, count] of measurementsByQubit) {
    if (count > 1) {
      diagnostics.push(
        createDiagnostic('warning', 'W011', `Qubit ${qubit} is measured ${count} times`, {
          suggestion: `Multiple measurements on same qubit:\n- First measurement collapses the state\n- Subsequent measurements return same result (no gates between)\n- If intentional for mid-circuit measurement, ignore this warning`,
        })
      )
    }
  }

  return diagnostics
}

function checkSmallRotations(circuit: ParsedCircuit): Diagnostic[] {
  const diagnostics: Diagnostic[] = []
  const THRESHOLD = 0.001
  const rotationGates: GateType[] = ['Rx', 'Ry', 'Rz', 'Phase', 'U1', 'CRx', 'CRy', 'CRz', 'CPhase']

  for (const gate of circuit.gates) {
    if (!rotationGates.includes(gate.type)) continue
    if (!gate.parameters || gate.parameters.length === 0) continue

    const angle = Math.abs(gate.parameters[0])
    if (angle > 0 && angle < THRESHOLD) {
      diagnostics.push(
        createDiagnostic('hint', 'W012', `${gate.type}(${gate.parameters[0].toFixed(6)}) is nearly identity`, {
          line: gate.line,
          gateIds: [gate.id],
          suggestion: `Angle ${angle.toExponential(2)} rad is very small (< 0.001).\nThis gate has negligible effect and can be removed.`,
          autoFixAvailable: true,
        })
      )
    }
  }

  return diagnostics
}

function checkLargeRotations(circuit: ParsedCircuit): Diagnostic[] {
  const diagnostics: Diagnostic[] = []
  const TWO_PI = 2 * Math.PI
  const rotationGates: GateType[] = ['Rx', 'Ry', 'Rz', 'Phase', 'U1', 'CRx', 'CRy', 'CRz', 'CPhase']

  for (const gate of circuit.gates) {
    if (!rotationGates.includes(gate.type)) continue
    if (!gate.parameters || gate.parameters.length === 0) continue

    const angle = gate.parameters[0]
    if (Math.abs(angle) > TWO_PI) {
      const simplified = angle % TWO_PI
      diagnostics.push(
        createDiagnostic('hint', 'W013', `${gate.type}(${angle.toFixed(3)}) can be simplified`, {
          line: gate.line,
          gateIds: [gate.id],
          suggestion: `Angle ${angle.toFixed(3)} > 2π.\nSimplify to ${gate.type}(${simplified.toFixed(3)}) for equivalent operation.`,
          autoFixAvailable: true,
        })
      )
    }
  }

  return diagnostics
}

function checkUnbalancedCircuit(circuit: ParsedCircuit): Diagnostic[] {
  const diagnostics: Diagnostic[] = []
  if (circuit.gates.length < 5) return diagnostics

  const gatesPerQubit = new Map<number, number>()
  for (const gate of circuit.gates) {
    for (const q of gate.qubits) {
      gatesPerQubit.set(q, (gatesPerQubit.get(q) || 0) + 1)
    }
  }

  const counts = [...gatesPerQubit.values()]
  const total = counts.reduce((a, b) => a + b, 0)
  const max = Math.max(...counts)

  if (max / total > 0.8 && circuit.numQubits > 1) {
    const heavyQubit = [...gatesPerQubit.entries()].find(([, c]) => c === max)?.[0]
    diagnostics.push(
      createDiagnostic('info', 'W015', `Unbalanced: ${((max / total) * 100).toFixed(0)}% of gates on qubit ${heavyQubit}`, {
        suggestion: `Most operations are on one qubit. This may indicate:\n- Algorithm bottleneck on qubit ${heavyQubit}\n- Opportunity for parallelization\n- Normal for some algorithms (ignore if intentional)`,
      })
    )
  }

  return diagnostics
}

function checkTGateCount(circuit: ParsedCircuit): Diagnostic[] {
  const diagnostics: Diagnostic[] = []
  const tGates = circuit.gates.filter((g) => g.type === 'T' || g.type === 'Tdg')

  if (tGates.length > 10) {
    diagnostics.push(
      createDiagnostic('info', 'W016', `Circuit has ${tGates.length} T/Tdg gates`, {
        suggestion: `T gates are expensive for fault-tolerant quantum computing.\n\nTo reduce T-count:\n1. Use T-gate optimization passes\n2. Consider approximate synthesis\n3. Use Clifford+T decomposition tools\n\nCurrent: ${tGates.length} T gates`,
        gateIds: tGates.slice(0, 5).map((g) => g.id),
      })
    )
  }

  return diagnostics
}

function checkSwapBeforeMeasurement(circuit: ParsedCircuit): Diagnostic[] {
  const diagnostics: Diagnostic[] = []
  if (circuit.measurements.length === 0) return diagnostics

  const swapGates = circuit.gates.filter((g) => g.type === 'SWAP')
  const measurePositions = new Map<number, number>()

  for (const m of circuit.measurements) {
    measurePositions.set(m.qubit, m.position)
  }

  for (const swap of swapGates) {
    const [q1, q2] = swap.qubits
    const m1 = measurePositions.get(q1)
    const m2 = measurePositions.get(q2)

    if (m1 !== undefined && m2 !== undefined) {
      const swapIsLast = !circuit.gates.some(
        (g) => g.position > swap.position &&
        (g.qubits.includes(q1) || g.qubits.includes(q2)) &&
        g.type !== 'Barrier'
      )

      if (swapIsLast) {
        diagnostics.push(
          createDiagnostic('hint', 'S007', `SWAP(${q1},${q2}) before measurement is unnecessary`, {
            line: swap.line,
            gateIds: [swap.id],
            suggestion: `Both qubits are measured after SWAP with no gates between.\nRemove SWAP and swap the classical bit assignments instead.`,
            autoFixAvailable: true,
          })
        )
      }
    }
  }

  return diagnostics
}

function checkHadamardSandwich(circuit: ParsedCircuit): Diagnostic[] {
  const diagnostics: Diagnostic[] = []
  const sortedGates = [...circuit.gates].sort((a, b) => a.position - b.position)

  for (let i = 0; i < sortedGates.length - 2; i++) {
    const g1 = sortedGates[i]
    const g2 = sortedGates[i + 1]
    const g3 = sortedGates[i + 2]

    if (g1.type !== 'H' || g3.type !== 'H') continue
    if (!arraysEqual(g1.qubits, g3.qubits)) continue
    if (!arraysEqual(g1.qubits, g2.qubits)) continue

    if (g2.type === 'Z') {
      diagnostics.push(
        createDiagnostic('hint', 'S007', `H-Z-H on qubit ${g1.qubits[0]} equals X gate`, {
          line: g1.line,
          gateIds: [g1.id, g2.id, g3.id],
          suggestion: `Replace H-Z-H with single X gate.\n\n**Before:** qc.h(${g1.qubits[0]}); qc.z(${g1.qubits[0]}); qc.h(${g1.qubits[0]})\n**After:** qc.x(${g1.qubits[0]})`,
          autoFixAvailable: true,
        })
      )
    } else if (g2.type === 'X') {
      diagnostics.push(
        createDiagnostic('hint', 'S007', `H-X-H on qubit ${g1.qubits[0]} equals Z gate`, {
          line: g1.line,
          gateIds: [g1.id, g2.id, g3.id],
          suggestion: `Replace H-X-H with single Z gate.\n\n**Before:** qc.h(${g1.qubits[0]}); qc.x(${g1.qubits[0]}); qc.h(${g1.qubits[0]})\n**After:** qc.z(${g1.qubits[0]})`,
          autoFixAvailable: true,
        })
      )
    } else if (g2.type === 'Y') {
      diagnostics.push(
        createDiagnostic('hint', 'S007', `H-Y-H on qubit ${g1.qubits[0]} equals -Y gate`, {
          line: g1.line,
          gateIds: [g1.id, g2.id, g3.id],
          suggestion: `H-Y-H = -Y (with global phase). Can simplify to Y if global phase doesn't matter.`,
          autoFixAvailable: true,
        })
      )
    }
  }

  return diagnostics
}

function checkCnotLadder(circuit: ParsedCircuit): Diagnostic[] {
  const diagnostics: Diagnostic[] = []
  const cnots = circuit.gates.filter((g) => g.type === 'CNOT' || g.type === 'CX')

  if (cnots.length < 3) return diagnostics

  const sortedCnots = [...cnots].sort((a, b) => a.position - b.position)

  for (let i = 0; i < sortedCnots.length - 2; i++) {
    const c1 = sortedCnots[i]
    const c2 = sortedCnots[i + 1]
    const c3 = sortedCnots[i + 2]

    const ctrl1 = c1.controlQubits[0]
    const tgt1 = c1.qubits[0]
    const ctrl2 = c2.controlQubits[0]
    const tgt2 = c2.qubits[0]
    const ctrl3 = c3.controlQubits[0]
    const tgt3 = c3.qubits[0]

    if (ctrl1 === tgt2 && ctrl2 === tgt3 && tgt1 === ctrl2 && tgt2 === ctrl3) {
      diagnostics.push(
        createDiagnostic('hint', 'S008', `CNOT ladder pattern detected`, {
          line: c1.line,
          gateIds: [c1.id, c2.id, c3.id],
          suggestion: `CNOT chain can potentially be optimized.\nConsider using linear nearest-neighbor optimization.`,
        })
      )
    }
  }

  return diagnostics
}

function checkConstantControl(circuit: ParsedCircuit): Diagnostic[] {
  const diagnostics: Diagnostic[] = []
  const qubitState = new Map<number, '0' | '1' | 'unknown'>()

  for (let i = 0; i < circuit.numQubits; i++) {
    qubitState.set(i, '0')
  }

  const sortedGates = [...circuit.gates].sort((a, b) => a.position - b.position)

  for (const gate of sortedGates) {
    if (gate.controlQubits.length > 0) {
      for (const ctrl of gate.controlQubits) {
        const state = qubitState.get(ctrl)
        if (state === '0') {
          diagnostics.push(
            createDiagnostic('hint', 'S010', `${gate.type} has control qubit ${ctrl} always |0⟩`, {
              line: gate.line,
              gateIds: [gate.id],
              suggestion: `Control qubit ${ctrl} is in |0⟩ state (never flipped).\nThis controlled gate will never activate. Remove it or add X gate before.`,
              autoFixAvailable: true,
            })
          )
        }
      }
    }

    for (const q of gate.qubits) {
      if (gate.type === 'X' && qubitState.get(q) === '0') {
        qubitState.set(q, '1')
      } else if (gate.type === 'X' && qubitState.get(q) === '1') {
        qubitState.set(q, '0')
      } else if (['H', 'Y', 'Rx', 'Ry', 'U', 'U2', 'U3'].includes(gate.type)) {
        qubitState.set(q, 'unknown')
      }
    }

    for (const q of gate.controlQubits) {
      if (gate.type === 'CNOT' || gate.type === 'CX') {
        const tgt = gate.qubits[0]
        if (qubitState.get(q) === '1') {
          const tgtState = qubitState.get(tgt)
          if (tgtState === '0') qubitState.set(tgt, '1')
          else if (tgtState === '1') qubitState.set(tgt, '0')
          else qubitState.set(tgt, 'unknown')
        }
      }
    }
  }

  return diagnostics
}

function checkRedundantBarriers(circuit: ParsedCircuit): Diagnostic[] {
  const diagnostics: Diagnostic[] = []
  const barriers = circuit.gates.filter((g) => g.type === 'Barrier')
  const sortedGates = [...circuit.gates].sort((a, b) => a.position - b.position)

  for (let i = 0; i < barriers.length; i++) {
    const barrier = barriers[i]
    const barrierIndex = sortedGates.indexOf(barrier)

    if (barrierIndex === 0 || barrierIndex === sortedGates.length - 1) {
      diagnostics.push(
        createDiagnostic('hint', 'S005', 'Barrier at circuit boundary has no effect', {
          line: barrier.line,
          gateIds: [barrier.id],
          suggestion: 'Consider removing this barrier',
          autoFixAvailable: true,
        })
      )
    }

    if (i < barriers.length - 1) {
      const nextBarrier = barriers[i + 1]
      const nextIndex = sortedGates.indexOf(nextBarrier)

      if (nextIndex === barrierIndex + 1) {
        diagnostics.push(
          createDiagnostic('hint', 'S005', 'Consecutive barriers detected', {
            gateIds: [barrier.id, nextBarrier.id],
            suggestion: 'Keep only one barrier',
            autoFixAvailable: true,
          })
        )
      }
    }
  }

  return diagnostics
}

function findSimilarGate(input: string): string {
  const gates = ['H', 'X', 'Y', 'Z', 'S', 'T', 'Rx', 'Ry', 'Rz', 'CNOT', 'CX', 'CZ', 'SWAP', 'Toffoli']
  const lower = input.toLowerCase()

  for (const g of gates) {
    if (g.toLowerCase().includes(lower) || lower.includes(g.toLowerCase())) {
      return g
    }
  }

  if (lower.includes('had')) return 'H'
  if (lower.includes('not') || lower.includes('cx')) return 'CNOT'
  if (lower.includes('phase')) return 'Phase or S'
  if (lower.includes('rot')) return 'Rx, Ry, or Rz'

  return 'H, X, CNOT, Rz'
}

function arraysEqual(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false
  const sortedA = [...a].sort()
  const sortedB = [...b].sort()
  return sortedA.every((v, i) => v === sortedB[i])
}

function getRequiredParamCount(gateType: GateType): number {
  switch (gateType) {
    case 'Rx':
    case 'Ry':
    case 'Rz':
    case 'Phase':
    case 'U1':
    case 'CRx':
    case 'CRy':
    case 'CRz':
    case 'CPhase':
      return 1
    case 'U2':
      return 2
    case 'U':
    case 'U3':
      return 3
    default:
      return 0
  }
}

export function hasCircuitErrors(circuit: ParsedCircuit): boolean {
  for (const gate of circuit.gates) {
    for (const qubit of [...gate.qubits, ...gate.controlQubits]) {
      if (qubit < 0 || qubit >= circuit.numQubits) {
        return true
      }
    }
  }

  for (const gate of circuit.gates) {
    for (const control of gate.controlQubits) {
      if (gate.qubits.includes(control)) {
        return true
      }
    }
  }

  return false
}

export function getCircuitSummary(circuit: ParsedCircuit): {
  errorCount: number
  warningCount: number
  suggestionCount: number
  isValid: boolean
} {
  const result = runDiagnostics(circuit)
  return {
    errorCount: result.errors.length,
    warningCount: result.warnings.length,
    suggestionCount: result.hints.length,
    isValid: !result.hasErrors,
  }
}
