import { COOKIE_CATEGORIES } from "./globals.js"
import { analyticsKeywords, essentialKeywords, marketingKeywords } from "./keywords.js"

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
  if (marketingKeywords.some(keyword => cookieName.includes(keyword))) return COOKIE_CATEGORIES.MARKETING
  if (analyticsKeywords.some(keyword => cookieName.includes(keyword))) return COOKIE_CATEGORIES.ANALYTICS
  if (essentialKeywords.some(keyword => cookieName.includes(keyword))) return COOKIE_CATEGORIES.ESSENTIAL

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

export function getCapturedCookiesStats(capturedCookies){

  const stats ={
    domains: [],
    domainStats: {},

  }

}
