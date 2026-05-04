(function () {
  const CATEGORY_LABELS = {
    'tasting': 'Fine Dining',
    'cal-am': 'Californian',
    'italian': 'Italian',
    'pizza': 'Pizza',
    'french': 'French',
    'japanese': 'Japanese',
    'chinese': 'Chinese',
    'mexican': 'Mexican / Latin',
    'vietnamese': 'Vietnamese',
    'thai': 'Thai / SE Asian',
    'indian': 'Indian',
    'korean': 'Korean',
    'med': 'Mediterranean',
    'filipino': 'Filipino',
    'peruvian': 'Peruvian',
    'seafood': 'Seafood',
    'steakhouse': 'Steakhouse',
    'bakery': 'Bakery / Coffee',
    'brunch': 'Brunch',
    'burgers': 'Burgers / Sandwiches',
    'vegetarian': 'Vegetarian',
    'bars': 'Bars',
  };

  let restaurants = [];
  let activeCategory = 'all';
  let activePrice = 'all';
  let searchQuery = '';
  let map = null;
  const markers = {};

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[c]);
  }

  function gmapsLink(restaurant) {
    const q = encodeURIComponent(`${restaurant.name}, ${restaurant.address}`);
    return `https://www.google.com/maps/search/?api=1&query=${q}`;
  }

  function isStarTag(tag) { return /^Michelin/i.test(tag); }

  function renderTag(tag) {
    const cls = isStarTag(tag) ? 'card-tag star' : 'card-tag';
    return `<span class="${cls}">${escapeHtml(tag)}</span>`;
  }

  function renderCard(r) {
    const tags = (r.tags || []).map(renderTag).join('');
    return `
      <article class="card" id="card-${escapeHtml(r.id)}" data-id="${escapeHtml(r.id)}">
        <div class="card-image" data-cat="${escapeHtml(r.category)}"></div>
        <div class="card-body">
          <h3 class="card-name">${escapeHtml(r.name)}</h3>
          <p class="card-meta">${escapeHtml(r.cuisine)} · ${escapeHtml(r.neighborhood)}<span class="price">${escapeHtml(r.price)}</span></p>
          ${tags ? `<div class="card-tags">${tags}</div>` : ''}
          <p class="card-desc">${escapeHtml(r.description)}</p>
          <p class="card-why">${escapeHtml(r.why)}</p>
          <div class="card-actions">
            <a class="card-link" href="${gmapsLink(r)}" target="_blank" rel="noopener">Open in Maps →</a>
            ${r.website ? `<a class="card-link secondary" href="${escapeHtml(r.website)}" target="_blank" rel="noopener">Website →</a>` : ''}
          </div>
        </div>
      </article>
    `;
  }

  function buildCuisineFilter() {
    const used = new Set(restaurants.map(r => r.category));
    const filterEl = document.getElementById('cuisine-filter');
    Object.keys(CATEGORY_LABELS).forEach(cat => {
      if (!used.has(cat)) return;
      const btn = document.createElement('button');
      btn.className = 'cuisine-btn';
      btn.dataset.cat = cat;
      btn.role = 'tab';
      btn.textContent = CATEGORY_LABELS[cat];
      filterEl.appendChild(btn);
    });
    filterEl.addEventListener('click', e => {
      const btn = e.target.closest('.cuisine-btn');
      if (!btn) return;
      filterEl.querySelectorAll('.cuisine-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeCategory = btn.dataset.cat;
      render();
    });
  }

  function bindPriceFilter() {
    document.querySelectorAll('.price-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.price-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activePrice = btn.dataset.price;
        render();
      });
    });
  }

  function bindSearch() {
    document.getElementById('search').addEventListener('input', e => {
      searchQuery = e.target.value.trim().toLowerCase();
      render();
    });
  }

  function matchesFilter(r) {
    if (activeCategory !== 'all' && r.category !== activeCategory) return false;
    if (activePrice !== 'all' && r.price !== activePrice) return false;
    if (searchQuery) {
      const haystack = `${r.name} ${r.neighborhood} ${r.cuisine} ${r.description} ${r.why}`.toLowerCase();
      if (!haystack.includes(searchQuery)) return false;
    }
    return true;
  }

  // ---- Map ----

  function initMap() {
    if (typeof L === 'undefined') return;
    const mapEl = document.getElementById('map');
    if (!mapEl) return;

    map = L.map(mapEl, {
      scrollWheelZoom: false,
      zoomControl: true,
    });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    // Re-enable scroll-wheel zoom only after the map gains focus.
    map.on('focus', () => map.scrollWheelZoom.enable());
    map.on('blur',  () => map.scrollWheelZoom.disable());
    mapEl.addEventListener('mouseleave', () => map.scrollWheelZoom.disable());

    restaurants.forEach(r => {
      if (!r.coords) return;
      const icon = L.divIcon({
        className: 'pin-wrap',
        html: `<div class="pin-marker" data-cat="${r.category}"></div>`,
        iconSize: [16, 16],
      });
      const m = L.marker(r.coords, { icon, title: r.name })
        .addTo(map)
        .bindPopup(popupHtml(r), { offset: [0, -6], autoPan: true, closeButton: true });
      m.on('popupopen', () => {
        // Wire the popup link to scroll into view (after popup is rendered).
        const pop = m.getPopup().getElement();
        if (!pop) return;
        const link = pop.querySelector('.pop-jump');
        if (link) {
          link.addEventListener('click', e => {
            e.preventDefault();
            jumpToCard(r.id);
          }, { once: true });
        }
      });
      markers[r.id] = m;
    });

    fitBoundsToVisible();
  }

  function popupHtml(r) {
    const tags = (r.tags || []).slice(0, 2).join(' · ');
    return (
      `<span class="pop-name">${escapeHtml(r.name)}</span>` +
      `<span class="pop-meta">${escapeHtml(r.cuisine)} · ${escapeHtml(r.neighborhood)} · ${escapeHtml(r.price)}${tags ? ' · ' + escapeHtml(tags) : ''}</span>` +
      `<span class="pop-actions">` +
        `<a class="pop-link pop-jump" href="#card-${escapeHtml(r.id)}">See full card</a>` +
        `<a class="pop-link" href="${gmapsLink(r)}" target="_blank" rel="noopener">Maps</a>` +
        (r.website ? `<a class="pop-link" href="${escapeHtml(r.website)}" target="_blank" rel="noopener">Website</a>` : '') +
      `</span>`
    );
  }

  function fitBoundsToVisible() {
    if (!map) return;
    const visible = restaurants.filter(matchesFilter).filter(r => r.coords);
    if (visible.length === 0) return;
    if (visible.length === 1) {
      map.setView(visible[0].coords, 14);
      return;
    }
    const bounds = L.latLngBounds(visible.map(r => r.coords));
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
  }

  function applyMarkerVisibility() {
    if (!map) return;
    let visible = 0;
    restaurants.forEach(r => {
      const m = markers[r.id];
      if (!m) return;
      const show = matchesFilter(r);
      if (show) {
        if (!map.hasLayer(m)) m.addTo(map);
        visible++;
      } else {
        if (map.hasLayer(m)) map.removeLayer(m);
      }
    });
    const cnt = document.getElementById('map-count');
    if (cnt) cnt.textContent = visible;
  }

  function jumpToCard(id) {
    const card = document.getElementById(`card-${id}`);
    if (!card) return;
    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    card.classList.remove('is-flash');
    // Re-trigger animation
    void card.offsetWidth;
    card.classList.add('is-flash');
  }

  // ---- Render ----

  function render() {
    const grid = document.getElementById('grid');
    const empty = document.getElementById('empty');
    const filtered = restaurants.filter(matchesFilter);
    if (filtered.length === 0) {
      grid.innerHTML = '';
      empty.hidden = false;
    } else {
      empty.hidden = true;
      grid.innerHTML = filtered.map(renderCard).join('');
    }
    applyMarkerVisibility();
    fitBoundsToVisible();
  }

  async function init() {
    try {
      const res = await fetch('/restaurants/data.json', { cache: 'no-cache' });
      restaurants = await res.json();
    } catch (e) {
      document.getElementById('grid').textContent = 'Failed to load restaurants.';
      return;
    }
    const order = Object.keys(CATEGORY_LABELS);
    restaurants.sort((a, b) => {
      const ca = order.indexOf(a.category);
      const cb = order.indexOf(b.category);
      if (ca !== cb) return ca - cb;
      return a.name.localeCompare(b.name);
    });
    buildCuisineFilter();
    bindPriceFilter();
    bindSearch();
    initMap();
    render();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
