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

  const cookieString = JSON.stringify(cookie)

  try {
    const response = await chrome.runtime.sendMessage({
      type: 'CLASSIFY_COOKIE',
      cookieName: cookieString, //NOTE trying with the whole cookiei but it doesnt work well
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

export function getSecurityScore(cookie) {}

//debug info shown in Inspect popup console
export async function classifyCookiesInBackground(cookies, listElement) {
  console.log(
    `%c[AI Classification] Starting background classification for ${cookies.length} cookies`,
    'color: #4CAF50; font-weight: bold'
  )

  for (let i = 0; i < cookies.length; i++) {
    const cookie = cookies[i]
    if (!cookie.aiCategory) {
      const startTime = performance.now()
      try {
        const oldCategory = simpleCookieClassifier(cookie)
        // const category = await aiCookieClassifier(cookie)
        const category = ''
        const duration = (performance.now() - startTime).toFixed(2)

        cookie.aiCategory = category

        const changed = category !== oldCategory
        const logColor = changed ? '#FF9800' : '#2196F3'
        const changeIndicator = changed ? '🔄' : '✓'

        console.log(
          `%c${changeIndicator} [${i + 1}/${cookies.length}] "${cookie.name}"`,
          `color: ${logColor}`,
          `\n  Keyword: ${oldCategory}`,
          `\n  AI Model: ${category}`,
          `\n  Changed: ${changed ? 'YES' : 'NO'}`,
          `\n  Time: ${duration}ms`
        )

        if (changed) {
          const cookieItems = listElement.querySelectorAll('.cookie-item')
          if (cookieItems[i]) {
            cookieItems[i].className = `cookie-item ${category}`
            const metaDiv = cookieItems[i].querySelector('.cookie-meta')
            if (metaDiv) {
              metaDiv.innerHTML = `<strong>Category:</strong> ${category}`
            }
          }

          if (typeof window.updateSummaryStats === 'function') {
            window.updateSummaryStats()
          }
        }
      } catch (error) {
        const duration = (performance.now() - startTime).toFixed(2)
        console.error(
          `%c❌ [${i + 1}/${cookies.length}] "${
            cookie.name
          }" failed (${duration}ms)`,
          'color: #F44336',
          error
        )
      }
    }
  }

  console.log(
    `%c[AI Classification] Completed all classifications`,
    'color: #4CAF50; font-weight: bold'
  )
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
