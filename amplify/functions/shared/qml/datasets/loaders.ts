import type { Dataset } from '../types'

const BUILTIN_DATASETS: Record<string, Dataset> = {
  iris: {
    id: 'iris',
    name: 'Iris',
    description: 'Classic iris flower classification dataset',
    numFeatures: 4,
    numClasses: 3,
    numSamples: 150,
    X: [],
    y: [],
  },
  moons: {
    id: 'moons',
    name: 'Moons',
    description: 'Two interleaving half circles',
    numFeatures: 2,
    numClasses: 2,
    numSamples: 200,
    X: [],
    y: [],
  },
  circles: {
    id: 'circles',
    name: 'Circles',
    description: 'Two concentric circles',
    numFeatures: 2,
    numClasses: 2,
    numSamples: 200,
    X: [],
    y: [],
  },
  xor: {
    id: 'xor',
    name: 'XOR',
    description: 'XOR classification problem',
    numFeatures: 2,
    numClasses: 2,
    numSamples: 200,
    X: [],
    y: [],
  },
  blobs: {
    id: 'blobs',
    name: 'Blobs',
    description: 'Gaussian blobs for clustering',
    numFeatures: 2,
    numClasses: 3,
    numSamples: 300,
    X: [],
    y: [],
  },
  spirals: {
    id: 'spirals',
    name: 'Spirals',
    description: 'Interleaved spirals',
    numFeatures: 2,
    numClasses: 2,
    numSamples: 200,
    X: [],
    y: [],
  },
}

export class DatasetLoader {
  async load(datasetId: string): Promise<Dataset> {
    if (datasetId in BUILTIN_DATASETS) {
      return this.generateBuiltinDataset(datasetId)
    }
    throw new Error(`Unknown dataset: ${datasetId}`)
  }

  private generateBuiltinDataset(datasetId: string): Dataset {
    const template = BUILTIN_DATASETS[datasetId]

    switch (datasetId) {
      case 'iris':
        return this.generateIris()
      case 'moons':
        return this.generateMoons(template.numSamples)
      case 'circles':
        return this.generateCircles(template.numSamples)
      case 'xor':
        return this.generateXOR(template.numSamples)
      case 'blobs':
        return this.generateBlobs(template.numSamples)
      case 'spirals':
        return this.generateSpirals(template.numSamples)
      default:
        throw new Error(`Unknown dataset: ${datasetId}`)
    }
  }

  private generateIris(): Dataset {
    const X: number[][] = []
    const y: number[] = []

    for (let i = 0; i < 50; i++) {
      X.push([
        5.0 + Math.random() * 0.8 - 0.4,
        3.4 + Math.random() * 0.6 - 0.3,
        1.5 + Math.random() * 0.4 - 0.2,
        0.2 + Math.random() * 0.2 - 0.1,
      ])
      y.push(0)
    }

    for (let i = 0; i < 50; i++) {
      X.push([
        6.0 + Math.random() * 1.0 - 0.5,
        2.8 + Math.random() * 0.6 - 0.3,
        4.5 + Math.random() * 0.8 - 0.4,
        1.4 + Math.random() * 0.4 - 0.2,
      ])
      y.push(1)
    }

    for (let i = 0; i < 50; i++) {
      X.push([
        6.5 + Math.random() * 1.0 - 0.5,
        3.0 + Math.random() * 0.6 - 0.3,
        5.5 + Math.random() * 0.8 - 0.4,
        2.0 + Math.random() * 0.4 - 0.2,
      ])
      y.push(2)
    }

    return {
      id: 'iris',
      name: 'Iris',
      description: 'Classic iris flower classification dataset',
      numFeatures: 4,
      numClasses: 3,
      numSamples: 150,
      X,
      y,
    }
  }

  private generateMoons(numSamples: number): Dataset {
    const X: number[][] = []
    const y: number[] = []
    const samplesPerClass = Math.floor(numSamples / 2)

    for (let i = 0; i < samplesPerClass; i++) {
      const angle = (Math.PI * i) / samplesPerClass
      X.push([
        Math.cos(angle) + 0.1 * (Math.random() - 0.5),
        Math.sin(angle) + 0.1 * (Math.random() - 0.5),
      ])
      y.push(0)
    }

    for (let i = 0; i < samplesPerClass; i++) {
      const angle = (Math.PI * i) / samplesPerClass
      X.push([
        1 - Math.cos(angle) + 0.1 * (Math.random() - 0.5),
        0.5 - Math.sin(angle) + 0.1 * (Math.random() - 0.5),
      ])
      y.push(1)
    }

    return {
      id: 'moons',
      name: 'Moons',
      description: 'Two interleaving half circles',
      numFeatures: 2,
      numClasses: 2,
      numSamples,
      X,
      y,
    }
  }

