let blocklist = ["doubleclick.net", "google-analytics.com", "facebook.net"];
let trackerCount = {};
let cookieCount = {};
let scoreByTab = {};

function getDomain(url) {
  try {
    return new URL(url).hostname;
  } catch (e) {
    return "";
  }
}

browser.webRequest.onBeforeRequest.addListener(
  details => {
    let domain = getDomain(details.url);
    if (!details.tabId || details.tabId === -1) return;
    if (!trackerCount[details.tabId]) trackerCount[details.tabId] = [];

    let isThirdParty = false;
    browser.tabs.get(details.tabId).then(tab => {
      let mainDomain = getDomain(tab.url);
      isThirdParty = !domain.endsWith(mainDomain);
    });

    if (blocklist.some(b => domain.includes(b))) {
      trackerCount[details.tabId].push(domain);
      return { cancel: true };
    }
  },
  { urls: ["<all_urls>"] },
  ["blocking"]
);

async function analyzeCookies(tabId, url) {
  let cookies = await browser.cookies.getAll({ url });
  cookieCount[tabId] = {
    firstParty: 0,
    thirdParty: 0,
    session: 0,
    persistent: 0
  };

  let mainDomain = getDomain(url);
  cookies.forEach(c => {
    if (c.session) cookieCount[tabId].session++;
    else cookieCount[tabId].persistent++;

    if (c.domain.includes(mainDomain)) cookieCount[tabId].firstParty++;
    else cookieCount[tabId].thirdParty++;
  });
}

browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete") {
    analyzeCookies(tabId, tab.url);
  }
});

function calculateScore(tabId) {
  let trackers = (trackerCount[tabId] || []).length;
  let cookies = cookieCount[tabId] || { firstParty: 0, thirdParty: 0, session: 0, persistent: 0 };
  let storage = scoreByTab[tabId]?.storage || { local: 0, session: 0, indexedDB: 0 };
  let fingerprint = scoreByTab[tabId]?.fingerprint || false;
  let hijacking = scoreByTab[tabId]?.hijacking || [];

  let score = trackers * 2 + cookies.thirdParty * 2 + storage.local + storage.session + storage.indexedDB;
  if (fingerprint.length > 0) score += 5;
  if (hijacking.length > 0) score += 10;

  return { trackers, cookies, storage, fingerprint, hijacking, score };
}

browser.runtime.onMessage.addListener((msg, sender, sendResponse) => {
   const tabId = sender.tab ? sender.tab.id : msg.tabId;
   if (!scoreByTab[tabId]) scoreByTab[tabId] = {};

   switch (msg.type) {
     case "storage_report":
       scoreByTab[tabId].storage = msg.data;
      sendResponse({ ok: true });
      return false;

     case "fingerprint_detected":
       scoreByTab[tabId].fingerprint = scoreByTab[tabId].fingerprint || [];
       scoreByTab[tabId].fingerprint.push(msg.method);
      sendResponse({ ok: true });
      return false;

     case "hijack_detected":
       scoreByTab[tabId].hijacking = scoreByTab[tabId].hijacking || [];
       scoreByTab[tabId].hijacking.push(msg.method);
      sendResponse({ ok: true });
      return false;

     case "get_report":
       const report = calculateScore(tabId);
       sendResponse(report);             

      return false;                       
   }
 });
