const PUBCHEM_BASE_URL = 'https://pubchem.ncbi.nlm.nih.gov/rest/pug'

const ATOMIC_SYMBOLS: Record<number, string> = {
  1: 'H', 2: 'He', 3: 'Li', 4: 'Be', 5: 'B', 6: 'C', 7: 'N', 8: 'O', 9: 'F', 10: 'Ne',
  11: 'Na', 12: 'Mg', 13: 'Al', 14: 'Si', 15: 'P', 16: 'S', 17: 'Cl', 18: 'Ar',
  19: 'K', 20: 'Ca', 21: 'Sc', 22: 'Ti', 23: 'V', 24: 'Cr', 25: 'Mn', 26: 'Fe',
  27: 'Co', 28: 'Ni', 29: 'Cu', 30: 'Zn', 31: 'Ga', 32: 'Ge', 33: 'As', 34: 'Se',
  35: 'Br', 36: 'Kr', 37: 'Rb', 38: 'Sr', 39: 'Y', 40: 'Zr', 41: 'Nb', 42: 'Mo',
  43: 'Tc', 44: 'Ru', 45: 'Rh', 46: 'Pd', 47: 'Ag', 48: 'Cd', 49: 'In', 50: 'Sn',
  51: 'Sb', 52: 'Te', 53: 'I', 54: 'Xe', 55: 'Cs', 56: 'Ba', 57: 'La', 58: 'Ce',
  59: 'Pr', 60: 'Nd', 61: 'Pm', 62: 'Sm', 63: 'Eu', 64: 'Gd', 65: 'Tb', 66: 'Dy',
  67: 'Ho', 68: 'Er', 69: 'Tm', 70: 'Yb', 71: 'Lu', 72: 'Hf', 73: 'Ta', 74: 'W',
  75: 'Re', 76: 'Os', 77: 'Ir', 78: 'Pt', 79: 'Au', 80: 'Hg', 81: 'Tl', 82: 'Pb',
  83: 'Bi', 84: 'Po', 85: 'At', 86: 'Rn', 87: 'Fr', 88: 'Ra', 89: 'Ac', 90: 'Th',
  91: 'Pa', 92: 'U', 93: 'Np', 94: 'Pu'
}

const VALENCE_ELECTRONS: Record<string, number> = {
  H: 1, He: 2, Li: 1, Be: 2, B: 3, C: 4, N: 5, O: 6, F: 7, Ne: 8,
  Na: 1, Mg: 2, Al: 3, Si: 4, P: 5, S: 6, Cl: 7, Ar: 8,
  K: 1, Ca: 2, Fe: 8, Co: 9, Ni: 10, Cu: 11, Zn: 12,
  Br: 7, I: 7, Pt: 10, Au: 11
}

export interface PubChemMolecule {
  cid: number
  name: string
  iupacName: string
  formula: string
  smiles: string
  inchi: string
  inchiKey: string
  molecularWeight: number
  numAtoms: number
  numHeavyAtoms: number
  numElectrons: number
  charge: number
  atomPositions: {
    element: string
    x: number
    y: number
    z: number
  }[]
  bonds: {
    atom1: number
    atom2: number
    order: number
  }[]
  description?: string
  synonyms?: string[]
}

export interface PubChemSearchResult {
  cid: number
  name: string
  formula: string
  molecularWeight: number
}

interface PubChemCompound {
  id?: { id?: { cid?: number } }
  atoms?: {
    aid?: number[]
    element?: number[]
  }
  bonds?: {
    aid1?: number[]
    aid2?: number[]
    order?: number[]
  }
  coords?: Array<{
    conformers?: Array<{
      x?: number[]
      y?: number[]
      z?: number[]
    }>
  }>
  charge?: number
  props?: Array<{
    urn?: { label?: string; name?: string }
    value?: { sval?: string; fval?: number; ival?: number }
  }>
  count?: {
    heavy_atom?: number
    atom_chiral?: number
  }
}

