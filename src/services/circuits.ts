import { client } from '@/lib/amplify'
import { uploadData, getUrl, remove } from 'aws-amplify/storage'
import type { CircuitGate, Measurement } from '@/types/simulator'

export interface SavedCircuit {
  id: string
  name: string
  description?: string
  numQubits: number
  gates: CircuitGate[]
  measurements: Measurement[]
  isPublic: boolean
  isTemplate: boolean
  isFeatured: boolean
  views: number
  likes: number
  forks: number
  tags: string[]
  category: 'educational' | 'algorithm' | 'experiment' | 'challenge' | 'other'
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  version: number
  parentCircuitId?: string
  createdAt: string
  updatedAt: string
}

interface CircuitInput {
  numQubits: number
  gates: CircuitGate[]
  measurements: Measurement[]
}

export async function saveCircuit(circuit: CircuitInput, metadata: {
  name: string
  description?: string
  isPublic?: boolean
  tags?: string[]
  category?: SavedCircuit['category']
  difficulty?: SavedCircuit['difficulty']
}): Promise<string | null> {
  try {
    const now = new Date().toISOString()
    
    const { data } = await client.models.Circuit.create({
      name: metadata.name,
      description: metadata.description,
      numQubits: circuit.numQubits,
      gates: JSON.stringify(circuit.gates),
      measurements: JSON.stringify(circuit.measurements),
      isPublic: metadata.isPublic ?? false,
      isTemplate: false,
      isFeatured: false,
      views: 0,
      likes: 0,
      forks: 0,
      tags: metadata.tags || [],
      category: metadata.category || 'experiment',
      difficulty: metadata.difficulty || 'beginner',
      version: 1,
      createdAt: now,
      updatedAt: now,
    })
    
    return (data as { id?: string } | null)?.id || null
  } catch (error) {
    console.error('Error saving circuit:', error)
    return null
  }
}

export async function updateCircuit(circuitId: string, updates: Partial<{
  name: string
  description: string
  numQubits: number
  gates: CircuitGate[]
  measurements: Measurement[]
  isPublic: boolean
  tags: string[]
  category: SavedCircuit['category']
  difficulty: SavedCircuit['difficulty']
}>): Promise<boolean> {
  try {
    const updateData: Record<string, unknown> = {
      id: circuitId,
      updatedAt: new Date().toISOString(),
    }
    
    if (updates.name !== undefined) updateData.name = updates.name
    if (updates.description !== undefined) updateData.description = updates.description
    if (updates.numQubits !== undefined) updateData.numQubits = updates.numQubits
    if (updates.gates !== undefined) updateData.gates = JSON.stringify(updates.gates)
    if (updates.measurements !== undefined) updateData.measurements = JSON.stringify(updates.measurements)
    if (updates.isPublic !== undefined) updateData.isPublic = updates.isPublic
    if (updates.tags !== undefined) updateData.tags = updates.tags
    if (updates.category !== undefined) updateData.category = updates.category
    if (updates.difficulty !== undefined) updateData.difficulty = updates.difficulty
    
    await client.models.Circuit.update(updateData as Parameters<typeof client.models.Circuit.update>[0])
    return true
  } catch (error) {
    console.error('Error updating circuit:', error)
    return false
  }
}

export async function deleteCircuit(circuitId: string): Promise<boolean> {
  try {
    await client.models.Circuit.delete({ id: circuitId })
    return true
  } catch (error) {
    console.error('Error deleting circuit:', error)
    return false
  }
}

export async function getCircuit(circuitId: string): Promise<SavedCircuit | null> {
  try {
    const { data } = await client.models.Circuit.get({ id: circuitId })
    
    if (!data) return null
    
    const circuitData = data as unknown as Record<string, unknown>
    
    return {
      id: circuitData.id as string,
      name: circuitData.name as string,
      description: (circuitData.description as string) ?? undefined,
      numQubits: circuitData.numQubits as number,
      gates: JSON.parse((circuitData.gates as string) || '[]') as CircuitGate[],
      measurements: JSON.parse((circuitData.measurements as string) || '[]') as Measurement[],
      isPublic: (circuitData.isPublic as boolean) || false,
      isTemplate: (circuitData.isTemplate as boolean) || false,
      isFeatured: (circuitData.isFeatured as boolean) || false,
      views: (circuitData.views as number) || 0,
      likes: (circuitData.likes as number) || 0,
      forks: (circuitData.forks as number) || 0,
      tags: (circuitData.tags as string[]) || [],
      category: circuitData.category as SavedCircuit['category'],
      difficulty: circuitData.difficulty as SavedCircuit['difficulty'],
      version: (circuitData.version as number) || 1,
      parentCircuitId: (circuitData.parentCircuitId as string) ?? undefined,
      createdAt: circuitData.createdAt as string,
      updatedAt: circuitData.updatedAt as string,
    }
  } catch (error) {
    console.error('Error fetching circuit:', error)
    return null
  }
}

