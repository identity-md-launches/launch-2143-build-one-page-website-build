import { useState } from 'react'
import { Icon } from './Icon'

export function CopyButton({
  value,
  label = 'Copy',
}: {
  value: string
  label?: string
}) {
  const [status, setStatus] = useState('')
  return (
    <span className="copy-control">
      <button
        type="button"
        className="icon-button"
        aria-label={label}
        title={label}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value)
            setStatus('Copied')
          } catch {
            setStatus('Select and copy the value manually.')
          }
        }}
      >
        <Icon name={status === 'Copied' ? 'check' : 'copy'} />
      </button>
      <span className="sr-only" role="status">
        {status}
      </span>
    </span>
  )
}
