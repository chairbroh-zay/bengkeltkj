// ============================================
// app.js — Logika Utama Peminjaman Bengkel TKJ
// Kode akses: tkjhebat
// ============================================

const STORAGE_KEY = 'db_bengkel_tkj';
const ADMIN_USER = 'admin';
const ADMIN_PASS = 'admin123';

// ---------- AUTH ----------
function isAdmin() {
  return sessionStorage.getItem('isAdmin') === 'true';
}

function login(username, password) {
  if (username === ADMIN_USER && password === ADMIN_PASS) {
    sessionStorage.setItem('isAdmin', 'true');
    return true;
  }
  return false;
}

function logout() {
  sessionStorage.removeItem('isAdmin');
  window.location.href = 'index.html';
}

function requireAdmin() {
  if (!isAdmin()) {
    alert('Akses ditolak! Silakan login sebagai admin terlebih dahulu.');
    window.location.href = 'login.html';
    return false;
  }
  return true;
}

// ---------- DATA ----------
async function initData() {
  if (localStorage.getItem(STORAGE_KEY)) return;
  try {
    const res = await fetch('data.json');
    const seed = await res.json();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
  } catch (e) {
    // Fallback jika fetch gagal (file://)
    const fallback = {
      barang: [
        { id: 1, nama_barang: "MikroTik RB941-2nD", jenis: "Alat", stok: 10, lokasi_rak: "Rak A-1" },
        { id: 2, nama_barang: "Cisco Switch 2960", jenis: "Alat", stok: 5, lokasi_rak: "Rak A-2" },
        { id: 3, nama_barang: "Kabel UTP Cat5e (Meter)", jenis: "Bahan", stok: 100, lokasi_rak: "Rak B-1" },
        { id: 4, nama_barang: "Konektor RJ45 (Pcs)", jenis: "Bahan", stok: 50, lokasi_rak: "Rak B-2" }
      ],
      peminjaman: []
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(fallback));
  }
}

function getData() {
  return JSON.parse(localStorage.getItem(STORAGE_KEY));
}

function saveData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

// ---------- UTIL ----------
function showAlert(msg, type = 'error') {
  const el = document.getElementById('alert');
  if (!el) return alert(msg);
  el.textContent = msg;
  el.className = 'alert show' + (type === 'success' ? ' success' : type === 'info' ? ' info' : '');
  setTimeout(() => el.className = 'alert', 3500);
}

function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function genId(arr) {
  return arr.length ? Math.max(...arr.map(x => x.id)) + 1 : 1;
}

// ---------- RENDER HEADER & NAV ----------
function renderHeader() {
  const el = document.getElementById('authArea');
  if (!el) return;
  if (isAdmin()) {
    el.innerHTML = `
      <small>👤 Login sebagai <strong>Admin</strong></small>
      <button class="btn btn-danger btn-sm" onclick="logout()">Logout</button>
    `;
  } else {
    el.innerHTML = `<a href="login.html" class="btn btn-primary btn-sm">🔐 Login Admin</a>`;
  }
}

function renderNav(activePage) {
  const el = document.getElementById('navArea');
  if (!el) return;
  const admin = isAdmin();
  el.innerHTML = `
    <a href="index.html" class="${activePage === 'peminjaman' ? 'active' : ''}">📋 Peminjaman</a>
    <a href="${admin ? 'barang.html' : 'login.html'}" 
       class="${activePage === 'barang' ? 'active' : ''} ${!admin ? 'locked' : ''}">
       📦 Kelola Barang ${!admin ? '🔒' : ''}
    </a>
    <a href="${admin ? 'pengaturan.html' : 'login.html'}" 
       class="${activePage === 'pengaturan' ? 'active' : ''} ${!admin ? 'locked' : ''}">
       ⚙️ Pengaturan ${!admin ? '🔒' : ''}
    </a>
  `;
}

// ============================================
// HALAMAN 1: INDEX (Peminjaman)
// ============================================
function initIndexPage() {
  renderHeader();
  renderNav('peminjaman');
  renderDropdownBarang();
  renderTabelPeminjaman();

  document.getElementById('formPinjam').addEventListener('submit', handlePinjam);
}

function renderDropdownBarang() {
  const data = getData();
  const select = document.getElementById('barang_id');
  if (!select) return;
  const current = select.value;
  select.innerHTML = '<option value="">-- Pilih Item --</option>';
  data.barang.filter(b => b.stok > 0).forEach(b => {
    const opt = document.createElement('option');
    opt.value = b.id;
    opt.textContent = `${b.nama_barang} (Stok: ${b.stok} | ${b.jenis})`;
    select.appendChild(opt);
  });
  select.value = current;
}

