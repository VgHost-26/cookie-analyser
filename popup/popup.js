import {
  STORAGE_CAPTURED_COOKIES_KEY,
  STORAGE_STORED_COOKIES_KEY,
} from '../globals.js'

import { renderCookieList } from '../components.js'
import { simpleCookieClassifier } from '../functions.js'

let capturedCookies = []
let storedCookies = []

let currentTab
let filters = {
  search: '',
  category: 'all',
  party: 'all',
}

;(async function initPopupWindow() {
  console.log('init')
  currentTab = await chrome.tabs.query({
    active: true,
    lastFocusedWindow: true,
  })

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

  // Export button
  // document.getElementById('export-btn').addEventListener('click', exportData)

  // Clear button
  // document.getElementById('clear-btn').addEventListener('click', clearAllCookies)

  // Modal close
  document.querySelector('.close').addEventListener('click', () => {
    document.getElementById('cookie-details-modal').close()
  })
}

function switchTab(tabName) {
  // Update tab buttons
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.remove('active')
  })
  document.querySelector(`[data-tab="${tabName}"]`).classList.add('active')

  // Update tab panes
  document.querySelectorAll('.tab-pane').forEach(pane => {
    pane.classList.remove('active')
  })
  document.getElementById(`${tabName}-tab`).classList.add('active')
}

function updateUI() {
  updateSummaryStats()
  renderCookieList('stored', storedCookies)
  renderCookieList('captured', capturedCookies)
}

function updateSummaryStats() {
  const categories = {
    essential: 0,
    analytics: 0,
    marketing: 0,
  }

  storedCookies.forEach(cookie => {
    const category = simpleCookieClassifier(cookie)
    if (categories.hasOwnProperty(category)) {
      categories[category]++
    }
  })

  document.getElementById('essential-count').textContent = categories.essential
  document.getElementById('analytics-count').textContent = categories.analytics
  document.getElementById('marketing-count').textContent = categories.marketing
}

async function loadCookies() {
  capturedCookies = await getCapturedCookiesFromCurrentTab()
  storedCookies = await storeAndGetCookiesFromCurrentTab()
}

async function storeAndGetCookiesFromCurrentTab() {
  // overrites stored cookies
  let [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (tab?.url) {
    const url = new URL(tab.url)
    const currentDomain = `${url.protocol}//${url.hostname}/`
    console.log('tab url', currentDomain)
    const currentCookies = await chrome.cookies.getAll({ url: currentDomain })
    chrome.storage.local.set({ [STORAGE_STORED_COOKIES_KEY]: currentCookies })
    return currentCookies
  }
}

async function getStoredCookies() {
  const result = await chrome.storage.local.get([STORAGE_STORED_COOKIES_KEY])
  return result[STORAGE_STORED_COOKIES_KEY] || []
}

async function getCapturedCookiesFromCurrentTab() {
  const result = await chrome.storage.local.get([STORAGE_CAPTURED_COOKIES_KEY])
  const cookies = result[STORAGE_CAPTURED_COOKIES_KEY] || []
  return cookies.filter(cookie => cookie.fromTabId === currentTab[0].id)
}

export function applyFilters(cookies) {
  return cookies.filter(cookie => {
    const name = (cookie.name || Object.keys(cookie)[0] || '').toLowerCase()
    const category = simpleCookieClassifier(cookie)
    const isThirdParty = cookie.thirdParty || false

    // Search filter
    if (filters.search && !name.includes(filters.search)) {
      return false
    }

    // Category filter
    if (filters.category !== 'all' && category !== filters.category) {
      return false
    }

    // Party filter
    if (filters.party === 'first' && isThirdParty) return false
    if (filters.party === 'third' && !isThirdParty) return false

    return true
  })
}
