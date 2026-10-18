import {
  createPublicClient,
  decodeEventLog,
  fallback,
  getAddress,
  http,
  parseAbi,
  type Address,
  type Hash,
  type TransactionReceipt,
} from 'viem'
import { mainnet } from 'viem/chains'

export const CONTRACT = getAddress('0x2fc2ca1b6accec8cbe479c4eb970c67af4bdd748')
export const QUOTER = getAddress('0x52f0e24d1c21c8a0cb1e5a5dd6198556bd9e1203')
export const RPC_URLS = [
  'https://0xrpc.io/eth',
  'https://eth.merkle.io',
  'https://ethereum-rpc.publicnode.com',
] as const
export const DEPLOYMENT_BLOCK = 26213445n
export const buyerAbi = parseAbi([
  'function paused() view returns (bool)',
  'function intake() view returns (address)',
  'function action() view returns (bytes32)',
  'function IMD() view returns (address)',
  'function poolKey() pure returns ((address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks))',
  'function bodyOf(string words) pure returns (bytes)',
  'function buyWebsiteWithMinimum(string words, uint256 minSurplus, uint256 deadline) payable returns (bytes32 requestId)',
  'function requestOf(bytes32 requestId) view returns ((address buyer, uint8 state, uint8 status, address intake, uint256 price, bytes32 resultHash, bytes32 reason, string uri))',
  'event WebsiteRequested(bytes32 indexed requestId, address indexed buyer, address indexed intake, address account, uint256 ethSpent, uint256 imdReceived, uint256 price, uint256 surplus)',
  'event WebsiteResult(bytes32 indexed requestId, address indexed buyer, bytes32 resultHash, string uri)',
  'error BadWords()',
  'error EnforcedPause()',
  'error ActionNotSold()',
  'error InsufficientIMD(uint256 received, uint256 required)',
  'error SurplusTooLow(uint256 surplus, uint256 minSurplus)',
  'error Expired(uint256 deadline)',
  'error IncompleteSwap()',
  'error InvalidETHAmount()',
])
export const tokenAbi = parseAbi(['function decimals() view returns (uint8)'])
export const intakeAbi = parseAbi([
  'function priceOf(bytes32 action, address asset) view returns (uint256)',
])
export const quoterAbi = parseAbi([
  'function quoteExactInputSingle(((address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) poolKey, bool zeroForOne, uint128 exactAmount, bytes hookData) params) returns (uint256 amountOut, uint256 gasEstimate)',
  'function quoteExactOutputSingle(((address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) poolKey, bool zeroForOne, uint128 exactAmount, bytes hookData) params) returns (uint256 amountIn, uint256 gasEstimate)',
])
export const publicClient = createPublicClient({
  chain: mainnet,
  transport: fallback(
    RPC_URLS.map((url) => http(url, { timeout: 12_000, retryCount: 0 })),
    { retryCount: 0 },
  ),
})

export async function readLiveContract() {
  const block = await publicClient.getBlockNumber({ cacheTime: 0 })
  const options = { address: CONTRACT, abi: buyerAbi, blockNumber: block }
  const [paused, intake, action, imd, pool] = await Promise.all([
    publicClient.readContract({ ...options, functionName: 'paused' }),
    publicClient.readContract({ ...options, functionName: 'intake' }),
    publicClient.readContract({ ...options, functionName: 'action' }),
    publicClient.readContract({ ...options, functionName: 'IMD' }),
    publicClient.readContract({ ...options, functionName: 'poolKey' }),
  ])
  const [price, decimals] = await Promise.all([
    publicClient.readContract({
      address: intake,
      abi: intakeAbi,
      functionName: 'priceOf',
      args: [action, imd],
      blockNumber: block,
    }),
    publicClient.readContract({
      address: imd,
      abi: tokenAbi,
      functionName: 'decimals',
      blockNumber: block,
    }),
  ])
  if (
    pool.currency0 !== '0x0000000000000000000000000000000000000000' ||
    pool.currency1.toLowerCase() !== imd.toLowerCase()
  ) {
    throw new Error(
      'The contract pool is unsupported. Check the verified contract before buying.',
    )
  }
  return {
    paused,
    intake,
    action,
    imd,
    pool,
    price,
    decimals,
    block,
    readAt: Date.now(),
  }
}
export type LiveContract = Awaited<ReturnType<typeof readLiveContract>>

