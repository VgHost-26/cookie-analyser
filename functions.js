import { COOKIE_CATEGORIES } from './globals.js'
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

export async function aiCookieClassifier(cookie) {
  if (!cookie.name) return COOKIE_CATEGORIES.UNKNOWN

  try {
    const response = await chrome.runtime.sendMessage({
      type: 'CLASSIFY_COOKIE',
      cookieName: cookie.name
    });
    return response.category;
  } catch (error) {
    console.error('Error in AI classification:', error);
    return simpleCookieClassifier(cookie);
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
  console.log(domainCount)

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
  }
}

export async function getCurrentTab() {
  let queryOptions = { active: true, lastFocusedWindow: true }
  let [tab] = await chrome.tabs.query(queryOptions)
  return tab
}


export function getSecurityScore(cookie){
  

}