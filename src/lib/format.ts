import {
  BaseError,
  ContractFunctionRevertedError,
  formatUnits,
  parseEther,
  type Hash,
} from 'viem'

export function briefError(words: string): string | undefined {
  if (!words.trim()) return 'Describe the website you want to build.'
  if (new TextEncoder().encode(words).length > 1000)
    return 'Keep the brief within 1,000 UTF-8 bytes.'
  if (/[\u0000-\u001f\u007f"\\]/.test(words))
    return 'Use one paragraph without double quotes, backslashes, or line breaks. Single quotes are allowed.'
  // TextEncoder replaces lone UTF-16 surrogates; reject them rather than changing a brief silently.
  for (let i = 0; i < words.length; i++) {
    const code = words.charCodeAt(i)
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = words.charCodeAt(++i)
      if (!(next >= 0xdc00 && next <= 0xdfff))
        return 'Remove the incomplete Unicode character from the brief.'
    } else if (code >= 0xdc00 && code <= 0xdfff)
      return 'Remove the incomplete Unicode character from the brief.'
  }
}
export function paymentError(value: string): string | undefined {
  if (!/^\d+(\.\d{1,18})?$/.test(value.trim()))
    return 'Enter an ETH amount with up to 18 decimal places, or use Estimate.'
  try {
    const amount = parseEther(value.trim())
    if (amount <= 0n)
      return 'Enter an ETH amount greater than zero, or use Estimate.'
    if (amount > 2n ** 127n - 1n)
      return 'This amount exceeds the contract payment limit.'
  } catch {
    return 'Enter a valid ETH amount, or use Estimate.'
  }
}
export function tokenAmount(
  value: bigint,
  decimals: number,
  places = 4,
): string {
  const raw = formatUnits(value, decimals)
  const [whole, fraction = ''] = raw.split('.')
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  const digits = fraction.slice(0, places).replace(/0+$/, '')
  if (value > 0n && whole === '0' && !digits && fraction.length)
    return `<0.${'0'.repeat(places - 1)}1`
  return `${grouped}${digits ? `.${digits}` : ''}`
}
export function shortAddress(value: string): string {
  return `${value.slice(0, 6)}…${value.slice(-4)}`
}
export function isHash(value: string): value is Hash {
  return /^0x[\da-fA-F]{64}$/.test(value)
}
export function safeResultUrl(value: string): string | undefined {
  try {
    if (value.startsWith('ipfs://')) {
      const path = value.slice(7).replace(/^ipfs\//, '')
      if (!/^[a-zA-Z0-9]+(?:[/?#].*)?$/.test(path)) return
      return `https://ipfs.io/ipfs/${path}`
    }
    const url = new URL(value)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return
    if (url.username || url.password) return
    return url.href
  } catch {
    return
  }
}
export function friendlyError(error: unknown): string {
  if (error instanceof BaseError) {
    const reverted = error.walk(
      (cause) => cause instanceof ContractFunctionRevertedError,
    )
    if (reverted instanceof ContractFunctionRevertedError) {
      const names: Record<string, string> = {
        BadWords:
          'The contract rejected the brief. Use one paragraph, at most 1,000 UTF-8 bytes, without double quotes or backslashes.',
        EnforcedPause:
          'Purchases are paused by the contract owner. Try again later.',
        ActionNotSold:
          'The service is not currently for sale. Try again later.',
        InsufficientIMD:
          'The ETH payment does not cover the live service price. Use Estimate and review again.',
        SurplusTooLow:
          'The price moved beyond the minimum IMD return. Refresh the quote and review again.',
        Expired:
          'The transaction deadline passed. Refresh the quote and try again.',
        IncompleteSwap:
          'The pool could not fill the full payment. Try a different amount later.',
        InvalidETHAmount: 'Enter a valid, positive ETH amount.',
      }
      if (reverted.data?.errorName && names[reverted.data.errorName])
        return names[reverted.data.errorName]
      return 'The contract simulation reverted. Refresh the quote or change the ETH amount before trying again.'
    }
  }
  const message = error instanceof Error ? error.message : String(error)
  if (/reject|denied|4001/i.test(message))
    return 'The wallet request was declined. You can try again when ready.'
  if (/insufficient funds|exceeds.*balance|balance.*too low/i.test(message))
    return 'The wallet needs enough ETH for the payment and the network fee.'
  if (/provider.*not found|provider.*unavailable/i.test(message))
    return 'No browser wallet was found. Install a wallet extension or choose Coinbase Wallet.'
  if (/fetch|network|timeout|HTTP|RPC|rate limit|429|403/i.test(message))
    return 'Ethereum could not be reached. Check your connection and try again.'
  if (error instanceof Error && !(error instanceof BaseError))
    return error.message
  return 'The request could not complete. Try again or check the contract on Etherscan.'
}
