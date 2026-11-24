const loginView = document.getElementById('login-view');
const dashboardView = document.getElementById('dashboard-view');
const modal = document.getElementById('game-modal');
const gameForm = document.getElementById('game-form');
const tbody = document.getElementById('game-tbody');

let cachedGames = [];

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${units[i]}`;
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function escapeHtml(str) {
  const map = { '&': '\x26amp;', '<': '\x26lt;', '>': '\x26gt;', '"': '\x26quot;', "'": '\x26#39;' };
  return String(str || '').replace(/[&<>"']/g, (c) => map[c]);
}

async function checkSession() {
  const res = await fetch('/api/auth/me', { credentials: 'same-origin' });
  if (res.ok) {
    const data = await res.json();
    document.getElementById('session-info').textContent =
      `Admin: ${data.username} (hết hạn: ${new Date(data.expiresAt).toLocaleTimeString('vi-VN')})`;
    loginView.hidden = true;
    dashboardView.hidden = false;
    await loadDashboard();
  } else {
    loginView.hidden = false;
    dashboardView.hidden = true;
  }
}

async function loadDashboard() {
  const res = await fetch('/api/admin/games', { credentials: 'same-origin' });
  if (res.status === 401) return checkSession();
  const data = await res.json();
  cachedGames = data.games || [];

  document.getElementById('stat-count').textContent = data.stats.totalGames;
  document.getElementById('stat-size').textContent = formatBytes(data.stats.totalBytes);
  document.getElementById('stat-downloads').textContent = data.stats.totalDownloads;

  tbody.innerHTML = cachedGames.map((g) => `
    <tr>
      <td><strong>${escapeHtml(g.name)}</strong><br/><small>/${escapeHtml(g.slug)}</small></td>
      <td>${escapeHtml(g.category)}</td>
      <td>v${escapeHtml(g.version)} · ${escapeHtml(g.resolution)}</td>
      <td>${formatBytes(g.jar?.sizeBytes)}</td>
      <td>${g.downloads || 0}</td>
      <td>
        <button data-edit="${g.id}">Sửa</button>
        <button data-del="${g.id}" class="btn-danger">Xóa</button>
      </td>
    </tr>
  `).join('');
}

document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errEl = document.getElementById('login-error');
  errEl.textContent = '';

  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({
      username: document.getElementById('login-user').value.trim(),
      password: document.getElementById('login-pass').value
    })
  });
  const data = await res.json();
  if (!res.ok) {
    errEl.textContent = data.error || 'Đăng nhập thất bại.';
    return;
  }
  await checkSession();
});

document.getElementById('btn-logout').addEventListener('click', async () => {
  await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
  await checkSession();
});

document.getElementById('btn-open-add').addEventListener('click', () => {
  gameForm.reset();
  document.getElementById('f-id').value = '';
  document.getElementById('modal-title').textContent = 'Thêm game mới';
  document.getElementById('jar-req-note').textContent = '*';
  document.getElementById('form-status').textContent = '';
  modal.showModal();
});

document.getElementById('btn-close-modal').addEventListener('click', () => modal.close());

tbody.addEventListener('click', async (e) => {
  const editId = e.target.dataset.edit;
  const delId = e.target.dataset.del;

  if (editId) {
    const g = cachedGames.find((x) => x.id === editId);
    if (!g) return;
    gameForm.reset();
    document.getElementById('f-id').value = g.id;
    document.getElementById('f-name').value = g.name;
    document.getElementById('f-slug').value = g.slug;
    document.getElementById('f-category').value = g.category;
    document.getElementById('f-version').value = g.version;
    document.getElementById('f-resolution').value = g.resolution;
    document.getElementById('f-language').value = g.language;
    document.getElementById('f-short').value = g.shortDescription;
    document.getElementById('f-full').value = g.fullDescription;
    document.getElementById('modal-title').textContent = `Chỉnh sửa: ${g.name}`;
    document.getElementById('jar-req-note').textContent = '(để trống nếu giữ file cũ)';
    document.getElementById('form-status').textContent = '';
    modal.showModal();
  }

  if (delId) {
    const g = cachedGames.find((x) => x.id === delId);
    if (!g) return;
    const confirmed = window.confirm(
      `Xác nhận xóa game "${g.name}" và file "${g.jar?.fileName}" khỏi GitHub? Hành động này không thể hoàn tác.`
    );
    if (!confirmed) return;

    const res = await fetch(`/api/admin/games?id=${encodeURIComponent(delId)}`, {
      method: 'DELETE',
      credentials: 'same-origin'
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || 'Xóa game thất bại.');
      return;
    }
    alert(`Đã xóa thành công game "${data.deletedName}".`);
    await loadDashboard();
  }
});

gameForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const statusEl = document.getElementById('form-status');
  const submitBtn = document.getElementById('btn-submit-game');
  const id = document.getElementById('f-id').value;
  const isEdit = Boolean(id);

  const jarInput = document.getElementById('f-jar').files[0];
  const coverInput = document.getElementById('f-cover').files[0];
  const shotInputs = Array.from(document.getElementById('f-shots').files || []).slice(0, 4);

  if (!isEdit && !jarInput) {
    statusEl.textContent = 'Vui lòng chọn file .jar.';
    return;
  }
  if (jarInput) {
    if (!jarInput.name.toLowerCase().endsWith('.jar')) {
      statusEl.textContent = 'File game phải có đuôi .jar.';
      return;
    }
    if (jarInput.size > 2 * 1024 * 1024) {
      statusEl.textContent = 'File JAR vượt quá giới hạn 2MB.';
      return;
    }
  }

  submitBtn.disabled = true;
  statusEl.textContent = 'Đang upload lên GitHub và cập nhật dữ liệu...';

  try {
    const payload = {
      id: id || undefined,
      name: document.getElementById('f-name').value.trim(),
      slug: document.getElementById('f-slug').value.trim(),
      category: document.getElementById('f-category').value.trim(),
      version: document.getElementById('f-version').value.trim(),
      resolution: document.getElementById('f-resolution').value.trim(),
      language: document.getElementById('f-language').value.trim(),
      shortDescription: document.getElementById('f-short').value.trim(),
      fullDescription: document.getElementById('f-full').value.trim()
    };

    if (jarInput) {
      payload.jarFile = { name: jarInput.name, base64: await fileToBase64(jarInput) };
    }
    if (coverInput) {
      payload.coverFile = { name: coverInput.name, base64: await fileToBase64(coverInput) };
    }
    if (shotInputs.length > 0) {
      payload.screenshotFiles = await Promise.all(
        shotInputs.map(async (f) => ({ name: f.name, base64: await fileToBase64(f) }))
      );
    }

    const res = await fetch('/api/admin/games', {
      method: isEdit ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Lưu thất bại.');

    modal.close();
    await loadDashboard();
  } catch (err) {
    statusEl.textContent = err.message;
  } finally {
    submitBtn.disabled = false;
  }
});

checkSession();