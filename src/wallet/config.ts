import { createConfig, fallback, http } from 'wagmi'
import { injected } from 'wagmi/connectors/injected'
import { coinbaseWallet } from 'wagmi/connectors/coinbaseWallet'
import { mainnet } from 'viem/chains'
import { RPC_URLS } from '../lib/contract'

export const walletConfig = createConfig({
  chains: [mainnet],
  multiInjectedProviderDiscovery: true,
  connectors: [injected(), coinbaseWallet({ appName: 'Website terminal' })],
  transports: {
    [mainnet.id]: fallback(
      RPC_URLS.map((url) => http(url, { timeout: 12_000, retryCount: 0 })),
    ),
  },
})
