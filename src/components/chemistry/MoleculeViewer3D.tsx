import { useRef, useMemo, useState, useEffect } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Text, Html, Environment, Float, Stars } from '@react-three/drei'
import * as THREE from 'three'
import type { MoleculeInfo, CatalystInfo, DrugMoleculeInfo, AtomPosition, ChemicalBond } from '@/lib/chemistry/molecules/types'
import { Atom as AtomIcon, GitBranch, RotateCw, Tag, Maximize2, ZoomIn, ZoomOut, RefreshCw } from 'lucide-react'

interface SimpleMolecule {
  id: string
  name: string
  formula: string
  numAtoms: number
  numElectrons: number
  atomPositions?: AtomPosition[]
  bonds?: Array<{ atom1: number; atom2: number; order: number }>
  qubitsRequired?: { sto3g: number }
  equilibriumBondLength?: number
  description?: string
}

interface MoleculeViewer3DProps {
  molecule: MoleculeInfo | CatalystInfo | DrugMoleculeInfo | SimpleMolecule | null
  viewMode?: 'ball-stick' | 'space-filling' | 'wireframe'
  showLabels?: boolean
  showBonds?: boolean
  animate?: boolean
  height?: number
}

const ELEMENT_COLORS: Record<string, string> = {
  H: '#E8E8E8',
  C: '#2D2D2D',
  N: '#4B7BEC',
  O: '#EB3B5A',
  S: '#F7B731',
  P: '#FA8231',
  F: '#26DE81',
  Cl: '#20BF6B',
  Br: '#A55EEA',
  I: '#8854D0',
  Fe: '#FC5C65',
  Pt: '#A5B1C2',
  Li: '#9B59B6',
  Be: '#2ECC71',
  Na: '#8E44AD',
  Mg: '#27AE60',
  Al: '#95A5A6',
  Si: '#E67E22',
  Ca: '#1ABC9C',
  default: '#E91E63'
}

const ELEMENT_GLOW: Record<string, string> = {
  H: '#FFFFFF',
  C: '#666666',
  N: '#6C9BFF',
  O: '#FF6B8A',
  S: '#FFD93D',
  P: '#FFB347',
  F: '#69F0AE',
  Cl: '#4DD599',
  default: '#FF69B4'
}

const ELEMENT_RADII: Record<string, number> = {
  H: 0.31,
  C: 0.77,
  N: 0.71,
  O: 0.66,
  S: 1.05,
  P: 1.07,
  F: 0.57,
  Cl: 1.02,
  Br: 1.20,
  I: 1.39,
  Fe: 1.26,
  Pt: 1.39,
  Li: 1.34,
  Be: 0.90,
  Na: 1.54,
  Mg: 1.30,
  Al: 1.18,
  Si: 1.11,
  Ca: 1.76,
  default: 0.80
}

function GlowingSphere({
  position,
  color,
  glowColor,
  radius,
  intensity = 0.5
}: {
  position: [number, number, number]
  color: string
  glowColor: string
  radius: number
  intensity?: number
}) {
  return (
    <group position={position}>
      <mesh scale={1.15}>
        <sphereGeometry args={[radius, 32, 32]} />
        <meshBasicMaterial
          color={glowColor}
          transparent
          opacity={intensity * 0.3}
          side={THREE.BackSide}
        />
      </mesh>
      <mesh scale={1.08}>
        <sphereGeometry args={[radius, 32, 32]} />
        <meshBasicMaterial
          color={glowColor}
          transparent
          opacity={intensity * 0.15}
          side={THREE.BackSide}
        />
      </mesh>
    </group>
  )
}