function getPropertyValue(props: PubChemCompound['props'], label: string, name?: string): string | number | undefined {
  const prop = props?.find(p =>
    p.urn?.label === label && (!name || p.urn?.name === name)
  )
  return prop?.value?.sval ?? prop?.value?.fval ?? prop?.value?.ival
}

async function fetchMoleculeProperties(cid: number): Promise<{ molecularWeight: number; formula: string }> {
  try {
    const response = await fetch(
      `${PUBCHEM_BASE_URL}/compound/cid/${cid}/property/MolecularWeight,MolecularFormula/JSON`
    )
    if (!response.ok) return { molecularWeight: 0, formula: '' }
    const data = await response.json()
    const props = data.PropertyTable?.Properties?.[0]
    const weight = props?.MolecularWeight
    return {
      molecularWeight: typeof weight === 'number' ? weight : parseFloat(String(weight)) || 0,
      formula: props?.MolecularFormula || ''
    }
  } catch {
    return { molecularWeight: 0, formula: '' }
  }
}

function calculateElectrons(elements: string[]): number {
  const atomicNumbers: Record<string, number> = {
    H: 1, He: 2, Li: 3, Be: 4, B: 5, C: 6, N: 7, O: 8, F: 9, Ne: 10,
    Na: 11, Mg: 12, Al: 13, Si: 14, P: 15, S: 16, Cl: 17, Ar: 18,
    K: 19, Ca: 20, Fe: 26, Co: 27, Ni: 28, Cu: 29, Zn: 30,
    Br: 35, I: 53, Pt: 78, Au: 79
  }
  return elements.reduce((sum, el) => sum + (atomicNumbers[el] || 6), 0)
}

export async function fetchMoleculeByName(name: string): Promise<PubChemMolecule | null> {
  try {
    const response = await fetch(
      `${PUBCHEM_BASE_URL}/compound/name/${encodeURIComponent(name)}/record/JSON?record_type=3d`
    )

    let molecule: PubChemMolecule | null = null

    if (!response.ok) {
      if (response.status === 404) {
        const response2d = await fetch(
          `${PUBCHEM_BASE_URL}/compound/name/${encodeURIComponent(name)}/JSON`
        )
        if (!response2d.ok) return null
        const data2d = await response2d.json()
        molecule = transformPubChemData(data2d.PC_Compounds?.[0], name)
      } else {
        return null
      }
    } else {
      const data = await response.json()
      molecule = transformPubChemData(data.PC_Compounds?.[0], name)
    }

    if (molecule && (!molecule.molecularWeight || molecule.molecularWeight === 0 || !molecule.formula)) {
      const props = await fetchMoleculeProperties(molecule.cid)
      if (!molecule.molecularWeight || molecule.molecularWeight === 0) {
        molecule.molecularWeight = props.molecularWeight
      }
      if (!molecule.formula) {
        molecule.formula = props.formula
      }
    }

    return molecule
  } catch (error) {
    console.error('PubChem fetch error:', error)
    return null
  }
}

export async function fetchMoleculeByCID(cid: number): Promise<PubChemMolecule | null> {
  try {
    const response = await fetch(
      `${PUBCHEM_BASE_URL}/compound/cid/${cid}/record/JSON?record_type=3d`
    )

    let molecule: PubChemMolecule | null = null

    if (!response.ok) {
      const response2d = await fetch(
        `${PUBCHEM_BASE_URL}/compound/cid/${cid}/JSON`
      )
      if (!response2d.ok) return null
      const data2d = await response2d.json()
      molecule = transformPubChemData(data2d.PC_Compounds?.[0])
    } else {
      const data = await response.json()
      molecule = transformPubChemData(data.PC_Compounds?.[0])
    }

    if (molecule && (!molecule.molecularWeight || molecule.molecularWeight === 0 || !molecule.formula)) {
      const props = await fetchMoleculeProperties(molecule.cid)
      if (!molecule.molecularWeight || molecule.molecularWeight === 0) {
        molecule.molecularWeight = props.molecularWeight
      }
      if (!molecule.formula) {
        molecule.formula = props.formula
      }
    }

    return molecule
  } catch (error) {
    console.error('PubChem fetch error:', error)
    return null
  }
}

