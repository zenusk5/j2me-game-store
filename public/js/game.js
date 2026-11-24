async function initGameDetail() {
  const slug = window.location.pathname.split('/').filter(Boolean).pop()
    || new URLSearchParams(window.location.search).get('slug');
  const res = await fetch(`/api/games/list?slug=${encodeURIComponent(slug)}`);
  if (!res.ok) {
    document.getElementById('game-detail').innerHTML = '<p>Không tìm thấy game.</p>';
    return;
  }
  const { game } = await res.json();
  const sizeKB = (game.jar.sizeBytes / 1024).toFixed(1);

  document.title = `${game.name} (.JAR) - J2ME Game Store`;
  document.getElementById('game-title').textContent = game.name;
  document.getElementById('game-cover').src = game.cover;
  document.getElementById('game-meta').textContent =
    `v${game.version} · ${game.resolution} · ${game.language} · ${sizeKB} KB · ${game.downloads} lượt tải`;
  document.getElementById('game-desc').textContent = game.fullDescription || game.shortDescription;

  const dlBtn = document.getElementById('btn-download');
  dlBtn.href = `/api/games/download?slug=${encodeURIComponent(game.slug)}`;
  dlBtn.textContent = `Tải ${game.jar.fileName} (${sizeKB} KB)`;

  const shotsBox = document.getElementById('game-screenshots');
  if (shotsBox) {
    shotsBox.innerHTML = (game.screenshots || []).length
      ? game.screenshots.map((src) => `<img src="${src}" alt="${game.name}" loading="lazy" />`).join('')
      : '<p>Chưa có ảnh chụp màn hình.</p>';
  }
}

initGameDetail();