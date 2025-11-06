import { parseCookieFromHeader } from './functions.js'
import {
  STORAGE_CAPTURED_COOKIES_KEY,
  STORAGE_STORED_COOKIES_KEY,
} from './globals.js'

async function setupOffscreenDocument() {
  const offscreenUrl = chrome.runtime.getURL('offscreen.html');
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
    documentUrls: [offscreenUrl]
  });

  if (existingContexts.length > 0) {
    return;
  }

  await chrome.offscreen.createDocument({
    url: 'offscreen.html',
    reasons: ['DOM_SCRAPING'],
    justification: 'ONNX Runtime for cookie classification'
  });
}

chrome.runtime.onInstalled.addListener(({ reason }) => {
  console.log('Extension installed, reason: ', reason)
  if (reason == 'install') {
    chrome.storage.local.set({ [STORAGE_CAPTURED_COOKIES_KEY]: [] })
    chrome.storage.local.set({ [STORAGE_STORED_COOKIES_KEY]: [] })
  }
  setupOffscreenDocument();
})

chrome.runtime.onStartup.addListener(() => {
  setupOffscreenDocument();
})

async function classifyCookieViaOffscreen(cookieName) {
  await setupOffscreenDocument();
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({
      type: 'CLASSIFY_COOKIE',
      cookieName: cookieName
    }, (response) => {
      resolve(response);
    });
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'CLASSIFY_COOKIE' && !sender.url?.includes('offscreen.html')) {
    classifyCookieViaOffscreen(message.cookieName).then(response => {
      sendResponse(response);
    });
    return true;
  }
})

// chrome.webRequest.onHeadersReceived.addListener(
//   function(details){
//     // console.log('Headers received: ', details)
//   },
//   {urls: ["<all_urls>"]},
// )

// chrome.webRequest.onBeforeRequest.addListener(
//   function (details) {
//     // console.log('Before request: ', details)
//     if (details.method === 'OPTIONS') {
//       console.log('OPTIONS request detected:', details)
//     }
//   },
//   { urls: ['<all_urls>'] },
//   ['extraHeaders', 'requestBody']
// )

// chrome.webRequest.onBeforeRequest.addListener(
//   details => {
//     console.log('Before request: ', details)
//   },
//   { urls: ['<all_urls>'] },
// )

chrome.webRequest.onHeadersReceived.addListener(
  async function (details) {
    if (details.responseHeaders && details.responseHeaders.length > 0) {
      const cookieDough = details.responseHeaders.filter(
        header => header.name.toLowerCase() === 'set-cookie'
      )
      if (cookieDough.length > 0) {

        console.log('------- Cookie detected -------')
        console.log('Raw cookie dough:', cookieDough)

        const bakedCookies = parseCookieFromHeader(
          cookieDough.map(c => c.value)
        )

        console.log(bakedCookies)

        let [tab] = await chrome.tabs.query({
          active: true,
          currentWindow: true,
        })
        console.log('Current tab:', tab)
        if (!tab?.url) return
        const currentUrl = new URL(tab?.url)

        chrome.storage.local.get([STORAGE_CAPTURED_COOKIES_KEY], result => {
          const cookies = result.capturedCookies || []
          console.log('=========== Initiator:', details.initiator)
          const initiatorURL = new URL(details.initiator)
          console.log('current url:', currentUrl.hostname)
          console.log('Initiator URL:', initiatorURL.hostname)
          const thirdParty = currentUrl.hostname !== initiatorURL.hostname

          if (thirdParty) {
            console.log('Third party cookie detected')
            console.log('initiator:', initiatorURL.hostname)
            console.log('currentUrl:', currentUrl.hostname)
          }

          bakedCookies.forEach(bakedCookie => {
            cookies.push({
              ...bakedCookie,
              url: details.url,
              domain: bakedCookie.domain || new URL(details.url).hostname,
              saveTimestamp: Date.now(),
              method: details.method,
              thirdParty: thirdParty,
              fromTabId: tab.id,
            })
          })

          if (cookies.length > 100) {
            const recentCookies = cookies.slice(-100)
            chrome.storage.local.set({ capturedCookies: recentCookies })
          } else {
            chrome.storage.local.set({ capturedCookies: cookies })
          }
        })
      }
    }
  },
  { urls: ['<all_urls>'] },
  ['responseHeaders', 'extraHeaders']
)