export async function fetchMoleculeBySMILES(smiles: string): Promise<PubChemMolecule | null> {
  try {
    const response = await fetch(
      `${PUBCHEM_BASE_URL}/compound/smiles/${encodeURIComponent(smiles)}/record/JSON?record_type=3d`
    )

    if (!response.ok) return null

    const data = await response.json()
    const molecule = transformPubChemData(data.PC_Compounds?.[0])

    if (molecule && (!molecule.molecularWeight || molecule.molecularWeight === 0 || !molecule.formula)) {
      const props = await fetchMoleculeProperties(molecule.cid)
      if (!molecule.molecularWeight || molecule.molecularWeight === 0) {
        molecule.molecularWeight = props.molecularWeight
      }
      if (!molecule.formula) {
        molecule.formula = props.formula
      }
    }

    return molecule
  } catch (error) {
    console.error('PubChem fetch error:', error)
    return null
  }
}

export async function searchMolecules(query: string, limit = 20): Promise<PubChemSearchResult[]> {
  try {
    const response = await fetch(
      `${PUBCHEM_BASE_URL}/compound/name/${encodeURIComponent(query)}/cids/JSON?name_type=word`
    )

    if (!response.ok) return []

    const data = await response.json()
    const cids: number[] = data.IdentifierList?.CID?.slice(0, limit) || []

    if (cids.length === 0) return []

    const propsResponse = await fetch(
      `${PUBCHEM_BASE_URL}/compound/cid/${cids.join(',')}/property/MolecularFormula,MolecularWeight,IUPACName/JSON`
    )

    if (!propsResponse.ok) return []

    const propsData = await propsResponse.json()

    return propsData.PropertyTable?.Properties?.map((prop: {
      CID: number
      MolecularFormula: string
      MolecularWeight: number
      IUPACName?: string
    }) => ({
      cid: prop.CID,
      name: prop.IUPACName || `CID ${prop.CID}`,
      formula: prop.MolecularFormula,
      molecularWeight: prop.MolecularWeight
    })) || []
  } catch (error) {
    console.error('PubChem search error:', error)
    return []
  }
}

export async function getAutocompleteSuggestions(query: string): Promise<string[]> {
  try {
    const response = await fetch(
      `https://pubchem.ncbi.nlm.nih.gov/rest/autocomplete/compound/${encodeURIComponent(query)}/json?limit=10`
    )

    if (!response.ok) return []

    const data = await response.json()
    return data.dictionary_terms?.compound || []
  } catch (error) {
    console.error('Autocomplete error:', error)
    return []
  }
}

export async function fetchMoleculeDescription(cid: number): Promise<string | null> {
  try {
    const response = await fetch(
      `https://pubchem.ncbi.nlm.nih.gov/rest/pug_view/data/compound/${cid}/JSON?heading=Record+Description`
    )

    if (!response.ok) return null

    const data = await response.json()
    const sections = data.Record?.Section || []

    for (const section of sections) {
      if (section.TOCHeading === 'Names and Identifiers') {
        const recordDesc = section.Section?.find((s: { TOCHeading: string }) => s.TOCHeading === 'Record Description')
        if (recordDesc?.Information?.[0]?.Description?.String) {
          return recordDesc.Information[0].Description.String
        }
      }
    }

    return null
  } catch (error) {
    console.error('Description fetch error:', error)
    return null
  }
}

export async function fetchSynonyms(cid: number): Promise<string[]> {
  try {
    const response = await fetch(
      `${PUBCHEM_BASE_URL}/compound/cid/${cid}/synonyms/JSON`
    )

    if (!response.ok) return []

    const data = await response.json()
    return data.InformationList?.Information?.[0]?.Synonym?.slice(0, 20) || []
  } catch (error) {
    console.error('Synonyms fetch error:', error)
    return []
  }
}