function Atom({
  position,
  element,
  viewMode,
  showLabel,
  index
}: {
  position: [number, number, number]
  element: string
  viewMode: 'ball-stick' | 'space-filling' | 'wireframe'
  showLabel: boolean
  index: number
}) {
  const meshRef = useRef<THREE.Mesh>(null)
  const [hovered, setHovered] = useState(false)
  const [scale, setScale] = useState(1)

  useEffect(() => {
    if (hovered) {
      setScale(1.15)
    } else {
      setScale(1)
    }
  }, [hovered])

  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.scale.lerp(new THREE.Vector3(scale, scale, scale), 0.1)
    }
  })

  const color = ELEMENT_COLORS[element] || ELEMENT_COLORS.default
  const glowColor = ELEMENT_GLOW[element] || ELEMENT_GLOW.default
  const baseRadius = ELEMENT_RADII[element] || ELEMENT_RADII.default

  const radius = useMemo(() => {
    switch (viewMode) {
      case 'space-filling':
        return baseRadius
      case 'wireframe':
        return baseRadius * 0.3
      default:
        return baseRadius * 0.45
    }
  }, [viewMode, baseRadius])

  return (
    <group position={position}>
      {viewMode !== 'wireframe' && (
        <GlowingSphere
          position={[0, 0, 0]}
          color={color}
          glowColor={glowColor}
          radius={radius}
          intensity={hovered ? 0.8 : 0.4}
        />
      )}
      <mesh
        ref={meshRef}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <sphereGeometry args={[radius, 64, 64]} />
        {viewMode === 'wireframe' ? (
          <meshBasicMaterial color={color} wireframe opacity={0.8} transparent />
        ) : (
          <meshPhysicalMaterial
            color={hovered ? '#FFD700' : color}
            metalness={0.1}
            roughness={0.2}
            clearcoat={1}
            clearcoatRoughness={0.1}
            envMapIntensity={1}
            emissive={hovered ? '#FFD700' : glowColor}
            emissiveIntensity={hovered ? 0.5 : 0.1}
          />
        )}
      </mesh>
      {showLabel && (
        <Float speed={2} rotationIntensity={0} floatIntensity={0.5}>
          <Text
            position={[0, radius + 0.4, 0]}
            fontSize={0.28}
            color="#FFFFFF"
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.02}
            outlineColor="#000000"
          >
            {element}
          </Text>
        </Float>
      )}
      {hovered && (
        <Html distanceFactor={8} zIndexRange={[100, 0]}>
          <div className="bg-gradient-to-br from-slate-900/95 to-slate-800/95 backdrop-blur-xl border border-white/10 text-white px-3 py-2 rounded-xl text-xs whitespace-nowrap shadow-2xl">
            <div className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full shadow-lg"
                style={{ backgroundColor: color, boxShadow: `0 0 8px ${glowColor}` }}
              />
              <span className="font-bold">{element}</span>
              <span className="text-slate-400">Atom {index + 1}</span>
            </div>
          </div>
        </Html>
      )}
    </group>
  )
}

function Bond({
  start,
  end,
  order,
  viewMode
}: {
  start: [number, number, number]
  end: [number, number, number]
  order: number
  viewMode: 'ball-stick' | 'space-filling' | 'wireframe'
}) {
  const { position, rotation, length } = useMemo(() => {
    const startVec = new THREE.Vector3(...start)
    const endVec = new THREE.Vector3(...end)
    const midpoint = new THREE.Vector3().addVectors(startVec, endVec).multiplyScalar(0.5)
    const direction = new THREE.Vector3().subVectors(endVec, startVec)
    const len = direction.length()
    direction.normalize()

    const quaternion = new THREE.Quaternion()
    quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction)
    const euler = new THREE.Euler().setFromQuaternion(quaternion)

    return {
      position: midpoint.toArray() as [number, number, number],
      rotation: euler.toArray().slice(0, 3) as [number, number, number],
      length: len
    }
  }, [start, end])

  if (viewMode === 'space-filling') return null

  const bondRadius = viewMode === 'wireframe' ? 0.02 : 0.06
  const bondSpacing = 0.18

  const bonds = []
  for (let i = 0; i < order; i++) {
    const offset = (i - (order - 1) / 2) * bondSpacing
    bonds.push(
      <mesh key={i} position={[offset, 0, 0]}>
        <cylinderGeometry args={[bondRadius, bondRadius, length, 16]} />
        {viewMode === 'wireframe' ? (
          <meshBasicMaterial color="#60A5FA" wireframe opacity={0.6} transparent />
        ) : (
          <meshPhysicalMaterial
            color="#94A3B8"
            metalness={0.4}
            roughness={0.3}
            clearcoat={0.5}
          />
        )}
      </mesh>
    )
  }

  return (
    <group position={position} rotation={rotation}>
      {bonds}
    </group>
  )
}

