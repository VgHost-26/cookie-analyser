import { STORAGE_CAPTURED_COOKIES_KEY, STORAGE_STORED_COOKIES_KEY } from "../globals";


let capturedCookies = []
let storedCookies = []
let currentTab
;(async function initPopupWindow() {
  console.log('init')
  currentTab = await chrome.tabs.query({
    active: true,
    lastFocusedWindow: true,
  })

  try {
    storedCookies = await chrome.cookies.getAll({ url: currentTab[0].url })
    console.log('Stored Cookies:', storedCookies)
    chrome.storage.local.set({ [STORAGE_STORED_COOKIES_KEY]: storedCookies })
  } catch {
    console.log('something went wrong')
  }

  chrome.storage.local.get([STORAGE_CAPTURED_COOKIES_KEY], result => {
    capturedCookies = result.capturedCookies || []
    console.log('Captured cookies:', capturedCookies)
  })

})()
