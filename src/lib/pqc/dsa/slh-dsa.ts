import { sha3_256, shake256 } from '../core/hash'
import { randomBytes } from '../core/random'

export interface SLHDSAParams {
  name: string
  n: number
  h: number
  d: number
  hPrime: number
  a: number
  k: number
  w: number
  lgW: number
  len1: number
  len2: number
  len: number
  publicKeySize: number
  secretKeySize: number
  signatureSize: number
  securityLevel: number
  isFast: boolean
}

function computeWOTSParams(n: number, w: number): { len1: number; len2: number; len: number } {
  const lgW = Math.log2(w)
  const len1 = Math.ceil((8 * n) / lgW)
  const len2 = Math.floor(Math.log2(len1 * (w - 1)) / lgW) + 1
  return { len1, len2, len: len1 + len2 }
}

const SLHDSA_128F_PARAMS = (() => {
  const n = 16, h = 66, d = 22, a = 6, k = 33, w = 16
  const { len1, len2, len } = computeWOTSParams(n, w)
  return {
    name: 'SLH-DSA-128f',
    n, h, d, hPrime: h / d, a, k, w,
    lgW: 4, len1, len2, len,
    publicKeySize: 2 * n,
    secretKeySize: 4 * n,
    signatureSize: (1 + k * (a + 1) + h + d * len) * n,
    securityLevel: 1,
    isFast: true
  }
})()

const SLHDSA_128S_PARAMS = (() => {
  const n = 16, h = 63, d = 7, a = 12, k = 14, w = 16
  const { len1, len2, len } = computeWOTSParams(n, w)
  return {
    name: 'SLH-DSA-128s',
    n, h, d, hPrime: h / d, a, k, w,
    lgW: 4, len1, len2, len,
    publicKeySize: 2 * n,
    secretKeySize: 4 * n,
    signatureSize: (1 + k * (a + 1) + h + d * len) * n,
    securityLevel: 1,
    isFast: false
  }
})()

const SLHDSA_192F_PARAMS = (() => {
  const n = 24, h = 66, d = 22, a = 8, k = 33, w = 16
  const { len1, len2, len } = computeWOTSParams(n, w)
  return {
    name: 'SLH-DSA-192f',
    n, h, d, hPrime: h / d, a, k, w,
    lgW: 4, len1, len2, len,
    publicKeySize: 2 * n,
    secretKeySize: 4 * n,
    signatureSize: (1 + k * (a + 1) + h + d * len) * n,
    securityLevel: 3,
    isFast: true
  }
})()

const SLHDSA_192S_PARAMS = (() => {
  const n = 24, h = 63, d = 7, a = 14, k = 17, w = 16
  const { len1, len2, len } = computeWOTSParams(n, w)
  return {
    name: 'SLH-DSA-192s',
    n, h, d, hPrime: h / d, a, k, w,
    lgW: 4, len1, len2, len,
    publicKeySize: 2 * n,
    secretKeySize: 4 * n,
    signatureSize: (1 + k * (a + 1) + h + d * len) * n,
    securityLevel: 3,
    isFast: false
  }
})()

const SLHDSA_256F_PARAMS = (() => {
  const n = 32, h = 68, d = 17, a = 9, k = 35, w = 16
  const { len1, len2, len } = computeWOTSParams(n, w)
  return {
    name: 'SLH-DSA-256f',
    n, h, d, hPrime: h / d, a, k, w,
    lgW: 4, len1, len2, len,
    publicKeySize: 2 * n,
    secretKeySize: 4 * n,
    signatureSize: (1 + k * (a + 1) + h + d * len) * n,
    securityLevel: 5,
    isFast: true
  }
})()