  private generateCircles(numSamples: number): Dataset {
    const X: number[][] = []
    const y: number[] = []
    const samplesPerClass = Math.floor(numSamples / 2)

    for (let i = 0; i < samplesPerClass; i++) {
      const angle = (2 * Math.PI * i) / samplesPerClass
      const r = 0.3 + 0.05 * (Math.random() - 0.5)
      X.push([r * Math.cos(angle), r * Math.sin(angle)])
      y.push(0)
    }

    for (let i = 0; i < samplesPerClass; i++) {
      const angle = (2 * Math.PI * i) / samplesPerClass
      const r = 0.7 + 0.05 * (Math.random() - 0.5)
      X.push([r * Math.cos(angle), r * Math.sin(angle)])
      y.push(1)
    }

    return {
      id: 'circles',
      name: 'Circles',
      description: 'Two concentric circles',
      numFeatures: 2,
      numClasses: 2,
      numSamples,
      X,
      y,
    }
  }

  private generateXOR(numSamples: number): Dataset {
    const X: number[][] = []
    const y: number[] = []
    const samplesPerQuadrant = Math.floor(numSamples / 4)

    const quadrants = [
      { center: [-0.5, -0.5], label: 0 },
      { center: [0.5, 0.5], label: 0 },
      { center: [-0.5, 0.5], label: 1 },
      { center: [0.5, -0.5], label: 1 },
    ]

    for (const q of quadrants) {
      for (let i = 0; i < samplesPerQuadrant; i++) {
        X.push([
          q.center[0] + 0.3 * (Math.random() - 0.5),
          q.center[1] + 0.3 * (Math.random() - 0.5),
        ])
        y.push(q.label)
      }
    }

    return {
      id: 'xor',
      name: 'XOR',
      description: 'XOR classification problem',
      numFeatures: 2,
      numClasses: 2,
      numSamples,
      X,
      y,
    }
  }

  private generateBlobs(numSamples: number): Dataset {
    const X: number[][] = []
    const y: number[] = []
    const samplesPerClass = Math.floor(numSamples / 3)

    const centers = [
      [-1, -1],
      [1, -1],
      [0, 1],
    ]

    for (let c = 0; c < 3; c++) {
      for (let i = 0; i < samplesPerClass; i++) {
        X.push([
          centers[c][0] + 0.4 * (Math.random() - 0.5),
          centers[c][1] + 0.4 * (Math.random() - 0.5),
        ])
        y.push(c)
      }
    }

    return {
      id: 'blobs',
      name: 'Blobs',
      description: 'Gaussian blobs for clustering',
      numFeatures: 2,
      numClasses: 3,
      numSamples,
      X,
      y,
    }
  }

  private generateSpirals(numSamples: number): Dataset {
    const X: number[][] = []
    const y: number[] = []
    const samplesPerClass = Math.floor(numSamples / 2)

    for (let i = 0; i < samplesPerClass; i++) {
      const t = (4 * Math.PI * i) / samplesPerClass
      const r = t / (4 * Math.PI)
      X.push([
        r * Math.cos(t) + 0.05 * (Math.random() - 0.5),
        r * Math.sin(t) + 0.05 * (Math.random() - 0.5),
      ])
      y.push(0)
    }

    for (let i = 0; i < samplesPerClass; i++) {
      const t = (4 * Math.PI * i) / samplesPerClass + Math.PI
      const r = t / (4 * Math.PI) - 0.25
      X.push([
        r * Math.cos(t) + 0.05 * (Math.random() - 0.5),
        r * Math.sin(t) + 0.05 * (Math.random() - 0.5),
      ])
      y.push(1)
    }

    return {
      id: 'spirals',
      name: 'Spirals',
      description: 'Interleaved spirals',
      numFeatures: 2,
      numClasses: 2,
      numSamples,
      X,
      y,
    }
  }
}

export async function loadDataset(datasetId: string): Promise<Dataset> {
  const loader = new DatasetLoader()
  return loader.load(datasetId)
}

export function getAvailableDatasets(): { id: string; name: string; description: string }[] {
  return Object.values(BUILTIN_DATASETS).map(d => ({
    id: d.id,
    name: d.name,
    description: d.description,
  }))
}