export async function getUserCircuits(limit: number = 50): Promise<SavedCircuit[]> {
  try {
    const { data: circuits } = await client.models.Circuit.list({
      limit,
    })
    
    return (circuits || []).map(c => ({
      id: c.id,
      name: c.name,
      description: c.description ?? undefined,
      numQubits: c.numQubits,
      gates: JSON.parse(c.gates as string) as CircuitGate[],
      measurements: JSON.parse((c.measurements as string) || '[]') as Measurement[],
      isPublic: c.isPublic || false,
      isTemplate: c.isTemplate || false,
      isFeatured: c.isFeatured || false,
      views: c.views || 0,
      likes: c.likes || 0,
      forks: c.forks || 0,
      tags: c.tags || [],
      category: c.category as SavedCircuit['category'],
      difficulty: c.difficulty as SavedCircuit['difficulty'],
      version: c.version || 1,
      parentCircuitId: c.parentCircuitId ?? undefined,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    }))
  } catch (error) {
    console.error('Error fetching user circuits:', error)
    return []
  }
}

export async function getPublicCircuits(limit: number = 50): Promise<SavedCircuit[]> {
  try {
    const { data: circuits } = await client.models.Circuit.list({
      filter: { isPublic: { eq: true } },
      limit,
    })
    
    return (circuits || []).map(c => ({
      id: c.id,
      name: c.name,
      description: c.description ?? undefined,
      numQubits: c.numQubits,
      gates: JSON.parse(c.gates as string) as CircuitGate[],
      measurements: JSON.parse((c.measurements as string) || '[]') as Measurement[],
      isPublic: c.isPublic || false,
      isTemplate: c.isTemplate || false,
      isFeatured: c.isFeatured || false,
      views: c.views || 0,
      likes: c.likes || 0,
      forks: c.forks || 0,
      tags: c.tags || [],
      category: c.category as SavedCircuit['category'],
      difficulty: c.difficulty as SavedCircuit['difficulty'],
      version: c.version || 1,
      parentCircuitId: c.parentCircuitId ?? undefined,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    }))
  } catch (error) {
    console.error('Error fetching public circuits:', error)
    return []
  }
}

export async function getTemplateCircuits(): Promise<SavedCircuit[]> {
  try {
    const { data: circuits } = await client.models.Circuit.list({
      filter: { isTemplate: { eq: true } },
    })
    
    return (circuits || []).map(c => ({
      id: c.id,
      name: c.name,
      description: c.description ?? undefined,
      numQubits: c.numQubits,
      gates: JSON.parse(c.gates as string) as CircuitGate[],
      measurements: JSON.parse((c.measurements as string) || '[]') as Measurement[],
      isPublic: c.isPublic || false,
      isTemplate: c.isTemplate || false,
      isFeatured: c.isFeatured || false,
      views: c.views || 0,
      likes: c.likes || 0,
      forks: c.forks || 0,
      tags: c.tags || [],
      category: c.category as SavedCircuit['category'],
      difficulty: c.difficulty as SavedCircuit['difficulty'],
      version: c.version || 1,
      parentCircuitId: c.parentCircuitId ?? undefined,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    }))
  } catch (error) {
    console.error('Error fetching template circuits:', error)
    return []
  }
}

export async function likeCircuit(circuitId: string): Promise<boolean> {
  try {
    const { data: existing } = await client.models.CircuitLike.list({
      filter: { circuitId: { eq: circuitId } },
    })
    
    if (existing && existing.length > 0) {
      await client.models.CircuitLike.delete({ circuitId: existing[0].circuitId, likedAt: existing[0].likedAt })
      
      const { data: circuitData1 } = await client.models.Circuit.get({ id: circuitId })
      const circuit1 = circuitData1 as { likes?: number } | null
      if (circuit1) {
        await client.models.Circuit.update({
          id: circuitId,
          likes: Math.max(0, (circuit1.likes || 0) - 1),
        })
      }

      return false
    } else {
      await client.models.CircuitLike.create({
        circuitId,
        likedAt: new Date().toISOString(),
      })

      const { data: circuitData2 } = await client.models.Circuit.get({ id: circuitId })
      const circuit2 = circuitData2 as { likes?: number } | null
      if (circuit2) {
        await client.models.Circuit.update({
          id: circuitId,
          likes: (circuit2.likes || 0) + 1,
        })
      }
      
      return true
    }
  } catch (error) {
    console.error('Error toggling circuit like:', error)
    return false
  }
}