const SLHDSA_256S_PARAMS = (() => {
  const n = 32, h = 64, d = 8, a = 14, k = 22, w = 16
  const { len1, len2, len } = computeWOTSParams(n, w)
  return {
    name: 'SLH-DSA-256s',
    n, h, d, hPrime: h / d, a, k, w,
    lgW: 4, len1, len2, len,
    publicKeySize: 2 * n,
    secretKeySize: 4 * n,
    signatureSize: (1 + k * (a + 1) + h + d * len) * n,
    securityLevel: 5,
    isFast: false
  }
})()

export const SLH_DSA_128F = SLHDSA_128F_PARAMS
export const SLH_DSA_128S = SLHDSA_128S_PARAMS
export const SLH_DSA_192F = SLHDSA_192F_PARAMS
export const SLH_DSA_192S = SLHDSA_192S_PARAMS
export const SLH_DSA_256F = SLHDSA_256F_PARAMS
export const SLH_DSA_256S = SLHDSA_256S_PARAMS

export type SLHDSAVariant =
  | 'SLH-DSA-128f' | 'SLH-DSA-128s'
  | 'SLH-DSA-192f' | 'SLH-DSA-192s'
  | 'SLH-DSA-256f' | 'SLH-DSA-256s'

export interface SLHDSAKeyPair {
  publicKey: Uint8Array
  secretKey: Uint8Array
}

export interface SLHDSASignature {
  signature: Uint8Array
}

interface Address {
  layer: number
  tree: bigint
  type: number
  keypair: number
  chain: number
  hash: number
  treeHeight: number
  treeIndex: number
}

function createAddress(): Address {
  return { layer: 0, tree: 0n, type: 0, keypair: 0, chain: 0, hash: 0, treeHeight: 0, treeIndex: 0 }
}

function addressToBytes(addr: Address): Uint8Array {
  const bytes = new Uint8Array(32)
  bytes[0] = addr.layer
  const tree = addr.tree
  for (let i = 0; i < 8; i++) {
    bytes[1 + i] = Number((tree >> BigInt(56 - i * 8)) & 0xFFn)
  }
  bytes[9] = addr.type
  bytes[10] = (addr.keypair >> 24) & 0xFF
  bytes[11] = (addr.keypair >> 16) & 0xFF
  bytes[12] = (addr.keypair >> 8) & 0xFF
  bytes[13] = addr.keypair & 0xFF
  bytes[14] = (addr.chain >> 24) & 0xFF
  bytes[15] = (addr.chain >> 16) & 0xFF
  bytes[16] = (addr.chain >> 8) & 0xFF
  bytes[17] = addr.chain & 0xFF
  bytes[18] = (addr.hash >> 24) & 0xFF
  bytes[19] = (addr.hash >> 16) & 0xFF
  bytes[20] = (addr.hash >> 8) & 0xFF
  bytes[21] = addr.hash & 0xFF
  bytes[22] = addr.treeHeight
  bytes[26] = (addr.treeIndex >> 24) & 0xFF
  bytes[27] = (addr.treeIndex >> 16) & 0xFF
  bytes[28] = (addr.treeIndex >> 8) & 0xFF
  bytes[29] = addr.treeIndex & 0xFF
  return bytes
}

function Hmsg(R: Uint8Array, pkSeed: Uint8Array, pkRoot: Uint8Array, message: Uint8Array, outLen: number): Uint8Array {
  const input = new Uint8Array(R.length + pkSeed.length + pkRoot.length + message.length)
  let offset = 0
  input.set(R, offset); offset += R.length
  input.set(pkSeed, offset); offset += pkSeed.length
  input.set(pkRoot, offset); offset += pkRoot.length
  input.set(message, offset)
  return shake256(input, outLen)
}

function PRF(skSeed: Uint8Array, pkSeed: Uint8Array, addr: Address, n: number): Uint8Array {
  const addrBytes = addressToBytes(addr)
  const input = new Uint8Array(pkSeed.length + addrBytes.length + skSeed.length)
  input.set(pkSeed, 0)
  input.set(addrBytes, pkSeed.length)
  input.set(skSeed, pkSeed.length + addrBytes.length)
  return shake256(input, n)
}

