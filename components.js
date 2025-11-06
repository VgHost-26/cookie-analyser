import {
  simpleCookieClassifier,
  classifyCookiesInBackground,
  getCookieByName,
  aiCookieClassifier,
  updateCookieInStorage,
} from './functions.js'
import { applyFilters, updateUI } from './popup/popup.js'

export function createCookieItem(cookie, category = null) {
  const name = cookie.name || '(unnamed)'
  const value = cookie.value || cookie[name] || ''
  const cookieAiCategory = cookie.aiCategory || null
  const cookieCategory = category || simpleCookieClassifier(cookie)
  const isThirdParty = cookie.thirdParty || false
  const isSecure = cookie.secure || cookie.Secure || false
  const isInvisible = cookie.invisible || false
  return `
  <div class="cookie-item ${cookieCategory}">
  <div class="cookie-header">
  <span class="cookie-name">${name}</span>
  <div class="cookie-badges">
  ${isInvisible ? '<span class="badge invisible">Invisible</span>' : ''}
  ${
    isThirdParty
      ? '<span class="badge third-party">3rd Party</span>'
      : '<span class="badge first-party">1st Party</span>'
  }
  ${isSecure ? '<span class="badge secure">Secure</span>' : ''}
  </div>
  </div>
  <div class="cookie-meta">
  <span>
  <strong>Category:</strong> ${cookieCategory}
  
  </span>
  ${
    cookieAiCategory
      ? `<span><strong>AI Category:</strong> ${cookieAiCategory}</span>`
      : ''
  }
  
  </div>
  <div class="cookie-value">
  <span><strong>Value:</strong> ${value.substring(0, 50)}${
    value.length > 50 ? '...' : ''
  }
  </span>
  <div class="cookie-buttons">
  <a href="https://cookiepedia.co.uk/cookies/${encodeURIComponent(
    name
  )}" target="_blank" class="cookiepedia-button"><img src="../icons/external.png" /></a>
  <button  type="button" class="ai-button" cookie-name="${name}"><img cookie-name="${name}" src="../icons/stars.png" /></button>
  </div>
  </div>
  </div>
  `
}
export function createNetworkCookieItem(cookie) {
  const isThirdParty = cookie.thirdParty || false
  const isSecure = cookie.secure || cookie.Secure || false

  return `
  <div class="cookie-item network-cookie">
  <div class="cookie-header">
  <span class="cookie-name">Received from ${cookie.domain || '(unknown)'}</span>
  <div class="cookie-badges">
  ${
    isThirdParty
      ? '<span class="badge third-party">3rd Party</span>'
      : '<span class="badge first-party">1st Party</span>'
  }
  ${isSecure ? '<span class="badge secure">Secure</span>' : ''}
  </div>
  </div>
  <div class="cookie-meta">
  <strong>Expires:</strong> ${cookie.expires || 'Session'}
  </div>
  <div class="cookie-value">
  <strong>Captured at:</strong> ${new Date(
    cookie.saveTimestamp
  ).toLocaleString()}
  </div>
  </div>
  `
}

export function renderExternalDomainsList(domainStats) {
  const listElement = document.getElementById('external-domains-list')
  listElement.innerHTML = Object.entries(domainStats)
    .map(([domain, percent]) => {
      return renderDomainItem(domain, percent.toFixed(2) + '%')
    })
    .join('')
}

export function renderDomainItem(domain, percent) {
  return `
  <div class="cookie-item ${domain}">
  <div class="cookie-header">
  <span class="cookie-name">${domain}</span>
  </div>
  <div class="cookie-meta">
  <strong>Amount:</strong> ${percent}
  </div>
  </div>
  `
}

export async function renderCookieList(listType, cookies) {
  const listElement = document.getElementById(`${listType}-cookies-list`)
  const filteredCookies = applyFilters(cookies)

  if (filteredCookies.length === 0) {
    listElement.innerHTML = `
      <div class="empty-state">
        <p>No cookies found</p>
      </div>
    `
    return
  }

  listElement.innerHTML = filteredCookies
    .map(cookie => {
      return listType === 'captured'
        ? createNetworkCookieItem(cookie)
        : createCookieItem(cookie)
    })
    .join('')

  listElement.querySelectorAll('.cookie-item').forEach((item, index) => {
    item.addEventListener('click', () => {
      showCookieDetails(filteredCookies[index])
    })
  })

  listElement.querySelectorAll('.ai-button').forEach(button => {
    button.addEventListener('click', async e => {
      const cookieName = e.target.getAttribute('cookie-name')
      e.stopPropagation()
      console.log('running ai classifier for cookie:', cookieName)
      const promise = aiCookieClassifier(cookieName)
      e.target.setAttribute('src', '../icons/loading.png')
      const results = await promise
      e.target.setAttribute('src', '../icons/stars.png')
      console.log('results: ', results)

      const cookie = await getCookieByName(cookieName)
      await updateCookieInStorage({
        ...cookie,
        aiCategory: results,
      })
      updateUI()
    })
  })

  if (listType === 'stored') {
    // classifyCookiesInBackground(filteredCookies, listElement)
  }
}

export function showCookieDetails(cookie) {
  const modal = document.getElementById('cookie-details-modal')
  const detailsDiv = document.getElementById('cookie-details')

  const details = [
    { label: 'Name', value: cookie.name || '(Network Cookie)' },
    { label: 'Value', value: cookie.value || '' },
    {
      label: 'Category',
      value: cookie.aiCategory || simpleCookieClassifier(cookie),
    },
    { label: 'Domain', value: cookie.domain || 'N/A' },
    { label: 'Path', value: cookie.path || cookie.Path || '/' },
    {
      label: 'Expires',
      value: cookie.expirationDate
        ? new Date(cookie.expirationDate * 1000).toLocaleString()
        : cookie.Expires || 'Session',
    },
    { label: 'Secure', value: cookie.secure || cookie.Secure ? 'Yes' : 'No' },
    {
      label: 'HttpOnly',
      value: cookie.httpOnly || cookie.HttpOnly ? 'Yes' : 'No',
    },
    { label: 'SameSite', value: cookie.sameSite || cookie.SameSite || 'None' },
    { label: 'Third Party', value: cookie.thirdParty ? 'Yes' : 'No' },
    { label: 'URL', value: cookie.url || 'N/A' },
    {
      label: 'Captured At',
      value: cookie.saveTimestamp
        ? new Date(cookie.saveTimestamp).toLocaleString()
        : 'N/A',
    },
  ]

  detailsDiv.innerHTML = details
    .map(
      detail => `
    <div class="detail-row">
      <div class="detail-label">${detail.label}:</div>
      <div class="detail-value">${detail.value}</div>
    </div>
  `
    )
    .join('')

  modal.showModal()
}
