import { v4 as uuid } from 'uuid'
import type { CircuitGate, GateType, QuantumCircuit } from '@/types/simulator'
import { createPass, noOpResult, passRegistry, type PassResult, type PassAction } from '../registry'


function cloneCircuit(circuit: QuantumCircuit): QuantumCircuit {
  return JSON.parse(JSON.stringify(circuit))
}

function normalizeAngle(angle: number): number {
  let normalized = angle % (2 * Math.PI)
  if (normalized > Math.PI) normalized -= 2 * Math.PI
  if (normalized < -Math.PI) normalized += 2 * Math.PI
  return normalized
}


function eulerZYZPass(circuit: QuantumCircuit): PassResult {
  const result = cloneCircuit(circuit)
  const actions: PassAction[] = []
  const toRemove = new Set<string>()
  const newGates: CircuitGate[] = []

  for (const gate of result.gates) {
    if (gate.type === 'U' || gate.type === 'U3') {
      if (gate.parameters && gate.parameters.length >= 3) {
        const [theta, phi, lambda] = gate.parameters
        const qubit = gate.qubits[0]

        toRemove.add(gate.id)

        const pos = gate.position
        const gates: CircuitGate[] = []

        if (Math.abs(normalizeAngle(phi)) > 1e-10) {
          gates.push({
            id: uuid(),
            type: 'Rz',
            qubits: [qubit],
            parameters: [normalizeAngle(phi)],
            position: pos,
          })
        }

        if (Math.abs(normalizeAngle(theta)) > 1e-10) {
          gates.push({
            id: uuid(),
            type: 'Ry',
            qubits: [qubit],
            parameters: [normalizeAngle(theta)],
            position: pos + 0.01,
          })
        }

        if (Math.abs(normalizeAngle(lambda)) > 1e-10) {
          gates.push({
            id: uuid(),
            type: 'Rz',
            qubits: [qubit],
            parameters: [normalizeAngle(lambda)],
            position: pos + 0.02,
          })
        }

        if (gates.length > 0) {
          newGates.push(...gates)
          actions.push({
            type: 'replace',
            gateIds: [gate.id],
            description: `U3 → Rz-Ry-Rz decomposition`,
            newGates: gates,
          })
        } else {
          actions.push({
            type: 'remove',
            gateIds: [gate.id],
            description: 'U3 is identity',
          })
        }
      }
    }

    if (gate.type === 'U2') {
      if (gate.parameters && gate.parameters.length >= 2) {
        const [phi, lambda] = gate.parameters
        const qubit = gate.qubits[0]

        toRemove.add(gate.id)

        const pos = gate.position
        const gates: CircuitGate[] = []

        if (Math.abs(normalizeAngle(phi)) > 1e-10) {
          gates.push({
            id: uuid(),
            type: 'Rz',
            qubits: [qubit],
            parameters: [normalizeAngle(phi)],
            position: pos,
          })
        }

        gates.push({
          id: uuid(),
          type: 'Ry',
          qubits: [qubit],
          parameters: [Math.PI / 2],
          position: pos + 0.01,
        })

        if (Math.abs(normalizeAngle(lambda)) > 1e-10) {
          gates.push({
            id: uuid(),
            type: 'Rz',
            qubits: [qubit],
            parameters: [normalizeAngle(lambda)],
            position: pos + 0.02,
          })
        }

        newGates.push(...gates)
        actions.push({
          type: 'replace',
          gateIds: [gate.id],
          description: 'U2 → Rz-Ry(π/2)-Rz decomposition',
          newGates: gates,
        })
      }
    }
  }

  if (toRemove.size === 0) {
    return noOpResult(circuit)
  }

  result.gates = result.gates.filter((g) => !toRemove.has(g.id))
  result.gates.push(...newGates)

  return {
    circuit: result,
    actions,
    gatesRemoved: toRemove.size - newGates.length,
    gatesMerged: 0,
    gatesReplaced: actions.filter((a) => a.type === 'replace').length,
    applied: true,
  }
}

export const eulerZYZ = createPass({
  id: 'E1_euler_zyz',
  name: 'Euler ZYZ Decomposition',
  category: 'mathematical',
  description: 'Convert U gates to Rz-Ry-Rz decomposition',
  timing: 'standard',
  priority: 1,
  enabled: true,
  estimatedTimeMs: 4,
  apply: eulerZYZPass,
})


