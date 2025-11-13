import { COOKIE_CATEGORIES, STORAGE_STORED_COOKIES_KEY } from './globals.js'
import {
  analyticsKeywords,
  essentialKeywords,
  functionalKeywords,
  marketingKeywords,
} from './keywords.js'

export function parseCookieFromHeader(rawCookies) {
  return rawCookies.map(rawCookie => {
    const props = rawCookie.split(';')
    const bakedCookies = {}
    props.map(prop => {
      const [name, value] = prop.split('=')
      const nameTrimed = name.trim().toLowerCase()
      bakedCookies[nameTrimed] = value
    })
    return bakedCookies
  })
}

export function simpleCookieClassifier(cookie) {
  if (!cookie.name) return COOKIE_CATEGORIES.UNKNOWN

  const cookieName = cookie.name.toLowerCase()
  if (marketingKeywords.some(keyword => cookieName.includes(keyword)))
    return COOKIE_CATEGORIES.MARKETING
  if (analyticsKeywords.some(keyword => cookieName.includes(keyword)))
    return COOKIE_CATEGORIES.ANALYTICS
  if (functionalKeywords.some(keyword => cookieName.includes(keyword)))
    return COOKIE_CATEGORIES.FUNCTIONAL
  if (essentialKeywords.some(keyword => cookieName.includes(keyword)))
    return COOKIE_CATEGORIES.ESSENTIAL

  return COOKIE_CATEGORIES.UNKNOWN
}

export async function getCookieByName(cookieName) {
  const result = await chrome.storage.local.get([STORAGE_STORED_COOKIES_KEY])
  const cookieList = result[STORAGE_STORED_COOKIES_KEY] || []

  return cookieList.find(cookie => cookie.name === cookieName)
}

export async function aiCookieClassifier(cookieName) {
  if (!cookieName) return COOKIE_CATEGORIES.UNKNOWN

  const cookie = await getCookieByName(cookieName)
  if (!cookie) {
    console.warn(`Failed to find a cookie named "${cookieName}"`)
    return COOKIE_CATEGORIES.UNKNOWN
  }

  const stringifiedCookie = prepareCookieForAiInput(cookie)
  console.log('stringified cookie:', stringifiedCookie)
  try {
    const response = await chrome.runtime.sendMessage({
      type: 'CLASSIFY_COOKIE',
      cookieName: stringifiedCookie,
    })
    return response.category
  } catch (error) {
    console.error('Error in AI classification:', error)
    return simpleCookieClassifier(cookie)
  }
}

export function getCapturedCookiesStats(capturedCookies) {
  const domains = capturedCookies.map(cookie => cookie.domain)
  const domainCount = {}

  capturedCookies.map(cookie => {
    if (domainCount[cookie.domain]) {
      domainCount[cookie.domain] = domainCount[cookie.domain] + 1
    } else {
      domainCount[cookie.domain] = 1
    }
  })

  const domainPercent = {}
  Object.entries(domainCount).map(([key, val]) => {
    domainPercent[key] = (val / capturedCookies.length) * 100
  })

  const sorted = Object.fromEntries(
    Object.entries(domainPercent).sort(([, a], [, b]) => b - a)
  )

  return {
    domains: [...new Set(domains)],
    domainStats: sorted,
    numOfDomains: Object.keys(domainCount).length,
  }
}

export async function getCurrentTab() {
  let queryOptions = { active: true, lastFocusedWindow: true }
  let [tab] = await chrome.tabs.query(queryOptions)
  return tab
}

export async function updateCookieInStorage(updatedCookie) {
  const result = await chrome.storage.local.get([STORAGE_STORED_COOKIES_KEY])
  const cookies = result[STORAGE_STORED_COOKIES_KEY] || []
  const index = cookies.findIndex(cookie => cookie.name === updatedCookie.name)

  if (index !== -1) {
    cookies[index] = updatedCookie
    await chrome.storage.local.set({ [STORAGE_STORED_COOKIES_KEY]: cookies })
    return true
  }
  return false
}

export async function deleteDomainCookies(domain) {
  console.log('deleting from', domain)
  let cookiesDeleted = 0
  try {
    const cookies = await chrome.cookies.getAll({ domain })

    if (cookies.length === 0) {
      return 'No cookies found'
    }

    let pending = cookies.map(deleteCookie)
    await Promise.all(pending)

    cookiesDeleted = pending.length
  } catch (error) {
    return `Unexpected error: ${error.message}`
  }

  return `Deleted ${cookiesDeleted} cookie(s).`
}

