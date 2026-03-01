import { QuantumSimulator, simulateCircuit, verifyBellState } from './simulator'
import type { QuantumCircuit } from '@/types/simulator'

export function testBellState(): { passed: boolean; message: string } {
  try {
    const passed = verifyBellState()
    return {
      passed,
      message: passed 
        ? '✅ Bell state test passed' 
        : '❌ Bell state test failed'
    }
  } catch (e) {
    return {
      passed: false,
      message: `❌ Bell state test error: ${e}`
    }
  }
}

export function testSingleQubitGates(): { passed: boolean; message: string } {
  try {
    const sim = new QuantumSimulator(1)

    sim.applyGate({ id: '1', type: 'X', qubits: [0], position: 0 })
    const probs = sim.getProbabilities()
    
    if (probs[0] > 0.001 || probs[1] < 0.999) {
      return { passed: false, message: '❌ X gate failed' }
    }

    sim.applyGate({ id: '2', type: 'X', qubits: [0], position: 1 })
    const probs2 = sim.getProbabilities()
    
    if (probs2[0] < 0.999 || probs2[1] > 0.001) {
      return { passed: false, message: '❌ X gate inversion failed' }
    }
    
    return { passed: true, message: '✅ Single qubit gates test passed' }
  } catch (e) {
    return { passed: false, message: `❌ Single qubit gates error: ${e}` }
  }
}

export function testHadamard(): { passed: boolean; message: string } {
  try {
    const circuit: QuantumCircuit = {
      id: 'test-h',
      name: 'Hadamard Test',
      numQubits: 1,
      gates: [{ id: 'h0', type: 'H', qubits: [0], position: 0 }],
      measurements: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isPublic: false,
      likes: 0,
      tags: [],
    }
    
    const result = simulateCircuit(circuit, 10000)
    
    const count0 = result.counts['0'] || 0
    const count1 = result.counts['1'] || 0
    
    const ratio0 = count0 / 10000
    const ratio1 = count1 / 10000

    const passed = ratio0 > 0.45 && ratio0 < 0.55 && ratio1 > 0.45 && ratio1 < 0.55
    
    return {
      passed,
      message: passed 
        ? '✅ Hadamard test passed' 
        : `❌ Hadamard test failed: |0⟩=${(ratio0*100).toFixed(1)}%, |1⟩=${(ratio1*100).toFixed(1)}%`
    }
  } catch (e) {
    return { passed: false, message: `❌ Hadamard test error: ${e}` }
  }
}

export function testGHZState(): { passed: boolean; message: string } {
  try {
    const circuit: QuantumCircuit = {
      id: 'test-ghz',
      name: 'GHZ Test',
      numQubits: 3,
      gates: [
        { id: 'h0', type: 'H', qubits: [0], position: 0 },
        { id: 'cx01', type: 'CNOT', qubits: [0, 1], position: 1 },
        { id: 'cx12', type: 'CNOT', qubits: [1, 2], position: 2 },
      ],
      measurements: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isPublic: false,
      likes: 0,
      tags: [],
    }
    
    const result = simulateCircuit(circuit, 10000)
    
    const count000 = result.counts['000'] || 0
    const count111 = result.counts['111'] || 0
    const otherCounts = 10000 - count000 - count111

    const passed = count000 > 4500 && count000 < 5500 &&
                   count111 > 4500 && count111 < 5500 &&
                   otherCounts < 100
    
    return {
      passed,
      message: passed
        ? '✅ GHZ state test passed'
        : `❌ GHZ test failed: |000⟩=${count000}, |111⟩=${count111}, other=${otherCounts}`
    }
  } catch (e) {
    return { passed: false, message: `❌ GHZ test error: ${e}` }
  }
}

export function testSwapGate(): { passed: boolean; message: string } {
  try {
    const sim = new QuantumSimulator(2)

    sim.applyGate({ id: '1', type: 'X', qubits: [0], position: 0 })

    let probs = sim.getProbabilities()
    if (probs[1] < 0.99) {
      return { passed: false, message: '❌ SWAP pre-condition failed' }
    }

    sim.applyGate({ id: '2', type: 'SWAP', qubits: [0, 1], position: 1 })

    probs = sim.getProbabilities()
    if (probs[2] < 0.99) {
      return { passed: false, message: '❌ SWAP gate failed' }
    }
    
    return { passed: true, message: '✅ SWAP gate test passed' }
  } catch (e) {
    return { passed: false, message: `❌ SWAP test error: ${e}` }
  }
}

export function testRotationGates(): { passed: boolean; message: string } {
  try {
    const sim = new QuantumSimulator(1)

    sim.applyGate({ id: '1', type: 'Ry', qubits: [0], position: 0, parameters: [Math.PI] })
    
    const probs = sim.getProbabilities()
    if (probs[1] < 0.99) {
      return { passed: false, message: '❌ Ry(π) rotation failed' }
    }
    
    return { passed: true, message: '✅ Rotation gates test passed' }
  } catch (e) {
    return { passed: false, message: `❌ Rotation test error: ${e}` }
  }
}

export function runAllTests(): { total: number; passed: number; results: string[] } {
  const tests = [
    testSingleQubitGates,
    testHadamard,
    testBellState,
    testGHZState,
    testSwapGate,
    testRotationGates,
  ]
  
  const results: string[] = []
  let passed = 0
  
  for (const test of tests) {
    const result = test()
    results.push(result.message)
    if (result.passed) passed++
  }
  
  console.log('\n=== Quantum Simulator Test Results ===')
  results.forEach(r => console.log(r))
  console.log(`\nTotal: ${passed}/${tests.length} tests passed`)
  console.log('=====================================\n')
  
  return { total: tests.length, passed, results }
}