function transformPubChemData(compound: PubChemCompound | undefined, searchName?: string): PubChemMolecule | null {
  if (!compound) return null

  const cid = compound.id?.id?.cid || 0
  const props = compound.props || []

  const formula = getPropertyValue(props, 'Molecular Formula') as string || ''
  const molecularWeightRaw = getPropertyValue(props, 'Molecular Weight')
  const molecularWeight = typeof molecularWeightRaw === 'number' ? molecularWeightRaw : parseFloat(String(molecularWeightRaw)) || 0
  const smiles = getPropertyValue(props, 'SMILES', 'Canonical') as string || ''
  const iupacName = getPropertyValue(props, 'IUPAC Name', 'Preferred') as string ||
                   getPropertyValue(props, 'IUPAC Name', 'Traditional') as string || ''
  const inchi = getPropertyValue(props, 'InChI', 'Standard') as string || ''
  const inchiKey = getPropertyValue(props, 'InChIKey', 'Standard') as string || ''

  const atomIds = compound.atoms?.aid || []
  const elementNumbers = compound.atoms?.element || []

  const elements = elementNumbers.map(num => ATOMIC_SYMBOLS[num] || 'X')

  const coords = compound.coords?.[0]?.conformers?.[0]
  const xCoords = coords?.x || []
  const yCoords = coords?.y || []
  const zCoords = coords?.z || []

  const atomPositions = atomIds.map((_, index) => ({
    element: elements[index] || 'X',
    x: xCoords[index] || 0,
    y: yCoords[index] || 0,
    z: zCoords[index] || 0
  }))

  const bonds = (compound.bonds?.aid1 || []).map((aid1, index) => ({
    atom1: aid1 - 1,
    atom2: (compound.bonds?.aid2?.[index] || 1) - 1,
    order: compound.bonds?.order?.[index] || 1
  }))

  const numAtoms = atomIds.length
  const numHeavyAtoms = compound.count?.heavy_atom || elements.filter(e => e !== 'H').length
  const numElectrons = calculateElectrons(elements) - (compound.charge || 0)

  return {
    cid,
    name: searchName || iupacName || `CID ${cid}`,
    iupacName,
    formula,
    smiles,
    inchi,
    inchiKey,
    molecularWeight,
    numAtoms,
    numHeavyAtoms,
    numElectrons,
    charge: compound.charge || 0,
    atomPositions,
    bonds
  }
}

export const POPULAR_MOLECULES = [
  'water', 'ethanol', 'caffeine', 'aspirin', 'glucose', 'benzene',
  'acetone', 'methane', 'ammonia', 'carbon dioxide', 'nicotine',
  'dopamine', 'serotonin', 'adrenaline', 'cholesterol', 'penicillin',
  'morphine', 'cocaine', 'lsd', 'thc', 'cbd', 'melatonin',
  'vitamin c', 'vitamin d', 'ibuprofen', 'paracetamol', 'insulin'
]

export const MOLECULE_CATEGORIES = {
  'Pharmaceuticals': ['aspirin', 'ibuprofen', 'paracetamol', 'penicillin', 'morphine', 'metformin'],
  'Neurotransmitters': ['dopamine', 'serotonin', 'adrenaline', 'acetylcholine', 'gaba', 'glutamate'],
  'Vitamins': ['vitamin c', 'vitamin d', 'vitamin e', 'vitamin b12', 'folic acid', 'biotin'],
  'Hormones': ['insulin', 'testosterone', 'estrogen', 'cortisol', 'melatonin', 'thyroxine'],
  'Simple Molecules': ['water', 'methane', 'ammonia', 'carbon dioxide', 'hydrogen peroxide', 'ozone'],
  'Organic Solvents': ['ethanol', 'acetone', 'benzene', 'toluene', 'chloroform', 'diethyl ether'],
  'Sugars': ['glucose', 'fructose', 'sucrose', 'lactose', 'maltose', 'ribose'],
  'Amino Acids': ['glycine', 'alanine', 'valine', 'leucine', 'isoleucine', 'proline']
}
