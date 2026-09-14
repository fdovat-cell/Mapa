const WHATSAPP_NUMBER = '59896190002'; // 096 190002 con código de país UY

const state = {
  productos: [],
  cart: JSON.parse(localStorage.getItem('pedido_cart') || '{}'),
  activeCat: null,
};

const els = {
  search: document.getElementById('search'),
  results: document.getElementById('results'),
  emptyState: document.getElementById('emptyState'),
  catBar: document.getElementById('catBar'),
  cartBtn: document.getElementById('cartBtn'),
  cartCount: document.getElementById('cartCount'),
  overlay: document.getElementById('overlay'),
  drawer: document.getElementById('drawer'),
  closeDrawer: document.getElementById('closeDrawer'),
  drawerItems: document.getElementById('drawerItems'),
  drawerEmpty: document.getElementById('drawerEmpty'),
  totalAmount: document.getElementById('totalAmount'),
  sendBtn: document.getElementById('sendBtn'),
};

function normalize(str) {
  return (str || '')
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function money(n) {
  return '$' + Math.round(n).toLocaleString('es-UY');
}

let categoryIndex = []; // [{cat, items:[...]}] sorted alphabetically

fetch('productos.json')
  .then(r => r.json())
  .then(data => {
    state.productos = data;
    saveCartCleanup();
    renderCartBadge();
    buildCategoryIndex();
    renderResults();
  })
  .catch(() => {
    els.emptyState.textContent = 'No se pudo cargar la lista de productos.';
  });

function buildCategoryIndex() {
  const byCat = {};
  state.productos.forEach(p => {
    (byCat[p.cat] = byCat[p.cat] || []).push(p);
  });
  categoryIndex = Object.keys(byCat)
    .sort((a, b) => a.localeCompare(b, 'es'))
    .map(cat => ({
      cat,
      items: byCat[cat].sort((a, b) => a.d.localeCompare(b.d, 'es')),
    }));
}

function saveCart() {
  localStorage.setItem('pedido_cart', JSON.stringify(state.cart));
}

function saveCartCleanup() {
  // drop cart entries for codes no longer in the list
  const validCodes = new Set(state.productos.map(p => p.c));
  let changed = false;
  Object.keys(state.cart).forEach(c => {
    if (!validCodes.has(c)) { delete state.cart[c]; changed = true; }
  });
  if (changed) saveCart();
}

function search(query) {
  const q = normalize(query).trim();
  if (!q) return [];
  const terms = q.split(/\s+/);
  return state.productos.filter(p => {
    const hay = normalize(p.c) + ' ' + normalize(p.d);
    return terms.every(t => hay.includes(t));
  }).slice(0, 80);
}

function renderCategoryChips(matches) {
  if (!matches.length) {
    els.catBar.innerHTML = '';
    return;
  }
  const counts = {};
  matches.forEach(p => { counts[p.cat] = (counts[p.cat] || 0) + 1; });
  const cats = Object.keys(counts).sort((a, b) => counts[b] - counts[a]).slice(0, 12);
  if (cats.length < 2) {
    els.catBar.innerHTML = '';
    return;
  }
  els.catBar.innerHTML = '';
  cats.forEach(cat => {
    const chip = document.createElement('button');
    chip.className = 'cat-chip' + (state.activeCat === cat ? ' active' : '');
    chip.textContent = cat.length > 28 ? cat.slice(0, 26) + '…' : cat;
    chip.onclick = () => {
      state.activeCat = state.activeCat === cat ? null : cat;
      runSearch();
    };
    els.catBar.appendChild(chip);
  });
}

function renderResults() {
  let matches = search(els.search.value);
  renderCategoryChips(matches);
  if (state.activeCat) {
    matches = matches.filter(p => p.cat === state.activeCat);
  }

  els.results.innerHTML = '';

  if (!els.search.value.trim()) {
    renderCategoryBrowse();
    return;
  }
  if (!matches.length) {
    els.emptyState.style.display = 'block';
    els.emptyState.textContent = 'Sin resultados. Probá con otra palabra o el código.';
    return;
  }
  els.emptyState.style.display = 'none';

  const frag = document.createDocumentFragment();
  matches.forEach(p => frag.appendChild(buildItemRow(p)));
  els.results.appendChild(frag);
}

function buildItemRow(p) {
  const inCart = !!state.cart[p.c];
  const row = document.createElement('div');
  row.className = 'item';
  row.innerHTML = `
    <div class="item-main">
      <div class="item-code">${p.c}</div>
      <div class="item-desc">${p.d}</div>
      <div class="item-price">${money(p.p)}</div>
    </div>
    <button class="add-btn ${inCart ? 'in-cart' : ''}" aria-label="Agregar">${inCart ? '✓' : '+'}</button>
  `;
  row.querySelector('.add-btn').onclick = (e) => {
    addToCart(p);
    e.currentTarget.classList.add('in-cart');
    e.currentTarget.textContent = '✓';
  };
  return row;
}

function renderCategoryBrowse() {
  els.catBar.innerHTML = '';
  els.emptyState.style.display = 'none';
  els.results.innerHTML = '';

  const frag = document.createDocumentFragment();
  categoryIndex.forEach(({ cat, items }) => {
    const details = document.createElement('details');
    details.className = 'cat-group';
    const summary = document.createElement('summary');
    summary.innerHTML = `<span>${cat}</span><span class="cat-count">${items.length}</span>`;
    details.appendChild(summary);

    const body = document.createElement('div');
    body.className = 'cat-group-body';
    let rendered = false;
    details.addEventListener('toggle', () => {
      if (details.open && !rendered) {
        items.forEach(p => body.appendChild(buildItemRow(p)));
        rendered = true;
      }
    });
    details.appendChild(body);
    frag.appendChild(details);
  });
  els.results.appendChild(frag);
}

function runSearch() {
  renderResults();
}

function addToCart(p) {
  if (state.cart[p.c]) {
    state.cart[p.c].qty += 1;
  } else {
    state.cart[p.c] = { c: p.c, d: p.d, p: p.p, qty: 1, color: '' };
  }
  saveCart();
  renderCartBadge();
}

function removeFromCart(code) {
  delete state.cart[code];
  saveCart();
  renderCartBadge();
  renderDrawer();
  renderResults();
}

function renderCartBadge() {
  const count = Object.values(state.cart).reduce((s, i) => s + i.qty, 0);
  els.cartCount.textContent = count;
}

function cartTotal() {
  return Object.values(state.cart).reduce((s, i) => s + i.p * i.qty, 0);
}

function renderDrawer() {
  const items = Object.values(state.cart);
  els.drawerItems.innerHTML = '';
  els.drawerEmpty.style.display = items.length ? 'none' : 'block';
  els.sendBtn.style.display = items.length ? 'flex' : 'none';

  items.forEach(item => {
    const line = document.createElement('div');
    line.className = 'cart-line';
    line.innerHTML = `
      <div class="cart-line-top">
        <div>
          <div class="cart-line-code">${item.c}</div>
          <div class="cart-line-desc">${item.d}</div>
        </div>
        <button class="remove-line" aria-label="Quitar">Quitar</button>
      </div>
      <div class="cart-line-controls">
        <div class="qty-stepper">
          <button class="qty-minus">−</button>
          <span>${item.qty}</span>
          <button class="qty-plus">+</button>
        </div>
        <input class="color-input" type="text" placeholder="Color (opcional)" value="${item.color.replace(/"/g, '&quot;')}">
      </div>
      <div class="line-total">${money(item.p * item.qty)}</div>
    `;
    line.querySelector('.remove-line').onclick = () => removeFromCart(item.c);
    line.querySelector('.qty-minus').onclick = () => {
      if (item.qty <= 1) { removeFromCart(item.c); return; }
      item.qty -= 1; saveCart(); renderDrawer();
    };
    line.querySelector('.qty-plus').onclick = () => {
      item.qty += 1; saveCart(); renderDrawer();
    };
    line.querySelector('.color-input').oninput = (e) => {
      item.color = e.target.value; saveCart();
    };
    els.drawerItems.appendChild(line);
  });

  els.totalAmount.textContent = money(cartTotal());
}

function openDrawer() {
  renderDrawer();
  els.overlay.classList.add('open');
  els.drawer.classList.add('open');
}
function closeDrawerFn() {
  els.overlay.classList.remove('open');
  els.drawer.classList.remove('open');
  renderResults(); // refresh add-btn states after possible removals
}

els.cartBtn.onclick = openDrawer;
els.closeDrawer.onclick = closeDrawerFn;
els.overlay.onclick = closeDrawerFn;

els.search.addEventListener('input', () => {
  state.activeCat = null;
  runSearch();
});

els.sendBtn.onclick = () => {
  const items = Object.values(state.cart);
  if (!items.length) return;
  const fecha = new Date().toLocaleDateString('es-UY');
  let msg = `🧾 Pedido papelería - ${fecha}\n\n`;
  items.forEach(i => {
    msg += `${i.qty}x [${i.c}] ${i.d}`;
    if (i.color.trim()) msg += ` (${i.color.trim()})`;
    msg += ` — ${money(i.p * i.qty)}\n`;
  });
  msg += `\nTotal: ${money(cartTotal())}`;
  const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`;
  window.open(url, '_blank');
};

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js').catch(() => {});
  });
}