function MoleculeScene({
  molecule,
  viewMode,
  showLabels,
  showBonds,
  animate
}: {
  molecule: MoleculeInfo | CatalystInfo | DrugMoleculeInfo | SimpleMolecule
  viewMode: 'ball-stick' | 'space-filling' | 'wireframe'
  showLabels: boolean
  showBonds: boolean
  animate: boolean
}) {
  const groupRef = useRef<THREE.Group>(null)

  useFrame((state) => {
    if (animate && groupRef.current) {
      groupRef.current.rotation.y = state.clock.elapsedTime * 0.2
    }
  })

  const { center, scale } = useMemo(() => {
    if (!molecule.atomPositions || molecule.atomPositions.length === 0) {
      return { center: [0, 0, 0] as [number, number, number], scale: 1 }
    }

    const positions = molecule.atomPositions
    const minX = Math.min(...positions.map(p => p.x))
    const maxX = Math.max(...positions.map(p => p.x))
    const minY = Math.min(...positions.map(p => p.y))
    const maxY = Math.max(...positions.map(p => p.y))
    const minZ = Math.min(...positions.map(p => p.z))
    const maxZ = Math.max(...positions.map(p => p.z))

    const centerX = (minX + maxX) / 2
    const centerY = (minY + maxY) / 2
    const centerZ = (minZ + maxZ) / 2

    const size = Math.max(maxX - minX, maxY - minY, maxZ - minZ)
    const targetSize = 4
    const scaleFactor = size > 0 ? targetSize / size : 1

    return {
      center: [centerX, centerY, centerZ] as [number, number, number],
      scale: scaleFactor
    }
  }, [molecule])

  return (
    <group ref={groupRef} scale={scale}>
      <group position={[-center[0], -center[1], -center[2]]}>
        {molecule.atomPositions?.map((atom, index) => (
          <Atom
            key={index}
            position={[atom.x, atom.y, atom.z]}
            element={atom.element}
            viewMode={viewMode}
            showLabel={showLabels}
            index={index}
          />
        ))}

        {showBonds && molecule.bonds?.map((bond, index) => {
          const startAtom = molecule.atomPositions![bond.atom1]
          const endAtom = molecule.atomPositions![bond.atom2]
          if (!startAtom || !endAtom) return null
          return (
            <Bond
              key={index}
              start={[startAtom.x, startAtom.y, startAtom.z]}
              end={[endAtom.x, endAtom.y, endAtom.z]}
              order={bond.order}
              viewMode={viewMode}
            />
          )
        })}
      </group>
    </group>
  )
}

function SceneLighting() {
  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight position={[10, 10, 5]} intensity={1} color="#FFFFFF" />
      <directionalLight position={[-10, -10, -5]} intensity={0.3} color="#60A5FA" />
      <pointLight position={[0, 10, 0]} intensity={0.5} color="#F472B6" />
      <pointLight position={[0, -10, 0]} intensity={0.3} color="#34D399" />
      <spotLight
        position={[5, 5, 5]}
        angle={0.3}
        penumbra={1}
        intensity={0.5}
        color="#FFFFFF"
      />
    </>
  )
}

function CameraController({ autoRotate }: { autoRotate?: boolean }) {
  const { camera } = useThree()

  useMemo(() => {
    camera.position.set(0, 0, 10)
    camera.lookAt(0, 0, 0)
  }, [camera])

  return (
    <OrbitControls
      enablePan
      enableZoom
      enableRotate
      autoRotate={autoRotate}
      autoRotateSpeed={0.5}
      minDistance={3}
      maxDistance={30}
      enableDamping
      dampingFactor={0.05}
    />
  )
}

function ViewModeButton({
  active,
  onClick,
  icon: Icon,
  label
}: {
  active: boolean
  onClick: () => void
  icon: React.ElementType
  label: string
}) {
  return (
    <button
      onClick={onClick}
      className={`
        flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
        transition-all duration-200 ease-out
        ${active
          ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg shadow-blue-500/25'
          : 'bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10'
        }
      `}
    >
      <Icon className="w-3.5 h-3.5" />
      <span>{label}</span>
    </button>
  )
}

function ToggleButton({
  active,
  onClick,
  icon: Icon,
  label,
  activeColor = 'blue'
}: {
  active: boolean
  onClick: () => void
  icon: React.ElementType
  label: string
  activeColor?: 'blue' | 'green' | 'purple'
}) {
  const colors = {
    blue: 'from-blue-500 to-cyan-500 shadow-blue-500/25',
    green: 'from-green-500 to-emerald-500 shadow-green-500/25',
    purple: 'from-purple-500 to-pink-500 shadow-purple-500/25'
  }

  return (
    <button
      onClick={onClick}
      className={`
        flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium
        transition-all duration-200 ease-out
        ${active
          ? `bg-gradient-to-r ${colors[activeColor]} text-white shadow-lg`
          : 'bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white border border-white/10'
        }
      `}
    >
      <Icon className="w-3.5 h-3.5" />
      <span className="hidden sm:inline">{label}</span>
    </button>
  )
}