export async function estimatePayment(live: LiveContract): Promise<bigint> {
  if (live.paused)
    throw new Error(
      'Purchases are paused by the contract owner. Try again later.',
    )
  if (live.price === 0n)
    throw new Error('The service is not currently for sale. Try again later.')
  // Target 2% more IMD than the live service price. This is an estimate only;
  // the subsequent exact-input quote and final simulation validate the purchase.
  const target = (live.price * 102n + 99n) / 100n
  if (target >= 2n ** 128n)
    throw new Error('The live price exceeds the quoter limit.')
  const quote = await publicClient.simulateContract({
    address: QUOTER,
    abi: quoterAbi,
    functionName: 'quoteExactOutputSingle',
    args: [
      {
        poolKey: live.pool,
        zeroForOne: true,
        exactAmount: target,
        hookData: '0x',
      },
    ],
    blockNumber: live.block,
  })
  return quote.result[0]
}

export async function quotePurchase(payment: bigint) {
  const live = await readLiveContract()
  if (live.paused)
    throw new Error(
      'Purchases are paused by the contract owner. Try again later.',
    )
  if (live.price === 0n)
    throw new Error('The service is not currently for sale. Try again later.')
  const { result } = await publicClient.simulateContract({
    address: QUOTER,
    abi: quoterAbi,
    functionName: 'quoteExactInputSingle',
    args: [
      {
        poolKey: live.pool,
        zeroForOne: true,
        exactAmount: payment,
        hookData: '0x',
      },
    ],
    blockNumber: live.block,
  })
  const received = result[0]
  const minimumOutput = (received * 99n) / 100n
  if (minimumOutput <= live.price) {
    throw new Error(
      'This payment does not leave enough IMD after the service price and 1% quote tolerance. Increase the ETH amount or use Estimate.',
    )
  }
  return {
    live,
    payment,
    received,
    surplus: received - live.price,
    minSurplus: minimumOutput - live.price,
    expiresAt: Date.now() + 60_000,
    deadline: BigInt(Math.floor(Date.now() / 1000) + 600),
  }
}
export type PurchaseQuote = Awaited<ReturnType<typeof quotePurchase>>

export function requestFromReceipt(
  receipt: TransactionReceipt,
  buyer?: Address,
): Hash | undefined {
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== CONTRACT.toLowerCase()) continue
    try {
      const decoded = decodeEventLog({
        abi: buyerAbi,
        eventName: 'WebsiteRequested',
        data: log.data,
        topics: log.topics,
      })
      if (!buyer || decoded.args.buyer.toLowerCase() === buyer.toLowerCase())
        return decoded.args.requestId
    } catch {
      /* Other contract events are not requests. */
    }
  }
}

export async function readRequest(id: Hash) {
  return publicClient.readContract({
    address: CONTRACT,
    abi: buyerAbi,
    functionName: 'requestOf',
    args: [id],
  })
}
export type WebsiteRequest = Awaited<ReturnType<typeof readRequest>>

export async function readResultUri(id: Hash) {
  const logs = await publicClient.getContractEvents({
    address: CONTRACT,
    abi: buyerAbi,
    eventName: 'WebsiteResult',
    args: { requestId: id },
    fromBlock: DEPLOYMENT_BLOCK,
    toBlock: 'latest',
    strict: true,
  })
  return logs.at(-1)?.args.uri ?? ''
}

export function explorerAddress(address: string) {
  return `https://etherscan.io/address/${address}`
}
export function explorerTransaction(hash: string) {
  return `https://etherscan.io/tx/${hash}`
}
