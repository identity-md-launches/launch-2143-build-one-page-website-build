import { useCallback, useState } from 'react'
import type { Address, Hash } from 'viem'
import { isHash } from './format'

const KEY = 'website-terminal:ethereum:2fc2ca1b:requests:v1'
export type SavedRequest = {
  hash: Hash
  buyer: Address
  createdAt: number
  requestId?: Hash
}
function readHistory(): SavedRequest[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter(
        (row): row is SavedRequest =>
          row &&
          isHash(row.hash) &&
          /^0x[\da-fA-F]{40}$/.test(row.buyer) &&
          typeof row.createdAt === 'number' &&
          (!row.requestId || isHash(row.requestId)),
      )
      .slice(0, 20)
  } catch {
    return []
  }
}
export function useRequestHistory() {
  const [history, setHistory] = useState(readHistory)
  const [storageError, setStorageError] = useState(false)
  const save = useCallback((row: SavedRequest) => {
    setHistory((previous) => {
      const next = [
        row,
        ...previous.filter((item) => item.hash !== row.hash),
      ].slice(0, 20)
      try {
        localStorage.setItem(KEY, JSON.stringify(next))
      } catch {
        setStorageError(true)
      }
      return next
    })
  }, [])
  return { history, save, storageError }
}
