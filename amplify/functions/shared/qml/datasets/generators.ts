import type { Dataset } from '../types'

export class DatasetGenerator {
  generateMoons(numSamples: number = 200, noise: number = 0.1): Dataset {
    return generateMoons(numSamples, noise)
  }

  generateCircles(numSamples: number = 200, noise: number = 0.05, factor: number = 0.5): Dataset {
    return generateCircles(numSamples, noise, factor)
  }

  generateBlobs(numSamples: number = 300, numClasses: number = 3, clusterStd: number = 0.4): Dataset {
    return generateBlobs(numSamples, numClasses, clusterStd)
  }

  generateXOR(numSamples: number = 200, noise: number = 0.15): Dataset {
    return generateXOR(numSamples, noise)
  }

  generateSpirals(numSamples: number = 200, noise: number = 0.05): Dataset {
    return generateSpirals(numSamples, noise)
  }
}

export function generateMoons(numSamples: number = 200, noise: number = 0.1): Dataset {
  const X: number[][] = []
  const y: number[] = []
  const samplesPerClass = Math.floor(numSamples / 2)

  for (let i = 0; i < samplesPerClass; i++) {
    const angle = (Math.PI * i) / samplesPerClass
    X.push([
      Math.cos(angle) + noise * gaussianRandom(),
      Math.sin(angle) + noise * gaussianRandom(),
    ])
    y.push(0)
  }

  for (let i = 0; i < samplesPerClass; i++) {
    const angle = (Math.PI * i) / samplesPerClass
    X.push([
      1 - Math.cos(angle) + noise * gaussianRandom(),
      0.5 - Math.sin(angle) + noise * gaussianRandom(),
    ])
    y.push(1)
  }

  return {
    id: 'moons_generated',
    name: 'Moons (Generated)',
    description: 'Two interleaving half circles',
    numFeatures: 2,
    numClasses: 2,
    numSamples: X.length,
    X,
    y,
  }
}

export function generateCircles(
  numSamples: number = 200,
  noise: number = 0.05,
  factor: number = 0.5
): Dataset {
  const X: number[][] = []
  const y: number[] = []
  const samplesPerClass = Math.floor(numSamples / 2)

  for (let i = 0; i < samplesPerClass; i++) {
    const angle = (2 * Math.PI * i) / samplesPerClass
    const r = factor + noise * gaussianRandom()
    X.push([r * Math.cos(angle), r * Math.sin(angle)])
    y.push(0)
  }

  for (let i = 0; i < samplesPerClass; i++) {
    const angle = (2 * Math.PI * i) / samplesPerClass
    const r = 1.0 + noise * gaussianRandom()
    X.push([r * Math.cos(angle), r * Math.sin(angle)])
    y.push(1)
  }

  return {
    id: 'circles_generated',
    name: 'Circles (Generated)',
    description: 'Two concentric circles',
    numFeatures: 2,
    numClasses: 2,
    numSamples: X.length,
    X,
    y,
  }
}

export function generateBlobs(
  numSamples: number = 300,
  numClasses: number = 3,
  clusterStd: number = 0.4
): Dataset {
  const X: number[][] = []
  const y: number[] = []
  const samplesPerClass = Math.floor(numSamples / numClasses)

  const centers: number[][] = []
  for (let i = 0; i < numClasses; i++) {
    const angle = (2 * Math.PI * i) / numClasses
    centers.push([Math.cos(angle), Math.sin(angle)])
  }

  for (let c = 0; c < numClasses; c++) {
    for (let i = 0; i < samplesPerClass; i++) {
      X.push([
        centers[c][0] + clusterStd * gaussianRandom(),
        centers[c][1] + clusterStd * gaussianRandom(),
      ])
      y.push(c)
    }
  }

  return {
    id: 'blobs_generated',
    name: 'Blobs (Generated)',
    description: 'Gaussian blobs for clustering',
    numFeatures: 2,
    numClasses,
    numSamples: X.length,
    X,
    y,
  }
}

export function generateXOR(numSamples: number = 200, noise: number = 0.15): Dataset {
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
        q.center[0] + noise * gaussianRandom(),
        q.center[1] + noise * gaussianRandom(),
      ])
      y.push(q.label)
    }
  }

  return {
    id: 'xor_generated',
    name: 'XOR (Generated)',
    description: 'XOR classification problem',
    numFeatures: 2,
    numClasses: 2,
    numSamples: X.length,
    X,
    y,
  }
}

export function generateSpirals(numSamples: number = 200, noise: number = 0.05): Dataset {
  const X: number[][] = []
  const y: number[] = []
  const samplesPerClass = Math.floor(numSamples / 2)

  for (let i = 0; i < samplesPerClass; i++) {
    const t = (4 * Math.PI * i) / samplesPerClass
    const r = t / (4 * Math.PI)
    X.push([
      r * Math.cos(t) + noise * gaussianRandom(),
      r * Math.sin(t) + noise * gaussianRandom(),
    ])
    y.push(0)
  }

  for (let i = 0; i < samplesPerClass; i++) {
    const t = (4 * Math.PI * i) / samplesPerClass + Math.PI
    const r = t / (4 * Math.PI) - 0.25
    X.push([
      r * Math.cos(t) + noise * gaussianRandom(),
      r * Math.sin(t) + noise * gaussianRandom(),
    ])
    y.push(1)
  }

  return {
    id: 'spirals_generated',
    name: 'Spirals (Generated)',
    description: 'Interleaved spirals',
    numFeatures: 2,
    numClasses: 2,
    numSamples: X.length,
    X,
    y,
  }
}

function gaussianRandom(): number {
  let u = 0
  let v = 0
  while (u === 0) u = Math.random()
  while (v === 0) v = Math.random()
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v)
}