function PRFmsg(skPrf: Uint8Array, optRand: Uint8Array, message: Uint8Array, n: number): Uint8Array {
  const input = new Uint8Array(skPrf.length + optRand.length + message.length)
  input.set(skPrf, 0)
  input.set(optRand, skPrf.length)
  input.set(message, skPrf.length + optRand.length)
  return shake256(input, n)
}

function F(pkSeed: Uint8Array, addr: Address, input: Uint8Array, n: number): Uint8Array {
  const addrBytes = addressToBytes(addr)
  const data = new Uint8Array(pkSeed.length + addrBytes.length + input.length)
  data.set(pkSeed, 0)
  data.set(addrBytes, pkSeed.length)
  data.set(input, pkSeed.length + addrBytes.length)
  return shake256(data, n)
}

function H(pkSeed: Uint8Array, addr: Address, left: Uint8Array, right: Uint8Array, n: number): Uint8Array {
  const addrBytes = addressToBytes(addr)
  const input = new Uint8Array(pkSeed.length + addrBytes.length + left.length + right.length)
  input.set(pkSeed, 0)
  input.set(addrBytes, pkSeed.length)
  input.set(left, pkSeed.length + addrBytes.length)
  input.set(right, pkSeed.length + addrBytes.length + left.length)
  return shake256(input, n)
}

function Tlen(pkSeed: Uint8Array, addr: Address, inputs: Uint8Array[], n: number): Uint8Array {
  const addrBytes = addressToBytes(addr)
  let totalLen = pkSeed.length + addrBytes.length
  for (const inp of inputs) totalLen += inp.length
  const data = new Uint8Array(totalLen)
  let offset = 0
  data.set(pkSeed, offset); offset += pkSeed.length
  data.set(addrBytes, offset); offset += addrBytes.length
  for (const inp of inputs) {
    data.set(inp, offset)
    offset += inp.length
  }
  return shake256(data, n)
}

function wotsChain(X: Uint8Array, start: number, steps: number, pkSeed: Uint8Array, addr: Address, n: number): Uint8Array {
  let current: Uint8Array = Uint8Array.from(X)
  for (let i = start; i < start + steps && i < 16; i++) {
    addr.hash = i
    current = F(pkSeed, addr, current, n) as Uint8Array
  }
  return current
}

function wotsPkGen(skSeed: Uint8Array, pkSeed: Uint8Array, addr: Address, params: SLHDSAParams): Uint8Array {
  const { n, len, w } = params
  const pk: Uint8Array[] = []
  for (let i = 0; i < len; i++) {
    addr.chain = i
    const sk = PRF(skSeed, pkSeed, addr, n)
    const pkI = wotsChain(sk, 0, w - 1, pkSeed, addr, n)
    pk.push(pkI)
  }
  addr.type = 1
  return Tlen(pkSeed, addr, pk, n)
}

function wotsSign(msg: Uint8Array, skSeed: Uint8Array, pkSeed: Uint8Array, addr: Address, params: SLHDSAParams): Uint8Array[] {
  const { n, len, len1, len2, w, lgW } = params
  const msgBaseW: number[] = []
  let csum = 0
  for (let i = 0; i < len1; i++) {
    const byteIdx = Math.floor(i * lgW / 8)
    const bitIdx = (i * lgW) % 8
    let digit = 0
    if (byteIdx < msg.length) {
      digit = (msg[byteIdx] >> bitIdx) & (w - 1)
    }
    msgBaseW.push(digit)
    csum += w - 1 - digit
  }
  csum = csum << (8 - ((len2 * lgW) % 8))
  for (let i = 0; i < len2; i++) {
    const shift = ((len2 - 1 - i) * lgW) % 8
    const digit = (csum >> shift) & (w - 1)
    msgBaseW.push(digit)
  }
  const sig: Uint8Array[] = []
  for (let i = 0; i < len; i++) {
    addr.chain = i
    const sk = PRF(skSeed, pkSeed, addr, n)
    const sigI = wotsChain(sk, 0, msgBaseW[i], pkSeed, addr, n)
    sig.push(sigI)
  }
  return sig
}

