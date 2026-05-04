(function () {
  const STATE_KEY = 'sf-restaurant-triage-v1';
  let sections = [];
  let votes = loadVotes();
  let filter = 'all';

  function loadVotes() {
    try {
      const raw = localStorage.getItem(STATE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) { return {}; }
  }

  function saveVotes() {
    try { localStorage.setItem(STATE_KEY, JSON.stringify(votes)); }
    catch (e) { /* ignore quota */ }
  }

  function setVote(id, value) {
    if (value == null) delete votes[id];
    else votes[id] = value;
    saveVotes();
    updateRowState(id);
    updateProgress();
    if (filter !== 'all') applyFilter();
  }

  function updateRowState(id) {
    const row = document.querySelector(`.row[data-id="${id}"]`);
    if (!row) return;
    const v = votes[id] || null;
    row.classList.toggle('is-up', v === 'up');
    row.classList.toggle('is-down', v === 'down');
    row.querySelectorAll('.btn-vote').forEach(btn => {
      const want = btn.dataset.vote;
      btn.classList.toggle('active', want === v);
    });
  }

  function counts() {
    let up = 0, down = 0, total = 0;
    sections.forEach(s => s.entries.forEach(e => {
      total++;
      if (votes[e.id] === 'up') up++;
      else if (votes[e.id] === 'down') down++;
    }));
    return { up, down, undecided: total - up - down, total };
  }

  function updateProgress() {
    const c = counts();
    const el = document.getElementById('progress');
    el.innerHTML =
      `<strong>${c.up}</strong> liked · <strong>${c.down}</strong> passed · ` +
      `<strong>${c.undecided}</strong> undecided · ${c.total} total`;
  }

  function rowMatchesFilter(id) {
    if (filter === 'all') return true;
    const v = votes[id] || 'undecided';
    if (filter === 'undecided') return v === 'undecided';
    return v === filter;
  }

  function applyFilter() {
    document.querySelectorAll('.row').forEach(row => {
      row.style.display = rowMatchesFilter(row.dataset.id) ? '' : 'none';
    });
    document.querySelectorAll('.section').forEach(sec => {
      const visible = Array.from(sec.querySelectorAll('.row')).some(r => r.style.display !== 'none');
      sec.style.display = visible ? '' : 'none';
    });
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[c]);
  }

  function renderBadges(badges) {
    if (!badges) return '';
    // Pick out things that look like Chronicle ranks or stars; render the rest plain.
    const parts = badges.split('`').filter(Boolean);
    return parts.map(p => {
      const t = p.trim();
      if (!t) return '';
      return `<span class="badge">${escapeHtml(t)}</span>`;
    }).join('');
  }

  function renderRow(entry) {
    const v = votes[entry.id] || null;
    const meta = [
      entry.neighborhood && escapeHtml(entry.neighborhood),
      entry.cuisine && escapeHtml(entry.cuisine),
    ].filter(Boolean).join(' · ');

    const div = document.createElement('div');
    div.className = 'row';
    if (v === 'up') div.classList.add('is-up');
    if (v === 'down') div.classList.add('is-down');
    div.dataset.id = entry.id;
    div.innerHTML = `
      <div class="row-buttons">
        <button class="btn-vote up ${v === 'up' ? 'active' : ''}" data-vote="up" aria-label="Like ${escapeHtml(entry.name)}">👍</button>
        <button class="btn-vote down ${v === 'down' ? 'active' : ''}" data-vote="down" aria-label="Pass ${escapeHtml(entry.name)}">👎</button>
        <button class="btn-vote skip" data-vote="" aria-label="Clear vote for ${escapeHtml(entry.name)}">↻</button>
      </div>
      <div class="row-content">
        <p class="row-name">${escapeHtml(entry.name)}</p>
        <p class="row-meta">${meta}${renderBadges(entry.badges)}</p>
      </div>
    `;

    div.querySelectorAll('.btn-vote').forEach(btn => {
      btn.addEventListener('click', () => {
        const want = btn.dataset.vote || null;
        const current = votes[entry.id] || null;
        // Toggle off if same vote clicked again
        const next = (want && want === current) ? null : (want || null);
        setVote(entry.id, next);
      });
    });
    return div;
  }

  function renderAll() {
    const list = document.getElementById('list');
    list.innerHTML = '';
    sections.forEach((s, i) => {
      const sec = document.createElement('section');
      sec.className = 'section';
      sec.id = `section-${i}`;
      sec.innerHTML = `
        <h2 class="section-header">
          <span>${escapeHtml(s.title)}</span>
          <span class="section-count">${s.entries.length}</span>
        </h2>
      `;
      s.entries.forEach(e => sec.appendChild(renderRow(e)));
      list.appendChild(sec);
    });
    updateProgress();
  }

  function buildExportText() {
    const liked = [], passed = [], undecided = [];
    sections.forEach(s => s.entries.forEach(e => {
      const line = `- **${e.name}** — ${e.neighborhood} — ${e.cuisine}` +
        (e.badges ? ` — ${e.badges}` : '');
      const v = votes[e.id];
      if (v === 'up') liked.push(line);
      else if (v === 'down') passed.push(line);
      else undecided.push(line);
    }));
    const date = new Date().toISOString().slice(0, 10);
    return [
      `# SF Restaurant Triage Results — ${date}`,
      ``,
      `## LIKED (${liked.length})`,
      liked.length ? liked.join('\n') : '_(none)_',
      ``,
      `## PASSED (${passed.length})`,
      passed.length ? passed.join('\n') : '_(none)_',
      ``,
      `## UNDECIDED (${undecided.length})`,
      undecided.length ? undecided.join('\n') : '_(none)_',
    ].join('\n');
  }

  function showExport() {
    const dlg = document.getElementById('export-dialog');
    document.getElementById('export-text').value = buildExportText();
    document.getElementById('copied-msg').hidden = true;
    if (typeof dlg.showModal === 'function') dlg.showModal();
    else dlg.setAttribute('open', '');
  }

  function copyExport() {
    const ta = document.getElementById('export-text');
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    if (!ok && navigator.clipboard) {
      navigator.clipboard.writeText(ta.value).then(() => flashCopied(), () => {});
      return;
    }
    if (ok) flashCopied();
  }

  function flashCopied() {
    const msg = document.getElementById('copied-msg');
    msg.hidden = false;
    setTimeout(() => { msg.hidden = true; }, 1800);
  }

  function bindToolbar() {
    document.querySelectorAll('.toolbar .filters button').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.toolbar .filters button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        filter = btn.dataset.filter;
        applyFilter();
      });
    });
    document.getElementById('export-btn').addEventListener('click', showExport);
    document.getElementById('reset-btn').addEventListener('click', () => {
      if (!confirm('Clear all votes? This cannot be undone.')) return;
      votes = {};
      saveVotes();
      document.querySelectorAll('.row').forEach(r => {
        r.classList.remove('is-up', 'is-down');
        r.querySelectorAll('.btn-vote').forEach(b => b.classList.remove('active'));
      });
      updateProgress();
      applyFilter();
    });
    document.getElementById('close-export').addEventListener('click', () => {
      document.getElementById('export-dialog').close();
    });
    document.getElementById('copy-btn').addEventListener('click', copyExport);
  }

  async function init() {
    try {
      const res = await fetch('/triage/data.json', { cache: 'no-cache' });
      sections = await res.json();
    } catch (e) {
      document.getElementById('list').textContent = 'Failed to load restaurant data.';
      return;
    }
    renderAll();
    bindToolbar();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
