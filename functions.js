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

export async function deleteDomainCookies(domain) {
  console.log("deleting from", domain)
  let cookiesDeleted = 0;
  try {
    const cookies = await chrome.cookies.getAll({ domain });

    if (cookies.length === 0) {
      return 'No cookies found';
    }

    let pending = cookies.map(deleteCookie);
    await Promise.all(pending);

    cookiesDeleted = pending.length;
  } catch (error) {
    return `Unexpected error: ${error.message}`;
  }

  return `Deleted ${cookiesDeleted} cookie(s).`;
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
  // Cookie deletion is largely modeled off of how deleting cookies works when using HTTP headers.
  // Specific flags on the cookie object like `secure` or `hostOnly` are not exposed for deletion
  // purposes. Instead, cookies are deleted by URL, name, and storeId. Unlike HTTP headers, though,
  // we don't have to delete cookies by setting Max-Age=0; we have a method for that ;)
  //
  // To remove cookies set with a Secure attribute, we must provide the correct protocol in the
  // details object's `url` property.
  // https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie#Secure
  const protocol = cookie.secure ? 'https:' : 'http:';

  // Note that the final URL may not be valid. The domain value for a standard cookie is prefixed
  // with a period (invalid) while cookies that are set to `cookie.hostOnly == true` do not have
  // this prefix (valid).
  // https://developer.chrome.com/docs/extensions/reference/cookies/#type-Cookie
  const cookieUrl = `${protocol}//${cookie.domain}${cookie.path}`;

  return chrome.cookies.remove({
    url: cookieUrl,
    name: cookie.name,
    storeId: cookie.storeId
  });
}
