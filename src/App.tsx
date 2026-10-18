import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useWaitForTransactionReceipt } from 'wagmi'
import { hexToString, type Hash } from 'viem'
import { Purchase } from './components/Purchase'
import { TrackRequest } from './components/TrackRequest'
import { CopyButton } from './components/CopyButton'
import { Icon } from './components/Icon'
import { WalletControl } from './wallet/Wallet'
import {
  CONTRACT,
  explorerAddress,
  explorerTransaction,
  readLiveContract,
  requestFromReceipt,
} from './lib/contract'
import { isHash } from './lib/format'
import { useRequestHistory, type SavedRequest } from './lib/history'

function readRoute() {
  const id = location.hash.replace(/^#request\//, '')
  return {
    track: location.hash === '#track' || isHash(id),
    request: isHash(id) ? id : undefined,
  }
}

export default function App() {
  const [route, setRoute] = useState(readRoute)
  const { history, save, storageError } = useRequestHistory()
  const [transaction, setTransaction] = useState<SavedRequest | undefined>(() =>
    history.find((row) => !row.requestId),
  )
  const [receiptMessage, setReceiptMessage] = useState('')
  useEffect(() => {
    const onHash = () => setRoute(readRoute())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  const live = useQuery({
    queryKey: ['live-contract'],
    queryFn: readLiveContract,
    staleTime: 30_000,
    refetchInterval: 60_000,
    retry: 1,
  })
  const receipt = useWaitForTransactionReceipt({
    hash: transaction?.hash,
    chainId: 1,
    confirmations: 1,
    query: { enabled: !!transaction && !transaction.requestId, retry: 1 },
  })
  useEffect(() => {
    if (!receipt.data || !transaction || transaction.requestId) return
    if (receipt.data.status === 'reverted') {
      setReceiptMessage(
        'The transaction reverted. No website request was created; the network fee may still be charged.',
      )
      return
    }
    const id = requestFromReceipt(receipt.data, transaction.buyer)
    if (!id) {
      setReceiptMessage(
        'Transaction confirmed, but no request event was found. Check the receipt on Etherscan.',
      )
      return
    }
    const updated = { ...transaction, requestId: id }
    save(updated)
    setTransaction(updated)
    setReceiptMessage('')
    location.hash = `request/${id}`
  }, [receipt.data, transaction, save])
  const submitted = (row: SavedRequest) => {
    save(row)
    setTransaction(row)
    setReceiptMessage('')
  }
  const pending =
    !!transaction && !transaction.requestId && !receipt.data && !receipt.isError
  let action = ''
  try {
    if (live.data) action = hexToString(live.data.action, { size: 32 })
  } catch {
    action = live.data?.action ?? ''
  }
  const status = live.isError
    ? 'Connection unavailable'
    : !live.data
      ? 'Reading Ethereum'
      : live.data.paused
        ? 'Purchases paused'
        : live.data.price === 0n
          ? 'Service unavailable'
          : 'Accepting requests'
  return (
    <>
      <a
        className="skip-link"
        href="#main"
        onClick={(event) => {
          event.preventDefault()
          document.getElementById('main')?.focus()
          document.getElementById('main')?.scrollIntoView()
        }}
      >
        Skip to content
      </a>
      <header className="site-header">
        <div className="header-inner">
          <a
            className="wordmark"
            href="#build"
            aria-label="Website terminal home"
          >
            <span className="brand-symbol" aria-hidden="true">
              <Icon name="terminal" />
            </span>
            <span>
              website<span className="brand-suffix"> / terminal</span>
            </span>
          </a>
          <div className="header-utilities">
            <span className="header-chain">
              <span className="network-diamond" aria-hidden="true" />
              Ethereum
            </span>
            <WalletControl />
          </div>
        </div>
      </header>
      <main id="main" tabIndex={-1}>
        <div className="page-intro">
          <div>
            <h1>
              Build a website<span className="title-dot">.</span>
            </h1>
            <p className="intro-description">
              Buy a hosted website with a brief and ETH.
            </p>
          </div>
          <div className="intro-art" aria-hidden="true">
            <img src="./matrix.svg" alt="" width="292" height="102" />
          </div>
        </div>
        <div className="product-grid">
          <section className="workspace" aria-label="Website terminal">
            <nav className="workspace-nav" aria-label="Website actions">
              <a href="#build" aria-current={!route.track ? 'page' : undefined}>
                <Icon name="terminal" />
                Build a website
              </a>
              <a href="#track" aria-current={route.track ? 'page' : undefined}>
                Track a request
                <Icon name="chevron" />
              </a>
            </nav>
            <div role="status" aria-live="polite">
              {transaction && (
                <div className="transaction-notice">
                  <Icon name={transaction.requestId ? 'check' : 'terminal'} />
                  <div>
                    <p>
                      {transaction.requestId
                        ? 'Request recorded on Ethereum.'
                        : receiptMessage ||
                          (receipt.isError
                            ? 'Confirmation could not be checked. Use the transaction hash to recover your request.'
                            : 'Transaction sent. Waiting for confirmation…')}
                    </p>
                    <a
                      href={explorerTransaction(transaction.hash)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      View transaction
                      <Icon name="external" />
                    </a>
                    {transaction.requestId && (
                      <a href={`#request/${transaction.requestId}`}>
                        Track request
                        <Icon name="chevron" />
                      </a>
                    )}
                  </div>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label="Dismiss transaction notice"
                    onClick={() => setTransaction(undefined)}
                  >
                    <Icon name="close" />
                  </button>
                </div>
              )}
            </div>
            <div hidden={route.track}>
              <Purchase
                live={live.data}
                readError={live.isError}
                reading={live.isFetching}
                refresh={() => void live.refetch()}
                onSubmitted={submitted}
                pending={pending}
              />
            </div>
            <div hidden={!route.track}>
              <TrackRequest
                selected={route.request as Hash | undefined}
                history={history}
                decimals={live.data?.decimals}
                storageError={storageError}
                onRecovered={save}
              />
            </div>
          </section>
          <aside
            className="contract-sidebar"
            aria-label="Contract and payment details"
          >
            <section className="contract-section">
              <div className="section-heading">
                <h2>The contract</h2>
                <a
                  className="icon-button"
                  href={`${explorerAddress(CONTRACT)}#code`}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="View verified contract on Etherscan"
                >
                  <Icon name="external" />
                </a>
              </div>
              <p className="small muted">WebsiteBuyer · Ethereum mainnet</p>
              <div className="contract-address">
                <code className="full-value">{CONTRACT}</code>
                <CopyButton value={CONTRACT} label="Copy contract address" />
              </div>
              <div
                role="status"
                className={`connection-status ${live.isError || live.data?.paused || live.data?.price === 0n ? 'warning-text' : ''}`}
              >
                <span
                  className={`status-light ${live.data && !live.isError ? 'connected' : ''}`}
                  aria-hidden="true"
                />
                <span>{status}</span>
              </div>
              {live.data && (
                <div className="snapshot">
                  <span className="small muted">
                    Block {live.data.block.toLocaleString()}
                  </span>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label="Refresh contract data"
                    title="Refresh contract data"
                    disabled={live.isFetching}
                    onClick={() => void live.refetch()}
                  >
                    <Icon name="refresh" />
                  </button>
                </div>
              )}
              {live.isError && (
                <button
                  type="button"
                  className="text-button"
                  disabled={live.isFetching}
                  onClick={() => void live.refetch()}
                >
                  {live.isFetching ? 'Retrying…' : 'Retry Ethereum connection'}
                </button>
              )}
            </section>
            <section
              className="payment-explainer"
              aria-labelledby="payment-title"
            >
              <h2 id="payment-title">What your payment does</h2>
              <ol>
                <li>
                  <span className="step-number" aria-hidden="true">
                    01
                  </span>
                  <div>
                    <h3>Swap ETH for IMD</h3>
                    <p className="small muted">
                      The full ETH amount enters the swap.
                    </p>
                  </div>
                </li>
                <li>
                  <span className="step-number" aria-hidden="true">
                    02
                  </span>
                  <div>
                    <h3>Pay for one website</h3>
                    <p className="small muted">
                      The service takes its live IMD price.
                    </p>
                  </div>
                </li>
                <li>
                  <span className="step-number" aria-hidden="true">
                    03
                  </span>
                  <div>
                    <h3>Receive the surplus</h3>
                    <p className="small muted">
                      Remaining IMD returns to your wallet.
                    </p>
                  </div>
                </li>
              </ol>
            </section>
            <div className="terminal-rule" aria-hidden="true">
              <span>└</span>
              <span />
              <span>↵</span>
            </div>
            <details className="contract-details">
              <summary>
                Before you buy
                <Icon name="chevron" />
              </summary>
              <div>
                <p>
                  A request is handled asynchronously. Track its ID for a
                  result; the contract provides no completion deadline.
                </p>
                <p>
                  The service price has already been spent if a request is
                  refused or ends without a result. This contract has no refund
                  function.
                </p>
                <p>
                  The quote protects a minimum IMD return and a 10-minute
                  transaction deadline. Refresh if the 60-second quote expires.
                  A transaction that reverts can still cost a network fee.
                </p>
              </div>
            </details>
            <details className="contract-details">
              <summary>
                Contract details
                <Icon name="chevron" />
              </summary>
              <div>
                <p>
                  Reads and writes use the address above on Ethereum (chain ID
                  1). Purchases call <code>buyWebsiteWithMinimum</code>.
                </p>
                {live.data && (
                  <>
                    <p>
                      Current action:{' '}
                      <code className="full-value">{action}</code>
                    </p>
                    <p>
                      Current intake:{' '}
                      <a
                        className="full-value"
                        href={explorerAddress(live.data.intake)}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {live.data.intake}
                      </a>
                    </p>
                    <p>
                      IMD token:{' '}
                      <a
                        className="full-value"
                        href={explorerAddress(live.data.imd)}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {live.data.imd}
                      </a>
                    </p>
                  </>
                )}
                <a href="./contract/WebsiteBuyer.abi.json" download>
                  Download verified ABI
                  <Icon name="external" />
                </a>
              </div>
            </details>
          </aside>
        </div>
      </main>
      <footer className="site-footer">
        <span>
          <Icon name="terminal" />
          Website terminal
        </span>
        <p>An interface to the IdentityMD WebsiteBuyer contract.</p>
        <a
          href={`${explorerAddress(CONTRACT)}#code`}
          target="_blank"
          rel="noopener noreferrer"
        >
          Verify the code
          <Icon name="external" />
        </a>
      </footer>
    </>
  )
}
