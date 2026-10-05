/* ===========================================================
   Thilda Style Collection — storefront logic
   Loads window.THILDA_DATA from data.js (falls back to an embedded default so the
   page still works when opened without a local server).
   =========================================================== */

const DEFAULT_DATA = {
  siteName: "Thilda Style Collection",
  tagline: "Considered pieces for a quieter kind of everyday.",
  logo: "",
  whatsappNumber: "2348012345678",
  currency: "\u20a6",
  banner: "Free express shipping on orders over \u20a650,000.",
  categories: [{ id: "cat-all", name: "General" }],
  products: []
};

const state = {
  data: null,
  activeCategory: "all",
  priceFilter: "all",
  sort: "featured",
  query: "",
  cart: loadCart()
};

function loadCart(){
  try{ return JSON.parse(localStorage.getItem("thilda_cart") || "[]"); }
  catch(e){ return []; }
}
function saveCart(){
  localStorage.setItem("thilda_cart", JSON.stringify(state.cart));
}

function loadData(){
  // data.js (loaded via a <script> tag in index.html) sets window.THILDA_DATA.
  // Using a script tag instead of fetch("./data.json") means this page works
  // straight from a double-clicked file:// link, no local server required.
  state.data = normalize(window.THILDA_DATA || DEFAULT_DATA);
  render();
}

function normalize(json){
  return {
    siteName: json.siteName || "Thilda Style Collection",
    tagline: json.tagline || "",
    logo: json.logo || "",
    whatsappNumber: (json.whatsappNumber || "").replace(/[^0-9]/g, ""),
    currency: json.currency || "\u20a6",
    banner: json.banner || "",
    categories: Array.isArray(json.categories) ? json.categories : [],
    products: Array.isArray(json.products) ? json.products : []
  };
}