function eulerZXZPass(circuit: QuantumCircuit): PassResult {
  const result = cloneCircuit(circuit)
  const actions: PassAction[] = []
  const toRemove = new Set<string>()
  const newGates: CircuitGate[] = []

  for (const gate of result.gates) {
    if (gate.type === 'U' || gate.type === 'U3') {
      if (gate.parameters && gate.parameters.length >= 3) {
        const [theta, phi, lambda] = gate.parameters
        const qubit = gate.qubits[0]


        toRemove.add(gate.id)

        const pos = gate.position
        const gates: CircuitGate[] = []

        const alpha = phi - Math.PI / 2
        const beta = theta
        const gamma = lambda + Math.PI / 2

        if (Math.abs(normalizeAngle(alpha)) > 1e-10) {
          gates.push({
            id: uuid(),
            type: 'Rz',
            qubits: [qubit],
            parameters: [normalizeAngle(alpha)],
            position: pos,
          })
        }

        if (Math.abs(normalizeAngle(beta)) > 1e-10) {
          gates.push({
            id: uuid(),
            type: 'Rx',
            qubits: [qubit],
            parameters: [normalizeAngle(beta)],
            position: pos + 0.01,
          })
        }

        if (Math.abs(normalizeAngle(gamma)) > 1e-10) {
          gates.push({
            id: uuid(),
            type: 'Rz',
            qubits: [qubit],
            parameters: [normalizeAngle(gamma)],
            position: pos + 0.02,
          })
        }

        if (gates.length > 0) {
          newGates.push(...gates)
          actions.push({
            type: 'replace',
            gateIds: [gate.id],
            description: 'U3 → Rz-Rx-Rz decomposition',
            newGates: gates,
          })
        }
      }
    }
  }

  if (toRemove.size === 0) {
    return noOpResult(circuit)
  }

  result.gates = result.gates.filter((g) => !toRemove.has(g.id))
  result.gates.push(...newGates)

  return {
    circuit: result,
    actions,
    gatesRemoved: toRemove.size - newGates.length,
    gatesMerged: 0,
    gatesReplaced: actions.length,
    applied: true,
  }
}

export const eulerZXZ = createPass({
  id: 'E2_euler_zxz',
  name: 'Euler ZXZ Decomposition',
  category: 'mathematical',
  description: 'Convert U gates to Rz-Rx-Rz decomposition',
  timing: 'deep',
  priority: 2,
  enabled: false, // Alternative to ZYZ, not both
  estimatedTimeMs: 4,
  apply: eulerZXZPass,
})


interface PauliFrame {
  x: boolean
  z: boolean
}

function cliffordFramePass(circuit: QuantumCircuit): PassResult {

  const result = cloneCircuit(circuit)
  const actions: PassAction[] = []

  const measuredQubits = new Set(result.measurements.map((m) => m.qubit))
  if (measuredQubits.size === 0) {
    return noOpResult(circuit)
  }

  const sortedGates = [...result.gates].sort((a, b) => b.position - a.position)
  const toRemove = new Set<string>()

  for (const gate of sortedGates) {
    if ((gate.type === 'X' || gate.type === 'Z') && gate.qubits.length === 1) {
      const qubit = gate.qubits[0]

      if (!measuredQubits.has(qubit)) continue

      const gatesAfter = result.gates.filter(
        (g) =>
          g.position > gate.position &&
          (g.qubits.includes(qubit) || g.controlQubits?.includes(qubit))
      )

      const onlyBarrierOrMeasure = gatesAfter.every((g) => g.type === 'Barrier')

      if (onlyBarrierOrMeasure) {
        toRemove.add(gate.id)
        actions.push({
          type: 'remove',
          gateIds: [gate.id],
          description: `Terminal ${gate.type} absorbed into measurement`,
        })
      }
    }
  }

  if (toRemove.size === 0) {
    return noOpResult(circuit)
  }

  result.gates = result.gates.filter((g) => !toRemove.has(g.id))

  return {
    circuit: result,
    actions,
    gatesRemoved: toRemove.size,
    gatesMerged: 0,
    gatesReplaced: 0,
    applied: true,
  }
}

export const cliffordFrame = createPass({
  id: 'E5_clifford_frame',
  name: 'Clifford Frame Tracking',
  category: 'mathematical',
  description: 'Track and optimize Pauli frame through Clifford gates',
  timing: 'deep',
  priority: 5,
  enabled: true,
  estimatedTimeMs: 8,
  apply: cliffordFramePass,
})


export function registerMathematicalPasses(): void {
  passRegistry.register(eulerZYZ)
  passRegistry.register(eulerZXZ)
  passRegistry.register(cliffordFrame)
}