export async function forkCircuit(circuitId: string, newName: string): Promise<string | null> {
  try {
    const original = await getCircuit(circuitId)
    if (!original) return null
    
    const now = new Date().toISOString()
    
    const { data } = await client.models.Circuit.create({
      name: newName,
      description: `Forked from ${original.name}`,
      numQubits: original.numQubits,
      gates: JSON.stringify(original.gates),
      measurements: JSON.stringify(original.measurements),
      isPublic: false,
      isTemplate: false,
      isFeatured: false,
      views: 0,
      likes: 0,
      forks: 0,
      tags: original.tags,
      category: original.category,
      difficulty: original.difficulty,
      version: 1,
      parentCircuitId: circuitId,
      createdAt: now,
      updatedAt: now,
    })
    
    await client.models.Circuit.update({
      id: circuitId,
      forks: original.forks + 1,
    })
    
    return (data as { id?: string } | null)?.id || null
  } catch (error) {
    console.error('Error forking circuit:', error)
    return null
  }
}

export async function incrementCircuitViews(circuitId: string): Promise<void> {
  try {
    const { data } = await client.models.Circuit.get({ id: circuitId })
    const circuit = data as { views?: number } | null
    if (circuit) {
      await client.models.Circuit.update({
        id: circuitId,
        views: (circuit.views || 0) + 1,
      })
    }
  } catch (error) {
    console.error('Error incrementing circuit views:', error)
  }
}

export interface SimulationRunRecord {
  id: string
  circuitId: string
  shots: number
  backend: 'browser' | 'cloud' | 'ibm' | 'aws_braket'
  optimization: number
  status: 'pending' | 'running' | 'completed' | 'failed'
  results?: Record<string, unknown>
  counts?: Record<string, number>
  executionTimeMs?: number
  errorMessage?: string
  createdAt: string
  completedAt?: string
}

export async function saveSimulationRun(data: {
  circuitId: string
  shots: number
  backend: SimulationRunRecord['backend']
  optimization: number
  status: SimulationRunRecord['status']
  results?: Record<string, unknown>
  counts?: Record<string, number>
  executionTimeMs?: number
  errorMessage?: string
}): Promise<string | null> {
  try {
    const { data: run } = await client.models.SimulationRun.create({
      circuitId: data.circuitId,
      shots: data.shots,
      backend: data.backend,
      optimization: data.optimization,
      status: data.status,
      results: data.results ? JSON.stringify(data.results) : undefined,
      counts: data.counts ? JSON.stringify(data.counts) : undefined,
      executionTimeMs: data.executionTimeMs,
      errorMessage: data.errorMessage,
      createdAt: new Date().toISOString(),
      completedAt: data.status === 'completed' ? new Date().toISOString() : undefined,
    })
    
    return (run as { id?: string } | null)?.id || null
  } catch (error) {
    console.error('Error saving simulation run:', error)
    return null
  }
}

export async function getCircuitSimulationRuns(circuitId: string, limit: number = 10): Promise<SimulationRunRecord[]> {
  try {
    const { data: runs } = await client.models.SimulationRun.list({
      filter: { circuitId: { eq: circuitId } },
      limit,
    })
    
    return (runs || []).map(r => ({
      id: r.id,
      circuitId: r.circuitId,
      shots: r.shots,
      backend: r.backend as SimulationRunRecord['backend'],
      optimization: r.optimization || 1,
      status: r.status as SimulationRunRecord['status'],
      results: r.results ? JSON.parse(r.results as string) : undefined,
      counts: r.counts ? JSON.parse(r.counts as string) : undefined,
      executionTimeMs: r.executionTimeMs ?? undefined,
      errorMessage: r.errorMessage ?? undefined,
      createdAt: r.createdAt,
      completedAt: r.completedAt ?? undefined,
    }))
  } catch (error) {
    console.error('Error fetching simulation runs:', error)
    return []
  }
}

export async function exportCircuitToStorage(
  circuitId: string,
  format: 'qasm' | 'qiskit' | 'cirq' | 'json',
  content: string
): Promise<string | null> {
  try {
    const filename = `circuits/${circuitId}/${circuitId}.${format === 'qiskit' ? 'py' : format}`
    
    const result = await uploadData({
      path: `exports/${filename}`,
      data: content,
      options: {
        contentType: format === 'json' ? 'application/json' : 'text/plain',
      },
    }).result
    
    return result.path
  } catch (error) {
    console.error('Error exporting circuit to storage:', error)
    return null
  }
}

export async function getExportUrl(path: string): Promise<string | null> {
  try {
    const result = await getUrl({ path })
    return result.url.toString()
  } catch (error) {
    console.error('Error getting export URL:', error)
    return null
  }
}

export async function deleteExport(path: string): Promise<boolean> {
  try {
    await remove({ path })
    return true
  } catch (error) {
    console.error('Error deleting export:', error)
    return false
  }
}
