export {
  mod,
  modAdd,
  modSub,
  modMul,
  modPow,
  modInverse,
  extendedGCD,
  bitReverse,
  findPrimitiveRoot,
  computeNTTRoots,
  computeInvNTTRoots,
  Polynomial,
  PolyMatrix,
  ntt,
  invNtt,
  KYBER_N,
  KYBER_Q,
  DILITHIUM_N,
  DILITHIUM_Q,
  kyberMath
} from './core/math'

export {
  sha3_256,
  sha3_512,
  shake128,
  shake256,
  hmacSha3_256,
  kdf,
  prf,
  hashWithDomain,
  hexToBytes,
  bytesToHex,
  concatBytes,
  pqcHash
} from './core/hash'

export {
  randomBytes,
  randomUint32,
  randomRange,
  randomSmallPoly,
  sampleCBD,
  sampleUniform,
  sampleTernary,
  shuffleArray,
  randomBits,
  constantTimeCompare,
  constantTimeSelect,
  zeroize,
  DeterministicRNG,
  pqcRandom
} from './core/random'

export {
  MLKEM,
  mlKemKeyGen,
  mlKemEncaps,
  mlKemDecaps,
  ML_KEM_512,
  ML_KEM_768,
  ML_KEM_1024,
  type MLKEMParams,
  type MLKEMKeyPair,
  type MLKEMEncapsulation
} from './kem/ml-kem'

export {
  MLDSA,
  mlDsaKeyGen,
  mlDsaSign,
  mlDsaVerify,
  ML_DSA_44,
  ML_DSA_65,
  ML_DSA_87,
  type MLDSAParams,
  type MLDSAKeyPair,
  type MLDSASignature
} from './dsa/ml-dsa'

export {
  ShorSimulator,
  getRSARecommendations,
  getECCRecommendations,
  type ShorStep,
  type ShorResourceEstimate,
  type ShorSimulationResult
} from './attacks/shor-simulator'

export {
  GroverSimulator,
  getSymmetricCryptoRecommendations,
  getGroverSpeedupData,
  getAmplitudeAmplificationExplanation,
  type GroverStep,
  type GroverResourceEstimate,
  type GroverSimulationResult
} from './attacks/grover-simulator'
