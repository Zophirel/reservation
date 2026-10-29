export type ApiErrorBody = { code: string; message: string; fieldErrors?: Record<string, string[]> }

export class ApiError extends Error {
  status: number
  code: string
  fieldErrors?: Record<string, string[]>
  constructor(status: number, body?: Partial<ApiErrorBody>) {
    super(body?.message || 'Unable to reach the server.')
    this.status = status
    this.code = body?.code || 'REQUEST_FAILED'
    this.fieldErrors = body?.fieldErrors
  }
}

const API_URL = import.meta.env.VITE_API_URL || '/api'

function getToken() {
  try { return JSON.parse(localStorage.getItem('reservio-session') || 'null')?.token || '' } catch { return '' }
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers)
  headers.set('Accept', 'application/json')
  if (options.body) headers.set('Content-Type', 'application/json')
  const token = getToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)
  const response = await fetch(`${API_URL}${path}`, { ...options, headers })
  const data = response.status === 204 ? null : await response.json().catch(() => null)
  if (!response.ok) throw new ApiError(response.status, data)
  return data as T
}

export function apiAsset(path: string) {
  return `${API_URL}${path}`
}
