/* ===========================================================
   Thilda Admin — edits data.js directly on disk via the
   File System Access API. Changes are staged in memory and only
   written to disk when the Save button is clicked.
   Falls back to manual upload/download on unsupported browsers.
   =========================================================== */

const BLANK_DATA = {
  siteName: "My Store",
  tagline: "",
  logo: "",
  whatsappNumber: "",
  currency: "\u20a6",
  banner: "",
  categories: [],
  products: []
};

const supportsFSA = "showOpenFilePicker" in window;

const admin = {
  data: null,
  fileHandle: null,
  dirty: false,
  openProductId: null
};

/* ---------------- IndexedDB: remember last file handle ---------------- */
function idbOpen(){
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("thilda-admin", 1);
    req.onupgradeneeded = () => req.result.createObjectStore("handles");
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function idbSet(key, val){
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("handles", "readwrite");
    tx.objectStore("handles").put(val, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
async function idbGet(key){
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("handles", "readonly");
    const req = tx.objectStore("handles").get(key);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

/* ---------------- status pill ---------------- */
function setStatus(kind, text){
  const pill = document.getElementById("statusPill");
  pill.className = "status-pill " + kind;
  document.getElementById("statusText").textContent = text;
}
function refreshSaveBtn(){
  const btn = document.getElementById("saveBtn");
  if(!btn) return;
  btn.disabled = !admin.dirty || (supportsFSA && !admin.fileHandle);
}

/* ---------------- file open / new / save ---------------- */
async function openFile(){
  try{
    const [handle] = await window.showOpenFilePicker({
      types: [{ description: "Thilda data file", accept: { "text/javascript": [".js"] } }]
    });
    await handle.requestPermission({ mode: "readwrite" });
    admin.fileHandle = handle;
    await idbSet("dataFileHandle", handle);
    const file = await handle.getFile();
    const text = await file.text();
    admin.data = normalize(parseDataJs(text));
    admin.dirty = false;
    refreshSaveBtn();
    setStatus("saved", "Connected \u2014 " + handle.name);
    renderAll();
  }catch(e){
    if(e.name !== "AbortError") console.error(e);
  }
}

async function newFile(){
  try{
    const handle = await window.showSaveFilePicker({
      suggestedName: "data.js",
      types: [{ description: "Thilda data file", accept: { "text/javascript": [".js"] } }]
    });
    admin.fileHandle = handle;
    await idbSet("dataFileHandle", handle);
    admin.data = normalize(BLANK_DATA);
    await writeToDisk();
    setStatus("saved", "Connected \u2014 " + handle.name);
    renderAll();
  }catch(e){
    if(e.name !== "AbortError") console.error(e);
  }
}

// data.js holds `window.THILDA_DATA = { ... };` — a real JS file (loaded via
// a <script> tag on the storefront) rather than a .json file loaded via
// fetch(), so both index.html and admin.html work straight from file://
// with no local server needed.
function parseDataJs(text){
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if(start === -1 || end === -1) throw new Error("Couldn't find a data object in this file.");
  return JSON.parse(text.slice(start, end + 1));
}
function stringifyDataJs(data){
  return "window.THILDA_DATA = " + JSON.stringify(data, null, 2) + ";\n";
}

async function tryRestoreHandle(){
  if(!supportsFSA) return;
  try{
    const handle = await idbGet("dataFileHandle");
    if(!handle) return;
    const perm = await handle.queryPermission({ mode: "readwrite" });
    admin.fileHandle = handle;
    if(perm === "granted"){
      const file = await handle.getFile();
      admin.data = normalize(parseDataJs(await file.text()));
      admin.dirty = false;
      refreshSaveBtn();
      setStatus("saved", "Connected \u2014 " + handle.name);
      renderAll();
    }else{
      setStatus("idle", "Reconnect to " + handle.name);
      const btn = document.getElementById("openFileBtn");
      btn.textContent = "Reconnect to " + handle.name;
      btn.onclick = reconnectHandle;
    }
  }catch(e){ /* no stored handle, ignore */ }
}

async function reconnectHandle(){
  try{
    const perm = await admin.fileHandle.requestPermission({ mode: "readwrite" });
    if(perm !== "granted") return;
    const file = await admin.fileHandle.getFile();
    admin.data = normalize(parseDataJs(await file.text()));
    admin.dirty = false;
    refreshSaveBtn();
    setStatus("saved", "Connected \u2014 " + admin.fileHandle.name);
    document.getElementById("openFileBtn").textContent = "Open data.js";
    document.getElementById("openFileBtn").onclick = openFile;
    renderAll();
  }catch(e){ console.error(e); }
}

async function writeToDisk(){
  if(!admin.fileHandle){
    setStatus("idle", "No file open \u2014 use Download backup");
    return;
  }
  try{
    setStatus("saving", "Saving\u2026");
    const writable = await admin.fileHandle.createWritable();
    await writable.write(stringifyDataJs(admin.data));
    await writable.close();
    admin.dirty = false;
    refreshSaveBtn();
    setStatus("saved", "Saved \u2014 " + admin.fileHandle.name);
  }catch(e){
    console.error(e);
    setStatus("error", "Couldn't save \u2014 try reopening the file");
  }
}

function downloadBackup(){
  const blob = new Blob([stringifyDataJs(admin.data)], { type: "text/javascript" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "data.js";
  a.click();
  URL.revokeObjectURL(url);
  if(!supportsFSA){
    admin.dirty = false;
    refreshSaveBtn();
    setStatus("saved", "Downloaded data.js");
  }
}

function handleFallbackUpload(e){
  const file = e.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try{
      admin.data = normalize(parseDataJs(reader.result));
      admin.dirty = false;
      refreshSaveBtn();
      setStatus("idle", "Loaded " + file.name + " (download to save changes)");
      renderAll();
    }catch(err){ alert("Couldn't read that file \u2014 make sure it's a data.js file exported from this admin panel."); }
  };
  reader.readAsText(file);
}

/* ---------------- data helpers ---------------- */
function normalize(json){
  return {
    siteName: json.siteName || "",
    tagline: json.tagline || "",
    logo: json.logo || "",
    whatsappNumber: json.whatsappNumber || "",
    currency: json.currency || "\u20a6",
    banner: json.banner || "",
    categories: Array.isArray(json.categories) ? json.categories : [],
    products: (Array.isArray(json.products) ? json.products : []).map(normalizeProduct)
  };
}
// Cleans up one product, migrating the old single `image` string (from
// earlier versions of this admin panel) into the `images` array the
// storefront's swipe gallery reads from.
function normalizeProduct(p){
  return {
    id: p.id || uid("p"),
    name: p.name || "",
    price: Number(p.price) || 0,
    compareAtPrice: p.compareAtPrice === "" || p.compareAtPrice == null ? null : Number(p.compareAtPrice),
    category: p.category || "",
    images: Array.isArray(p.images) ? p.images.slice(0, 3) : (p.image ? [p.image] : []),
    description: p.description || "",
    rating: Number(p.rating) || 0,
    featured: !!p.featured,
    inStock: p.inStock !== false
  };
}
function uid(prefix){
  return prefix + "-" + Math.random().toString(36).slice(2, 9);
}
function onEdit(){
  if(!admin.data) return;
  admin.dirty = true;
  refreshSaveBtn();
  if(supportsFSA && admin.fileHandle) setStatus("idle", "Unsaved changes \u2014 click Save");
  else setStatus("idle", "Unsaved changes \u2014 use Download backup");
}

/* ---------------- render ---------------- */
function renderAll(){
  renderSiteSettings();
  renderCategories();
  renderProducts();
}

function renderSiteSettings(){
  const d = admin.data;
  document.getElementById("siteNameInput").value = d.siteName;
  document.getElementById("taglineInput").value = d.tagline;
  document.getElementById("whatsappInput").value = d.whatsappNumber;
  document.getElementById("currencyInput").value = d.currency;
  document.getElementById("bannerInput").value = d.banner;
  document.getElementById("logoUrlInput").value = d.logo && !d.logo.startsWith("data:") ? d.logo : "";
  document.getElementById("logoPreview").src = d.logo || "";
}

function renderCategories(){
  const list = document.getElementById("catList");
  list.innerHTML = "";
  if(admin.data.categories.length === 0){
    list.innerHTML = '<p class="empty-hint">No categories yet.</p>';
  }
  admin.data.categories.forEach(cat => {
    const row = document.createElement("div");
    row.className = "cat-row";
    row.innerHTML = `<input type="text" value="${escapeAttr(cat.name)}"><button class="btn small danger" type="button">Delete</button>`;
    row.querySelector("input").addEventListener("input", (e) => {
      cat.name = e.target.value;
      onEdit();
      renderProducts();
    });
    row.querySelector("button").addEventListener("click", () => deleteCategory(cat.id));
    list.appendChild(row);
  });
  refreshCategorySelects();
}

function addCategory(){
  const input = document.getElementById("newCatInput");
  const name = input.value.trim();
  if(!name) return;
  admin.data.categories.push({ id: uid("cat"), name });
  input.value = "";
  onEdit();
  renderCategories();
}

function deleteCategory(id){
  const used = admin.data.products.some(p => p.category === id);
  if(used && !confirm("Products using this category will become Uncategorized. Continue?")) return;
  admin.data.categories = admin.data.categories.filter(c => c.id !== id);
  admin.data.products.forEach(p => { if(p.category === id) p.category = ""; });
  onEdit();
  renderCategories();
  renderProducts();
}

function refreshCategorySelects(){
  document.querySelectorAll('select[data-field="category"]').forEach(sel => {
    const current = sel.value;
    sel.innerHTML = '<option value="">Uncategorized</option>' +
      admin.data.categories.map(c => `<option value="${c.id}">${escapeAttr(c.name)}</option>`).join("");
    sel.value = current;
  });
}

function renderProducts(){
  const list = document.getElementById("productList");
  const openId = admin.openProductId;
  list.innerHTML = "";
  if(admin.data.products.length === 0){
    list.innerHTML = '<p class="empty-hint">No products yet. Click "Add product" to create one.</p>';
    return;
  }
  admin.data.products.forEach((p, i) => {
    const row = document.createElement("div");
    row.className = "product-row";
    const catLabel = admin.data.categories.find(c => c.id === p.category)?.name || "Uncategorized";
    row.innerHTML = `
      <div class="product-row-head">
        <div class="order-btns">
          <button type="button" data-act="up" ${i === 0 ? "disabled" : ""} aria-label="Move up">\u25b2</button>
          <button type="button" data-act="down" ${i === admin.data.products.length - 1 ? "disabled" : ""} aria-label="Move down">\u25bc</button>
        </div>
        <img src="${(p.images && p.images[0]) || ""}" alt="">
        <span class="pname">${escapeAttr(p.name || "Untitled product")}</span>
        <span class="pmeta">${catLabel} \u00b7 ${admin.data.currency}${Number(p.price||0).toLocaleString()}</span>
        <button class="btn small light" type="button" data-act="toggle">Edit</button>
        <button class="row-delete-btn" type="button" data-act="delete" aria-label="Delete ${escapeAttr(p.name || "product")}">\u2715</button>
      </div>
    `;
    row.querySelector('[data-act="up"]').addEventListener("click", () => moveProduct(i, -1));
    row.querySelector('[data-act="down"]').addEventListener("click", () => moveProduct(i, 1));
    row.querySelector('[data-act="toggle"]').addEventListener("click", () => {
      admin.openProductId = admin.openProductId === p.id ? null : p.id;
      renderProducts();
    });
    row.querySelector('[data-act="delete"]').addEventListener("click", () => deleteProduct(p.id));

    const editWrap = document.createElement("div");
    const tpl = document.getElementById("productEditTemplate").content.cloneNode(true);
    const editEl = tpl.querySelector(".product-edit");
    if(p.id === openId) editEl.classList.add("open");

    editEl.querySelector('[data-field="name"]').value = p.name || "";
    editEl.querySelector('[data-field="price"]').value = p.price ?? "";
    editEl.querySelector('[data-field="compareAtPrice"]').value = p.compareAtPrice ?? "";
    editEl.querySelector('[data-field="description"]').value = p.description || "";
    editEl.querySelector('[data-field="rating"]').value = p.rating ?? "";
    editEl.querySelector('[data-field="featured"]').checked = !!p.featured;
    editEl.querySelector('[data-field="inStock"]').checked = p.inStock !== false;
    const catSel = editEl.querySelector('[data-field="category"]');
    catSel.innerHTML = '<option value="">Uncategorized</option>' +
      admin.data.categories.map(c => `<option value="${c.id}">${escapeAttr(c.name)}</option>`).join("");
    catSel.value = p.category || "";

    ["name","description"].forEach(f => {
      editEl.querySelector(`[data-field="${f}"]`).addEventListener("input", (e) => {
        p[f] = e.target.value;
        onEdit();
        if(f === "name") renderProductRowOnly(row, p);
      });
    });
    ["price","compareAtPrice","rating"].forEach(f => {
      editEl.querySelector(`[data-field="${f}"]`).addEventListener("input", (e) => {
        p[f] = e.target.value === "" ? (f === "compareAtPrice" ? null : 0) : Number(e.target.value);
        onEdit();
        renderProductRowOnly(row, p);
      });
    });
    catSel.addEventListener("change", (e) => {
      p.category = e.target.value;
      onEdit();
      renderProductRowOnly(row, p);
    });
    editEl.querySelector('[data-field="featured"]').addEventListener("change", (e) => { p.featured = e.target.checked; onEdit(); });
    editEl.querySelector('[data-field="inStock"]').addEventListener("change", (e) => { p.inStock = e.target.checked; onEdit(); });

    if(!Array.isArray(p.images)) p.images = [];
    editEl.querySelectorAll(".image-slot").forEach(slot => {
      const idx = Number(slot.dataset.idx);
      const preview = slot.querySelector('[data-role="preview"]');
      const urlInput = slot.querySelector('[data-role="url"]');
      const uploadInput = slot.querySelector('[data-role="upload"]');
      const clearBtn = slot.querySelector('[data-role="clear"]');
      const current = p.images[idx] || "";
      preview.src = current;
      urlInput.value = current && !current.startsWith("data:") ? current : "";

      const setSlot = (val) => {
        p.images[idx] = val;
        preview.src = val;
        onEdit();
        renderProductRowOnly(row, p);
      };
      urlInput.addEventListener("input", (e) => setSlot(e.target.value));
      uploadInput.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if(!file) return;
        const reader = new FileReader();
        reader.onload = () => { urlInput.value = ""; setSlot(reader.result); };
        reader.readAsDataURL(file);
      });
      clearBtn.addEventListener("click", () => { urlInput.value = ""; setSlot(""); });
    });

    editWrap.appendChild(tpl);
    row.appendChild(editEl);
    list.appendChild(row);
  });
}

function renderProductRowOnly(row, p){
  const catLabel = admin.data.categories.find(c => c.id === p.category)?.name || "Uncategorized";
  row.querySelector(".pname").textContent = p.name || "Untitled product";
  row.querySelector(".pmeta").textContent = `${catLabel} \u00b7 ${admin.data.currency}${Number(p.price||0).toLocaleString()}`;
  row.querySelector(".product-row-head img").src = (p.images && p.images[0]) || "";
}

function deleteProduct(id){
  const p = admin.data.products.find(x => x.id === id);
  if(!confirm(`Delete "${p?.name || "this product"}"?`)) return;
  admin.data.products = admin.data.products.filter(x => x.id !== id);
  if(admin.openProductId === id) admin.openProductId = null;
  onEdit();
  renderProducts();
}

function moveProduct(index, dir){
  const arr = admin.data.products;
  const target = index + dir;
  if(target < 0 || target >= arr.length) return;
  [arr[index], arr[target]] = [arr[target], arr[index]];
  onEdit();
  renderProducts();
}

function addProduct(){
  const p = {
    id: uid("p"),
    name: "New product",
    price: 0,
    compareAtPrice: null,
    category: admin.data.categories[0]?.id || "",
    images: [],
    description: "",
    rating: 0,
    featured: false,
    inStock: true
  };
  admin.data.products.push(p);
  admin.openProductId = p.id;
  onEdit();
  renderProducts();
}

function escapeAttr(s){
  return String(s || "").replace(/[&<>"']/g, m => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[m]));
}

/* ---------------- site settings field wiring ---------------- */
function wireSiteSettings(){
  const bind = (id, field) => {
    document.getElementById(id).addEventListener("input", (e) => {
      admin.data[field] = e.target.value;
      onEdit();
    });
  };
  bind("siteNameInput", "siteName");
  bind("taglineInput", "tagline");
  bind("whatsappInput", "whatsappNumber");
  bind("currencyInput", "currency");
  bind("bannerInput", "banner");
  document.getElementById("logoUrlInput").addEventListener("input", (e) => {
    admin.data.logo = e.target.value;
    document.getElementById("logoPreview").src = e.target.value;
    onEdit();
  });
  document.getElementById("logoUpload").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      admin.data.logo = reader.result;
      document.getElementById("logoPreview").src = admin.data.logo;
      document.getElementById("logoUrlInput").value = "";
      onEdit();
    };
    reader.readAsDataURL(file);
  });
  document.getElementById("clearLogoBtn").addEventListener("click", () => {
    admin.data.logo = "";
    document.getElementById("logoPreview").src = "";
    document.getElementById("logoUrlInput").value = "";
    onEdit();
  });
}

/* ---------------- init ---------------- */
function init(){
  admin.data = normalize(BLANK_DATA);

  if(!supportsFSA){
    document.getElementById("unsupportedBanner").hidden = false;
    document.getElementById("openFileBtn").hidden = true;
    document.getElementById("newFileBtn").hidden = true;
    document.getElementById("saveBtn").hidden = true;
    document.getElementById("fallbackUpload").addEventListener("change", handleFallbackUpload);
  }else{
    document.getElementById("openFileBtn").addEventListener("click", openFile);
    document.getElementById("newFileBtn").addEventListener("click", newFile);
    document.getElementById("saveBtn").addEventListener("click", writeToDisk);
    tryRestoreHandle();
  }

  document.getElementById("downloadBtn").addEventListener("click", downloadBackup);
  document.getElementById("addCatBtn").addEventListener("click", addCategory);
  document.getElementById("newCatInput").addEventListener("keydown", (e) => { if(e.key === "Enter") addCategory(); });
  document.getElementById("addProductBtn").addEventListener("click", addProduct);

  window.addEventListener("beforeunload", (e) => {
    if(admin.dirty){ e.preventDefault(); e.returnValue = ""; }
  });

  wireSiteSettings();
  refreshSaveBtn();
  renderAll();
}

init();
