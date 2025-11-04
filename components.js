import { simpleCookieClassifier } from "./functions.js"
import { applyFilters } from "./popup/popup.js"

export function createCookieItem(cookie) {
  // TODO Adjust this and fix this shit
  // const name = cookie.name || Object.keys(cookie)[0]
  const name = cookie.name || '(unnamed)'
  const value = cookie.value || cookie[name] || ''
  const category = simpleCookieClassifier(cookie)
  const isThirdParty = cookie.thirdParty || false
  const isSecure = cookie.secure || cookie.Secure || false
  const isInvisible = cookie.invisible || false
  
  return `
  <div class="cookie-item ${category}">
  <div class="cookie-header">
  <span class="cookie-name">${name}</span>
  <div class="cookie-badges">
  ${isInvisible ? '<span class="badge invisible">Invisible</span>' : ''}
  ${isThirdParty ? '<span class="badge third-party">3rd Party</span>' : '<span class="badge first-party">1st Party</span>'}
  ${isSecure ? '<span class="badge secure">Secure</span>' : ''}
  </div>
  </div>
  <div class="cookie-meta">
  <strong>Category:</strong> ${category}
  </div>
  <div class="cookie-value">
  <strong>Value:</strong> ${value.substring(0, 50)}${value.length > 50 ? '...' : ''}
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
  ${isThirdParty ? '<span class="badge third-party">3rd Party</span>' : '<span class="badge first-party">1st Party</span>'}
  ${isSecure ? '<span class="badge secure">Secure</span>' : ''}
  </div>
  </div>
  <div class="cookie-meta">
  <strong>Expires:</strong> ${cookie.expires || 'Session'}
  </div>
  <div class="cookie-value">
  <strong>Captured at:</strong> ${new Date(cookie.saveTimestamp).toLocaleString()}
  </div>
  </div>
  `
}

export function renderCookieList(listType, cookies) {
  // TODO fix this AI shit
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
  
  listElement.innerHTML = filteredCookies.map(cookie => {
    return listType === 'captured' ? createNetworkCookieItem(cookie) : createCookieItem(cookie)
  }).join('')
  
  // Add click listeners
  listElement.querySelectorAll('.cookie-item').forEach((item, index) => {
    item.addEventListener('click', () => {
      showCookieDetails(filteredCookies[index])
    })
  })
}


export function showCookieDetails(cookie) {
  const modal = document.getElementById('cookie-details-modal')
  const detailsDiv = document.getElementById('cookie-details')
  
  const details = [
    { label: 'Name', value: cookie.name || '(Network Cookie)' },
    { label: 'Value', value: cookie.value || '' },
    { label: 'Category', value: simpleCookieClassifier(cookie) },
    { label: 'Domain', value: cookie.domain || 'N/A' },
    { label: 'Path', value: cookie.path || cookie.Path || '/' },
    { label: 'Expires', value: cookie.expirationDate ? new Date(cookie.expirationDate * 1000).toLocaleString() : (cookie.Expires || 'Session') },
    { label: 'Secure', value: (cookie.secure || cookie.Secure) ? 'Yes' : 'No' },
    { label: 'HttpOnly', value: (cookie.httpOnly || cookie.HttpOnly) ? 'Yes' : 'No' },
    { label: 'SameSite', value: cookie.sameSite || cookie.SameSite || 'None' },
    { label: 'Third Party', value: cookie.thirdParty ? 'Yes' : 'No' },
    { label: 'URL', value: cookie.url || 'N/A' },
    { label: 'Captured At', value: cookie.saveTimestamp ? new Date(cookie.saveTimestamp).toLocaleString() : 'N/A' },
  ]
  
  detailsDiv.innerHTML = details.map(detail => `
    <div class="detail-row">
      <div class="detail-label">${detail.label}:</div>
      <div class="detail-value">${detail.value}</div>
    </div>
  `).join('')
  
  modal.showModal()
}