function fmt(n){
  return state.data.currency + Number(n || 0).toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function catName(id){
  const c = state.data.categories.find(c => c.id === id);
  return c ? c.name : "Uncategorized";
}

function getImages(p){
  const arr = Array.isArray(p.images) ? p.images.filter(Boolean) : [];
  if(arr.length === 0 && p.image) arr.push(p.image);
  return arr;
}

/* ---------------- render ---------------- */
function render(){
  const d = state.data;
  document.title = d.siteName;
  document.getElementById("bannerText").textContent = d.banner || "";
  document.getElementById("siteNameText").textContent = d.siteName;
  document.getElementById("footerSiteName").textContent = d.siteName;
  document.getElementById("footerCopyName").textContent = d.siteName;
  document.getElementById("taglineText").textContent = d.tagline;
  document.getElementById("footerTagline").textContent = d.tagline;
  document.getElementById("yearText").textContent = new Date().getFullYear();

  const logoImg = document.getElementById("logoImg");
  if(d.logo){ logoImg.src = d.logo; logoImg.hidden = false; } else { logoImg.hidden = true; }

  renderSpotlight();
  renderCategoryRail();
  renderPriceFilterOptions();
  renderFooterCategories();
  renderGrid();
  renderCart();
}

function renderSpotlight(){
  const featured = state.data.products.find(p => p.featured) || state.data.products[0];
  const img = document.getElementById("spotlightImg");
  const name = document.getElementById("spotlightName");
  const price = document.getElementById("spotlightPrice");
  if(!featured){ name.textContent = "\u2014"; price.textContent = "\u2014"; return; }
  img.src = getImages(featured)[0] || "";
  img.alt = featured.name;
  name.textContent = featured.name;
  price.textContent = fmt(featured.price);
}

function renderCategoryRail(){
  const rail = document.getElementById("categoryRail");
  rail.innerHTML = "";
  const all = document.createElement("button");
  all.className = "cat-pill" + (state.activeCategory === "all" ? " active" : "");
  all.textContent = "All Items";
  all.onclick = () => { state.activeCategory = "all"; renderCategoryRail(); renderGrid(); };
  rail.appendChild(all);

  state.data.categories.forEach(cat => {
    const btn = document.createElement("button");
    btn.className = "cat-pill" + (state.activeCategory === cat.id ? " active" : "");
    btn.textContent = cat.name;
    btn.onclick = () => { state.activeCategory = cat.id; renderCategoryRail(); renderGrid(); };
    rail.appendChild(btn);
  });
}

function renderPriceFilterOptions(){
  const sel = document.getElementById("priceFilter");
  const prices = state.data.products.map(p => p.price).filter(n => typeof n === "number");
  sel.innerHTML = '<option value="all">Filter by: All prices</option>';
  if(prices.length < 2) return;
  const min = Math.min(...prices), max = Math.max(...prices);
  const third = (max - min) / 3;
  const low = Math.round(min + third);
  const high = Math.round(min + third * 2);
  sel.innerHTML += `
    <option value="low">Under ${fmt(low)}</option>
    <option value="mid">${fmt(low)} &ndash; ${fmt(high)}</option>
    <option value="high">Over ${fmt(high)}</option>
  `;
  sel.dataset.low = low;
  sel.dataset.high = high;
}

function renderFooterCategories(){
  const ul = document.getElementById("footerCategories");
  ul.innerHTML = "";
  state.data.categories.forEach(cat => {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.textContent = cat.name;
    btn.onclick = () => {
      state.activeCategory = cat.id;
      renderCategoryRail(); renderGrid();
      document.getElementById("products-section").scrollIntoView({ behavior: "smooth" });
    };
    li.appendChild(btn);
    ul.appendChild(li);
  });
}

function getFilteredProducts(){
  let list = [...state.data.products];
  if(state.activeCategory !== "all") list = list.filter(p => p.category === state.activeCategory);

  const sel = document.getElementById("priceFilter");
  const low = Number(sel.dataset.low), high = Number(sel.dataset.high);
  if(state.priceFilter === "low") list = list.filter(p => p.price < low);
  else if(state.priceFilter === "mid") list = list.filter(p => p.price >= low && p.price <= high);
  else if(state.priceFilter === "high") list = list.filter(p => p.price > high);

  const q = state.query.trim().toLowerCase();
  if(q){
    list = list.filter(p => {
      const haystack = [p.name, p.description, catName(p.category)].join(" ").toLowerCase();
      return haystack.includes(q);
    });
  }

  if(state.sort === "price-asc") list.sort((a,b) => a.price - b.price);
  else if(state.sort === "price-desc") list.sort((a,b) => b.price - a.price);
  else if(state.sort === "rating") list.sort((a,b) => (b.rating||0) - (a.rating||0));
  else list.sort((a,b) => (b.featured?1:0) - (a.featured?1:0));

  return list;
}

function renderGrid(){
  const grid = document.getElementById("productGrid");
  const empty = document.getElementById("emptyState");
  const list = getFilteredProducts();
  grid.innerHTML = "";

  if(list.length === 0){
    empty.hidden = false;
    grid.hidden = true;
    return;
  }
  empty.hidden = true;
  grid.hidden = false;

  list.forEach(p => {
    const images = getImages(p);
    const card = document.createElement("article");
    card.className = "product-card" + (p.inStock === false ? " out-of-stock" : "");
    const slidesHtml = images.length > 0
      ? images.map(src => `<div class="carousel-slide"><img src="${src}" alt="${escapeHtml(p.name)}" loading="lazy"></div>`).join("")
      : `<div class="carousel-slide"><img src="" alt="${escapeHtml(p.name)}" loading="lazy"></div>`;
    const dotsHtml = images.length > 1
      ? `<div class="carousel-dots">${images.map((_,i) => `<button class="carousel-dot${i===0?" active":""}" data-i="${i}" aria-label="Show image ${i+1}"></button>`).join("")}</div>`
      : "";
    const arrowsHtml = images.length > 1
      ? `<button class="carousel-arrow prev" aria-label="Previous image">\u2039</button><button class="carousel-arrow next" aria-label="Next image">\u203a</button>`
      : "";
    card.innerHTML = `
      <div class="product-media">
        <div class="carousel-track">${slidesHtml}</div>
        ${arrowsHtml}
        ${dotsHtml}
        ${p.compareAtPrice ? '<span class="badge-sale">Sale</span>' : ""}
        <span class="tag-shape">${fmt(p.price)}</span>
      </div>
      <div class="product-body">
        <div class="product-cat">${escapeHtml(catName(p.category))}</div>
        <h3 class="product-name">${escapeHtml(p.name)}</h3>
        <div class="product-rating">${"\u2605".repeat(Math.round(p.rating||0))}<span style="color:#b6b09c;">${"\u2605".repeat(5-Math.round(p.rating||0))}</span> ${p.rating ? p.rating.toFixed(1) : ""}</div>
        ${p.description ? `<p class="product-desc">${escapeHtml(p.description)}</p>` : ""}
        <div class="product-footer">
          <div class="price-row">
            <span>${fmt(p.price)}</span>
            ${p.compareAtPrice ? `<span class="price-old">${fmt(p.compareAtPrice)}</span>` : ""}
          </div>
          <button class="add-btn" aria-label="Add ${escapeHtml(p.name)} to cart" data-id="${p.id}">+</button>
        </div>
      </div>
    `;
    grid.appendChild(card);
    if(images.length > 1) initCarousel(card.querySelector(".product-media"), images.length);

    card.addEventListener("click", () => openQuickView(p.id));
  });

  grid.querySelectorAll(".add-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      addToCart(btn.dataset.id);
    });
  });
}

