import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useAccount, useSwitchChain, useWriteContract } from 'wagmi'
import { formatEther, formatUnits, parseEther, type Hash } from 'viem'
import { useQueryClient } from '@tanstack/react-query'
import {
  buyerAbi,
  CONTRACT,
  estimatePayment,
  publicClient,
  quotePurchase,
  readLiveContract,
  type LiveContract,
  type PurchaseQuote,
} from '../lib/contract'
import {
  briefError,
  friendlyError,
  paymentError,
  tokenAmount,
} from '../lib/format'
import type { SavedRequest } from '../lib/history'
import { useOpenWallet } from '../wallet/Wallet'
import { Modal } from './Modal'
import { Icon } from './Icon'

const EXAMPLE =
  'A one-page portfolio for an independent photographer, with a black and white gallery, an about section, and a contact link.'

export function Purchase({
  live,
  readError,
  reading,
  refresh,
  onSubmitted,
  pending,
}: {
  live?: LiveContract
  readError: boolean
  reading: boolean
  refresh: () => void
  onSubmitted: (request: SavedRequest) => void
  pending: boolean
}) {
  const [words, setWords] = useState('')
  const [payment, setPayment] = useState('')
  const [errors, setErrors] = useState<{ words?: string; payment?: string }>({})
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState<'estimate' | 'quote' | 'purchase' | null>(
    null,
  )
  const [quote, setQuote] = useState<PurchaseQuote | null>(null)
  const wordsRef = useRef<HTMLTextAreaElement>(null)
  const amountRef = useRef<HTMLInputElement>(null)
  const { address, isConnected, chainId } = useAccount()
  const { writeContractAsync } = useWriteContract()
  const { switchChainAsync } = useSwitchChain()
  const openWallet = useOpenWallet()
  const queryClient = useQueryClient()
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    if (!quote) return
    setNow(Date.now())
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [quote])
  const unavailable = live?.paused || live?.price === 0n
  const frozen = !!busy || pending
  const estimate = async () => {
    setBusy('estimate')
    setMessage('')
    try {
      const current = await readLiveContract()
      queryClient.setQueryData(['live-contract'], current)
      const amount = await estimatePayment(current)
      setPayment(formatEther(amount))
      setErrors((previous) => ({ ...previous, payment: undefined }))
      setMessage(
        'Estimate applied. Review to check the current swap and minimum IMD return.',
      )
    } catch (cause) {
      setMessage(friendlyError(cause))
    } finally {
      setBusy(null)
    }
  }
  const review = async (event?: FormEvent) => {
    event?.preventDefault()
    const next = { words: briefError(words), payment: paymentError(payment) }
    setErrors(next)
    setMessage('')
    if (next.words) {
      wordsRef.current?.focus()
      return
    }
    if (next.payment) {
      amountRef.current?.focus()
      return
    }
    setBusy('quote')
    try {
      const nextQuote = await quotePurchase(parseEther(payment.trim()))
      queryClient.setQueryData(['live-contract'], nextQuote.live)
      setQuote(nextQuote)
    } catch (cause) {
      setMessage(friendlyError(cause))
    } finally {
      setBusy(null)
    }
  }
  const buy = async () => {
    if (!quote || busy || pending) return
    if (!isConnected || !address) {
      openWallet()
      return
    }
    setMessage('')
    if (chainId !== 1) {
      try {
        await switchChainAsync({ chainId: 1 })
      } catch (cause) {
        setMessage(friendlyError(cause))
      }
      return
    }
    if (Date.now() >= quote.expiresAt) {
      setMessage('This quote expired. Refresh the quote before buying.')
      return
    }
    setBusy('purchase')
    try {
      // Simulate the exact buyer call before handing it to the wallet. The wallet
      // still receives the explicit chain, account, full ETH amount and limits.
      const args = [words, quote.minSurplus, quote.deadline] as const
      await publicClient.simulateContract({
        address: CONTRACT,
        abi: buyerAbi,
        functionName: 'buyWebsiteWithMinimum',
        args,
        account: address,
        value: quote.payment,
      })
      if (Date.now() >= quote.expiresAt)
        throw new Error(
          'This quote expired during simulation. Refresh the quote before buying.',
        )
      const hash: Hash = await writeContractAsync({
        address: CONTRACT,
        abi: buyerAbi,
        functionName: 'buyWebsiteWithMinimum',
        args,
        value: quote.payment,
        chainId: 1,
        account: address,
      })
      onSubmitted({ hash, buyer: address, createdAt: Date.now() })
      setQuote(null)
    } catch (cause) {
      setMessage(friendlyError(cause))
    } finally {
      setBusy(null)
    }
  }
  return (
    <>
      <form
        className="purchase-form"
        onSubmit={(event) => void review(event)}
        noValidate
      >
        <div className="field">
          <div className="field-heading">
            <label htmlFor="brief">Describe your website</label>
            <button
              type="button"
              className="text-button example-button"
              disabled={frozen}
              onClick={() => {
                setWords(EXAMPLE)
                setErrors((previous) => ({ ...previous, words: undefined }))
                wordsRef.current?.focus()
              }}
            >
              Use an example
            </button>
          </div>
          <textarea
            ref={wordsRef}
            id="brief"
            name="brief"
            rows={4}
            value={words}
            onChange={(event) => {
              setWords(event.target.value)
              if (errors.words)
                setErrors((previous) => ({ ...previous, words: undefined }))
            }}
            disabled={frozen}
            placeholder="A site for your idea. Include its purpose, content, and visual style."
            aria-invalid={!!errors.words}
            aria-describedby="brief-hint brief-error"
            autoComplete="off"
            spellCheck
          />
          <div className="field-foot">
            <p id="brief-hint" className="small muted">
              One paragraph. No double quotes or backslashes.
            </p>
            <span
              className={`small byte-count ${new TextEncoder().encode(words).length > 1000 ? 'error-text' : ''}`}
            >
              {new TextEncoder().encode(words).length}/1,000 bytes
            </span>
          </div>
          <p id="brief-error" className="error-message" role="alert">
            {errors.words}
          </p>
        </div>
        <div className="field payment-field">
          <label htmlFor="payment">ETH payment</label>
          <div className="amount-controls">
            <div className="amount-input">
              <input
                ref={amountRef}
                id="payment"
                name="payment"
                inputMode="decimal"
                type="text"
                autoComplete="off"
                spellCheck={false}
                value={payment}
                placeholder="0.00"
                onChange={(event) => {
                  setPayment(event.target.value)
                  if (errors.payment)
                    setErrors((previous) => ({
                      ...previous,
                      payment: undefined,
                    }))
                }}
                aria-invalid={!!errors.payment}
                aria-describedby="payment-hint payment-error"
                disabled={frozen}
              />
              <span aria-hidden="true">ETH</span>
            </div>
            <button
              type="button"
              className="button estimate-button"
              onClick={() => void estimate()}
              disabled={frozen || !!unavailable}
            >
              {busy === 'estimate' ? 'Estimating…' : 'Estimate'}
            </button>
          </div>
          <p id="payment-hint" className="small muted">
            Full amount is spent. Network fee is extra.
          </p>
          <p id="payment-error" className="error-message" role="alert">
            {errors.payment}
          </p>
        </div>
        <div className="service-price">
          <span>
            {readError && live
              ? 'Last read service price'
              : 'Live service price'}
          </span>
          <span>
            {live
              ? `${tokenAmount(live.price, live.decimals)} IMD`
              : reading
                ? 'Reading Ethereum…'
                : 'Unavailable'}
          </span>
        </div>
        {unavailable && (
          <p className="notice warning">
            <Icon name="warning" />
            {live?.paused
              ? 'Purchases are paused. You can still track requests.'
              : 'This service is not currently for sale.'}
          </p>
        )}
        {readError && (
          <div className="inline-recovery">
            <p className="small warning-text">
              Live price unavailable. Retry before buying.
            </p>
            <button
              type="button"
              className="text-button"
              onClick={refresh}
              disabled={reading}
            >
              {reading ? 'Retrying…' : 'Retry connection'}
            </button>
          </div>
        )}
        <button
          type="submit"
          className="button primary-button full-width review-button"
          disabled={frozen || !!unavailable}
        >
          <span>
            {busy === 'quote'
              ? 'Checking live quote…'
              : busy === 'purchase'
                ? 'Waiting for wallet…'
                : pending
                  ? 'Transaction pending…'
                  : 'Review purchase'}
          </span>
          <Icon name="arrow" />
        </button>
        {!quote && (
          <p className="form-status small" role="status">
            {message}
          </p>
        )}
        <p className="small privacy-note muted">
          <Icon name="warning" />
          Your brief becomes public on Ethereum. Leave out private information.
        </p>
      </form>
      {quote && (
        <Modal
          title="Review your purchase"
          onClose={() => setQuote(null)}
          className="purchase-modal"
        >
          <p className="muted">You are buying one website on Ethereum.</p>
          <div className="review-brief">
            <span className="small muted">Website brief</span>
            <p>{words}</p>
          </div>
          <dl className="quote-details">
            <div>
              <dt>ETH you will spend</dt>
              <dd>{formatEther(quote.payment)} ETH</dd>
            </div>
            <div>
              <dt>Live service price</dt>
              <dd>{formatUnits(quote.live.price, quote.live.decimals)} IMD</dd>
            </div>
            <div>
              <dt>Estimated IMD returned</dt>
              <dd>{formatUnits(quote.surplus, quote.live.decimals)} IMD</dd>
            </div>
            <div>
              <dt>Minimum IMD returned</dt>
              <dd>{formatUnits(quote.minSurplus, quote.live.decimals)} IMD</dd>
            </div>
            <div>
              <dt>Network fee</dt>
              <dd>Calculated by your wallet</dd>
            </div>
          </dl>
          <p className="small muted">
            The full ETH payment is swapped for IMD. The service price is paid
            in IMD; surplus IMD goes to your wallet. A failed or refused website
            request does not refund the service price.
          </p>
          <div className="quote-time">
            <span className="small">
              {now >= quote.expiresAt
                ? 'Quote expired'
                : `Quote valid for ${Math.ceil((quote.expiresAt - now) / 1000)}s`}
            </span>
            <button
              type="button"
              className="text-button"
              disabled={!!busy}
              onClick={() => void review()}
            >
              <Icon name="refresh" />
              Refresh quote
            </button>
          </div>
          <p className="small muted">
            1% quote tolerance. Transaction deadline:{' '}
            {new Date(Number(quote.deadline) * 1000).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
              timeZoneName: 'short',
            })}
            .
          </p>
          <p className="error-message" role="alert">
            {message}
          </p>
          <button
            type="button"
            className="button primary-button full-width"
            disabled={
              !!busy ||
              pending ||
              (isConnected && chainId === 1 && now >= quote.expiresAt)
            }
            onClick={() => void buy()}
          >
            <span>
              {busy === 'purchase'
                ? 'Confirm in your wallet…'
                : !isConnected
                  ? 'Connect to buy'
                  : chainId !== 1
                    ? 'Switch to Ethereum'
                    : 'Buy website'}
            </span>
            <Icon name="arrow" />
          </button>
          <p className="small muted confirmation-note">
            Your wallet asks for final confirmation. The brief and payment are
            public.
          </p>
        </Modal>
      )}
    </>
  )
}
