import { useState } from 'react'
import Editor from '@monaco-editor/react'
import { motion } from 'framer-motion'
import { Play, Download, Upload, Copy, RefreshCw, Code } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/Tabs'

const CODE_TEMPLATES = {
  qiskit: `from qiskit import QuantumCircuit, QuantumRegister, ClassicalRegister
from qiskit_aer import AerSimulator
from qiskit.visualization import plot_histogram

qr = QuantumRegister(2, 'q')
cr = ClassicalRegister(2, 'c')
qc = QuantumCircuit(qr, cr)

qc.h(qr[0])
qc.cx(qr[0], qr[1])
qc.measure(qr, cr)

simulator = AerSimulator()
job = simulator.run(qc, shots=1024)
result = job.result()
counts = result.get_counts(qc)

print("Results:", counts)
`,
  cirq: `import cirq
import numpy as np

q0, q1 = cirq.LineQubit.range(2)

circuit = cirq.Circuit([
    cirq.H(q0),
    cirq.CNOT(q0, q1),
    cirq.measure(q0, q1, key='result')
])

print(circuit)

simulator = cirq.Simulator()
result = simulator.run(circuit, repetitions=1024)
print("Results:", result.histogram(key='result'))
`,
  pennylane: `import pennylane as qml
from pennylane import numpy as np

dev = qml.device('default.qubit', wires=2, shots=1024)

@qml.qnode(dev)
def bell_state():
    qml.Hadamard(wires=0)
    qml.CNOT(wires=[0, 1])
    return qml.counts()

results = bell_state()
print("Results:", results)
`,
  openqasm: `OPENQASM 2.0;
include "qelib1.inc";

qreg q[2];
creg c[2];

h q[0];
cx q[0], q[1];

measure q[0] -> c[0];
measure q[1] -> c[1];
`,
}

const OUTPUT_EXAMPLES = {
  qiskit: `Results: {'00': 512, '11': 512}`,
  cirq: `0: ───H───@───M('result')───
       │
1: ───────X───M─────────────
Results: Counter({0: 498, 3: 526})`,
  pennylane: `Results: {'00': 507, '11': 517}`,
  openqasm: `Parsed successfully. Ready to simulate.`,
}

export default function CodePlaygroundPage() {
  const [language, setLanguage] = useState<keyof typeof CODE_TEMPLATES>('qiskit')
  const [code, setCode] = useState(CODE_TEMPLATES.qiskit)
  const [output, setOutput] = useState('')
  const [isRunning, setIsRunning] = useState(false)

  const handleLanguageChange = (lang: string) => {
    setLanguage(lang as keyof typeof CODE_TEMPLATES)
    setCode(CODE_TEMPLATES[lang as keyof typeof CODE_TEMPLATES])
    setOutput('')
  }

  const handleRun = async () => {
    setIsRunning(true)
    setOutput('Running simulation...\n')

    await new Promise((resolve) => setTimeout(resolve, 1500))

    setOutput(OUTPUT_EXAMPLES[language])
    setIsRunning(false)
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(code)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-display font-bold text-white flex items-center gap-2">
            <Code className="w-6 h-6 text-purple-400" />
            Code Playground
          </h1>
          <p className="text-sm text-slate-400">
            Write and run quantum code in your favorite framework
          </p>
        </div>

        <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
          <Tabs value={language} onChange={handleLanguageChange}>
            <TabsList className="w-max">
              <TabsTrigger value="qiskit" className="text-xs sm:text-sm">Qiskit</TabsTrigger>
              <TabsTrigger value="cirq" className="text-xs sm:text-sm">Cirq</TabsTrigger>
              <TabsTrigger value="pennylane" className="text-xs sm:text-sm">PennyLane</TabsTrigger>
              <TabsTrigger value="openqasm" className="text-xs sm:text-sm">OpenQASM</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-4 min-h-[500px] lg:h-[calc(100vh-12rem)]">
        <div className="flex-1 flex flex-col min-w-0 min-h-[300px] lg:min-h-0">
          <Card variant="neumorph" className="flex-1 flex flex-col overflow-hidden" padding="none">
            <div className="flex items-center justify-between px-3 md:px-4 py-2 border-b border-white/10">
              <span className="text-xs md:text-sm text-slate-400">
                {language === 'qiskit' && 'main.py'}
                {language === 'cirq' && 'circuit.py'}
                {language === 'pennylane' && 'quantum.py'}
                {language === 'openqasm' && 'circuit.qasm'}
              </span>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" onClick={handleCopy} className="p-2">
                  <Copy className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="sm" className="p-2">
                  <Download className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="sm" className="p-2">
                  <Upload className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <div className="flex-1 min-h-[200px]">
              <Editor
                height="100%"
                language={language === 'openqasm' ? 'plaintext' : 'python'}
                value={code}
                onChange={(value) => setCode(value || '')}
                theme="vs-dark"
                options={{
                  minimap: { enabled: false },
                  fontSize: 13,
                  fontFamily: 'JetBrains Mono, monospace',
                  lineNumbers: 'on',
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                  padding: { top: 12 },
                  wordWrap: 'on',
                }}
              />
            </div>
          </Card>
        </div>

        <div className="lg:w-80 xl:w-96 flex flex-col gap-4">
          <div className="flex gap-2">
            <Button
              className="flex-1"
              onClick={handleRun}
              isLoading={isRunning}
              leftIcon={<Play className="w-4 h-4" />}
            >
              Run Code
            </Button>
            <Button variant="secondary" onClick={() => setCode(CODE_TEMPLATES[language])}>
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>

          <Card variant="neumorph" className="flex-1 overflow-hidden min-h-[150px]" padding="none">
            <div className="flex items-center justify-between px-3 md:px-4 py-2 border-b border-white/10">
              <span className="text-xs md:text-sm text-slate-400">Output</span>
            </div>
            <div className="p-3 md:p-4 h-full overflow-auto">
              {output ? (
                <pre className="font-mono text-xs md:text-sm text-green-400 whitespace-pre-wrap">
                  {output}
                </pre>
              ) : (
                <p className="text-slate-500 text-xs md:text-sm">
                  Run your code to see the output here
                </p>
              )}
            </div>
          </Card>

          <Card variant="neumorph" className="p-4">
            <h3 className="font-semibold text-white mb-3 text-sm">Quick Tips</h3>
            <ul className="space-y-2 text-xs text-slate-400">
              <li>• Use Shift+Enter to run code</li>
              <li>• Ctrl+S to save to your circuits</li>
              <li>• Up to 15 qubits in browser</li>
              <li>• Cloud execution for 16+ qubits</li>
            </ul>
          </Card>
        </div>
      </div>
    </div>
  )
}
