import { supabase } from './supabase'
import { API_URL } from './config'

/**
 * The app's only door to data: the AdminOS API with the user's Supabase access
 * token as a bearer token. Every route checks role and tenant server-side; the
 * app only decides what to *show*.
 */

export class ApiError extends Error {
  readonly status: number
  readonly code?: string
  readonly fields?: Record<string, string>
  constructor(status: number, message: string, code?: string, fields?: Record<string, string>) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.fields = fields
  }
  /** No response at all — offline, DNS, timeout. Safe to retry later. */
  get isNetwork(): boolean {
    return this.status === 0
  }
}

let onUnauthorized: (() => void) | null = null
/** The session store registers sign-out here (avoids an import cycle). */
export function setUnauthorizedHandler(fn: () => void) {
  onUnauthorized = fn
}

const TIMEOUT_MS = 30_000

async function request<T>(method: string, path: string, body?: unknown, init: { timeoutMs?: number } = {}): Promise<T> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  const isForm = typeof FormData !== 'undefined' && body instanceof FormData

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), init.timeoutMs ?? TIMEOUT_MS)
  let res: Response
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        ...(isForm || body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body),
    })
  } catch (e) {
    const aborted = (e as Error)?.name === 'AbortError'
    throw new ApiError(0, aborted ? 'The server took too long to answer. Check your connection and try again.' : 'You appear to be offline. Check your connection and try again.', aborted ? 'timeout' : 'network')
  } finally {
    clearTimeout(timer)
  }

  const text = await res.text()
  let json: unknown = undefined
  try {
    json = text ? JSON.parse(text) : undefined
  } catch {
    /* non-JSON body (e.g. a plain 401 from the edge) */
  }

  if (!res.ok) {
    const b = (json ?? {}) as { error?: string; code?: string; fields?: Record<string, string> }
    if (res.status === 401) onUnauthorized?.()
    const fallback =
      res.status === 401 ? 'Your session has ended. Please sign in again.'
      : res.status === 402 ? 'Your business’s AdminOS subscription needs attention. Ask the owner to check billing.'
      : res.status === 403 ? 'You don’t have permission to do that.'
      : res.status === 429 ? 'Too many requests — please wait a moment and try again.'
      : res.status >= 500 ? 'Something went wrong on our side. Please try again.'
      : `Request failed (${res.status}).`
    const fieldMsg = b.fields ? Object.values(b.fields)[0] : undefined
    throw new ApiError(res.status, fieldMsg ?? b.error ?? fallback, b.code, b.fields)
  }
  return json as T
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body ?? {}),
  patch: <T>(path: string, body: unknown) => request<T>('PATCH', path, body),
  del: <T>(path: string, body?: unknown) => request<T>('DELETE', path, body),
  upload: <T>(path: string, form: FormData) => request<T>('POST', path, form, { timeoutMs: 90_000 }),
}

/** Unauthenticated JSON POST (invite redemption). */
export async function publicPost<T>(path: string, body: unknown): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
    })
  } catch {
    throw new ApiError(0, 'You appear to be offline. Check your connection and try again.', 'network')
  }
  const json = (await res.json().catch(() => ({}))) as { error?: string; code?: string }
  if (!res.ok) throw new ApiError(res.status, json.error ?? `Request failed (${res.status}).`, json.code)
  return json as T
}

export function errorMessage(e: unknown): string {
  if (e instanceof ApiError) return e.message
  if (e instanceof Error) return e.message
  return 'Something went wrong. Please try again.'
}
