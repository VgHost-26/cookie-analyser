import { parseCookieFromHeader } from './functions.js'
import { STORAGE_CAPTURED_COOKIES_KEY } from './globals.js'

chrome.runtime.onInstalled.addListener(({ reason }) => {
  console.log('Extension installed, reason: ', reason)
  if (reason == 'install') {
    chrome.storage.local.set({ [STORAGE_CAPTURED_COOKIES_KEY]: [] })
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
  function (details) {
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

        chrome.storage.local.get([STORAGE_CAPTURED_COOKIES_KEY], result => {
          const cookies = result.capturedCookies || []

          bakedCookies.forEach(bakedCookie => {
            cookies.push({
              ...bakedCookie,
              url: details.url,
              saveTimestamp: Date.now(),
              method: details.method,
            })
          })

          if (cookies.length > 100) {
            // prevent to many cookies in the sotorage
            // TODO: adjust this value maybe
            console.log(`cut last ${cookies.length - 100} cookies`)
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
