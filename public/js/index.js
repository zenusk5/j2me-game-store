const grid = document.getElementById('game-grid');
const categoryBar = document.getElementById('category-bar');
const searchForm = document.getElementById('search-form');
const searchInput = document.getElementById('search-input');

let allGames = [];
let activeCategory = '';

function escapeHtml(str) {
  const map = { '&': '\x26amp;', '<': '\x26lt;', '>': '\x26gt;', '"': '\x26quot;', "'": '\x26#39;' };
  return String(str || '').replace(/[&<>"']/g, (c) => map[c]);
}

function renderCategories() {
  const categories = [...new Set(allGames.map((g) => g.category).filter(Boolean))];
  const buttons = [
    `<button class="${activeCategory === '' ? 'active' : ''}" data-cat="">Táº¥t cáº£ (${allGames.length})</button>`,
    ...categories.map(
      (cat) => `<button class="${activeCategory === cat ? 'active' : ''}" data-cat="${escapeHtml(cat)}">${escapeHtml(cat)}</button>`
    )
  ];
  categoryBar.innerHTML = buttons.join('');
}

function renderGames(games) {
  if (!games.length) {
    grid.innerHTML = '<p>ChÆ°a cÃ³ game nÃ o phÃ¹ há»£p.</p>';
    return;
  }

  grid.innerHTML = games.map((g) => {
    const sizeKB = ((g.jar?.sizeBytes || 0) / 1024).toFixed(1);
    return `
      <article class="game-card">
        <a href="/game/${encodeURIComponent(g.slug)}" class="thumb-link">
          <img src="${escapeHtml(g.cover)}" alt="${escapeHtml(g.name)}" loading="lazy" />
        </a>
        <div class="card-body">
          <span class="badge">${escapeHtml(g.category)}</span>
          <h2><a href="/game/${encodeURIComponent(g.slug)}">${escapeHtml(g.name)}</a></h2>
          <p class="desc">${escapeHtml(g.shortDescription)}</p>
          <div class="meta">v${escapeHtml(g.version)} Â· ${escapeHtml(g.resolution)} Â· ${sizeKB} KB Â· ${g.downloads || 0} lÆ°á»£t táº£i</div>
          <div class="card-actions">
            <a href="/game/${encodeURIComponent(g.slug)}" class="btn-outline">Chi tiáº¿t</a>
            <a href="/api/games/download?slug=${encodeURIComponent(g.slug)}" class="btn-primary">Táº£i .JAR</a>
          </div>
        </div>
      </article>
    `;
  }).join('');
}

function applyFilter() {
  const kw = searchInput.value.trim().toLowerCase();
  const filtered = allGames.filter((g) => {
    const matchCat = !activeCategory || g.category === activeCategory;
    const matchKw = !kw || g.name.toLowerCase().includes(kw) || g.shortDescription.toLowerCase().includes(kw);
    return matchCat && matchKw;
  });
  renderGames(filtered);
}

categoryBar.addEventListener('click', (e) => {
  if (e.target.tagName !== 'BUTTON') return;
  activeCategory = e.target.dataset.cat || '';
  renderCategories();
  applyFilter();
});

searchForm.addEventListener('submit', (e) => {
  e.preventDefault();
  applyFilter();
});

async function init() {
  const res = await fetch('/api/games/list');
  if (!res.ok) {
    grid.innerHTML = '<p>Lá»—i táº£i dá»¯ liá»‡u tá»« mÃ¡y chá»§.</p>';
    return;
  }
  const data = await res.json();
  allGames = data.games || [];
  renderCategories();
  renderGames(allGames);
}

init();