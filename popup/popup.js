import {
  STORAGE_CAPTURED_COOKIES_KEY,
  STORAGE_STORED_COOKIES_KEY,
  VIEWS,
} from '../globals.js'

import { renderCookieList, renderExternalDomainsList } from '../components.js'
import {
  deleteDomainCookies,
  getCapturedCookiesStats,
  getCurrentTab,
  simpleCookieClassifier,
} from '../functions.js'

let capturedCookies = []
let storedCookies = []

let currentTab
let currentTabURL
let filters = {
  search: '',
  category: 'all',
  party: 'all',
  thisTabOnly: true,
}
let currentView = VIEWS.STORED

;(async function initPopupWindow() {
  currentTab = await getCurrentTab()
  if (currentTab?.url) {
    currentTabURL = new URL(currentTab?.url)
  } else {
    currentTabURL = undefined
  }

  await loadCookies()
  setupEventListeners()
  updateUI()
})()

function setupEventListeners() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      switchTab(e.target.dataset.tab)
    })
  })

  document.getElementById('search').addEventListener('input', e => {
    filters.search = e.target.value.toLowerCase()
    updateUI()
  })

  document.getElementById('category-filter').addEventListener('change', e => {
    filters.category = e.target.value
    updateUI()
  })

  document.getElementById('party-filter').addEventListener('change', e => {
    filters.party = e.target.value
    updateUI()
  })

  document
    .getElementById('is-only-current-tab')
    .addEventListener('change', e => {
      filters.thisTabOnly = e.target.checked
      updateUI()
    })

  // Export button
  // document.getElementById('export-btn').addEventListener('click', exportData)

  document.getElementById('clear-btn').addEventListener('click', async () => {
    console.log(await deleteDomainCookies(currentTabURL.hostname))
    await storeAndGetCookiesFromCurrentTab()
    updateUI()

  })

  document.querySelector('.close').addEventListener('click', () => {
    document.getElementById('cookie-details-modal').close()
  })
}

function switchTab(tabName) {
  currentView = tabName

  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.remove('active')
  })
  document.querySelector(`[data-tab="${tabName}"]`).classList.add('active')

  document.querySelectorAll('.tab-pane').forEach(pane => {
    pane.classList.remove('active')
  })
  document.getElementById(`${tabName}-tab`).classList.add('active')

  if (currentView === VIEWS.DOMAINS) {
    document.getElementById('is-only-current-tab-label').style.display = 'flex'
  } else {
    document.getElementById('is-only-current-tab-label').style.display = 'none'
  }
}

export async function updateUI() {
  updateSummaryStats()
  storedCookies = await getStoredCookies()
  console.log('Stored cookies:', storedCookies)
  capturedCookies = await getCapturedCookiesFromCurrentTab()
  renderCookieList('stored', storedCookies)
  renderCookieList('captured', capturedCookies)

  let capturedCookieStats
  if (filters.thisTabOnly) {
    capturedCookieStats = getCapturedCookiesStats(capturedCookies)
  } else {
    const allCapturedCookies = await getCapturedCookies()
    capturedCookieStats = getCapturedCookiesStats(allCapturedCookies)
  }

  renderExternalDomainsList(capturedCookieStats.domainStats)
}

window.updateSummaryStats = async function updateSummaryStats() {
  const categories = {
    essential: 0,
    analytics: 0,
    marketing: 0,
    functional: 0,
    externalDomains: 0,
  }

  storedCookies.forEach(cookie => {
    const category = simpleCookieClassifier(cookie)
    if (categories.hasOwnProperty(category)) {
      categories[category]++
    }
  })
  const capturedCurrTab = await getCapturedCookiesFromCurrentTab()
  const capturedCookieStats = getCapturedCookiesStats(capturedCurrTab)
  categories.externalDomains = capturedCookieStats.numOfDomains

  console.log(
    `%c[Stats Update] Essential: ${categories.essential}, Analytics: ${categories.analytics}, Marketing: ${categories.marketing}, External Domains: ${categories.externalDomains}, Functional: ${categories.functional}`,
    'color: #00BCD4'
  )

  document.getElementById('essential-count').textContent = categories.essential
  document.getElementById('analytics-count').textContent = categories.analytics
  document.getElementById('marketing-count').textContent = categories.marketing
  document.getElementById('external-domains-count').textContent =
    categories.externalDomains
  document.getElementById('functional-count').textContent =
    categories.functional
}

async function loadCookies() {
  capturedCookies = await getCapturedCookiesFromCurrentTab()
  storedCookies = await storeAndGetCookiesFromCurrentTab()
}

async function storeAndGetCookiesFromCurrentTab() {
  // NOTE: it overrites stored cookies but keeps aiCategory

  let [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (tab?.url) {
    const url = new URL(tab.url)
    const currentDomain = `${url.protocol}//${url.hostname}/`
    console.log('tab url', currentDomain)
    let currentCookies = await chrome.cookies.getAll({ url: currentDomain })
    const oldCookies = await getStoredCookies()
    if (oldCookies.length > 0) {
      console.log('old cookies exists')
      currentCookies = transferAiClassification(oldCookies, currentCookies)
    }

    chrome.storage.local.set({ [STORAGE_STORED_COOKIES_KEY]: currentCookies })
    return currentCookies
  }
}

async function getStoredCookies() {
  const result = await chrome.storage.local.get([STORAGE_STORED_COOKIES_KEY])
  return result[STORAGE_STORED_COOKIES_KEY] || []
}

async function getCapturedCookies() {
  const result = await chrome.storage.local.get([STORAGE_CAPTURED_COOKIES_KEY])
  return result[STORAGE_CAPTURED_COOKIES_KEY] || []
}

async function getCapturedCookiesFromCurrentTab() {
  const result = await chrome.storage.local.get([STORAGE_CAPTURED_COOKIES_KEY])
  const cookies = result[STORAGE_CAPTURED_COOKIES_KEY] || []
  return cookies.filter(
    cookie =>
      cookie.fromTabId === currentTab.id &&
      cookie.capturedAtDomain === currentTabURL?.hostname
  )
}

export function applyFilters(cookies) {
  return cookies.filter(cookie => {
    const name = (cookie.name || Object.keys(cookie)[0] || '').toLowerCase()
    const category = cookie.aiCategory || simpleCookieClassifier(cookie)
    const isThirdParty = cookie.thirdParty || false

    if (filters.search && !name.includes(filters.search)) {
      return false
    }

    if (filters.category !== 'all' && category !== filters.category) {
      return false
    }

    if (filters.party === 'first' && isThirdParty) return false
    if (filters.party === 'third' && !isThirdParty) return false

    return true
  })
}

function transferAiClassification(oldCookies, newCookies) {
  return newCookies.map(newCookie => {
    const oldCookie = oldCookies.find(
      oldCookie => oldCookie.name === newCookie.name
    )
    if (!oldCookie?.aiCategory) return newCookie
    return {
      ...newCookie,
      aiCategory: oldCookie.aiCategory,
    }
  })
}