function wotsPkFromSig(sig: Uint8Array[], msg: Uint8Array, pkSeed: Uint8Array, addr: Address, params: SLHDSAParams): Uint8Array {
  const { n, len, len1, len2, w, lgW } = params
  const msgBaseW: number[] = []
  let csum = 0
  for (let i = 0; i < len1; i++) {
    const byteIdx = Math.floor(i * lgW / 8)
    const bitIdx = (i * lgW) % 8
    let digit = 0
    if (byteIdx < msg.length) {
      digit = (msg[byteIdx] >> bitIdx) & (w - 1)
    }
    msgBaseW.push(digit)
    csum += w - 1 - digit
  }
  csum = csum << (8 - ((len2 * lgW) % 8))
  for (let i = 0; i < len2; i++) {
    const shift = ((len2 - 1 - i) * lgW) % 8
    const digit = (csum >> shift) & (w - 1)
    msgBaseW.push(digit)
  }
  const pk: Uint8Array[] = []
  for (let i = 0; i < len; i++) {
    addr.chain = i
    const pkI = wotsChain(sig[i], msgBaseW[i], w - 1 - msgBaseW[i], pkSeed, addr, n)
    pk.push(pkI)
  }
  addr.type = 1
  return Tlen(pkSeed, addr, pk, n)
}

function forsSkGen(skSeed: Uint8Array, pkSeed: Uint8Array, addr: Address, idx: number, n: number): Uint8Array {
  addr.treeHeight = 0
  addr.treeIndex = idx
  return PRF(skSeed, pkSeed, addr, n)
}

function forsTreeHash(skSeed: Uint8Array, pkSeed: Uint8Array, addr: Address, startIdx: number, targetHeight: number, params: SLHDSAParams): Uint8Array {
  const { n } = params
  if (targetHeight === 0) {
    const sk = forsSkGen(skSeed, pkSeed, addr, startIdx, n)
    addr.treeHeight = 0
    addr.treeIndex = startIdx
    return F(pkSeed, addr, sk, n)
  }
  const left = forsTreeHash(skSeed, pkSeed, addr, startIdx, targetHeight - 1, params)
  const right = forsTreeHash(skSeed, pkSeed, addr, startIdx + (1 << (targetHeight - 1)), targetHeight - 1, params)
  addr.treeHeight = targetHeight
  addr.treeIndex = startIdx >> targetHeight
  return H(pkSeed, addr, left, right, n)
}

function forsSign(md: Uint8Array, skSeed: Uint8Array, pkSeed: Uint8Array, addr: Address, params: SLHDSAParams): { sig: Uint8Array; roots: Uint8Array[] } {
  const { n, a, k } = params
  const sigParts: Uint8Array[] = []
  const roots: Uint8Array[] = []
  for (let i = 0; i < k; i++) {
    const bitStart = i * a
    const byteStart = Math.floor(bitStart / 8)
    const bitOffset = bitStart % 8
    let idx = 0
    for (let b = 0; b < a; b++) {
      const byteIdx = byteStart + Math.floor((bitOffset + b) / 8)
      if (byteIdx < md.length) {
        const bit = (md[byteIdx] >> ((bitOffset + b) % 8)) & 1
        idx |= (bit << b)
      }
    }
    idx = idx % (1 << a)
    addr.keypair = i
    const sk = forsSkGen(skSeed, pkSeed, addr, idx, n)
    sigParts.push(sk)
    for (let j = 0; j < a; j++) {
      const siblingIdx = (idx >> j) ^ 1
      const siblingStart = siblingIdx << j
      const node = forsTreeHash(skSeed, pkSeed, addr, siblingStart, j, params)
      sigParts.push(node)
    }
    roots.push(forsTreeHash(skSeed, pkSeed, addr, 0, a, params))
  }
  const totalLen = sigParts.reduce((sum, p) => sum + p.length, 0)
  const sig = new Uint8Array(totalLen)
  let offset = 0
  for (const part of sigParts) {
    sig.set(part, offset)
    offset += part.length
  }
  return { sig, roots }
}

