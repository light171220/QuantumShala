import { uploadData, getUrl, remove, list } from 'aws-amplify/storage'

export async function uploadAvatar(
  userId: string,
  file: File
): Promise<{ path: string; url: string } | null> {
  try {
    if (!file.type.startsWith('image/')) {
      throw new Error('File must be an image')
    }
    
    if (file.size > 5 * 1024 * 1024) {
      throw new Error('File size must be less than 5MB')
    }
    
    const extension = file.name.split('.').pop() || 'jpg'
    const filename = `avatar.${extension}`
    const path = `avatars/${userId}/${filename}`
    
    try {
      const existing = await list({ path: `avatars/${userId}/` })
      for (const item of existing.items) {
        await remove({ path: item.path })
      }
    } catch {
    }
    
    const result = await uploadData({
      path,
      data: file,
      options: {
        contentType: file.type,
      },
    }).result
    
    const urlResult = await getUrl({ path: result.path })
    
    return {
      path: result.path,
      url: urlResult.url.toString(),
    }
  } catch (error) {
    console.error('Error uploading avatar:', error)
    return null
  }
}

export async function getAvatarUrl(userId: string): Promise<string | null> {
  try {
    const result = await list({ path: `avatars/${userId}/` })
    
    if (result.items.length > 0) {
      const urlResult = await getUrl({ path: result.items[0].path })
      return urlResult.url.toString()
    }
    
    return null
  } catch (error) {
    console.error('Error getting avatar URL:', error)
    return null
  }
}

export async function deleteAvatar(userId: string): Promise<boolean> {
  try {
    const result = await list({ path: `avatars/${userId}/` })
    
    for (const item of result.items) {
      await remove({ path: item.path })
    }
    
    return true
  } catch (error) {
    console.error('Error deleting avatar:', error)
    return false
  }
}

export async function saveNoteToStorage(
  userId: string,
  lessonId: string,
  content: string
): Promise<string | null> {
  try {
    const path = `notes/${userId}/${lessonId}.md`
    
    const result = await uploadData({
      path,
      data: content,
      options: {
        contentType: 'text/markdown',
      },
    }).result
    
    return result.path
  } catch (error) {
    console.error('Error saving note:', error)
    return null
  }
}

export async function getNoteFromStorage(
  userId: string,
  lessonId: string
): Promise<string | null> {
  try {
    const path = `notes/${userId}/${lessonId}.md`
    const urlResult = await getUrl({ path })
    
    const response = await fetch(urlResult.url.toString())
    if (response.ok) {
      return await response.text()
    }
    
    return null
  } catch {
    return null
  }
}

export async function deleteNoteFromStorage(
  userId: string,
  lessonId: string
): Promise<boolean> {
  try {
    const path = `notes/${userId}/${lessonId}.md`
    await remove({ path })
    return true
  } catch (error) {
    console.error('Error deleting note:', error)
    return false
  }
}

export async function uploadCertificatePDF(
  userId: string,
  certificateId: string,
  pdfBlob: Blob
): Promise<string | null> {
  try {
    const path = `certificates/${userId}/${certificateId}.pdf`
    
    const result = await uploadData({
      path,
      data: pdfBlob,
      options: {
        contentType: 'application/pdf',
      },
    }).result
    
    return result.path
  } catch (error) {
    console.error('Error uploading certificate PDF:', error)
    return null
  }
}

export async function getCertificatePDFUrl(
  userId: string,
  certificateId: string
): Promise<string | null> {
  try {
    const path = `certificates/${userId}/${certificateId}.pdf`
    const urlResult = await getUrl({ path })
    return urlResult.url.toString()
  } catch (error) {
    console.error('Error getting certificate PDF URL:', error)
    return null
  }
}

export async function cacheSimulationResult(
  userId: string,
  circuitId: string,
  result: Record<string, unknown>
): Promise<string | null> {
  try {
    const path = `simulations/${userId}/${circuitId}_${Date.now()}.json`
    
    const uploadResult = await uploadData({
      path,
      data: JSON.stringify(result),
      options: {
        contentType: 'application/json',
      },
    }).result
    
    return uploadResult.path
  } catch (error) {
    console.error('Error caching simulation result:', error)
    return null
  }
}

export async function getCachedSimulationResults(
  userId: string,
  circuitId: string
): Promise<Record<string, unknown>[]> {
  try {
    const result = await list({ path: `simulations/${userId}/` })
    const matching = result.items.filter(item => item.path.includes(circuitId))
    
    const results: Record<string, unknown>[] = []
    
    for (const item of matching) {
      const urlResult = await getUrl({ path: item.path })
      const response = await fetch(urlResult.url.toString())
      if (response.ok) {
        results.push(await response.json())
      }
    }
    
    return results
  } catch (error) {
    console.error('Error getting cached simulation results:', error)
    return []
  }
}

export async function uploadExportFile(
  userId: string,
  filename: string,
  content: string,
  contentType: string = 'text/plain'
): Promise<{ path: string; url: string } | null> {
  try {
    const path = `exports/${userId}/${filename}`
    
    const result = await uploadData({
      path,
      data: content,
      options: {
        contentType,
      },
    }).result
    
    const urlResult = await getUrl({ path: result.path })
    
    return {
      path: result.path,
      url: urlResult.url.toString(),
    }
  } catch (error) {
    console.error('Error uploading export file:', error)
    return null
  }
}

export async function getUserExports(userId: string): Promise<{ path: string; name: string; lastModified?: Date }[]> {
  try {
    const result = await list({ path: `exports/${userId}/` })
    
    return result.items.map(item => ({
      path: item.path,
      name: item.path.split('/').pop() || item.path,
      lastModified: item.lastModified,
    }))
  } catch (error) {
    console.error('Error getting user exports:', error)
    return []
  }
}

export async function deleteExportFile(path: string): Promise<boolean> {
  try {
    await remove({ path })
    return true
  } catch (error) {
    console.error('Error deleting export file:', error)
    return false
  }
}
