import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { formatUnits, type Hash } from 'viem'
import {
  CONTRACT,
  explorerAddress,
  explorerTransaction,
  publicClient,
  readRequest,
  readResultUri,
  requestFromReceipt,
} from '../lib/contract'
import {
  friendlyError,
  isHash,
  safeResultUrl,
  shortAddress,
} from '../lib/format'
import type { SavedRequest } from '../lib/history'
import { CopyButton } from './CopyButton'
import { Icon } from './Icon'

export function TrackRequest({
  selected,
  history,
  decimals,
  storageError,
  onRecovered,
}: {
  selected?: Hash
  history: SavedRequest[]
  decimals?: number
  storageError: boolean
  onRecovered: (row: SavedRequest) => void
}) {
  const [value, setValue] = useState(selected ?? '')
  const [mode, setMode] = useState<'request' | 'transaction'>('request')
  const [error, setError] = useState('')
  const [recovering, setRecovering] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (selected) {
      setValue(selected)
      setMode('request')
      setError('')
    }
  }, [selected])
  const request = useQuery({
    queryKey: ['website-request', selected],
    queryFn: () => readRequest(selected!),
    enabled: !!selected,
    retry: 1,
    refetchInterval: (query) =>
      query.state.data?.state === 1 ? 15_000 : false,
  })
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    const id = value.trim()
    if (!isHash(id)) {
      setError(
        `Enter a ${mode === 'request' ? 'request ID' : 'transaction hash'}: 0x followed by 64 hexadecimal characters.`,
      )
      input.current?.focus()
      return
    }
    if (mode === 'request') {
      if (id === selected) void request.refetch()
      else location.hash = `request/${id}`
      return
    }
    setRecovering(true)
    try {
      const receipt = await publicClient.getTransactionReceipt({ hash: id })
      if (receipt.status === 'reverted')
        throw new Error(
          'This transaction reverted and did not create a website request.',
        )
      const requestId = requestFromReceipt(receipt)
      if (!requestId)
        throw new Error(
          'This transaction contains no website request from this contract. Check its hash on Etherscan.',
        )
      const record = await readRequest(requestId)
      onRecovered({
        hash: id,
        requestId,
        buyer: record.buyer,
        createdAt: Date.now(),
      })
      location.hash = `request/${requestId}`
    } catch (cause) {
      if (cause instanceof Error && /not.*found/i.test(cause.message))
        setError(
          'The transaction is not confirmed on Ethereum yet, or the hash is incorrect. Check it and try again.',
        )
      else setError(friendlyError(cause))
    } finally {
      setRecovering(false)
    }
  }
  const result = request.data
  const emittedResult = useQuery({
    queryKey: ['result-uri', selected],
    queryFn: () => readResultUri(selected!),
    enabled: !!selected && result?.state === 2 && !result.uri,
    retry: 1,
    staleTime: Infinity,
  })
  const resultUri = result?.uri || emittedResult.data || ''
  const uri = result?.state === 2 ? safeResultUrl(resultUri) : undefined
  return (
    <div className="track-content">
      <h2 className="sr-only">Track a request</h2>
      <p className="track-intro muted">
        Read a request and its result directly from the contract.
      </p>
      <form onSubmit={(event) => void submit(event)} noValidate>
        <div className="field-heading">
          <label htmlFor="request-id">
            {mode === 'request' ? 'Request ID' : 'Transaction hash'}
          </label>
          <button
            type="button"
            className="text-button"
            onClick={() => {
              setMode(mode === 'request' ? 'transaction' : 'request')
              setValue('')
              setError('')
              input.current?.focus()
            }}
          >
            {mode === 'request' ? 'Use transaction hash' : 'Use request ID'}
          </button>
        </div>
        <input
          ref={input}
          id="request-id"
          name="request-id"
          type="text"
          placeholder="0x…"
          value={value}
          spellCheck={false}
          autoComplete="off"
          onChange={(event) => setValue(event.target.value)}
          aria-invalid={!!error}
          aria-describedby="lookup-error"
        />
        <p id="lookup-error" className="error-message" role="alert">
          {error}
        </p>
        <button
          type="submit"
          className="button primary-button full-width"
          disabled={recovering || request.isFetching}
        >
          <span>
            {recovering
              ? 'Reading transaction…'
              : request.isFetching
                ? 'Reading request…'
                : 'Find request'}
          </span>
          <Icon name="arrow" />
        </button>
      </form>
      <div
        className="request-result"
        aria-live="polite"
        aria-busy={request.isFetching}
      >
        {selected && request.isPending && (
          <p className="muted">Reading the request on Ethereum…</p>
        )}
        {selected && request.isError && (
          <div className="notice warning">
            <p>{friendlyError(request.error)}</p>
            <button
              type="button"
              className="text-button"
              onClick={() => void request.refetch()}
            >
              Retry request
            </button>
          </div>
        )}
        {result?.state === 0 && (
          <div className="empty-state">
            <Icon name="terminal" />
            <h3>No request found</h3>
            <p className="muted">
              Check the ID, or look up the transaction that created it.
            </p>
          </div>
        )}
        {result && result.state !== 0 && selected && (
          <>
            <div className={`request-state state-${result.state}`}>
              <span className="state-marker" aria-hidden="true">
                {result.state === 2 ? (
                  <Icon name="check" />
                ) : result.state === 3 ? (
                  <Icon name="warning" />
                ) : (
                  <Icon name="terminal" />
                )}
              </span>
              <h3>
                {result.state === 1
                  ? 'Request pending'
                  : result.state === 2
                    ? 'Website ready'
                    : 'Request ended without a website'}
              </h3>
              <button
                type="button"
                className="icon-button"
                title="Refresh request"
                aria-label="Refresh request"
                disabled={request.isFetching}
                onClick={() => void request.refetch()}
              >
                <Icon name="refresh" />
              </button>
            </div>
            {result.state === 1 && (
              <p className="muted">
                Waiting for the service to publish a result. This view refreshes
                every 15 seconds.
              </p>
            )}
            {result.state === 3 && (
              <p className="warning-text">
                The service returned status {result.status}. The service price
                has already been spent.
              </p>
            )}
            {uri && (
              <a
                className="button primary-button full-width"
                href={uri}
                target="_blank"
                rel="noopener noreferrer"
              >
                Open website
                <Icon name="external" />
              </a>
            )}
            {result.state === 2 && !uri && (
              <p className="muted">
                {emittedResult.isFetching
                  ? 'Reading the full result URI from the event…'
                  : resultUri
                    ? 'The result uses a URI this browser cannot open. Copy it below.'
                    : 'No website URI could be read. Check the full WebsiteResult event.'}{' '}
                <a
                  href={`${explorerAddress(CONTRACT)}#events`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  View contract events
                </a>
                {emittedResult.isError && (
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => void emittedResult.refetch()}
                  >
                    Retry result URI
                  </button>
                )}
              </p>
            )}
            <dl className="request-details">
              <div>
                <dt>Request ID</dt>
                <dd className="address-row">
                  <code className="full-value">{selected}</code>
                  <CopyButton value={selected} label="Copy request ID" />
                </dd>
              </div>
              <div>
                <dt>Buyer</dt>
                <dd>
                  <a
                    className="full-value"
                    href={explorerAddress(result.buyer)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {result.buyer}
                  </a>
                </dd>
              </div>
              <div>
                <dt>Service price paid</dt>
                <dd>
                  {decimals !== undefined
                    ? `${formatUnits(result.price, decimals)} IMD`
                    : `${result.price} IMD base units`}
                </dd>
              </div>
              {result.state === 2 && (
                <div>
                  <dt>Result hash</dt>
                  <dd>
                    <code className="full-value">{result.resultHash}</code>
                  </dd>
                </div>
              )}
              {result.state === 2 && resultUri && (
                <div>
                  <dt>Result URI</dt>
                  <dd className="address-row">
                    <code className="full-value">{resultUri}</code>
                    <CopyButton value={resultUri} label="Copy result URI" />
                  </dd>
                </div>
              )}
              {result.state === 3 && (
                <div>
                  <dt>Failure reason</dt>
                  <dd>
                    <code className="full-value">{result.reason}</code>
                  </dd>
                </div>
              )}
            </dl>
            <div className="share-request">
              <span className="small muted">Save a link to this request</span>
              <CopyButton
                value={`${location.href.split('#')[0]}#request/${selected}`}
                label="Copy request link"
              />
            </div>
          </>
        )}
      </div>
      <section className="recent-requests" aria-labelledby="recent-title">
        <h3 id="recent-title">Saved in this browser</h3>
        {storageError && (
          <p className="warning-text small">
            Browser storage is unavailable. Save the transaction hash or request
            link before leaving.
          </p>
        )}
        {!history.length ? (
          <p className="small muted">
            Requests you submit here will appear here. You can also paste an
            existing ID above.
          </p>
        ) : (
          <ul>
            {history.map((row) => (
              <li key={row.hash}>
                <div>
                  <code>{shortAddress(row.requestId ?? row.hash)}</code>
                  <span className="small muted">
                    {row.requestId ? 'Request ID' : 'Transaction hash'}
                  </span>
                </div>
                {row.requestId ? (
                  <a
                    className="button small-button"
                    href={`#request/${row.requestId}`}
                  >
                    View request
                    <Icon name="chevron" />
                  </a>
                ) : (
                  <button
                    type="button"
                    className="button small-button"
                    onClick={() => {
                      setMode('transaction')
                      setValue(row.hash)
                      input.current?.focus()
                    }}
                  >
                    Find request
                    <Icon name="chevron" />
                  </button>
                )}
                <a
                  className="icon-button"
                  aria-label={`View transaction ${row.hash} on Etherscan`}
                  href={explorerTransaction(row.hash)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Icon name="external" />
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
