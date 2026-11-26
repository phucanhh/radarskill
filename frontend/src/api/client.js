import {
  getStaticDashboard,
  getStaticHustCatalog,
  getStaticMajorCourses,
  getStaticMajors,
  runStaticAnalyze,
} from '../data/staticEngine'

const API_BASE = import.meta.env.VITE_API_URL || ''
const SHOULD_CALL_API = Boolean(import.meta.env.DEV || API_BASE)

async function requestJson(path, options = {}) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 2000)
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    })
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`)
    }
    return await res.json()
  } finally {
    clearTimeout(timeout)
  }
}

export async function fetchHustCatalog() {
  if (!SHOULD_CALL_API) {
    return { data: getStaticHustCatalog(), live: false }
  }
  try {
    const data = await requestJson('/api/hust-catalog')
    return { data: data.schools || data, live: true }
  } catch {
    return { data: getStaticHustCatalog(), live: false }
  }
}

export async function fetchMajors() {
  if (!SHOULD_CALL_API) {
    return { data: getStaticMajors(), live: false }
  }
  try {
    const data = await requestJson('/api/majors')
    return { data: data.majors || data, live: true }
  } catch {
    return { data: getStaticMajors(), live: false }
  }
}

export async function fetchMajorCourses(majorCode, programCode = '') {
  if (!SHOULD_CALL_API) {
    return { data: getStaticMajorCourses(majorCode, programCode), live: false }
  }
  try {
    const qs = programCode ? `?program_code=${encodeURIComponent(programCode)}` : ''
    const data = await requestJson(`/api/majors/${encodeURIComponent(majorCode)}/courses${qs}`)
    return { data: data.courses || data, live: true }
  } catch {
    return { data: getStaticMajorCourses(majorCode, programCode), live: false }
  }
}

export async function analyzeStudentProfile(payload) {
  if (!SHOULD_CALL_API) {
    return { data: runStaticAnalyze(payload), live: false }
  }
  try {
    const data = await requestJson('/api/analyze', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
    return { data, live: true }
  } catch {
    return { data: runStaticAnalyze(payload), live: false }
  }
}

export async function fetchDashboard() {
  if (!SHOULD_CALL_API) {
    return { data: getStaticDashboard(), live: false }
  }
  try {
    const data = await requestJson('/api/dashboard')
    return { data, live: true }
  } catch {
    return { data: getStaticDashboard(), live: false }
  }
}
