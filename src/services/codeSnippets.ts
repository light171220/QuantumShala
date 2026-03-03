import { client } from '@/lib/amplify'

export type SnippetLanguage = 'qiskit' | 'cirq' | 'pennylane' | 'openqasm' | 'python'

export interface SavedCodeSnippet {
  id: string
  name: string
  description?: string
  language: SnippetLanguage
  code: string
  isPublic: boolean
  isTemplate: boolean
  views: number
  likes: number
  forks: number
  tags: string[]
  createdAt: string
  updatedAt: string
}

export async function saveCodeSnippet(data: {
  name: string
  description?: string
  language: SnippetLanguage
  code: string
  isPublic?: boolean
  tags?: string[]
}): Promise<string | null> {
  try {
    const now = new Date().toISOString()

    const { data: snippet } = await client.models.CodeSnippet.create({
      name: data.name,
      description: data.description,
      language: data.language,
      code: data.code,
      isPublic: data.isPublic ?? false,
      isTemplate: false,
      views: 0,
      likes: 0,
      forks: 0,
      tags: data.tags || [],
      createdAt: now,
      updatedAt: now,
    })

    return (snippet as { id?: string } | null)?.id || null
  } catch (error) {
    console.error('Error saving code snippet:', error)
    return null
  }
}

export async function updateCodeSnippet(snippetId: string, updates: Partial<{
  name: string
  description: string
  language: SnippetLanguage
  code: string
  isPublic: boolean
  tags: string[]
}>): Promise<boolean> {
  try {
    const updateData: Record<string, unknown> = {
      id: snippetId,
      updatedAt: new Date().toISOString(),
    }

    if (updates.name !== undefined) updateData.name = updates.name
    if (updates.description !== undefined) updateData.description = updates.description
    if (updates.language !== undefined) updateData.language = updates.language
    if (updates.code !== undefined) updateData.code = updates.code
    if (updates.isPublic !== undefined) updateData.isPublic = updates.isPublic
    if (updates.tags !== undefined) updateData.tags = updates.tags

    await client.models.CodeSnippet.update(updateData as Parameters<typeof client.models.CodeSnippet.update>[0])
    return true
  } catch (error) {
    console.error('Error updating code snippet:', error)
    return false
  }
}

export async function deleteCodeSnippet(snippetId: string): Promise<boolean> {
  try {
    await client.models.CodeSnippet.delete({ id: snippetId })
    return true
  } catch (error) {
    console.error('Error deleting code snippet:', error)
    return false
  }
}

export async function getCodeSnippet(snippetId: string): Promise<SavedCodeSnippet | null> {
  try {
    const { data } = await client.models.CodeSnippet.get({ id: snippetId })

    if (!data) return null

    const snippetData = data as unknown as Record<string, unknown>

    return {
      id: snippetData.id as string,
      name: snippetData.name as string,
      description: (snippetData.description as string) ?? undefined,
      language: snippetData.language as SnippetLanguage,
      code: snippetData.code as string,
      isPublic: (snippetData.isPublic as boolean) || false,
      isTemplate: (snippetData.isTemplate as boolean) || false,
      views: (snippetData.views as number) || 0,
      likes: (snippetData.likes as number) || 0,
      forks: (snippetData.forks as number) || 0,
      tags: (snippetData.tags as string[]) || [],
      createdAt: snippetData.createdAt as string,
      updatedAt: snippetData.updatedAt as string,
    }
  } catch (error) {
    console.error('Error fetching code snippet:', error)
    return null
  }
}

export async function getUserCodeSnippets(limit: number = 50): Promise<SavedCodeSnippet[]> {
  try {
    const { data: snippets } = await client.models.CodeSnippet.list({
      limit,
    })

    return (snippets || []).map(s => ({
      id: s.id,
      name: s.name,
      description: s.description ?? undefined,
      language: s.language as SnippetLanguage,
      code: s.code,
      isPublic: s.isPublic || false,
      isTemplate: s.isTemplate || false,
      views: s.views || 0,
      likes: s.likes || 0,
      forks: s.forks || 0,
      tags: s.tags || [],
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    }))
  } catch (error) {
    console.error('Error fetching user code snippets:', error)
    return []
  }
}

export async function getPublicCodeSnippets(limit: number = 50): Promise<SavedCodeSnippet[]> {
  try {
    const { data: snippets } = await client.models.CodeSnippet.list({
      filter: { isPublic: { eq: true } },
      limit,
    })

    return (snippets || []).map(s => ({
      id: s.id,
      name: s.name,
      description: s.description ?? undefined,
      language: s.language as SnippetLanguage,
      code: s.code,
      isPublic: s.isPublic || false,
      isTemplate: s.isTemplate || false,
      views: s.views || 0,
      likes: s.likes || 0,
      forks: s.forks || 0,
      tags: s.tags || [],
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    }))
  } catch (error) {
    console.error('Error fetching public code snippets:', error)
    return []
  }
}

export async function getCodeSnippetsByLanguage(language: SnippetLanguage, limit: number = 50): Promise<SavedCodeSnippet[]> {
  try {
    const { data: snippets } = await client.models.CodeSnippet.listByLanguage({
      language,
    }, { limit })

    return (snippets || []).map(s => ({
      id: s.id,
      name: s.name,
      description: s.description ?? undefined,
      language: s.language as SnippetLanguage,
      code: s.code,
      isPublic: s.isPublic || false,
      isTemplate: s.isTemplate || false,
      views: s.views || 0,
      likes: s.likes || 0,
      forks: s.forks || 0,
      tags: s.tags || [],
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    }))
  } catch (error) {
    console.error('Error fetching code snippets by language:', error)
    return []
  }
}

export async function forkCodeSnippet(snippetId: string, newName: string): Promise<string | null> {
  try {
    const original = await getCodeSnippet(snippetId)
    if (!original) return null

    const now = new Date().toISOString()

    const { data } = await client.models.CodeSnippet.create({
      name: newName,
      description: `Forked from ${original.name}`,
      language: original.language,
      code: original.code,
      isPublic: false,
      isTemplate: false,
      views: 0,
      likes: 0,
      forks: 0,
      tags: original.tags,
      createdAt: now,
      updatedAt: now,
    })

    await client.models.CodeSnippet.update({
      id: snippetId,
      forks: original.forks + 1,
    })

    return (data as { id?: string } | null)?.id || null
  } catch (error) {
    console.error('Error forking code snippet:', error)
    return null
  }
}

export async function incrementSnippetViews(snippetId: string): Promise<void> {
  try {
    const { data } = await client.models.CodeSnippet.get({ id: snippetId })
    const snippet = data as { views?: number } | null
    if (snippet) {
      await client.models.CodeSnippet.update({
        id: snippetId,
        views: (snippet.views || 0) + 1,
      })
    }
  } catch (error) {
    console.error('Error incrementing snippet views:', error)
  }
}
