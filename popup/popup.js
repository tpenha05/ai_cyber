function renderReport(report) {
  document.getElementById("summary").innerHTML = `
    <p><b>Trackers bloqueados:</b> ${report.trackers}</p>
    <p><b>Cookies:</b> 
      1ª Parte=${report.cookies.firstParty}, 
      3ª Parte=${report.cookies.thirdParty}, 
      Sessão=${report.cookies.session}, 
      Persistentes=${report.cookies.persistent}
    </p>
    <p><b>Storage:</b> 
      Local=${report.storage.local}, 
      Session=${report.storage.session}, 
      IndexedDB=${report.storage.indexedDB}
    </p>
    <p><b>Canvas Fingerprint:</b> 
  ${report.fingerprint && report.fingerprint.length > 0 
    ? "Detectado via " + report.fingerprint.join(", ") 
    : "Não"}
</p>
    <p><b>Scripts externos suspeitos:</b> ${report.hijacking.length}</p>
    <p><b>Pontuação de Privacidade:</b> ${report.score}</p>
  `;
}

browser.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
  browser.runtime.sendMessage({ type: "get_report", tabId: tab.id }).then(report => {
    if (!report) {
      document.getElementById("summary").innerText = "Ainda sem dados. Recarregue a página.";
      return;
    }
    renderReport(report);
  });
});

function renderBlocklist(list) {
  let ul = document.getElementById("blocklist");
  ul.innerHTML = "";
  list.forEach((domain, i) => {
    let li = document.createElement("li");
    li.textContent = domain + " ";
    let btn = document.createElement("button");
    btn.textContent = "Remover";
    btn.onclick = () => {
      list.splice(i, 1);
      browser.storage.local.set({ blocklist: list });
      renderBlocklist(list);
    };
    li.appendChild(btn);
    ul.appendChild(li);
  });
}

browser.storage.local.get("blocklist").then(data => {
  renderBlocklist(data.blocklist || []);
});

document.getElementById("addDomain").onclick = () => {
  let newDomain = document.getElementById("newDomain").value.trim();
  if (!newDomain) return;
  browser.storage.local.get("blocklist").then(data => {
    let list = data.blocklist || [];
    if (!list.includes(newDomain)) {
      list.push(newDomain);
      browser.storage.local.set({ blocklist: list });
      renderBlocklist(list);
    }
    document.getElementById("newDomain").value = "";
  });
};
