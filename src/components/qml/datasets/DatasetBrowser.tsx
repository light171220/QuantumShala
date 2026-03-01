import { useState } from 'react'
import { useQMLStore, type QMLDataset } from '@/stores/qmlStore'

interface DatasetBrowserProps {
  onSelect?: (dataset: QMLDataset) => void
}

const DATASET_ICONS: Record<string, string> = {
  iris: '🌸',
  moons: '🌙',
  circles: '⭕',
  xor: '⊕',
  blobs: '🫧',
  custom: '📁'
}

const DATASET_DESCRIPTIONS: Record<string, string> = {
  iris: 'Classic Iris flower dataset with 4 features, 2 classes (Setosa vs Versicolor)',
  moons: 'Two interleaving half circles - tests non-linear separation',
  circles: 'Concentric circles - tests radial separation capability',
  xor: 'XOR logical pattern - classical non-linearly separable problem',
  blobs: 'Gaussian blobs with 3 classes - tests multiclass capability'
}

export function DatasetBrowser({ onSelect }: DatasetBrowserProps) {
  const { dataset, availableDatasets, loadBuiltinDataset, uploadCustomDataset, splitDataset } = useQMLStore()
  const [showUpload, setShowUpload] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const handleSelectDataset = (datasetId: string) => {
    loadBuiltinDataset(datasetId)
    splitDataset(0.8)
    if (onSelect) {
      const selected = availableDatasets.find(d => d.id === datasetId)
      if (selected) onSelect(selected)
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      setUploadError(null)
      const text = await file.text()

      if (file.name.endsWith('.json')) {
        const data = JSON.parse(text)
        if (!data.features || !data.labels) {
          throw new Error('JSON must have "features" and "labels" arrays')
        }
        uploadCustomDataset({ features: data.features, labels: data.labels })
        splitDataset(0.8)
      } else if (file.name.endsWith('.csv')) {
        const lines = text.trim().split('\n')
        const features: number[][] = []
        const labels: number[] = []

        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(',').map(v => parseFloat(v.trim()))
          labels.push(values.pop()!)
          features.push(values)
        }

        uploadCustomDataset({ features, labels })
        splitDataset(0.8)
      } else {
        throw new Error('Unsupported file format. Use JSON or CSV.')
      }

      setShowUpload(false)
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Failed to parse file')
    }
  }

  return (
    <div className="bg-neumorph-base shadow-neumorph-xs border border-white/[0.02] rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">Datasets</h3>
        <button
          onClick={() => setShowUpload(!showUpload)}
          className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          {showUpload ? 'Cancel' : 'Upload Custom'}
        </button>
      </div>

      {showUpload && (
        <div className="mb-4 p-4 bg-neumorph-base shadow-neumorph-inset-xs rounded-lg border border-white/[0.02]">
          <p className="text-sm text-slate-300 mb-3">
            Upload a JSON or CSV file with features and labels.
          </p>
          <input
            type="file"
            accept=".json,.csv"
            onChange={handleFileUpload}
            className="block w-full text-sm text-slate-400
              file:mr-4 file:py-2 file:px-4
              file:rounded-lg file:border-0
              file:text-sm file:font-medium
              file:bg-blue-600 file:text-white
              hover:file:bg-blue-700
              cursor-pointer"
          />
          {uploadError && (
            <p className="mt-2 text-sm text-red-400">{uploadError}</p>
          )}
          <div className="mt-3 text-xs text-slate-500">
            <p>JSON format: {'{"features": [[x1,x2,...], ...], "labels": [0,1,...]}'}</p>
            <p>CSV format: x1,x2,...,label (with header row)</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {availableDatasets.map((ds) => {
          const isSelected = dataset?.id === ds.id
          return (
            <button
              key={ds.id}
              onClick={() => handleSelectDataset(ds.id)}
              className={`
                p-4 rounded-lg border text-left transition-all
                ${isSelected
                  ? 'bg-blue-600/20 border-blue-500 ring-2 ring-blue-500/50'
                  : 'bg-neumorph-base shadow-neumorph-xs border-white/[0.02] hover:shadow-neumorph-sm'
                }
              `}
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl">{DATASET_ICONS[ds.id] || '📊'}</span>
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-white truncate">{ds.name}</h4>
                  <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                    {DATASET_DESCRIPTIONS[ds.id] || ds.name}
                  </p>
                  <div className="flex gap-2 mt-2">
                    <span className="px-2 py-0.5 text-xs bg-neumorph-base shadow-neumorph-xs border border-white/[0.02] text-slate-300 rounded">
                      {ds.numFeatures} features
                    </span>
                    <span className="px-2 py-0.5 text-xs bg-neumorph-base shadow-neumorph-xs border border-white/[0.02] text-slate-300 rounded">
                      {ds.numClasses} classes
                    </span>
                  </div>
                </div>
              </div>
            </button>
          )
        })}
      </div>

      {dataset && (
        <div className="mt-4 pt-4 border-t border-white/[0.06]">
          <h4 className="text-sm font-medium text-slate-300 mb-2">Selected: {dataset.name}</h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
            <div className="p-2 bg-neumorph-base shadow-neumorph-inset-xs border border-white/[0.02] rounded-lg">
              <p className="text-lg font-bold text-blue-400">{dataset.features.length}</p>
              <p className="text-xs text-slate-400">Samples</p>
            </div>
            <div className="p-2 bg-neumorph-base shadow-neumorph-inset-xs border border-white/[0.02] rounded-lg">
              <p className="text-lg font-bold text-purple-400">{dataset.numFeatures}</p>
              <p className="text-xs text-slate-400">Features</p>
            </div>
            <div className="p-2 bg-neumorph-base shadow-neumorph-inset-xs border border-white/[0.02] rounded-lg">
              <p className="text-lg font-bold text-green-400">{dataset.trainIndices?.length || 0}</p>
              <p className="text-xs text-slate-400">Training</p>
            </div>
            <div className="p-2 bg-neumorph-base shadow-neumorph-inset-xs border border-white/[0.02] rounded-lg">
              <p className="text-lg font-bold text-amber-400">{dataset.testIndices?.length || 0}</p>
              <p className="text-xs text-slate-400">Testing</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default DatasetBrowser