function calculateExpirationCategory(cookie) {
  let expirationCategory = 'unknown'
  const isSession = cookie.expirationDate ? false : true

  if (cookie.expirationDate && typeof cookie.expirationDate === 'number') {
    const days =
      (cookie.expirationDate * 1000 - Date.now()) / (1000 * 60 * 60 * 24)
    if (days <= 1) expirationCategory = 'short'
    else if (days <= 30) expirationCategory = 'medium'
    else if (days <= 365) expirationCategory = 'long'
    else expirationCategory = 'persistent'
  } else if (cookie.Expires && typeof cookie.Expires === 'string') {
    expirationCategory = cookie.Expires
  } else if (isSession) {
    expirationCategory = 'session'
  }
  return expirationCategory
}

function prepareCookieForAiInput(cookie) {
  const cookie_name = cookie.name || ''
  const cookie_domain = cookie.domain || ''
  const cookie_session_flag = cookie.expirationDate ? 'persistent' : 'session'
  const cookie_expiration_cat = calculateExpirationCategory(cookie)
  return `${cookie_name} ${cookie_domain} ${cookie_session_flag} ${cookie_expiration_cat}`
}

function deleteCookie(cookie) {
  const protocol = cookie.secure ? 'https:' : 'http:'

  const cookieUrl = `${protocol}//${cookie.domain}${cookie.path}`

  return chrome.cookies.remove({
    url: cookieUrl,
    name: cookie.name,
    storeId: cookie.storeId,
  })
}

export function getSecurityScore(cookie) {
  // Returns a danger-oriented score (0-100) where higher = more dangerous
  if (!cookie) return { score: 0, level: 'unknown', reasons: [] }

  const reasons = []
  let score = 0

  // 1) Third-party
  if (cookie.thirdParty) {
    score += 20
    reasons.push('Third-party cookie (+20)')
  }

  // 2) Category-based (marketing/analytics are more concerning)
  const cat = simpleCookieClassifier(cookie)
  if (cat === COOKIE_CATEGORIES.MARKETING) {
    score += 20
    reasons.push('Marketing/tracking cookie (+20)')
  } else if (cat === COOKIE_CATEGORIES.ANALYTICS) {
    score += 10
    reasons.push('Analytics cookie (+10)')
  } else if (cat === COOKIE_CATEGORIES.FUNCTIONAL) {
    score += 5
    reasons.push('Functional cookie (+5)')
  }

  // 3) HttpOnly
  const isHttpOnly = !!(cookie.httpOnly || cookie.HttpOnly)
  if (!isHttpOnly) {
    score += 15
    reasons.push('Missing HttpOnly (+15)')
  }

  // 4) Secure flag
  const isSecure = !!(cookie.secure || cookie.Secure)
  if (!isSecure) {
    score += 15
    reasons.push('Missing Secure (+15)')
  }

  // 5) SameSite
  const sameSite = (cookie.sameSite || cookie.SameSite || 'none').toLowerCase()
  if (sameSite === 'none') {
    score += 10
    reasons.push('SameSite=None (+10)')
  } else if (sameSite === 'lax') {
    score += 5
    reasons.push('SameSite=Lax (+5)')
  } // strict = good => no penalty

  // 6) Lifespan / expiration
  const expCat = calculateExpirationCategory(cookie) // uses existing helper
  if (expCat === 'session') {
    // session = good (no addition)
  } else if (expCat === 'short') {
    score += 5
    reasons.push('Short-lived persistent (+5)')
  } else if (expCat === 'medium') {
    score += 10
    reasons.push('Medium lifespan (+10)')
  } else if (expCat === 'long') {
    score += 18
    reasons.push('Long lifespan (+18)')
  } else if (expCat === 'persistent') {
    score += 30
    reasons.push('Very long / persistent (+30)')
  } else {
    // unknown -> small penalty
    score += 5
    reasons.push('Unknown expiration (+5)')
  }

  // 7) Domain scope
  const domain = cookie.domain || ''
  if (domain.startsWith('.')) {
    score += 8
    reasons.push('Wildcard domain (accessible by subdomains) (+8)')
  }

  // 8) Path scope
  const path = cookie.path || cookie.Path || '/'
  if (path === '/' || !path) {
    score += 4
    reasons.push('Site-wide path (/) (+4)')
  }

  // 9) Value heuristics (possible identifiers)
  const value = (cookie.value || cookie.value || '').toString()
  if (value.length > 100) {
    score += 6
    reasons.push('Large cookie value (possible token) (+6)')
  }
  if (/id=|user|uuid|token|auth/i.test(value)) {
    score += 8
    reasons.push('Value contains identifiers/tokens (+8)')
  }

  // clamp score
  score = Math.max(0, Math.min(100, Math.round(score)))

  // level
  let level = 'low'
  if (score >= 90) level = 'critical'
  else if (score >= 70) level = 'high'
  else if (score >= 40) level = 'medium'
  else if (score >= 20) level = 'low-medium'

  return {
    score,
    level,
    reasons,
    breakdown: {
      category: cat,
      sameSite,
      expirationCategory: expCat,
      httpOnly: isHttpOnly,
      secure: isSecure,
      thirdParty: !!cookie.thirdParty,
    },
  }
}
