export class ApiError extends Error {
  status: number
  code: string
  constructor(status: number, body?: { code?: string; message?: string }) { super(body?.message || 'Unable to reach the server.'); this.status = status; this.code = body?.code || 'REQUEST_FAILED' }
}

const API_URL = import.meta.env.VITE_API_URL || '/api'
function getToken() { try { return JSON.parse(localStorage.getItem('reservio-admin-session') || 'null')?.token || '' } catch { return '' } }
export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers); headers.set('Accept', 'application/json'); if (options.body) headers.set('Content-Type', 'application/json')
  const token = getToken(); if (token) headers.set('Authorization', `Bearer ${token}`)
  const response = await fetch(`${API_URL}${path}`, { ...options, headers }); const data = response.status === 204 ? null : await response.json().catch(() => null)
  if (!response.ok) { if (response.status === 401) localStorage.removeItem('reservio-admin-session'); throw new ApiError(response.status, data) }
  return data as T
}
export function apiAsset(path: string) { return `${API_URL}${path}` }
