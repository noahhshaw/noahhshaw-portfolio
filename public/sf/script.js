(function () {
  let categories = [];          // [{ id, label, blurb, color, subcategoryOrder }]
  let categoryById = {};
  let places = [];              // unified list, each with category + subcategory
  let activeCategory = 'all';
  let searchQuery = '';
  let map = null;
  const markers = {};

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[c]);
  }

  function gmapsLink(p) {
    return 'https://www.google.com/maps/search/?api=1&query=' +
      encodeURIComponent(`${p.name}, ${p.address}`);
  }

  function isStarTag(tag) { return /^Michelin/i.test(tag); }

  // ---- Filtering ----

  function matches(p) {
    if (activeCategory !== 'all' && p.category !== activeCategory) return false;
    if (searchQuery) {
      const hay = `${p.name} ${p.neighborhood} ${p.subcategory} ${p.kind || ''} ${p.description} ${p.why}`.toLowerCase();
      if (!hay.includes(searchQuery)) return false;
    }
    return true;
  }

  // ---- Card rendering ----

  function renderCard(p) {
    const tags = (p.tags || []).map(t => {
      const cls = isStarTag(t) ? 'card-tag star' : 'card-tag';
      return `<span class="${cls}">${escapeHtml(t)}</span>`;
    }).join('');
    const metaLeft = [p.kind || p.subcategory, p.neighborhood].filter(Boolean).map(escapeHtml).join(' · ');
    const price = p.price ? `<span class="price">${escapeHtml(p.price)}</span>` : '';
    return `
      <article class="card" id="card-${escapeHtml(p.id)}" data-id="${escapeHtml(p.id)}">
        <div class="card-accent" data-cat="${escapeHtml(p.category)}"></div>
        <div class="card-body">
          <h3 class="card-name">${escapeHtml(p.name)}</h3>
          <p class="card-meta">${metaLeft}${price}</p>
          ${tags ? `<div class="card-tags">${tags}</div>` : ''}
          <p class="card-desc">${escapeHtml(p.description)}</p>
          <p class="card-why">${escapeHtml(p.why)}</p>
          <div class="card-actions">
            <a class="card-link" href="${gmapsLink(p)}" target="_blank" rel="noopener">Open in Maps →</a>
            ${p.website ? `<a class="card-link secondary" href="${escapeHtml(p.website)}" target="_blank" rel="noopener">Website →</a>` : ''}
          </div>
        </div>
      </article>
    `;
  }

  // ---- Sections rendering ----

  function renderSections() {
    const root = document.getElementById('sections');
    const empty = document.getElementById('empty');
    const filtered = places.filter(matches);

    if (filtered.length === 0) {
      root.innerHTML = '';
      empty.hidden = false;
      return '';
    }
    empty.hidden = true;

    // Group filtered places by category, then subcategory.
    const byCat = {};
    filtered.forEach(p => {
      if (!byCat[p.category]) byCat[p.category] = {};
      if (!byCat[p.category][p.subcategory]) byCat[p.category][p.subcategory] = [];
      byCat[p.category][p.subcategory].push(p);
    });

    // Render in category order, then subcategoryOrder within each.
    const html = categories.map(cat => {
      const subs = byCat[cat.id];
      if (!subs) return '';
      const subOrder = (cat.subcategoryOrder || []).slice();
      // Append any unexpected subcategories at the end, alphabetically.
      Object.keys(subs).forEach(s => { if (!subOrder.includes(s)) subOrder.push(s); });
      const subsHtml = subOrder.map(subKey => {
        const items = subs[subKey];
        if (!items || items.length === 0) return '';
        items.sort((a, b) => a.name.localeCompare(b.name));
        return `
          <div class="subsection">
            <h3 class="subsection-title">${escapeHtml(subKey)}</h3>
            <div class="grid">${items.map(renderCard).join('')}</div>
          </div>
        `;
      }).join('');

      const count = Object.values(subs).reduce((n, arr) => n + arr.length, 0);
      return `
        <section class="section" id="sec-${escapeHtml(cat.id)}">
          <header class="section-header">
            <h2 class="section-title">${escapeHtml(cat.label)}</h2>
            <span class="section-count">${count}</span>
          </header>
          ${cat.blurb ? `<p class="section-blurb">${escapeHtml(cat.blurb)}</p>` : ''}
          ${subsHtml}
        </section>
      `;
    }).join('');

    root.innerHTML = html;
  }

  // ---- Map ----

  function popupHtml(p) {
    const meta = [p.kind || p.subcategory, p.neighborhood, p.price].filter(Boolean).map(escapeHtml).join(' · ');
    return (
      `<span class="pop-name">${escapeHtml(p.name)}</span>` +
      `<span class="pop-meta">${meta}</span>` +
      `<span class="pop-actions">` +
        `<a class="pop-link pop-jump" href="#card-${escapeHtml(p.id)}">See card</a>` +
        `<a class="pop-link" href="${gmapsLink(p)}" target="_blank" rel="noopener">Maps</a>` +
        (p.website ? `<a class="pop-link" href="${escapeHtml(p.website)}" target="_blank" rel="noopener">Website</a>` : '') +
      `</span>`
    );
  }

  function initMap() {
    if (typeof L === 'undefined') return;
    const el = document.getElementById('map');
    if (!el) return;
    map = L.map(el, { scrollWheelZoom: false, zoomControl: true });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);
    map.on('focus', () => map.scrollWheelZoom.enable());
    map.on('blur',  () => map.scrollWheelZoom.disable());
    el.addEventListener('mouseleave', () => map.scrollWheelZoom.disable());

    places.forEach(p => {
      if (!p.coords) return;
      const icon = L.divIcon({
        className: 'pin-wrap',
        html: `<div class="pin-marker" data-cat="${p.category}"></div>`,
        iconSize: [16, 16],
      });
      const m = L.marker(p.coords, { icon, title: p.name })
        .addTo(map)
        .bindPopup(popupHtml(p), { offset: [0, -6], autoPan: true });
      m.on('popupopen', () => {
        const pop = m.getPopup().getElement();
        if (!pop) return;
        const link = pop.querySelector('.pop-jump');
        if (link) {
          link.addEventListener('click', e => {
            e.preventDefault();
            jumpToCard(p.id);
          }, { once: true });
        }
      });
      markers[p.id] = m;
    });

    fitBoundsToVisible();
  }

  function fitBoundsToVisible() {
    if (!map) return;
    const visible = places.filter(matches).filter(p => p.coords);
    if (visible.length === 0) return;
    if (visible.length === 1) { map.setView(visible[0].coords, 14); return; }
    const bounds = L.latLngBounds(visible.map(p => p.coords));
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
  }

  function applyMarkerVisibility() {
    if (!map) return;
    let n = 0;
    places.forEach(p => {
      const m = markers[p.id];
      if (!m) return;
      if (matches(p)) {
        if (!map.hasLayer(m)) m.addTo(map);
        n++;
      } else if (map.hasLayer(m)) {
        map.removeLayer(m);
      }
    });
    const cnt = document.getElementById('map-count');
    if (cnt) cnt.textContent = n;
  }

  function jumpToCard(id) {
    const card = document.getElementById(`card-${id}`);
    if (!card) return;
    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    card.classList.remove('is-flash');
    void card.offsetWidth;
    card.classList.add('is-flash');
  }

  // ---- Filter UI ----

  function buildCategoryFilter() {
    const el = document.getElementById('category-filter');
    categories.forEach(cat => {
      const btn = document.createElement('button');
      btn.className = 'cat-btn';
      btn.dataset.cat = cat.id;
      btn.role = 'tab';
      btn.textContent = cat.label;
      el.appendChild(btn);
    });
    el.addEventListener('click', e => {
      const btn = e.target.closest('.cat-btn');
      if (!btn) return;
      el.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeCategory = btn.dataset.cat;
      rerender();
    });
  }

  function bindSearch() {
    document.getElementById('search').addEventListener('input', e => {
      searchQuery = e.target.value.trim().toLowerCase();
      rerender();
    });
  }

  function rerender() {
    renderSections();
    applyMarkerVisibility();
    fitBoundsToVisible();
  }

  async function init() {
    try {
      const [catsRes, dataRes] = await Promise.all([
        fetch('/sf/categories.json', { cache: 'no-cache' }),
        fetch('/sf/data.json', { cache: 'no-cache' }),
      ]);
      const cats = await catsRes.json();
      categories = cats.categories || [];
      categoryById = Object.fromEntries(categories.map(c => [c.id, c]));
      places = await dataRes.json();
    } catch (e) {
      document.getElementById('sections').textContent = 'Failed to load data.';
      return;
    }
    buildCategoryFilter();
    bindSearch();
    initMap();
    rerender();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
