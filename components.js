import { simpleCookieClassifier, aiCookieClassifier } from "./functions.js"
import { applyFilters } from "./popup/popup.js"

export function createCookieItem(cookie, category = null) {
  const name = cookie.name || '(unnamed)'
  const value = cookie.value || cookie[name] || ''
  const cookieCategory = category || cookie.aiCategory || simpleCookieClassifier(cookie)
  const isThirdParty = cookie.thirdParty || false
  const isSecure = cookie.secure || cookie.Secure || false
  const isInvisible = cookie.invisible || false

  return `
  <div class="cookie-item ${cookieCategory}">
  <div class="cookie-header">
  <span class="cookie-name">${name}</span>
  <div class="cookie-badges">
  ${isInvisible ? '<span class="badge invisible">Invisible</span>' : ''}
  ${isThirdParty ? '<span class="badge third-party">3rd Party</span>' : '<span class="badge first-party">1st Party</span>'}
  ${isSecure ? '<span class="badge secure">Secure</span>' : ''}
  </div>
  <div class="cookie-buttons">
  <a href="https://cookiepedia.co.uk/cookies/${encodeURIComponent(name)}" target="_blank" id="cookiepedia-button" cookie-name="${name}" class="cookiepedia-button"><img src="../icons/external.png" /></a>
  <button id="ai-button" cookie-name="${name}" type="button" class="ai-button"><img src="../icons/stars.png" /></button>
  </div>
  </div>
  <div class="cookie-meta">
  <strong>Category:</strong> ${cookieCategory}
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

  listElement.innerHTML = filteredCookies.map(cookie => {
    return listType === 'captured' ? createNetworkCookieItem(cookie) : createCookieItem(cookie)
  }).join('')

  listElement.querySelectorAll('.cookie-item').forEach((item, index) => {
    item.addEventListener('click', () => {
      showCookieDetails(filteredCookies[index])
    })
  })

  if (listType === 'stored') {
    classifyCookiesInBackground(filteredCookies, listElement);
  }
}

//debug info shown in Inspect popup console
async function classifyCookiesInBackground(cookies, listElement) {
  console.log(`%c[AI Classification] Starting background classification for ${cookies.length} cookies`, 'color: #4CAF50; font-weight: bold');

  for (let i = 0; i < cookies.length; i++) {
    const cookie = cookies[i];
    if (!cookie.aiCategory) {
      const startTime = performance.now();
      try {
        const oldCategory = simpleCookieClassifier(cookie);
        const category = await aiCookieClassifier(cookie);
        const duration = (performance.now() - startTime).toFixed(2);

        cookie.aiCategory = category;

        const changed = category !== oldCategory;
        const logColor = changed ? '#FF9800' : '#2196F3';
        const changeIndicator = changed ? '🔄' : '✓';

        console.log(
          `%c${changeIndicator} [${i + 1}/${cookies.length}] "${cookie.name}"`,
          `color: ${logColor}`,
          `\n  Keyword: ${oldCategory}`,
          `\n  AI Model: ${category}`,
          `\n  Changed: ${changed ? 'YES' : 'NO'}`,
          `\n  Time: ${duration}ms`
        );

        if (changed) {
          const cookieItems = listElement.querySelectorAll('.cookie-item');
          if (cookieItems[i]) {
            cookieItems[i].className = `cookie-item ${category}`;
            const metaDiv = cookieItems[i].querySelector('.cookie-meta');
            if (metaDiv) {
              metaDiv.innerHTML = `<strong>Category:</strong> ${category}`;
            }
          }

          if (typeof window.updateSummaryStats === 'function') {
            window.updateSummaryStats();
          }
        }
      } catch (error) {
        const duration = (performance.now() - startTime).toFixed(2);
        console.error(`%c❌ [${i + 1}/${cookies.length}] "${cookie.name}" failed (${duration}ms)`, 'color: #F44336', error);
      }
    }
  }

  console.log(`%c[AI Classification] Completed all classifications`, 'color: #4CAF50; font-weight: bold');
}


export function showCookieDetails(cookie) {
  const modal = document.getElementById('cookie-details-modal')
  const detailsDiv = document.getElementById('cookie-details')

  const details = [
    { label: 'Name', value: cookie.name || '(Network Cookie)' },
    { label: 'Value', value: cookie.value || '' },
    { label: 'Category', value: cookie.aiCategory || simpleCookieClassifier(cookie) },
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