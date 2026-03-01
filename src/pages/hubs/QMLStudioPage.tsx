import { useState, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Brain,
  Layers,
  Play,
  Pause,
  Settings,
  BarChart3,
  Database,
  Cpu,
  Download,
  BookOpen,
  Zap,
  Trash2,
  ArrowRight,
  Target,
  Code,
  Copy,
  Info,
  Sparkles,
  Network,
  Shuffle,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs'
import { Progress } from '@/components/ui/Progress'
import { Badge } from '@/components/ui/Badge'
import { LossCurve } from '@/components/qml/training/LossCurve'
import { DatasetBrowser } from '@/components/qml/datasets/DatasetBrowser'
import { DecisionBoundary } from '@/components/qml/visualization/DecisionBoundary'
import { VQC } from '@/lib/qml/algorithms/VQC'
import { QSVM, createQSVM } from '@/lib/qml/algorithms/QSVM'
import { QCNN, createQCNN } from '@/lib/qml/algorithms/QCNN'
import { QGAN, createQGAN } from '@/lib/qml/algorithms/QGAN'
import { useQMLStore } from '@/stores/qmlStore'
import type { OptimizerType } from '@/lib/qml/core/Optimizer'

const ALGORITHM_OPTIONS = [
  { id: 'vqc', name: 'VQC', icon: Brain, description: 'Variational Quantum Classifier', color: 'purple' },
  { id: 'qsvm', name: 'QSVM', icon: Network, description: 'Quantum Support Vector Machine', color: 'blue' },
  { id: 'qcnn', name: 'QCNN', icon: Layers, description: 'Quantum Convolutional Neural Network', color: 'green' },
  { id: 'qgan', name: 'QGAN', icon: Shuffle, description: 'Quantum Generative Adversarial Network', color: 'orange' },
]

const ENCODING_OPTIONS = [
  { id: 'angle', name: 'Angle Encoding', description: 'Encode data as rotation angles' },
  { id: 'amplitude', name: 'Amplitude Encoding', description: 'Encode data in amplitudes' },
  { id: 'iqp', name: 'IQP Encoding', description: 'Instantaneous quantum polynomial' },
  { id: 'dense_angle', name: 'Dense Encoding', description: 'Multiple rotation gates per feature' },
]

const OPTIMIZER_OPTIONS: { id: OptimizerType; name: string }[] = [
  { id: 'adam', name: 'Adam' },
  { id: 'sgd', name: 'SGD' },
  { id: 'spsa', name: 'SPSA' },
  { id: 'cobyla', name: 'COBYLA' },
  { id: 'nelder_mead', name: 'Nelder-Mead' },
]

const BUILTIN_DATASETS = [
  { id: 'iris', name: 'Iris Dataset', samples: 150, features: 4, classes: 3, icon: '🌸' },
  { id: 'moons', name: 'Two Moons', samples: 200, features: 2, classes: 2, icon: '🌙' },
  { id: 'circles', name: 'Concentric Circles', samples: 200, features: 2, classes: 2, icon: '⭕' },
  { id: 'xor', name: 'XOR Problem', samples: 100, features: 2, classes: 2, icon: '✕' },
  { id: 'wine', name: 'Wine Quality', samples: 178, features: 13, classes: 3, icon: '🍷' },
  { id: 'breast_cancer', name: 'Breast Cancer', samples: 569, features: 30, classes: 2, icon: '🏥' },
]

function generateSyntheticData(type: string, numSamples: number): { data: number[][]; labels: number[] } {
  const data: number[][] = []
  const labels: number[] = []

  if (type === 'moons') {
    for (let i = 0; i < numSamples / 2; i++) {
      const angle = Math.PI * (i / (numSamples / 2))
      data.push([Math.cos(angle) + Math.random() * 0.1, Math.sin(angle) + Math.random() * 0.1])
      labels.push(0)
    }
    for (let i = 0; i < numSamples / 2; i++) {
      const angle = Math.PI * (i / (numSamples / 2))
      data.push([1 - Math.cos(angle) + Math.random() * 0.1, 0.5 - Math.sin(angle) + Math.random() * 0.1])
      labels.push(1)
    }
  } else if (type === 'circles') {
    for (let i = 0; i < numSamples / 2; i++) {
      const angle = 2 * Math.PI * Math.random()
      const r = 0.3 + Math.random() * 0.1
      data.push([r * Math.cos(angle), r * Math.sin(angle)])
      labels.push(0)
    }
    for (let i = 0; i < numSamples / 2; i++) {
      const angle = 2 * Math.PI * Math.random()
      const r = 0.8 + Math.random() * 0.1
      data.push([r * Math.cos(angle), r * Math.sin(angle)])
      labels.push(1)
    }
  } else if (type === 'xor') {
    for (let i = 0; i < numSamples; i++) {
      const x = Math.random() * 2 - 1
      const y = Math.random() * 2 - 1
      data.push([x, y])
      labels.push((x > 0) !== (y > 0) ? 1 : 0)
    }
  } else {
    for (let i = 0; i < numSamples; i++) {
      const x = Math.random() * 2 - 1
      const y = Math.random() * 2 - 1
      data.push([x, y])
      labels.push(x + y > 0 ? 1 : 0)
    }
  }

  return { data, labels }
}

export default function QMLStudioPage() {
  const [selectedTab, setSelectedTab] = useState('algorithm')
  const [selectedAlgorithm, setSelectedAlgorithm] = useState('vqc')
  const [encoding, setEncoding] = useState('angle')
  const [numQubits, setNumQubits] = useState(4)
  const [numLayers, setNumLayers] = useState(3)
  const [optimizer, setOptimizer] = useState<OptimizerType>('adam')
  const [learningRate, setLearningRate] = useState(0.1)
  const [maxIterations, setMaxIterations] = useState(50)
  const [selectedDataset, setSelectedDataset] = useState(BUILTIN_DATASETS[1])

  const [isTraining, setIsTraining] = useState(false)
  const [trainingHistory, setTrainingHistory] = useState<{ epoch: number; loss: number; accuracy: number }[]>([])
  const [currentEpoch, setCurrentEpoch] = useState(0)
  const [trainedModel, setTrainedModel] = useState<VQC | QSVM | QCNN | null>(null)
  const [predictions, setPredictions] = useState<number[]>([])

  const [showCode, setShowCode] = useState(false)

  const { data: syntheticData, labels: syntheticLabels } = useMemo(() => {
    return generateSyntheticData(selectedDataset.id, 100)
  }, [selectedDataset.id])

  const handleTrain = useCallback(async () => {
    setIsTraining(true)
    setTrainingHistory([])
    setCurrentEpoch(0)
    setPredictions([])

    try {
      if (selectedAlgorithm === 'vqc') {
        const vqc = new VQC({
          numQubits,
          numLayers,
          encodingType: encoding as 'angle' | 'amplitude' | 'iqp' | 'dense_angle',
          optimizerType: optimizer,
          learningRate,
          maxIterations,
          batchSize: 16,
          entanglement: 'linear'
        })

        vqc.train(
          syntheticData,
          syntheticLabels,
          undefined,
          undefined,
          (epoch, loss, accuracy) => {
            setCurrentEpoch(epoch + 1)
            setTrainingHistory(prev => [...prev, { epoch: epoch + 1, loss, accuracy }])
          }
        )

        setTrainedModel(vqc)
        const preds = syntheticData.map(d => vqc.predict(d))
        setPredictions(preds)
      } else if (selectedAlgorithm === 'qsvm') {
        const qsvm = createQSVM(numQubits)

        const result = qsvm.train(syntheticData, syntheticLabels)

        setTrainingHistory([{ epoch: 1, loss: 1 - result.accuracy, accuracy: result.accuracy }])
        setCurrentEpoch(1)

        setTrainedModel(qsvm)
        const preds = syntheticData.map(d => qsvm.predictOne(d))
        setPredictions(preds)
      } else if (selectedAlgorithm === 'qcnn') {
        const qcnn = createQCNN(numQubits, numLayers)

        qcnn.train(
          syntheticData,
          syntheticLabels,
          undefined,
          undefined,
          (epoch, trainLoss, trainAcc) => {
            setCurrentEpoch(epoch + 1)
            setTrainingHistory(prev => [...prev, { epoch: epoch + 1, loss: trainLoss, accuracy: trainAcc }])
          }
        )

        setTrainedModel(qcnn)
        const preds = syntheticData.map(d => qcnn.predict(d))
        setPredictions(preds)
      } else if (selectedAlgorithm === 'qgan') {
        const qgan = createQGAN(numQubits, numLayers)

        qgan.train(
          syntheticData,
          (epoch, genLoss, discLoss) => {
            setCurrentEpoch(epoch + 1)
            setTrainingHistory(prev => [...prev, {
              epoch: epoch + 1,
              loss: (genLoss + discLoss) / 2,
              accuracy: 1 - Math.min(genLoss, 1)
            }])
          }
        )
      }
    } catch (error) {
      console.error('Training error:', error)
    }

    setIsTraining(false)
  }, [selectedAlgorithm, numQubits, numLayers, encoding, optimizer, learningRate, maxIterations, syntheticData, syntheticLabels])

  const stopTraining = () => {
    setIsTraining(false)
  }

  const lastMetrics = trainingHistory[trainingHistory.length - 1]

  const generateCode = () => {
    if (selectedAlgorithm === 'vqc') {
      return `import pennylane as qml
from pennylane import numpy as np
from pennylane.optimize import AdamOptimizer

dev = qml.device('default.qubit', wires=${numQubits})

@qml.qnode(dev)
def circuit(x, weights):
    for i in range(${numQubits}):
        qml.RY(x[i % len(x)] * np.pi, wires=i)

    for layer in range(${numLayers}):
        for i in range(${numQubits}):
            qml.RY(weights[layer, i, 0], wires=i)
            qml.RZ(weights[layer, i, 1], wires=i)
        for i in range(${numQubits} - 1):
            qml.CNOT(wires=[i, i + 1])
        qml.CNOT(wires=[${numQubits - 1}, 0])

    return qml.expval(qml.PauliZ(0))

opt = AdamOptimizer(stepsize=${learningRate})
weights = np.random.randn(${numLayers}, ${numQubits}, 2)

for epoch in range(${maxIterations}):
    weights, cost = opt.step_and_cost(cost_fn, weights)
    print(f"Epoch {epoch}: Loss = {cost:.4f}")`
    } else if (selectedAlgorithm === 'qsvm') {
      return `import pennylane as qml
from pennylane import numpy as np
from sklearn.svm import SVC

dev = qml.device('default.qubit', wires=${numQubits})

@qml.qnode(dev)
def kernel_circuit(x1, x2):
    for i in range(${numQubits}):
        qml.RY(x1[i % len(x1)] * np.pi, wires=i)
    for i in range(${numQubits}):
        qml.adjoint(qml.RY)(x2[i % len(x2)] * np.pi, wires=i)
    return qml.probs(wires=range(${numQubits}))

def quantum_kernel(X1, X2):
    K = np.zeros((len(X1), len(X2)))
    for i, x1 in enumerate(X1):
        for j, x2 in enumerate(X2):
            probs = kernel_circuit(x1, x2)
            K[i, j] = probs[0]
    return K

K_train = quantum_kernel(X_train, X_train)
svm = SVC(kernel='precomputed')
svm.fit(K_train, y_train)`
    } else if (selectedAlgorithm === 'qcnn') {
      return `import pennylane as qml
from pennylane import numpy as np

dev = qml.device('default.qubit', wires=${numQubits})

@qml.qnode(dev)
def qcnn_circuit(x, weights):
    for i in range(${numQubits}):
        qml.RY(x[i % len(x)] * np.pi, wires=i)

    for layer in range(${numLayers}):
        for i in range(${numQubits}):
            qml.RY(weights[layer, i, 0], wires=i)
            qml.RZ(weights[layer, i, 1], wires=i)
        for i in range(0, ${numQubits} - 1, 2):
            qml.CNOT(wires=[i, i + 1])

    for i in range(0, ${numQubits}, 2):
        qml.CNOT(wires=[i, (i + 1) % ${numQubits}])

    return qml.expval(qml.PauliZ(0))

weights = np.random.randn(${numLayers}, ${numQubits}, 2)
opt = qml.AdamOptimizer(stepsize=${learningRate})`
    } else {
      return `import pennylane as qml
from pennylane import numpy as np

dev = qml.device('default.qubit', wires=${numQubits})

@qml.qnode(dev)
def generator(latent, gen_weights):
    for i in range(${numQubits}):
        qml.Hadamard(wires=i)
    for layer in range(${numLayers}):
        for i in range(${numQubits}):
            qml.RY(gen_weights[layer, i, 0] + latent[i % len(latent)], wires=i)
        for i in range(${numQubits} - 1):
            qml.CNOT(wires=[i, i + 1])
    return [qml.expval(qml.PauliZ(i)) for i in range(${numQubits})]

@qml.qnode(dev)
def discriminator(data, disc_weights):
    for i in range(${numQubits}):
        qml.RY(data[i % len(data)] * np.pi, wires=i)
    for layer in range(${numLayers}):
        for i in range(${numQubits}):
            qml.RY(disc_weights[layer, i], wires=i)
        for i in range(${numQubits} - 1):
            qml.CNOT(wires=[i, i + 1])
    return qml.expval(qml.PauliZ(0))`
    }
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0">
            <Brain className="w-5 h-5 md:w-6 md:h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-display font-bold text-white">
              QML Studio
            </h1>
            <p className="text-sm text-slate-400">
              Train real quantum machine learning models
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            leftIcon={<Code className="w-4 h-4" />}
            size="sm"
            onClick={() => setShowCode(!showCode)}
          >
            <span className="hidden sm:inline">Export Code</span>
          </Button>
          <Button variant="secondary" leftIcon={<BookOpen className="w-4 h-4" />} size="sm">
            <span className="hidden sm:inline">Guide</span>
          </Button>
        </div>
      </div>

      <Tabs value={selectedTab} onChange={setSelectedTab}>
        <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
          <TabsList className="w-max md:w-auto">
            <TabsTrigger value="algorithm" className="text-xs md:text-sm">
              <Brain className="w-4 h-4 mr-1" />
              Algorithm
            </TabsTrigger>
            <TabsTrigger value="training" className="text-xs md:text-sm">
              <BarChart3 className="w-4 h-4 mr-1" />
              Training
            </TabsTrigger>
            <TabsTrigger value="datasets" className="text-xs md:text-sm">
              <Database className="w-4 h-4 mr-1" />
              Datasets
            </TabsTrigger>
            <TabsTrigger value="visualization" className="text-xs md:text-sm">
              <Sparkles className="w-4 h-4 mr-1" />
              Visualization
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="algorithm" className="mt-4 md:mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6">
            <div className="lg:col-span-4">
              <Card variant="neumorph" className="p-4">
                <h3 className="font-semibold text-white mb-4 text-sm flex items-center gap-2">
                  <Brain className="w-4 h-4 text-purple-400" />
                  Select Algorithm
                </h3>
                <div className="space-y-2">
                  {ALGORITHM_OPTIONS.map((algo) => {
                    const Icon = algo.icon
                    return (
                      <button
                        key={algo.id}
                        onClick={() => setSelectedAlgorithm(algo.id)}
                        className={`w-full p-3 rounded-lg transition-colors text-left ${
                          selectedAlgorithm === algo.id
                            ? 'bg-purple-500/20 border border-purple-500/50'
                            : 'bg-neumorph-base shadow-neumorph-xs border border-white/[0.02] hover:bg-neumorph-base'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <Icon className={`w-5 h-5 ${
                            selectedAlgorithm === algo.id ? 'text-purple-400' : 'text-slate-400'
                          }`} />
                          <div>
                            <div className="font-medium text-white text-sm">{algo.name}</div>
                            <div className="text-xs text-slate-400">{algo.description}</div>
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </Card>
            </div>

            <div className="lg:col-span-4">
              <Card variant="neumorph" className="p-4">
                <h3 className="font-semibold text-white mb-4 text-sm flex items-center gap-2">
                  <Settings className="w-4 h-4 text-blue-400" />
                  Configuration
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">Qubits</label>
                    <input
                      type="range"
                      min={2}
                      max={10}
                      value={numQubits}
                      onChange={(e) => setNumQubits(parseInt(e.target.value))}
                      className="w-full accent-purple-500"
                    />
                    <div className="flex justify-between text-xs text-slate-500 mt-1">
                      <span>2</span>
                      <span className="text-purple-400 font-medium">{numQubits}</span>
                      <span>10</span>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">Layers</label>
                    <input
                      type="range"
                      min={1}
                      max={6}
                      value={numLayers}
                      onChange={(e) => setNumLayers(parseInt(e.target.value))}
                      className="w-full accent-purple-500"
                    />
                    <div className="flex justify-between text-xs text-slate-500 mt-1">
                      <span>1</span>
                      <span className="text-purple-400 font-medium">{numLayers}</span>
                      <span>6</span>
                    </div>
                  </div>

                  {selectedAlgorithm === 'vqc' && (
                    <div>
                      <label className="text-xs text-slate-400 mb-1 block">Encoding</label>
                      <select
                        value={encoding}
                        onChange={(e) => setEncoding(e.target.value)}
                        className="w-full px-3 py-2 bg-neumorph-base shadow-neumorph-xs border border-white/[0.02] rounded-lg text-white text-sm"
                      >
                        {ENCODING_OPTIONS.map(enc => (
                          <option key={enc.id} value={enc.id}>{enc.name}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">Optimizer</label>
                    <select
                      value={optimizer}
                      onChange={(e) => setOptimizer(e.target.value as OptimizerType)}
                      className="w-full px-3 py-2 bg-neumorph-base shadow-neumorph-xs border border-white/[0.02] rounded-lg text-white text-sm"
                    >
                      {OPTIMIZER_OPTIONS.map(opt => (
                        <option key={opt.id} value={opt.id}>{opt.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">Learning Rate</label>
                    <input
                      type="number"
                      value={learningRate}
                      onChange={(e) => setLearningRate(parseFloat(e.target.value))}
                      step={0.01}
                      min={0.001}
                      max={1}
                      className="w-full px-3 py-2 bg-neumorph-base shadow-neumorph-xs border border-white/[0.02] rounded-lg text-white text-sm"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">Iterations</label>
                    <input
                      type="number"
                      value={maxIterations}
                      onChange={(e) => setMaxIterations(parseInt(e.target.value))}
                      min={10}
                      max={200}
                      className="w-full px-3 py-2 bg-neumorph-base shadow-neumorph-xs border border-white/[0.02] rounded-lg text-white text-sm"
                    />
                  </div>
                </div>
              </Card>
            </div>

            <div className="lg:col-span-4 space-y-4">
              <Card variant="neumorph" className="p-4">
                <h3 className="font-semibold text-white mb-3 text-sm">Model Summary</h3>
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2 rounded bg-neumorph-base shadow-neumorph-xs border border-white/[0.02] text-center">
                    <div className="text-lg font-bold text-white">{numQubits}</div>
                    <div className="text-xs text-slate-400">Qubits</div>
                  </div>
                  <div className="p-2 rounded bg-neumorph-base shadow-neumorph-xs border border-white/[0.02] text-center">
                    <div className="text-lg font-bold text-white">{numLayers}</div>
                    <div className="text-xs text-slate-400">Layers</div>
                  </div>
                  <div className="p-2 rounded bg-neumorph-base shadow-neumorph-xs border border-white/[0.02] text-center">
                    <div className="text-lg font-bold text-white">{numQubits * numLayers * 2}</div>
                    <div className="text-xs text-slate-400">Parameters</div>
                  </div>
                  <div className="p-2 rounded bg-neumorph-base shadow-neumorph-xs border border-white/[0.02] text-center">
                    <div className="text-lg font-bold text-white">{numQubits * numLayers * 3}</div>
                    <div className="text-xs text-slate-400">Gates</div>
                  </div>
                </div>
              </Card>

              <Card variant="neumorph" className="p-4">
                <h3 className="font-semibold text-white mb-3 text-sm">Dataset</h3>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-neumorph-base shadow-neumorph-xs border border-white/[0.02]">
                  <span className="text-2xl">{selectedDataset.icon}</span>
                  <div>
                    <div className="text-white text-sm font-medium">{selectedDataset.name}</div>
                    <div className="text-xs text-slate-400">
                      {selectedDataset.samples} samples, {selectedDataset.features} features
                    </div>
                  </div>
                </div>
              </Card>

              <Button
                className="w-full"
                onClick={isTraining ? stopTraining : handleTrain}
                disabled={false}
                size="sm"
              >
                {isTraining ? (
                  <>
                    <Pause className="w-4 h-4 mr-2" />
                    Stop Training
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-2" />
                    Start Training
                  </>
                )}
              </Button>
            </div>
          </div>

          <AnimatePresence>
            {showCode && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden mt-4"
              >
                <Card variant="neumorph" className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-white text-sm flex items-center gap-2">
                      <Code className="w-4 h-4 text-green-400" />
                      PennyLane Code
                    </h3>
                    <Button variant="ghost" size="sm" onClick={() => navigator.clipboard.writeText(generateCode())}>
                      <Copy className="w-4 h-4 mr-1" />
                      Copy
                    </Button>
                  </div>
                  <pre className="p-4 bg-neumorph-base rounded-lg overflow-x-auto text-xs text-green-400 font-mono">
                    {generateCode()}
                  </pre>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </TabsContent>

        <TabsContent value="training" className="mt-4 md:mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
            <div className="lg:col-span-2">
              <LossCurve
                history={trainingHistory}
                showValidation={false}
                height={350}
              />
            </div>

            <div className="space-y-4">
              <Card variant="neumorph" className="p-4">
                <h3 className="font-semibold text-white mb-4 text-sm">Current Metrics</h3>
                {trainingHistory.length > 0 ? (
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Epoch</span>
                      <span className="text-white">{currentEpoch} / {maxIterations}</span>
                    </div>
                    <Progress value={(currentEpoch / maxIterations) * 100} />
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Loss</span>
                      <span className="text-purple-400">{lastMetrics?.loss.toFixed(4)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Accuracy</span>
                      <span className="text-green-400">{(lastMetrics?.accuracy * 100).toFixed(1)}%</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-slate-400 text-sm">Start training to see metrics</p>
                )}
              </Card>

              <Card variant="neumorph" className="p-4">
                <h3 className="font-semibold text-white mb-4 text-sm">Training Configuration</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Algorithm</span>
                    <span className="text-white">{selectedAlgorithm.toUpperCase()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Dataset</span>
                    <span className="text-white">{selectedDataset.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Optimizer</span>
                    <span className="text-white">{optimizer.toUpperCase()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Learning Rate</span>
                    <span className="text-white">{learningRate}</span>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="datasets" className="mt-4 md:mt-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {BUILTIN_DATASETS.map((dataset) => (
              <Card
                key={dataset.id}
                variant="neumorph-hover"
                className={`p-4 cursor-pointer transition-all ${
                  selectedDataset.id === dataset.id ? 'ring-2 ring-purple-500' : ''
                }`}
                onClick={() => setSelectedDataset(dataset)}
              >
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-3xl">{dataset.icon}</span>
                  <div>
                    <h3 className="font-semibold text-white text-sm">{dataset.name}</h3>
                    <p className="text-xs text-slate-400">{dataset.classes} classes</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center mb-3">
                  <div className="p-2 rounded bg-neumorph-base shadow-neumorph-xs border border-white/[0.02]">
                    <div className="text-sm font-bold text-white">{dataset.samples}</div>
                    <div className="text-xs text-slate-400">Samples</div>
                  </div>
                  <div className="p-2 rounded bg-neumorph-base shadow-neumorph-xs border border-white/[0.02]">
                    <div className="text-sm font-bold text-white">{dataset.features}</div>
                    <div className="text-xs text-slate-400">Features</div>
                  </div>
                  <div className="p-2 rounded bg-neumorph-base shadow-neumorph-xs border border-white/[0.02]">
                    <div className="text-sm font-bold text-white">{dataset.classes}</div>
                    <div className="text-xs text-slate-400">Classes</div>
                  </div>
                </div>
                <Button
                  variant={selectedDataset.id === dataset.id ? 'primary' : 'secondary'}
                  className="w-full"
                  size="sm"
                >
                  {selectedDataset.id === dataset.id ? 'Selected' : 'Select'}
                </Button>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="visualization" className="mt-4 md:mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
            <DecisionBoundary
              boundary={predictions.length > 0
                ? syntheticData.map((d, i) => ({ x: d[0], y: d[1], prediction: predictions[i] }))
                : []
              }
              dataPoints={syntheticData.map((d, i) => ({ x: d[0], y: d[1], label: syntheticLabels[i] }))}
              height={400}
            />

            <Card variant="neumorph" className="p-4">
              <h3 className="font-semibold text-white mb-4 text-sm flex items-center gap-2">
                <Target className="w-4 h-4 text-green-400" />
                Classification Results
              </h3>
              {predictions.length > 0 ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-lg bg-neumorph-base shadow-neumorph-xs border border-white/[0.02] text-center">
                      <div className="text-3xl font-bold text-green-400">
                        {((predictions.filter((p, i) => p === syntheticLabels[i]).length / predictions.length) * 100).toFixed(1)}%
                      </div>
                      <div className="text-sm text-slate-400">Accuracy</div>
                    </div>
                    <div className="p-4 rounded-lg bg-neumorph-base shadow-neumorph-xs border border-white/[0.02] text-center">
                      <div className="text-3xl font-bold text-blue-400">
                        {predictions.length}
                      </div>
                      <div className="text-sm text-slate-400">Predictions</div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h4 className="text-sm text-slate-400">Confusion Matrix</h4>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="p-3 rounded bg-green-500/20 text-center">
                        <div className="text-lg font-bold text-green-400">
                          {predictions.filter((p, i) => p === 0 && syntheticLabels[i] === 0).length}
                        </div>
                        <div className="text-xs text-slate-400">True Neg</div>
                      </div>
                      <div className="p-3 rounded bg-red-500/20 text-center">
                        <div className="text-lg font-bold text-red-400">
                          {predictions.filter((p, i) => p === 1 && syntheticLabels[i] === 0).length}
                        </div>
                        <div className="text-xs text-slate-400">False Pos</div>
                      </div>
                      <div className="p-3 rounded bg-red-500/20 text-center">
                        <div className="text-lg font-bold text-red-400">
                          {predictions.filter((p, i) => p === 0 && syntheticLabels[i] === 1).length}
                        </div>
                        <div className="text-xs text-slate-400">False Neg</div>
                      </div>
                      <div className="p-3 rounded bg-green-500/20 text-center">
                        <div className="text-lg font-bold text-green-400">
                          {predictions.filter((p, i) => p === 1 && syntheticLabels[i] === 1).length}
                        </div>
                        <div className="text-xs text-slate-400">True Pos</div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                  <Cpu className="w-12 h-12 mb-3 opacity-50" />
                  <p className="text-sm">Train a model to see classification results</p>
                </div>
              )}
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