function forsPkFromSig(sig: Uint8Array, md: Uint8Array, pkSeed: Uint8Array, addr: Address, params: SLHDSAParams): Uint8Array {
  const { n, a, k } = params
  const roots: Uint8Array[] = []
  let sigOffset = 0
  for (let i = 0; i < k; i++) {
    const bitStart = i * a
    const byteStart = Math.floor(bitStart / 8)
    const bitOffset = bitStart % 8
    let idx = 0
    for (let b = 0; b < a; b++) {
      const byteIdx = byteStart + Math.floor((bitOffset + b) / 8)
      if (byteIdx < md.length) {
        const bit = (md[byteIdx] >> ((bitOffset + b) % 8)) & 1
        idx |= (bit << b)
      }
    }
    idx = idx % (1 << a)
    addr.keypair = i
    const sk = sig.slice(sigOffset, sigOffset + n)
    sigOffset += n
    addr.treeHeight = 0
    addr.treeIndex = idx
    let node = F(pkSeed, addr, sk, n)
    for (let j = 0; j < a; j++) {
      const authNode = sig.slice(sigOffset, sigOffset + n)
      sigOffset += n
      addr.treeHeight = j + 1
      addr.treeIndex = idx >> (j + 1)
      if (((idx >> j) & 1) === 0) {
        node = H(pkSeed, addr, node, authNode, n)
      } else {
        node = H(pkSeed, addr, authNode, node, n)
      }
    }
    roots.push(node)
  }
  addr.type = 2
  return Tlen(pkSeed, addr, roots, n)
}

function xmssTreeHash(skSeed: Uint8Array, pkSeed: Uint8Array, startIdx: number, targetHeight: number, addr: Address, params: SLHDSAParams): Uint8Array {
  const { n } = params
  if (targetHeight === 0) {
    addr.keypair = startIdx
    return wotsPkGen(skSeed, pkSeed, addr, params)
  }
  const left = xmssTreeHash(skSeed, pkSeed, startIdx, targetHeight - 1, addr, params)
  const right = xmssTreeHash(skSeed, pkSeed, startIdx + (1 << (targetHeight - 1)), targetHeight - 1, addr, params)
  addr.treeHeight = targetHeight
  addr.treeIndex = startIdx >> targetHeight
  return H(pkSeed, addr, left, right, n)
}

function xmssSign(msg: Uint8Array, skSeed: Uint8Array, pkSeed: Uint8Array, idx: number, addr: Address, params: SLHDSAParams): { sig: Uint8Array[]; auth: Uint8Array[] } {
  const { n, hPrime } = params
  addr.keypair = idx
  const sig = wotsSign(msg, skSeed, pkSeed, addr, params)
  const auth: Uint8Array[] = []
  for (let j = 0; j < hPrime; j++) {
    const siblingIdx = (idx >> j) ^ 1
    const siblingStart = siblingIdx << j
    const node = xmssTreeHash(skSeed, pkSeed, siblingStart, j, addr, params)
    auth.push(node)
  }
  return { sig, auth }
}

function xmssPkFromSig(idx: number, sig: Uint8Array[], auth: Uint8Array[], msg: Uint8Array, pkSeed: Uint8Array, addr: Address, params: SLHDSAParams): Uint8Array {
  const { n, hPrime } = params
  addr.keypair = idx
  let node = wotsPkFromSig(sig, msg, pkSeed, addr, params)
  for (let j = 0; j < hPrime; j++) {
    addr.treeHeight = j + 1
    addr.treeIndex = idx >> (j + 1)
    if (((idx >> j) & 1) === 0) {
      node = H(pkSeed, addr, node, auth[j], n)
    } else {
      node = H(pkSeed, addr, auth[j], node, n)
    }
  }
  return node
}

