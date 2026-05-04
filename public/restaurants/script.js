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

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[c]);
  }

  function gmapsLink(restaurant) {
    const q = encodeURIComponent(`${restaurant.name}, ${restaurant.address}`);
    return `https://www.google.com/maps/search/?api=1&query=${q}`;
  }

  function isStarTag(tag) {
    return /^Michelin/i.test(tag);
  }

  function renderTag(tag) {
    const cls = isStarTag(tag) ? 'card-tag star' : 'card-tag';
    return `<span class="${cls}">${escapeHtml(tag)}</span>`;
  }

  function renderCard(r) {
    const tags = (r.tags || []).map(renderTag).join('');
    return `
      <article class="card">
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
    const used = new Set();
    restaurants.forEach(r => used.add(r.category));
    const filterEl = document.getElementById('cuisine-filter');
    // The "All" button is already in HTML; append the rest in our preferred order.
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

  function render() {
    const grid = document.getElementById('grid');
    const empty = document.getElementById('empty');
    const filtered = restaurants.filter(matchesFilter);
    if (filtered.length === 0) {
      grid.innerHTML = '';
      empty.hidden = false;
      return;
    }
    empty.hidden = true;
    grid.innerHTML = filtered.map(renderCard).join('');
  }

  async function init() {
    try {
      const res = await fetch('/restaurants/data.json', { cache: 'no-cache' });
      restaurants = await res.json();
    } catch (e) {
      document.getElementById('grid').textContent = 'Failed to load restaurants.';
      return;
    }
    // Stable sort: by category in a sensible order, then by name.
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
    render();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
