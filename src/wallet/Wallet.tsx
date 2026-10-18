import { createContext, useContext, useState, type ReactNode } from 'react'
import {
  useAccount,
  useConnect,
  useDisconnect,
  useSwitchChain,
  type Connector,
} from 'wagmi'
import { getAddress } from 'viem'
import { Modal } from '../components/Modal'
import { Icon } from '../components/Icon'
import { CopyButton } from '../components/CopyButton'
import { friendlyError, shortAddress } from '../lib/format'
import { OPEN_IN, isMobileBrowser } from './open-in'

const WalletContext = createContext<() => void>(() => {})
export function useOpenWallet() {
  return useContext(WalletContext)
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <WalletContext.Provider value={() => setOpen(true)}>
      {children}
      {open && <WalletSheet onClose={() => setOpen(false)} />}
    </WalletContext.Provider>
  )
}

export function WalletControl() {
  const { address, isConnected, chainId } = useAccount()
  const open = useOpenWallet()
  const { switchChainAsync, isPending } = useSwitchChain()
  const [error, setError] = useState('')
  const wrongChain = isConnected && chainId !== 1
  return (
    <div className="wallet-control">
      <button
        type="button"
        className="button wallet-button"
        disabled={isPending}
        onClick={async () => {
          if (!wrongChain) {
            open()
            return
          }
          setError('')
          try {
            await switchChainAsync({ chainId: 1 })
          } catch (cause) {
            setError(friendlyError(cause))
          }
        }}
      >
        <Icon name="wallet" />
        <span>
          {isPending
            ? 'Switching…'
            : wrongChain
              ? 'Switch to Ethereum'
              : isConnected && address
                ? shortAddress(getAddress(address))
                : 'Connect'}
        </span>
      </button>
      {error && (
        <p className="wallet-switch-error" role="alert">
          {error}
          <button
            type="button"
            className="text-button"
            onClick={() => setError('')}
          >
            Dismiss
          </button>
        </p>
      )}
    </div>
  )
}

function WalletSheet({ onClose }: { onClose: () => void }) {
  const { address, isConnected, connector } = useAccount()
  const { connectors, connectAsync, isPending, variables } = useConnect()
  const { disconnectAsync } = useDisconnect()
  const [error, setError] = useState('')
  const named = connectors.some(
    (item) => item.type === 'injected' && item.id !== 'injected',
  )
  const mobile = isMobileBrowser() && !named
  const listed = [
    ...connectors.filter((item) => item.type === 'injected'),
    ...connectors.filter((item) => item.type !== 'injected'),
  ]
    .filter((item) => !(item.id === 'injected' && named))
    .filter((item) => !mobile || item.type !== 'injected')
  const label = (item: Connector) =>
    item.id === 'injected'
      ? 'Browser wallet'
      : item.id === 'coinbaseWalletSDK' && mobile
        ? 'Coinbase Smart Wallet'
        : item.name
  const choose = async (item: Connector) => {
    setError('')
    try {
      await connectAsync({ connector: item })
      onClose()
    } catch (cause) {
      setError(friendlyError(cause))
    }
  }
  return (
    <Modal
      title={isConnected ? 'Connected wallet' : 'Connect a wallet'}
      onClose={onClose}
      className="wallet-sheet"
    >
      {isConnected && address ? (
        <>
          <p className="muted">
            Connected with {connector?.name ?? 'your wallet'}.
          </p>
          <div className="address-row">
            <code className="full-value">{getAddress(address)}</code>
            <CopyButton
              value={getAddress(address)}
              label="Copy wallet address"
            />
          </div>
          <button
            type="button"
            className="button full-width"
            onClick={async () => {
              try {
                await disconnectAsync()
                onClose()
              } catch (cause) {
                setError(friendlyError(cause))
              }
            }}
          >
            Disconnect
          </button>
        </>
      ) : (
        <>
          <p className="muted">Choose a wallet to buy on Ethereum.</p>
          <div className="wallet-list">
            {mobile &&
              OPEN_IN.map((wallet) => (
                <a
                  className="wallet-row"
                  key={wallet.id}
                  href={wallet.href(location.href)}
                >
                  <img
                    src={`./wallets/${wallet.id}.svg`}
                    alt=""
                    width="28"
                    height="28"
                  />
                  <span>Open in {wallet.name}</span>
                  <Icon name="external" />
                </a>
              ))}
            {listed.map((item) => (
              <button
                type="button"
                className="wallet-row"
                key={item.uid}
                disabled={isPending}
                onClick={() => void choose(item)}
              >
                {item.icon ? (
                  <img src={item.icon} alt="" width="28" height="28" />
                ) : item.id === 'coinbaseWalletSDK' ? (
                  <img
                    src="./wallets/coinbase.svg"
                    alt=""
                    width="28"
                    height="28"
                  />
                ) : (
                  <span className="generic-wallet-mark">
                    <Icon name="wallet" />
                  </span>
                )}
                <span>
                  {label(item)}
                  {isPending && variables?.connector === item
                    ? ' · opening…'
                    : ''}
                </span>
                <Icon name="chevron" />
              </button>
            ))}
          </div>
          {!mobile && !named && (
            <p className="small muted">
              Use an installed extension, or create a passkey wallet with
              Coinbase.
            </p>
          )}
        </>
      )}
      <p className="error-message" role="alert">
        {error}
      </p>
    </Modal>
  )
}