export function slhDsaKeyGen(params: SLHDSAParams = SLH_DSA_128F): SLHDSAKeyPair {
  const { n } = params
  const skSeed = randomBytes(n)
  const skPrf = randomBytes(n)
  const pkSeed = randomBytes(n)
  const addr = createAddress()
  addr.layer = params.d - 1
  const pkRoot = xmssTreeHash(skSeed, pkSeed, 0, params.hPrime, addr, params)
  const secretKey = new Uint8Array(4 * n)
  secretKey.set(skSeed, 0)
  secretKey.set(skPrf, n)
  secretKey.set(pkSeed, 2 * n)
  secretKey.set(pkRoot, 3 * n)
  const publicKey = new Uint8Array(2 * n)
  publicKey.set(pkSeed, 0)
  publicKey.set(pkRoot, n)
  return { publicKey, secretKey }
}

export function slhDsaSign(message: Uint8Array, secretKey: Uint8Array, params: SLHDSAParams = SLH_DSA_128F): SLHDSASignature {
  const { n, h, d, hPrime, a, k } = params
  const skSeed = secretKey.slice(0, n)
  const skPrf = secretKey.slice(n, 2 * n)
  const pkSeed = secretKey.slice(2 * n, 3 * n)
  const pkRoot = secretKey.slice(3 * n, 4 * n)
  const optRand = randomBytes(n)
  const R = PRFmsg(skPrf, optRand, message, n)
  const digestLen = Math.ceil((k * a + 7 + (h - h / d) * 8) / 8)
  const digest = Hmsg(R, pkSeed, pkRoot, message, digestLen)
  const md = digest.slice(0, Math.ceil(k * a / 8))
  const idxTree = digest.slice(Math.ceil(k * a / 8))
  let treeIdx = 0n
  for (let i = 0; i < Math.min(8, idxTree.length); i++) {
    treeIdx |= BigInt(idxTree[i]) << BigInt(i * 8)
  }
  treeIdx = treeIdx % (1n << BigInt(h - h / d))
  let leafIdx = 0
  if (idxTree.length > 8) {
    for (let i = 0; i < Math.min(4, idxTree.length - 8); i++) {
      leafIdx |= idxTree[8 + i] << (i * 8)
    }
  }
  leafIdx = leafIdx % (1 << hPrime)
  const addr = createAddress()
  addr.tree = treeIdx
  addr.type = 3
  const { sig: forsSig, roots } = forsSign(md, skSeed, pkSeed, addr, params)
  addr.type = 2
  const forsPk = Tlen(pkSeed, addr, roots, n)
  const htSig: Uint8Array[] = []
  let idx = leafIdx
  let tree = treeIdx
  let msg = forsPk
  for (let layer = 0; layer < d; layer++) {
    addr.layer = layer
    addr.tree = tree
    addr.type = 0
    const { sig: wotsSig, auth } = xmssSign(msg, skSeed, pkSeed, idx, addr, params)
    for (const s of wotsSig) htSig.push(s)
    for (const a of auth) htSig.push(a)
    msg = xmssPkFromSig(idx, wotsSig, auth, msg, pkSeed, addr, params)
    idx = Number(tree % BigInt(1 << hPrime))
    tree = tree >> BigInt(hPrime)
  }
  const sigParts: Uint8Array[] = [R, forsSig, ...htSig]
  const totalLen = sigParts.reduce((sum, p) => sum + p.length, 0)
  const signature = new Uint8Array(totalLen)
  let offset = 0
  for (const part of sigParts) {
    signature.set(part, offset)
    offset += part.length
  }
  return { signature }
}

