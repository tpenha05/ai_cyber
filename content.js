(function() {
  let storageInfo = {
    local: Object.keys(localStorage).length,
    session: Object.keys(sessionStorage).length,
    indexedDB: 0
  };

  if (window.indexedDB) {
    let req = indexedDB.databases ? indexedDB.databases() : Promise.resolve([]);
    req.then(dbs => {
      storageInfo.indexedDB = dbs.length;
      browser.runtime.sendMessage({ type: "storage_report", data: storageInfo });
    });
  } else {
    browser.runtime.sendMessage({ type: "storage_report", data: storageInfo });
  }

  function flagFingerprint(method) {
    console.warn("Canvas Fingerprint detectado via:", method);
    browser.runtime.sendMessage({ type: "fingerprint_detected" });
  }

  const origToDataURL = HTMLCanvasElement.prototype.toDataURL;
  HTMLCanvasElement.prototype.toDataURL = function() {
    flagFingerprint("toDataURL");
    return origToDataURL.apply(this, arguments);
  };

  const origToBlob = HTMLCanvasElement.prototype.toBlob;
  HTMLCanvasElement.prototype.toBlob = function() {
    flagFingerprint("toBlob");
    return origToBlob.apply(this, arguments);
  };

  const origGetImageData = CanvasRenderingContext2D.prototype.getImageData;
  CanvasRenderingContext2D.prototype.getImageData = function() {
    flagFingerprint("getImageData");
    return origGetImageData.apply(this, arguments);
  };
})();

(function() {
  let redirectCount = 0;
  const origAssign = window.location.assign;
  window.location.assign = function() {
    redirectCount++;
    if (redirectCount > 3) {
      browser.runtime.sendMessage({ type: "hijack_detected", method: "Redirect loop" });
      console.warn("Possível hijacking: redirecionamentos excessivos");
    }
    return origAssign.apply(this, arguments);
  };

  const origOpen = window.open;
  window.open = function() {
    browser.runtime.sendMessage({ type: "hijack_detected", method: "Popup inesperado" });
    console.warn("Possível hijacking: popup inesperado");
    return origOpen.apply(this, arguments);
  };

  const origPushState = history.pushState;
  history.pushState = function() {
    browser.runtime.sendMessage({ type: "hijack_detected", method: "History pushState" });
    console.warn("Possível hijacking: manipulação do histórico");
    return origPushState.apply(this, arguments);
  };

  const origReplaceState = history.replaceState;
  history.replaceState = function() {
    browser.runtime.sendMessage({ type: "hijack_detected", method: "History replaceState" });
    console.warn("Possível hijacking: replaceState suspeito");
    return origReplaceState.apply(this, arguments);
  };

  const observer = new MutationObserver(mutations => {
    for (let mut of mutations) {
      for (let node of mut.addedNodes) {
        if (node.tagName === "SCRIPT" && node.src) {
          let mainDomain = new URL(location.href).hostname;
          let scriptDomain = new URL(node.src).hostname;
          if (!scriptDomain.endsWith(mainDomain)) {
            browser.runtime.sendMessage({ type: "hijack_detected", method: "Script externo suspeito: " + scriptDomain });
            console.warn("Possível XSS/hijacking: script externo " + scriptDomain);
          }
        }
      }
    }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  function detectHook(obj, funcName) {
    const original = obj[funcName];
    Object.defineProperty(obj, funcName, {
      configurable: true,
      get: function() {
        return original;
      },
      set: function(value) {
        browser.runtime.sendMessage({ type: "hijack_detected", method: `Hook em ${funcName}` });
        console.warn("Possível hijacking: função sobrescrita ->", funcName);
        return original;
      }
    });
  }

  detectHook(window, "fetch");
  detectHook(window, "XMLHttpRequest");
  detectHook(window, "alert");

})();