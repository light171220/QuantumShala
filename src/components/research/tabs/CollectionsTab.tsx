import { useState } from 'react'
import {
  FolderOpen,
  Plus,
  Edit2,
  Trash2,
  FileText,
  MoreVertical,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { PaperCard } from '../papers/PaperCard'
import { useResearchStore } from '@/stores/researchStore'
import type { PaperCollection } from '@/types/research'

const COLLECTION_COLORS = [
  '#3B82F6', // blue
  '#8B5CF6', // purple
  '#EC4899', // pink
  '#EF4444', // red
  '#F97316', // orange
  '#EAB308', // yellow
  '#22C55E', // green
  '#06B6D4', // cyan
]

const COLLECTION_ICONS = [
  'folder', 'book', 'star', 'heart', 'bookmark', 'flag', 'tag', 'archive',
]

export function CollectionsTab() {
  const {
    papers,
    collections,
    createCollection,
    updateCollection,
    deleteCollection,
    selectPaper,
    deletePaper,
    summarizePaper,
    extractQuantumInsights,
    addPaperToCollection,
    removePaperFromCollection,
    setPaperRating,
    setPaperReadStatus,
  } = useResearchStore()

  const [selectedCollection, setSelectedCollection] = useState<PaperCollection | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingCollection, setEditingCollection] = useState<PaperCollection | null>(null)
  const [showMenu, setShowMenu] = useState<string | null>(null)

  // Form state
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [color, setColor] = useState(COLLECTION_COLORS[0])
  const [icon, setIcon] = useState(COLLECTION_ICONS[0])

  const collectionPapers = selectedCollection
    ? papers.filter(p => p.collectionIds?.includes(selectedCollection.id))
    : []

  const handleCreate = async () => {
    if (!name.trim()) return

    await createCollection({
      name: name.trim(),
      description: description.trim() || undefined,
      color,
      icon,
    })

    setShowCreateModal(false)
    resetForm()
  }

  const handleEdit = async () => {
    if (!editingCollection || !name.trim()) return

    await updateCollection(editingCollection.id, {
      name: name.trim(),
      description: description.trim() || undefined,
      color,
      icon,
    })

    setShowEditModal(false)
    setEditingCollection(null)
    resetForm()
  }

  const handleDelete = async (collectionId: string) => {
    if (confirm('Are you sure you want to delete this collection? Papers will not be deleted.')) {
      await deleteCollection(collectionId)
      if (selectedCollection?.id === collectionId) {
        setSelectedCollection(null)
      }
    }
    setShowMenu(null)
  }

  const openEditModal = (collection: PaperCollection) => {
    setEditingCollection(collection)
    setName(collection.name)
    setDescription(collection.description || '')
    setColor(collection.color)
    setIcon(collection.icon)
    setShowEditModal(true)
    setShowMenu(null)
  }

  const resetForm = () => {
    setName('')
    setDescription('')
    setColor(COLLECTION_COLORS[0])
    setIcon(COLLECTION_ICONS[0])
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-yellow-500/20 to-orange-500/20 flex items-center justify-center">
            <FolderOpen className="w-5 h-5 text-yellow-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Collections</h2>
            <p className="text-sm text-slate-400">
              Organize your papers into collections
            </p>
          </div>
        </div>

        <Button
          onClick={() => {
            resetForm()
            setShowCreateModal(true)
          }}
          leftIcon={<Plus className="w-4 h-4" />}
        >
          New Collection
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Collections list */}
        <div className="lg:col-span-1 space-y-2">
          {collections.length === 0 ? (
            <div className="text-center py-8 bg-neumorph-darker border border-white/5 rounded-xl">
              <FolderOpen className="w-10 h-10 text-slate-600 mx-auto mb-2" />
              <p className="text-sm text-slate-400">No collections yet</p>
            </div>
          ) : (
            collections.map((collection) => (
              <div
                key={collection.id}
                className={`relative bg-neumorph-darker border rounded-xl p-3 cursor-pointer transition-all ${
                  selectedCollection?.id === collection.id
                    ? 'border-blue-500/50 bg-blue-500/5'
                    : 'border-white/5 hover:border-white/10'
                }`}
                onClick={() => setSelectedCollection(collection)}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: `${collection.color}20` }}
                  >
                    <FolderOpen
                      className="w-4 h-4"
                      style={{ color: collection.color }}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white font-medium truncate">
                      {collection.name}
                    </p>
                    <p className="text-xs text-slate-400">
                      {collection.paperCount} papers
                    </p>
                  </div>
                  <div className="relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setShowMenu(showMenu === collection.id ? null : collection.id)
                      }}
                      className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>
                    {showMenu === collection.id && (
                      <div className="absolute right-0 top-full mt-1 w-32 bg-neumorph-dark border border-white/10 rounded-lg shadow-xl z-10">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            openEditModal(collection)
                          }}
                          className="w-full px-3 py-2 text-left text-sm text-slate-300 hover:bg-white/5 flex items-center gap-2"
                        >
                          <Edit2 className="w-3 h-3" />
                          Edit
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDelete(collection.id)
                          }}
                          className="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-red-500/10 flex items-center gap-2"
                        >
                          <Trash2 className="w-3 h-3" />
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Collection papers */}
        <div className="lg:col-span-3">
          {selectedCollection ? (
            <div className="space-y-4">
              <div
                className="bg-neumorph-darker border border-white/5 rounded-xl p-4"
                style={{ borderLeft: `4px solid ${selectedCollection.color}` }}
              >
                <h3 className="text-white font-medium">{selectedCollection.name}</h3>
                {selectedCollection.description && (
                  <p className="text-sm text-slate-400 mt-1">
                    {selectedCollection.description}
                  </p>
                )}
                <p className="text-xs text-slate-500 mt-2">
                  {collectionPapers.length} papers in this collection
                </p>
              </div>

              {collectionPapers.length === 0 ? (
                <div className="text-center py-8 bg-neumorph-darker border border-white/5 rounded-xl">
                  <FileText className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                  <p className="text-sm text-slate-400">
                    No papers in this collection
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Add papers from your library using the menu
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {collectionPapers.map((paper) => (
                    <PaperCard
                      key={paper.id}
                      paper={paper}
                      collections={collections.filter(c => c.id !== selectedCollection.id)}
                      onSelect={selectPaper}
                      onDelete={deletePaper}
                      onSummarize={summarizePaper}
                      onExtractInsights={extractQuantumInsights}
                      onAddToCollection={async (paperId, collectionId) => {
                        await addPaperToCollection(paperId, collectionId)
                        await removePaperFromCollection(paperId, selectedCollection.id)
                      }}
                      onRatingChange={setPaperRating}
                      onReadStatusChange={setPaperReadStatus}
                      compact
                    />
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-12 bg-neumorph-darker border border-white/5 rounded-xl">
              <FolderOpen className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <h3 className="text-white font-medium mb-1">Select a Collection</h3>
              <p className="text-sm text-slate-400">
                Choose a collection to view its papers
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Create Collection Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create Collection"
        description="Organize your papers into a new collection"
        variant="neumorph"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-slate-300 mb-1.5">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-blue-500"
              placeholder="Collection name"
            />
          </div>

          <div>
            <label className="block text-sm text-slate-300 mb-1.5">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-blue-500 resize-none"
              rows={2}
              placeholder="Optional description"
            />
          </div>

          <div>
            <label className="block text-sm text-slate-300 mb-1.5">Color</label>
            <div className="flex gap-2">
              {COLLECTION_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-8 h-8 rounded-lg transition-transform ${
                    color === c ? 'scale-110 ring-2 ring-white/50' : ''
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="secondary" onClick={() => setShowCreateModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={!name.trim()}>
              Create
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit Collection Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="Edit Collection"
        variant="neumorph"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-slate-300 mb-1.5">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm text-slate-300 mb-1.5">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-blue-500 resize-none"
              rows={2}
            />
          </div>

          <div>
            <label className="block text-sm text-slate-300 mb-1.5">Color</label>
            <div className="flex gap-2">
              {COLLECTION_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-8 h-8 rounded-lg transition-transform ${
                    color === c ? 'scale-110 ring-2 ring-white/50' : ''
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="secondary" onClick={() => setShowEditModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleEdit} disabled={!name.trim()}>
              Save
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