export function slhDsaVerify(message: Uint8Array, signature: Uint8Array, publicKey: Uint8Array, params: SLHDSAParams = SLH_DSA_128F): boolean {
  const { n, h, d, hPrime, a, k, len } = params
  const pkSeed = publicKey.slice(0, n)
  const pkRoot = publicKey.slice(n, 2 * n)
  let sigOffset = 0
  const R = signature.slice(sigOffset, sigOffset + n)
  sigOffset += n
  const forsLen = k * (1 + a) * n
  const forsSig = signature.slice(sigOffset, sigOffset + forsLen)
  sigOffset += forsLen
  const digestLen = Math.ceil((k * a + 7 + (h - h / d) * 8) / 8)
  const digest = Hmsg(R, pkSeed, pkRoot, message, digestLen)
  const md = digest.slice(0, Math.ceil(k * a / 8))
  const idxTree = digest.slice(Math.ceil(k * a / 8))
  let treeIdx = 0n
  for (let i = 0; i < Math.min(8, idxTree.length); i++) {
    treeIdx |= BigInt(idxTree[i]) << BigInt(i * 8)
  }
  treeIdx = treeIdx % (1n << BigInt(h - h / d))
  let leafIdx = 0
  if (idxTree.length > 8) {
    for (let i = 0; i < Math.min(4, idxTree.length - 8); i++) {
      leafIdx |= idxTree[8 + i] << (i * 8)
    }
  }
  leafIdx = leafIdx % (1 << hPrime)
  const addr = createAddress()
  addr.tree = treeIdx
  addr.type = 3
  const forsPk = forsPkFromSig(forsSig, md, pkSeed, addr, params)
  let idx = leafIdx
  let tree = treeIdx
  let node = forsPk
  for (let layer = 0; layer < d; layer++) {
    addr.layer = layer
    addr.tree = tree
    addr.type = 0
    const wotsSig: Uint8Array[] = []
    for (let i = 0; i < len; i++) {
      wotsSig.push(signature.slice(sigOffset, sigOffset + n))
      sigOffset += n
    }
    const auth: Uint8Array[] = []
    for (let i = 0; i < hPrime; i++) {
      auth.push(signature.slice(sigOffset, sigOffset + n))
      sigOffset += n
    }
    node = xmssPkFromSig(idx, wotsSig, auth, node, pkSeed, addr, params)
    idx = Number(tree % BigInt(1 << hPrime))
    tree = tree >> BigInt(hPrime)
  }
  for (let i = 0; i < n; i++) {
    if (node[i] !== pkRoot[i]) {
      return false
    }
  }
  return true
}

export class SLHDSA {
  private params: SLHDSAParams

  constructor(variant: SLHDSAVariant = 'SLH-DSA-128f') {
    switch (variant) {
      case 'SLH-DSA-128f': this.params = SLH_DSA_128F; break
      case 'SLH-DSA-128s': this.params = SLH_DSA_128S; break
      case 'SLH-DSA-192f': this.params = SLH_DSA_192F; break
      case 'SLH-DSA-192s': this.params = SLH_DSA_192S; break
      case 'SLH-DSA-256f': this.params = SLH_DSA_256F; break
      case 'SLH-DSA-256s': this.params = SLH_DSA_256S; break
      default: this.params = SLH_DSA_128F
    }
  }

  keyGen(): SLHDSAKeyPair {
    return slhDsaKeyGen(this.params)
  }

  sign(message: Uint8Array, secretKey: Uint8Array): SLHDSASignature {
    return slhDsaSign(message, secretKey, this.params)
  }

  verify(message: Uint8Array, signature: Uint8Array, publicKey: Uint8Array): boolean {
    return slhDsaVerify(message, signature, publicKey, this.params)
  }

  getParams(): SLHDSAParams {
    return { ...this.params }
  }
}