function renderTabelPeminjaman() {
  const data = getData();
  const tbody = document.getElementById('tabelRiwayat');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (data.peminjaman.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="empty">Belum ada riwayat peminjaman.</td></tr>';
    return;
  }

  const list = [...data.peminjaman].sort((a, b) => b.id - a.id);
  const admin = isAdmin();

  list.forEach(p => {
    const barang = data.barang.find(b => b.id === p.barang_id);
    const namaBarang = barang ? barang.nama_barang : '(Barang dihapus)';
    const jenis = barang ? barang.jenis : '-';
    const tgl = new Date(p.tanggal_pinjam).toLocaleString('id-ID');

    const badge = p.status === 'Dipinjam'
      ? '<span class="badge badge-dipinjam">Dipinjam</span>'
      : '<span class="badge badge-kembali">Dikembalikan</span>';

    let aksi = '';
    if (p.status === 'Dipinjam') {
      aksi = `<button class="btn btn-success btn-sm" onclick="kembalikan(${p.id})">Kembalikan</button>`;
    } else if (admin) {
      aksi = `<button class="btn btn-danger btn-sm" onclick="hapusLog(${p.id})">Hapus Log</button>`;
    } else {
      aksi = `<span class="text-muted">—</span>`;
    }

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHTML(p.nama_siswa)}</td>
      <td>${escapeHTML(p.kelas)}</td>
      <td><strong>${escapeHTML(namaBarang)}</strong><br><small class="text-muted">Jenis: ${jenis}</small></td>
      <td>${p.jumlah_pinjam}</td>
      <td><small>${tgl}</small></td>
      <td>${badge}</td>
      <td>${aksi}</td>
    `;
    tbody.appendChild(tr);
  });
}

function handlePinjam(e) {
  e.preventDefault();
  const nama = document.getElementById('nama_siswa').value.trim();
  const kelas = document.getElementById('kelas').value.trim();
  const barang_id = parseInt(document.getElementById('barang_id').value);
  const jumlah = parseInt(document.getElementById('jumlah_pinjam').value);

  if (!nama || !kelas || !barang_id || !jumlah || jumlah < 1) {
    showAlert('Semua field wajib diisi dengan benar!');
    return;
  }

  const data = getData();
  const barang = data.barang.find(b => b.id === barang_id);
  if (!barang) return showAlert('Barang tidak ditemukan!');
  if (barang.stok < jumlah) return showAlert(`Stok tidak mencukupi! Tersedia hanya ${barang.stok}.`);

  barang.stok -= jumlah;
  data.peminjaman.push({
    id: genId(data.peminjaman),
    nama_siswa: nama,
    kelas: kelas,
    barang_id: barang_id,
    jumlah_pinjam: jumlah,
    tanggal_pinjam: new Date().toISOString(),
    status: 'Dipinjam'
  });

  saveData(data);
  e.target.reset();
  renderDropdownBarang();
  renderTabelPeminjaman();
  showAlert('Peminjaman berhasil dicatat!', 'success');
}

function kembalikan(id) {
  if (!confirm('Konfirmasi pengembalian barang ini?')) return;
  const data = getData();
  const p = data.peminjaman.find(x => x.id === id);
  if (!p || p.status === 'Dikembalikan') return;

  const barang = data.barang.find(b => b.id === p.barang_id);
  if (barang) barang.stok += p.jumlah_pinjam;
  p.status = 'Dikembalikan';

  saveData(data);
  renderDropdownBarang();
  renderTabelPeminjaman();
  showAlert('Barang berhasil dikembalikan!', 'success');
}

function hapusLog(id) {
  if (!isAdmin()) return;
  if (!confirm('Hapus log riwayat ini permanen?')) return;
  const data = getData();
  data.peminjaman = data.peminjaman.filter(p => p.id !== id);
  saveData(data);
  renderTabelPeminjaman();
  showAlert('Log berhasil dihapus.', 'success');
}

// ============================================
// HALAMAN 2: BARANG (Kelola Barang - Admin)
// ============================================
function initBarangPage() {
  if (!requireAdmin()) return;
  renderHeader();
  renderNav('barang');
  renderTabelBarang();
  document.getElementById('formBarang').addEventListener('submit', handleSimpanBarang);
  document.getElementById('btnCancelEdit').addEventListener('click', resetFormBarang);
}

let editingBarangId = null;

function renderTabelBarang() {
  const data = getData();
  const tbody = document.getElementById('tabelBarang');
  tbody.innerHTML = '';

  if (data.barang.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="empty">Belum ada barang.</td></tr>';
    return;
  }

  data.barang.forEach(b => {
    let stokBadge = '';
    if (b.stok === 0) stokBadge = ' <span class="badge badge-habis">HABIS</span>';
    else if (b.stok < 5) stokBadge = ' <span class="badge badge-rendah">RENDAH</span>';

    // Cek apakah barang sedang dipinjam
    const sedangDipinjam = data.peminjaman.some(p => p.barang_id === b.id && p.status === 'Dipinjam');
    const infoPinjam = sedangDipinjam ? '<br><small class="text-muted">⚠️ Sedang dipinjam</small>' : '';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${b.id}</td>
      <td><strong>${escapeHTML(b.nama_barang)}</strong>${infoPinjam}</td>
      <td>${b.jenis}</td>
      <td>${b.stok}${stokBadge}</td>
      <td>${escapeHTML(b.lokasi_rak)}</td>
      <td>
        <button class="btn btn-warning btn-sm" onclick="editBarang(${b.id})">Edit</button>
        <button class="btn btn-danger btn-sm" onclick="hapusBarang(${b.id})">Hapus</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function handleSimpanBarang(e) {
  e.preventDefault();
  const nama = document.getElementById('nama_barang').value.trim();
  const jenis = document.getElementById('jenis').value;
  const stok = parseInt(document.getElementById('stok').value);
  const lokasi = document.getElementById('lokasi_rak').value.trim();

  if (!nama || !jenis || isNaN(stok) || stok < 0 || !lokasi) {
    return showAlert('Semua field wajib diisi dengan benar!');
  }

  const data = getData();

  // Cek duplikat nama (kecuali saat edit dirinya sendiri)
  const dupe = data.barang.find(b => 
    b.nama_barang.toLowerCase() === nama.toLowerCase() && b.id !== editingBarangId
  );
  if (dupe) return showAlert('Nama barang sudah ada! Gunakan nama lain.');

  if (editingBarangId) {
    const b = data.barang.find(x => x.id === editingBarangId);
    b.nama_barang = nama;
    b.jenis = jenis;
    b.stok = stok;
    b.lokasi_rak = lokasi;
    saveData(data);
    showAlert('Barang berhasil diupdate!', 'success');
  } else {
    data.barang.push({
      id: genId(data.barang),
      nama_barang: nama,
      jenis: jenis,
      stok: stok,
      lokasi_rak: lokasi
    });
    saveData(data);
    showAlert('Barang berhasil ditambahkan!', 'success');
  }

  resetFormBarang();
  renderTabelBarang();
}

function editBarang(id) {
  const data = getData();
  const b = data.barang.find(x => x.id === id);
  if (!b) return;

  editingBarangId = id;
  document.getElementById('nama_barang').value = b.nama_barang;
  document.getElementById('jenis').value = b.jenis;
  document.getElementById('stok').value = b.stok;
  document.getElementById('lokasi_rak').value = b.lokasi_rak;
  document.getElementById('formTitle').textContent = 'Edit Barang';
  document.getElementById('btnCancelEdit').style.display = 'inline-block';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function resetFormBarang() {
  editingBarangId = null;
  document.getElementById('formBarang').reset();
  document.getElementById('formTitle').textContent = 'Tambah Barang Baru';
  document.getElementById('btnCancelEdit').style.display = 'none';
}

function hapusBarang(id) {
  const data = getData();
  const b = data.barang.find(x => x.id === id);
  if (!b) return;

  const sedangDipinjam = data.peminjaman.some(p => p.barang_id === id && p.status === 'Dipinjam');
  const warning = sedangDipinjam
    ? `⚠️ Barang "${b.nama_barang}" SEDANG DIPINJAM.\n\nJika dihapus:\n- Riwayat peminjaman tetap ada\n- Akan tampil sebagai "(Barang dihapus)"\n- Stok tidak bisa dikembalikan\n\nLanjut hapus?`
    : `Hapus barang "${b.nama_barang}"?\n\nRiwayat peminjaman lama akan tetap ada dengan label "(Barang dihapus)".`;

  if (!confirm(warning)) return;

  data.barang = data.barang.filter(x => x.id !== id);
  saveData(data);
  renderTabelBarang();
  showAlert('Barang berhasil dihapus. Riwayat lama tetap tersimpan.', 'success');
}

// ============================================
// HALAMAN 3: LOGIN
// ============================================
function initLoginPage() {
  renderHeader();
  renderNav('');
  document.getElementById('formLogin').addEventListener('submit', function (e) {
    e.preventDefault();
    const u = document.getElementById('username').value.trim();
    const p = document.getElementById('password').value;
    if (login(u, p)) {
      window.location.href = 'barang.html';
    } else {
      showAlert('Username atau password salah!');
    }
  });

  // Jika sudah login, redirect
  if (isAdmin()) {
    setTimeout(() => window.location.href = 'barang.html', 100);
  }
}

// ============================================
// HALAMAN 4: PENGATURAN (Export/Import - Admin)
// ============================================
function initPengaturanPage() {
  if (!requireAdmin()) return;
  renderHeader();
  renderNav('pengaturan');
  updateStorageInfo();

  document.getElementById('btnExport').addEventListener('click', exportJSON);
  document.getElementById('btnImport').addEventListener('click', () => {
    document.getElementById('fileImport').click();
  });
  document.getElementById('fileImport').addEventListener('change', importJSON);
  document.getElementById('btnReset').addEventListener('click', resetAllData);
}

function updateStorageInfo() {
  const el = document.getElementById('storageInfo');
  if (!el) return;
  const data = getData();
  const raw = localStorage.getItem(STORAGE_KEY);
  const sizeKB = (new Blob([raw]).size / 1024).toFixed(2);
  el.innerHTML = `
    <p><strong>📦 Barang:</strong> ${data.barang.length} item</p>
    <p><strong>📋 Peminjaman:</strong> ${data.peminjaman.length} transaksi</p>
    <p><strong>💾 Ukuran data:</strong> ${sizeKB} KB</p>
  `;
}

function exportJSON() {
  const data = getData();
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = `backup_bengkel_${ts}.json`;
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  showAlert(`Backup berhasil: ${filename}`, 'success');
}

function importJSON(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function (evt) {
    try {
      const parsed = JSON.parse(evt.target.result);

      // Validasi struktur
      if (!parsed || typeof parsed !== 'object') throw new Error('File bukan objek JSON');
      if (!Array.isArray(parsed.barang)) throw new Error('Field "barang" tidak ditemukan atau bukan array');
      if (!Array.isArray(parsed.peminjaman)) throw new Error('Field "peminjaman" tidak ditemukan atau bukan array');

      // Validasi setiap barang
      parsed.barang.forEach((b, i) => {
        if (typeof b.id !== 'number' || !b.nama_barang || !b.jenis || typeof b.stok !== 'number') {
          throw new Error(`Barang index ${i} tidak valid (field wajib kurang)`);
        }
      });

      // Validasi setiap peminjaman
      parsed.peminjaman.forEach((p, i) => {
        if (typeof p.id !== 'number' || !p.nama_siswa || typeof p.barang_id !== 'number') {
          throw new Error(`Peminjaman index ${i} tidak valid`);
        }
      });

      const konfirmasi = confirm(
        `📥 IMPORT DATA\n\n` +
        `File: ${file.name}\n` +
        `Barang: ${parsed.barang.length} item\n` +
        `Peminjaman: ${parsed.peminjaman.length} transaksi\n\n` +
        `⚠️ Data saat ini akan DITIMPA.\nLanjutkan?`
      );
      if (!konfirmasi) {
        e.target.value = '';
        return;
      }

      // Backup data lama
      const oldData = localStorage.getItem(STORAGE_KEY);
      localStorage.setItem(STORAGE_KEY + '_backup', oldData);

      saveData(parsed);
      updateStorageInfo();
      showAlert(`Import berhasil! ${parsed.barang.length} barang, ${parsed.peminjaman.length} transaksi dimuat.`, 'success');
    } catch (err) {
      showAlert('Import gagal: ' + err.message);
    }
    e.target.value = '';
  };
  reader.readAsText(file);
}

function resetAllData() {
  if (!confirm('⚠️ RESET DATA\n\nSemua data akan dihapus dan dikembalikan ke kondisi awal.\nLanjutkan?')) return;
  localStorage.removeItem(STORAGE_KEY);
  initData().then(() => {
    updateStorageInfo();
    showAlert('Data berhasil direset ke kondisi awal.', 'success');
  });
}