export function MoleculeViewer3D({
  molecule,
  viewMode = 'ball-stick',
  showLabels = true,
  showBonds = true,
  animate = false,
  height = 400
}: MoleculeViewer3DProps) {
  const [currentViewMode, setCurrentViewMode] = useState(viewMode)
  const [labels, setLabels] = useState(showLabels)
  const [bonds, setBonds] = useState(showBonds)
  const [rotation, setRotation] = useState(animate)
  const [isFullscreen, setIsFullscreen] = useState(false)

  if (!molecule || !molecule.atomPositions || molecule.atomPositions.length === 0) {
    return (
      <div
        className="relative flex items-center justify-center rounded-2xl overflow-hidden"
        style={{ height }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-900/20 via-transparent to-transparent" />
        <div className="relative z-10 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center border border-white/10">
            <AtomIcon className="w-8 h-8 text-blue-400" />
          </div>
          <p className="text-slate-400 text-sm">Select a molecule to view its 3D structure</p>
        </div>
      </div>
    )
  }

  return (
    <div
      className={`
        relative rounded-2xl overflow-hidden border border-white/10
        ${isFullscreen ? 'fixed inset-4 z-50' : ''}
      `}
      style={{ height: isFullscreen ? 'auto' : height }}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-[#0a0a1a] to-slate-900" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/30 via-transparent to-transparent" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,_var(--tw-gradient-stops))] from-purple-900/20 via-transparent to-transparent" />

      <div className="absolute top-0 left-0 right-0 z-10 p-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-black/40 backdrop-blur-xl rounded-xl p-1 border border-white/10">
              <ViewModeButton
                active={currentViewMode === 'ball-stick'}
                onClick={() => setCurrentViewMode('ball-stick')}
                icon={AtomIcon}
                label="Ball & Stick"
              />
              <ViewModeButton
                active={currentViewMode === 'space-filling'}
                onClick={() => setCurrentViewMode('space-filling')}
                icon={ZoomIn}
                label="Space Fill"
              />
              <ViewModeButton
                active={currentViewMode === 'wireframe'}
                onClick={() => setCurrentViewMode('wireframe')}
                icon={GitBranch}
                label="Wireframe"
              />
            </div>
          </div>

          <div className="flex items-center gap-1.5 bg-black/40 backdrop-blur-xl rounded-xl p-1 border border-white/10">
            <ToggleButton
              active={labels}
              onClick={() => setLabels(!labels)}
              icon={Tag}
              label="Labels"
              activeColor="blue"
            />
            <ToggleButton
              active={bonds}
              onClick={() => setBonds(!bonds)}
              icon={GitBranch}
              label="Bonds"
              activeColor="purple"
            />
            <ToggleButton
              active={rotation}
              onClick={() => setRotation(!rotation)}
              icon={RotateCw}
              label="Rotate"
              activeColor="green"
            />
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white border border-white/10 transition-all"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 z-10 p-3">
        <div className="bg-black/50 backdrop-blur-xl rounded-xl p-3 border border-white/10">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center border border-white/10">
                <AtomIcon className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <h3 className="text-white font-semibold text-sm">{molecule.name}</h3>
                <p className="text-slate-400 text-xs font-mono">{molecule.formula}</p>
              </div>
            </div>

            <div className="flex items-center gap-4 text-xs">
              <div className="text-center">
                <div className="text-white font-bold text-lg">{molecule.numAtoms}</div>
                <div className="text-slate-500">Atoms</div>
              </div>
              <div className="w-px h-8 bg-white/10" />
              <div className="text-center">
                <div className="text-white font-bold text-lg">{molecule.numElectrons}</div>
                <div className="text-slate-500">Electrons</div>
              </div>
              <div className="w-px h-8 bg-white/10" />
              <div className="text-center">
                <div className="text-white font-bold text-lg">{molecule.qubitsRequired?.sto3g || 'N/A'}</div>
                <div className="text-slate-500">Qubits</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute inset-0">
        <Canvas
          camera={{ position: [0, 0, 10], fov: 50 }}
          dpr={[1, 2]}
          gl={{ antialias: true, alpha: true }}
        >
          <color attach="background" args={['#000000']} />
          <fog attach="fog" args={['#0a0a1a', 15, 40]} />

          <SceneLighting />
          <CameraController autoRotate={rotation} />

          <Stars
            radius={50}
            depth={50}
            count={1000}
            factor={3}
            saturation={0.5}
            fade
            speed={0.5}
          />

          <MoleculeScene
            molecule={molecule}
            viewMode={currentViewMode}
            showLabels={labels}
            showBonds={bonds}
            animate={rotation}
          />
        </Canvas>
      </div>

      {isFullscreen && (
        <button
          onClick={() => setIsFullscreen(false)}
          className="absolute top-4 right-4 z-20 p-2 rounded-lg bg-black/50 hover:bg-black/70 text-white border border-white/10 transition-all"
        >
          <RefreshCw className="w-5 h-5" />
        </button>
      )}
    </div>
  )
}

export default MoleculeViewer3D