/* ---------------- product image carousel (swipe + arrows + dots) ---------------- */
function initCarousel(media, count, onIndexChange){
  const track = media.querySelector(".carousel-track");
  const dots = media.querySelectorAll(".carousel-dot");
  let index = 0;
  let startX = 0, deltaX = 0, dragging = false, wasDrag = false;

  function goTo(i){
    index = Math.max(0, Math.min(count - 1, i));
    track.style.transform = `translateX(-${index * 100}%)`;
    dots.forEach((d, di) => d.classList.toggle("active", di === index));
    if(onIndexChange) onIndexChange(index);
  }

  media.querySelector(".prev")?.addEventListener("click", (e) => { e.stopPropagation(); goTo(index - 1); });
  media.querySelector(".next")?.addEventListener("click", (e) => { e.stopPropagation(); goTo(index + 1); });
  dots.forEach(d => d.addEventListener("click", (e) => { e.stopPropagation(); goTo(Number(d.dataset.i)); }));

  // Swallow the click that follows a real drag so swiping a card doesn't
  // also trigger the card's "open quick view" click handler.
  media.addEventListener("click", (e) => { if(wasDrag){ e.stopPropagation(); wasDrag = false; } }, true);

  media.addEventListener("pointerdown", (e) => {
    dragging = true;
    startX = e.clientX;
    deltaX = 0;
    track.style.transition = "none";
    media.setPointerCapture(e.pointerId);
  });
  media.addEventListener("pointermove", (e) => {
    if(!dragging) return;
    deltaX = e.clientX - startX;
    track.style.transform = `translateX(calc(-${index * 100}% + ${deltaX}px))`;
  });
  function endDrag(){
    if(!dragging) return;
    dragging = false;
    track.style.transition = "";
    const threshold = media.clientWidth * 0.18;
    wasDrag = Math.abs(deltaX) > 8;
    if(deltaX < -threshold) goTo(index + 1);
    else if(deltaX > threshold) goTo(index - 1);
    else goTo(index);
  }
  media.addEventListener("pointerup", endDrag);
  media.addEventListener("pointerleave", endDrag);
  media.addEventListener("pointercancel", endDrag);
}

