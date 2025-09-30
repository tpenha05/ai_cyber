function renderList(list) {
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
      renderList(list);
    };
    li.appendChild(btn);
    ul.appendChild(li);
  });
}

browser.storage.local.get("blocklist").then(data => {
  renderList(data.blocklist || []);
});

document.getElementById("addDomain").onclick = () => {
  let newDomain = document.getElementById("newDomain").value.trim();
  if (!newDomain) return;
  browser.storage.local.get("blocklist").then(data => {
    let list = data.blocklist || [];
    list.push(newDomain);
    browser.storage.local.set({ blocklist: list });
    renderList(list);
    document.getElementById("newDomain").value = "";
  });
};