function escapeHtml(s){
  return String(s || "").replace(/[&<>"']/g, m => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[m]));
}

/* ---------------- quick-view modal ---------------- */
function openQuickView(id){
  const p = state.data.products.find(x => x.id === id);
  if(!p) return;
  renderQuickView(p);
  document.getElementById("qvOverlay").classList.add("open");
  document.getElementById("qvModal").classList.add("open");
}
function closeQuickView(){
  document.getElementById("qvOverlay").classList.remove("open");
  document.getElementById("qvModal").classList.remove("open");
}

function renderQuickView(p){
  const modal = document.getElementById("qvModal");
  const images = getImages(p);
  const slidesHtml = images.length > 0
    ? images.map(src => `<div class="carousel-slide"><img src="${src}" alt="${escapeHtml(p.name)}"></div>`).join("")
    : `<div class="carousel-slide"><img src="" alt="${escapeHtml(p.name)}"></div>`;
  const dotsHtml = images.length > 1
    ? `<div class="carousel-dots">${images.map((_,i) => `<button class="carousel-dot${i===0?" active":""}" data-i="${i}" aria-label="Show image ${i+1}"></button>`).join("")}</div>`
    : "";
  const arrowsHtml = images.length > 1
    ? `<button class="carousel-arrow prev" aria-label="Previous image">\u2039</button><button class="carousel-arrow next" aria-label="Next image">\u203a</button>`
    : "";

  let qty = 1;

  modal.innerHTML = `
    <div class="qv-gallery">
      <div class="carousel-track">${slidesHtml}</div>
      ${arrowsHtml}
      ${dotsHtml}
      <button class="qv-close" aria-label="Close">&times;</button>
    </div>
    <div class="qv-info">
      <div class="product-cat">${escapeHtml(catName(p.category))}</div>
      <h2>${escapeHtml(p.name)}</h2>
      <div class="qv-rating">${"\u2605".repeat(Math.round(p.rating||0))}<span style="color:#b6b09c;">${"\u2605".repeat(5-Math.round(p.rating||0))}</span> ${p.rating ? p.rating.toFixed(1) : ""}</div>
      ${p.description ? `<p class="qv-desc">${escapeHtml(p.description)}</p>` : ""}
      <div class="qv-price-row">
        <span>${fmt(p.price)}</span>
        ${p.compareAtPrice ? `<span class="price-old">${fmt(p.compareAtPrice)}</span>` : ""}
      </div>
      ${p.inStock === false ? '<div class="qv-out">Out of stock</div>' : `
        <div class="qv-qty-row">
          <button class="qty-btn" data-act="qv-dec">&minus;</button>
          <span id="qvQtyDisplay">1</span>
          <button class="qty-btn" data-act="qv-inc">+</button>
        </div>
        <button class="btn btn-block" id="qvAddBtn">Add to Cart</button>
      `}
    </div>
  `;

  const gallery = modal.querySelector(".qv-gallery");
  if(images.length > 1) initCarousel(gallery, images.length);

  modal.querySelector(".qv-close").addEventListener("click", closeQuickView);
  modal.querySelector('[data-act="qv-dec"]')?.addEventListener("click", () => {
    qty = Math.max(1, qty - 1);
    modal.querySelector("#qvQtyDisplay").textContent = qty;
  });
  modal.querySelector('[data-act="qv-inc"]')?.addEventListener("click", () => {
    qty += 1;
    modal.querySelector("#qvQtyDisplay").textContent = qty;
  });
  modal.querySelector("#qvAddBtn")?.addEventListener("click", () => {
    addToCart(p.id, qty);
    closeQuickView();
  });
}

document.getElementById("qvOverlay").addEventListener("click", closeQuickView);

/* ---------------- cart ---------------- */
function addToCart(id, qty = 1){
  const existing = state.cart.find(l => l.id === id);
  if(existing) existing.qty += qty;
  else state.cart.push({ id, qty });
  saveCart();
  renderCart();
  openCart();
}

function changeQty(id, delta){
  const line = state.cart.find(l => l.id === id);
  if(!line) return;
  line.qty += delta;
  if(line.qty <= 0) state.cart = state.cart.filter(l => l.id !== id);
  saveCart();
  renderCart();
}

function removeLine(id){
  state.cart = state.cart.filter(l => l.id !== id);
  saveCart();
  renderCart();
}

function renderCart(){
  const wrap = document.getElementById("cartItems");
  const countEl = document.getElementById("cartCount");
  const totalQty = state.cart.reduce((s,l) => s + l.qty, 0);
  countEl.textContent = totalQty;

  if(state.cart.length === 0){
    wrap.innerHTML = '<div class="cart-empty"><p>Your cart is empty.<br>Looks like you haven\u2019t added anything yet.</p></div>';
  }else{
    wrap.innerHTML = "";
    state.cart.forEach(line => {
      const p = state.data.products.find(p => p.id === line.id);
      if(!p) return;
      const row = document.createElement("div");
      row.className = "cart-line";
      row.innerHTML = `
        <img src="${getImages(p)[0] || ""}" alt="">
        <div class="cart-line-info">
          <span class="cart-line-name">${escapeHtml(p.name)}</span>
          <span>${fmt(p.price)}</span>
          <div class="qty-row">
            <button class="qty-btn" data-act="dec">&minus;</button>
            <span>${line.qty}</span>
            <button class="qty-btn" data-act="inc">+</button>
          </div>
          <button class="remove-line" data-act="remove">Remove</button>
        </div>
      `;
      row.querySelector('[data-act="dec"]').onclick = () => changeQty(p.id, -1);
      row.querySelector('[data-act="inc"]').onclick = () => changeQty(p.id, 1);
      row.querySelector('[data-act="remove"]').onclick = () => removeLine(p.id);
      wrap.appendChild(row);
    });
  }

  const subtotal = state.cart.reduce((s,l) => {
    const p = state.data.products.find(p => p.id === l.id);
    return s + (p ? p.price * l.qty : 0);
  }, 0);
  const shipping = subtotal > 0 && subtotal < 50000 ? 2500 : 0;
  const total = subtotal + shipping;

  document.getElementById("sumSubtotal").textContent = fmt(subtotal);
  document.getElementById("sumShipping").textContent = shipping ? fmt(shipping) : "Free";
  document.getElementById("sumTotal").textContent = fmt(total);

  const waBtn = document.getElementById("whatsappBtn");
  waBtn.disabled = state.cart.length === 0;
}

function openCart(){
  document.getElementById("cartDrawer").classList.add("open");
  document.getElementById("cartOverlay").classList.add("open");
}
function closeCart(){
  document.getElementById("cartDrawer").classList.remove("open");
  document.getElementById("cartOverlay").classList.remove("open");
}

function buildWhatsappMessage(){
  const d = state.data;
  let lines = [`Hi ${d.siteName}, I'd like to order:`, ""];
  let subtotal = 0;
  state.cart.forEach(l => {
    const p = d.products.find(p => p.id === l.id);
    if(!p) return;
    subtotal += p.price * l.qty;
    lines.push(`\u2022 ${p.name} x${l.qty} \u2014 ${fmt(p.price * l.qty)}`);
  });
  const shipping = subtotal > 0 && subtotal < 50000 ? 2500 : 0;
  lines.push("");
  lines.push(`Subtotal: ${fmt(subtotal)}`);
  lines.push(`Shipping: ${shipping ? fmt(shipping) : "Free"}`);
  lines.push(`Total: ${fmt(subtotal + shipping)}`);
  return lines.join("\n");
}

function sendWhatsapp(){
  if(state.cart.length === 0) return;
  const msg = encodeURIComponent(buildWhatsappMessage());
  const number = state.data.whatsappNumber;
  window.open(`https://wa.me/${number}?text=${msg}`, "_blank");
}

/* ---------------- events ---------------- */
document.getElementById("cartBtn").addEventListener("click", openCart);
document.getElementById("cartCloseBtn").addEventListener("click", closeCart);
document.getElementById("cartOverlay").addEventListener("click", closeCart);
document.getElementById("whatsappBtn").addEventListener("click", sendWhatsapp);
document.getElementById("footerWhatsapp").addEventListener("click", (e) => { e.preventDefault(); sendWhatsapp(); });

document.getElementById("priceFilter").addEventListener("change", (e) => {
  state.priceFilter = e.target.value;
  renderGrid();
});
document.getElementById("sortSelect").addEventListener("change", (e) => {
  state.sort = e.target.value;
  renderGrid();
});
document.getElementById("searchInput").addEventListener("input", (e) => {
  state.query = e.target.value;
  renderGrid();
});
document.getElementById("heroSearchBtn").addEventListener("click", () => {
  document.getElementById("products-section").scrollIntoView({ behavior: "smooth" });
  const input = document.getElementById("searchInput");
  input.focus();
});
document.getElementById("resetFiltersBtn").addEventListener("click", () => {
  state.activeCategory = "all";
  state.priceFilter = "all";
  state.sort = "featured";
  state.query = "";
  document.getElementById("priceFilter").value = "all";
  document.getElementById("sortSelect").value = "featured";
  document.getElementById("searchInput").value = "";
  renderCategoryRail();
  renderGrid();
});
document.getElementById("newsletterForm").addEventListener("submit", (e) => {
  e.preventDefault();
  e.target.reset();
  alert("Thanks for subscribing!");
});
document.addEventListener("keydown", (e) => {
  if(e.key === "Escape") closeQuickView();
});

loadData();
