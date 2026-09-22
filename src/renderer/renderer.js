(() => {
  const state = {
    cwd: null,
    history: [],
    historyIndex: -1,
    entries: [],
    selected: new Set(),
    viewMode: 'grid', // 'grid' | 'list'
    showHidden: false,
    filter: '',
    pinned: JSON.parse(localStorage.getItem('niko:pinned') || '[]'),
    homedir: null,
    clipboard: null // { mode: 'copy' | 'cut', paths: string[] }
  };

  const el = {
    fileList: document.getElementById('fileList'),
    fileArea: document.getElementById('fileArea'),
    emptyState: document.getElementById('emptyState'),
    breadcrumb: document.getElementById('breadcrumb'),
    backBtn: document.getElementById('backBtn'),
    fwdBtn: document.getElementById('fwdBtn'),
    upBtn: document.getElementById('upBtn'),
    searchInput: document.getElementById('searchInput'),
    viewToggle: document.getElementById('viewToggle'),
    hiddenToggle: document.getElementById('hiddenToggle'),
    newFolderBtn: document.getElementById('newFolderBtn'),
    terminalToggle: document.getElementById('terminalToggle'),
    terminalDrawer: document.getElementById('terminalDrawer'),
    terminalClose: document.getElementById('terminalClose'),
    terminalCwd: document.getElementById('terminalCwd'),
    terminalHost: document.getElementById('terminalHost'),
    statusCount: document.getElementById('statusCount'),
    statusSelection: document.getElementById('statusSelection'),
    contextMenu: document.getElementById('contextMenu'),
    pinnedList: document.getElementById('pinnedList'),
    diskUsageBtn: document.getElementById('diskUsageBtn'),
    diskUsageLabel: document.getElementById('diskUsageLabel'),
    sideItems: document.querySelectorAll('.side-item[data-goto]'),
    errorBanner: document.getElementById('errorBanner'),
    settingsBtn: document.getElementById('settingsBtn'),
    settingsOverlay: document.getElementById('settingsOverlay'),
    settingsClose: document.getElementById('settingsClose'),
    settingsDone: document.getElementById('settingsDone'),
    settingsReset: document.getElementById('settingsReset'),
    textSizeRange: document.getElementById('textSizeRange'),
    iconSizeRange: document.getElementById('iconSizeRange'),
    textSizeValue: document.getElementById('textSizeValue'),
    iconSizeValue: document.getElementById('iconSizeValue')
  };

  function showError(message) {
    el.errorBanner.textContent = message;
    el.errorBanner.classList.remove('hidden');
    clearTimeout(showError._t);
    showError._t = setTimeout(() => el.errorBanner.classList.add('hidden'), 4000);
  }

  const folderIcon = `<svg class="icon folder" viewBox="0 0 24 24"><path d="M3 6h6l2 2.5h10V19H3V6Z"/></svg>`;
  const fileIcon = `<svg class="icon file" viewBox="0 0 24 24"><path d="M6 2h8l5 5v15H6V2Z"/><path d="M14 2v5h5"/></svg>`;

  function formatDate(ms) {
    const d = new Date(ms);
    const now = new Date();
    const sameYear = d.getFullYear() === now.getFullYear();
    return d.toLocaleDateString(undefined, {
      month: 'short', day: 'numeric',
      year: sameYear ? undefined : 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }

  /* ---------------- Navigation ---------------- */

  async function navigate(dirPath, { pushHistory = true } = {}) {
    let entries;
    try {
      entries = await window.niko.readDir(dirPath);
    } catch (err) {
      console.error(err);
      const reason = err && err.code === 'EACCES' ? 'Permission denied' :
                     err && err.code === 'ENOENT' ? 'This folder no longer exists' :
                     'Could not open this folder';
      showError(`${reason}: ${dirPath}`);
      return;
    }
    state.cwd = dirPath;
    state.entries = entries;
    state.selected.clear();

    if (pushHistory) {
      state.history = state.history.slice(0, state.historyIndex + 1);
      state.history.push(dirPath);
      state.historyIndex = state.history.length - 1;
    }
    el.backBtn.disabled = state.historyIndex <= 0;
    el.fwdBtn.disabled = state.historyIndex >= state.history.length - 1;

    renderBreadcrumb();
    renderFiles();
    syncSidebarActive();
    if (window._nikoPtyReady) window.niko.ptyCd(dirPath);
  }

  function renderBreadcrumb() {
    const parts = state.cwd.split('/').filter(Boolean);
    el.breadcrumb.innerHTML = '';
    const rootCrumb = document.createElement('span');
    rootCrumb.className = 'crumb';
    rootCrumb.textContent = '/';
    rootCrumb.onclick = () => navigate('/');
    el.breadcrumb.appendChild(rootCrumb);

    let acc = '';
    parts.forEach((part, i) => {
      acc += '/' + part;
      const sep = document.createElement('span');
      sep.className = 'sep';
      sep.textContent = '/';
      el.breadcrumb.appendChild(sep);

      const crumb = document.createElement('span');
      crumb.className = 'crumb' + (i === parts.length - 1 ? ' current' : '');
      crumb.textContent = part;
      const target = acc;
      crumb.onclick = () => navigate(target);
      el.breadcrumb.appendChild(crumb);
    });
  }

  function renderFiles() {
    const q = state.filter.trim().toLowerCase();
    const visible = state.entries.filter(e => {
      if (!state.showHidden && e.hidden) return false;
      if (q && !e.name.toLowerCase().includes(q)) return false;
      return true;
    });

    el.fileList.innerHTML = '';
    el.fileList.className = state.viewMode;
    el.emptyState.classList.toggle('hidden', visible.length > 0);

    for (const entry of visible) {
      const item = document.createElement('div');
      item.className = 'file-item';
      item.dataset.path = entry.path;
      item.dataset.isDir = entry.isDir;

      const icon = entry.isDir ? folderIcon : fileIcon;
      const nameHtml = `<span class="name">${escapeHtml(entry.name)}</span>`;
      if (state.viewMode === 'list') {
        item.innerHTML = `${icon}${nameHtml}<span class="meta"><span class="size">${entry.sizeLabel}</span><span class="date">${formatDate(entry.mtime)}</span></span>`;
      } else {
        const mediaWrap = document.createElement('div');
        mediaWrap.className = 'thumb-wrap';
        mediaWrap.innerHTML = icon;
        item.appendChild(mediaWrap);
        const name = document.createElement('span');
        name.className = 'name';
        name.textContent = entry.name;
        item.appendChild(name);
        if (!entry.isDir) {
          const ext = entry.name.includes('.') ? entry.name.slice(entry.name.lastIndexOf('.')).toLowerCase() : '';
          if (['.jpg','.jpeg','.png','.gif','.webp','.bmp','.svg','.ico'].includes(ext)) {
            window.niko.thumbnail(entry.path).then(src => {
              if (!src || !document.body.contains(item)) return;
              const img = document.createElement('img');
              img.className = 'file-thumbnail';
              img.alt = entry.name;
              img.src = src;
              img.onload = () => { mediaWrap.replaceChildren(img); };
            });
          }
        }
      }

      item.addEventListener('click', (e) => onItemClick(e, entry, item));
      item.addEventListener('dblclick', () => openEntry(entry));
      item.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        if (!state.selected.has(entry.path)) selectOnly(entry.path, item);
        openContextMenu(e.clientX, e.clientY, entry, 'item');
      });

      el.fileList.appendChild(item);
    }

    updateStatusBar(visible.length);
  }

  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function updateStatusBar(count) {
    el.statusCount.textContent = `${count} item${count === 1 ? '' : 's'}`;
    el.statusSelection.textContent = state.selected.size ? `${state.selected.size} selected` : '';
  }

  function selectOnly(path, itemEl) {
    state.selected.clear();
    document.querySelectorAll('.file-item.selected').forEach(n => n.classList.remove('selected'));
    state.selected.add(path);
    itemEl.classList.add('selected');
    updateStatusBar(state.entries.length);
  }

  function onItemClick(e, entry, itemEl) {
    if (e.metaKey || e.ctrlKey) {
      if (state.selected.has(entry.path)) {
        state.selected.delete(entry.path);
        itemEl.classList.remove('selected');
      } else {
        state.selected.add(entry.path);
        itemEl.classList.add('selected');
      }
    } else {
      selectOnly(entry.path, itemEl);
    }
    updateStatusBar(state.entries.length);
  }

  function openEntry(entry) {
    if (entry.isDir) navigate(entry.path);
    else window.niko.openNative(entry.path);
  }

  el.fileArea.addEventListener('click', (e) => {
    if (e.target === el.fileArea || e.target.id === 'fileList') {
      state.selected.clear();
      document.querySelectorAll('.file-item.selected').forEach(n => n.classList.remove('selected'));
      updateStatusBar(state.entries.length);
    }
  });

  /* ---------------- Toolbar actions ---------------- */

  el.backBtn.addEventListener('click', () => {
    if (state.historyIndex > 0) {
      state.historyIndex--;
      navigate(state.history[state.historyIndex], { pushHistory: false });
    }
  });
  el.fwdBtn.addEventListener('click', () => {
    if (state.historyIndex < state.history.length - 1) {
      state.historyIndex++;
      navigate(state.history[state.historyIndex], { pushHistory: false });
    }
  });
  el.upBtn.addEventListener('click', () => {
    const parent = state.cwd.split('/').slice(0, -1).join('/') || '/';
    navigate(parent);
  });

  el.searchInput.addEventListener('input', (e) => {
    state.filter = e.target.value;
    renderFiles();
  });

  el.viewToggle.addEventListener('click', () => {
    state.viewMode = state.viewMode === 'grid' ? 'list' : 'grid';
    renderFiles();
  });

  el.hiddenToggle.addEventListener('click', () => {
    state.showHidden = !state.showHidden;
    el.hiddenToggle.classList.toggle('accent', state.showHidden);
    renderFiles();
  });

  async function createNewFolder() {
    const base = 'New Folder';
    let name = base, n = 1;
    const existing = new Set(state.entries.map(e => e.name));
    while (existing.has(name)) { n++; name = `${base} ${n}`; }
    const target = `${state.cwd}/${name}`.replace('//', '/');
    try {
      await window.niko.mkdir(target);
      await navigate(state.cwd, { pushHistory: false });
    } catch (err) {
      console.error(err);
      showError('Could not create folder here');
    }
  }

  el.newFolderBtn.addEventListener('click', createNewFolder);

  el.sideItems.forEach(btn => {
    btn.addEventListener('click', async () => {
      const key = btn.dataset.goto;
      const map = {
        home: state.homedir,
        root: '/',
        desktop: `${state.homedir}/Desktop`,
        documents: `${state.homedir}/Documents`,
        downloads: `${state.homedir}/Downloads`
      };
      navigate(map[key] || state.homedir);
    });
  });

  function syncSidebarActive() {
    el.sideItems.forEach(btn => {
      const key = btn.dataset.goto;
      const map = {
        home: state.homedir, root: '/',
        desktop: `${state.homedir}/Desktop`,
        documents: `${state.homedir}/Documents`,
        downloads: `${state.homedir}/Downloads`
      };
      btn.classList.toggle('active', map[key] === state.cwd);
    });
  }

  el.diskUsageBtn.addEventListener('click', async () => {
    el.diskUsageLabel.textContent = 'Calculating…';
    const size = await window.niko.diskUsage(state.cwd);
    el.diskUsageLabel.textContent = `This folder: ${size}`;
  });

  /* ---------------- Pinned sidebar ---------------- */

  function renderPinned() {
    el.pinnedList.innerHTML = '';
    state.pinned.forEach(p => {
      const btn = document.createElement('button');
      btn.className = 'side-item';
      btn.innerHTML = `<svg viewBox="0 0 20 20"><path d="M3 9.5 10 3l7 6.5V17a1 1 0 0 1-1 1h-4v-5H8v5H4a1 1 0 0 1-1-1V9.5Z"/></svg>${escapeHtml(p.name)}`;
      btn.onclick = () => navigate(p.path);
      el.pinnedList.appendChild(btn);
    });
  }

  function pinPath(entry) {
    if (state.pinned.some(p => p.path === entry.path)) return;
    state.pinned.push({ name: entry.name, path: entry.path });
    localStorage.setItem('niko:pinned', JSON.stringify(state.pinned));
    renderPinned();
  }

  /* ---------------- Context menu ---------------- */

  let contextTarget = null;

  function openContextMenu(x, y, entry, mode) {
    contextTarget = entry;
    el.contextMenu.classList.toggle('bg-mode', mode === 'bg');
    // "Paste" only makes sense in bg mode when there's something to paste.
    const pasteItem = el.contextMenu.querySelector('[data-action="paste"]');
    pasteItem.style.display = (mode === 'bg' && state.clipboard) ? '' : 'none';
    el.contextMenu.style.left = x + 'px';
    el.contextMenu.style.top = y + 'px';
    el.contextMenu.classList.remove('hidden');
  }

  document.addEventListener('click', () => el.contextMenu.classList.add('hidden'));

  // Right-click on empty space in the file area = background menu (safe
  // actions only — no rename/trash of the folder you're currently inside).
  el.fileArea.addEventListener('contextmenu', (e) => {
    if (e.target === el.fileArea || e.target.id === 'fileList') {
      e.preventDefault();
      openContextMenu(e.clientX, e.clientY, { path: state.cwd, isDir: true, name: '.' }, 'bg');
    }
  });

  function selectedEntries() {
    return state.entries.filter(en => state.selected.has(en.path));
  }

  async function copySelectionTo(destDir, mode) {
    const items = state.clipboard ? state.clipboard.paths : [];
    for (const src of items) {
      try {
        if (mode === 'cut') await window.niko.move(src, destDir);
        else await window.niko.copy(src, destDir);
      } catch (err) {
        console.error(err);
        showError(`Couldn't ${mode === 'cut' ? 'move' : 'copy'} ${src.split('/').pop()}`);
      }
    }
    state.clipboard = null;
    navigate(state.cwd, { pushHistory: false });
  }

  el.contextMenu.addEventListener('click', async (e) => {
    const action = e.target.dataset.action;
    if (!action || !contextTarget) return;
    const entry = contextTarget;
    // If several items are selected and the click target is one of them,
    // the action applies to the whole selection — not just the one clicked.
    const multi = state.selected.size > 1 && state.selected.has(entry.path);
    const targets = multi ? selectedEntries() : [entry];

    if (action === 'open') openEntry(entry);
    if (action === 'open-terminal') {
      const dir = entry.isDir ? entry.path : state.cwd;
      openTerminal(dir);
    }
    if (action === 'new-folder') createNewFolder();
    if (action === 'rename') startRename(entry);
    if (action === 'copy-path') navigator.clipboard.writeText(targets.map(t => t.path).join('\n'));
    if (action === 'pin') pinPath(entry);
    if (action === 'copy') state.clipboard = { mode: 'copy', paths: targets.map(t => t.path) };
    if (action === 'cut') state.clipboard = { mode: 'cut', paths: targets.map(t => t.path) };
    if (action === 'paste' && state.clipboard) {
      await copySelectionTo(state.cwd, state.clipboard.mode);
    }
    if (action === 'trash') {
      for (const t of targets) {
        try { await window.niko.trash(t.path); }
        catch (err) { console.error(err); showError(`Couldn't trash ${t.name}`); }
      }
      navigate(state.cwd, { pushHistory: false });
    }
  });

  function startRename(entry) {
    const itemEl = [...el.fileList.children].find(n => n.dataset.path === entry.path);
    if (!itemEl) return;
    const nameSpan = itemEl.querySelector('.name');
    const input = document.createElement('input');
    input.className = 'rename-input';
    input.value = entry.name;
    nameSpan.replaceWith(input);
    input.focus();
    input.select();

    const commit = async () => {
      const newName = input.value.trim();
      if (newName && newName !== entry.name) {
        const newPath = entry.path.split('/').slice(0, -1).concat(newName).join('/');
        try { await window.niko.rename(entry.path, newPath); } catch (err) { console.error(err); }
      }
      navigate(state.cwd, { pushHistory: false });
    };
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') commit();
      if (e.key === 'Escape') navigate(state.cwd, { pushHistory: false });
    });
    input.addEventListener('blur', commit);
  }

  /* ---------------- Keyboard shortcuts ---------------- */

  document.addEventListener('keydown', (e) => {
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key === '`') { e.preventDefault(); toggleTerminal(); }
    if (mod && e.key === ',') { e.preventDefault(); openSettings(); }
    if (e.key === 'Escape' && !el.settingsOverlay.classList.contains('hidden')) { closeSettings(); }
    if (e.key === 'F2' && state.selected.size === 1) {
      const path = [...state.selected][0];
      const entry = state.entries.find(en => en.path === path);
      if (entry) startRename(entry);
    }
    if (e.key === 'Delete' && state.selected.size) {
      e.preventDefault();
      Promise.all([...state.selected].map(p => window.niko.trash(p)))
        .then(() => navigate(state.cwd, { pushHistory: false }));
    }
    if (mod && e.key === 'l') {
      e.preventDefault();
      // quick focus filter as a lightweight path-jump substitute
      el.searchInput.focus();
      el.searchInput.select();
    }
    // Skip clipboard shortcuts while typing in a text field (search box, rename input).
    const typing = document.activeElement && ['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName);
    if (!typing && mod && (e.key === 'c' || e.key === 'x') && state.selected.size) {
      e.preventDefault();
      state.clipboard = { mode: e.key === 'x' ? 'cut' : 'copy', paths: [...state.selected] };
    }
    if (!typing && mod && e.key === 'v' && state.clipboard) {
      e.preventDefault();
      copySelectionTo(state.cwd, state.clipboard.mode);
    }
  });

  /* ---------------- Terminal ---------------- */

  let term, fitAddon, ptyStarted = false;

  async function initTerminalIfNeeded() {
    if (term) return;
    const available = await window.niko.ptyAvailable();
    if (!available) {
      el.terminalHost.innerHTML = '<p style="color:#8b93a1;font:12px var(--font-ui);padding:10px;">Terminal backend (node-pty) isn\'t installed. Run <code>npm install</code> and rebuild native modules, then restart Niko Files.</p>';
      return;
    }
    term = new Terminal({
      fontFamily: 'JetBrains Mono, monospace',
      fontSize: 13,
      theme: {
        background: '#0e1014',
        foreground: '#e8eaed',
        cursor: '#e8a33d'
      },
      cursorBlink: true
    });
    fitAddon = new FitAddon.FitAddon();
    term.loadAddon(fitAddon);
    term.open(el.terminalHost);
    fitAddon.fit();

    window.niko.onPtyData((data) => term.write(data));
    window.niko.onPtyExit(() => term.writeln('\r\n[process exited]'));
    term.onData((data) => window.niko.ptyWrite(data));

    // Keep the actual shell's terminal size (COLUMNS/LINES) in sync with the
    // on-screen size — without this, full-screen programs (vim, htop, less)
    // wrap and redraw against stale dimensions.
    term.onResize(({ cols, rows }) => window.niko.ptyResize(cols, rows));

    window.addEventListener('resize', () => {
      if (el.terminalDrawer.classList.contains('open')) fitAddon.fit();
    });
  }

  async function openTerminal(cwd) {
    await initTerminalIfNeeded();
    el.terminalDrawer.classList.add('open');
    el.terminalCwd.textContent = cwd;
    if (fitAddon) fitAddon.fit();
    if (!ptyStarted && term) {
      await window.niko.ptyCreate(cwd, term.cols, term.rows);
      ptyStarted = true;
      window._nikoPtyReady = true;
    } else if (ptyStarted) {
      window.niko.ptyCd(cwd);
    }
    setTimeout(() => { if (fitAddon) fitAddon.fit(); term && term.focus(); }, 180);
  }

  function toggleTerminal() {
    if (el.terminalDrawer.classList.contains('open')) {
      el.terminalDrawer.classList.remove('open');
    } else {
      openTerminal(state.cwd);
    }
  }

  el.terminalToggle.addEventListener('click', toggleTerminal);
  el.terminalClose.addEventListener('click', () => el.terminalDrawer.classList.remove('open'));

  /* ---------------- Appearance settings ---------------- */

  const SETTINGS_DEFAULTS = { textSize: 14, iconSize: 24 };

  function loadAppearanceSettings() {
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem('niko:appearance') || '{}'); } catch {}
    const textSize = Number(saved.textSize) || SETTINGS_DEFAULTS.textSize;
    const iconSize = Number(saved.iconSize) || SETTINGS_DEFAULTS.iconSize;
    applyAppearance(textSize, iconSize, false);
  }

  function applyAppearance(textSize, iconSize, persist = true) {
    const t = Math.min(20, Math.max(11, Number(textSize) || SETTINGS_DEFAULTS.textSize));
    const i = Math.min(40, Math.max(16, Number(iconSize) || SETTINGS_DEFAULTS.iconSize));
    document.documentElement.style.setProperty('--ui-text-size', `${t}px`);
    document.documentElement.style.setProperty('--ui-icon-size', `${i}px`);
    el.textSizeRange.value = t;
    el.iconSizeRange.value = i;
    el.textSizeValue.textContent = `${t} px`;
    el.iconSizeValue.textContent = `${i} px`;
    if (persist) localStorage.setItem('niko:appearance', JSON.stringify({ textSize: t, iconSize: i }));
  }

  function openSettings() {
    el.settingsOverlay.classList.remove('hidden');
    el.textSizeRange.focus();
  }
  function closeSettings() { el.settingsOverlay.classList.add('hidden'); }

  el.settingsBtn.addEventListener('click', openSettings);
  el.settingsClose.addEventListener('click', closeSettings);
  el.settingsDone.addEventListener('click', closeSettings);
  el.settingsOverlay.addEventListener('click', (e) => { if (e.target === el.settingsOverlay) closeSettings(); });
  el.textSizeRange.addEventListener('input', () => applyAppearance(el.textSizeRange.value, el.iconSizeRange.value));
  el.iconSizeRange.addEventListener('input', () => applyAppearance(el.textSizeRange.value, el.iconSizeRange.value));
  el.settingsReset.addEventListener('click', () => applyAppearance(SETTINGS_DEFAULTS.textSize, SETTINGS_DEFAULTS.iconSize));

  /* ---------------- Boot ---------------- */

  (async () => {
    loadAppearanceSettings();
    state.homedir = await window.niko.homedir();
    renderPinned();
    await navigate(state.homedir);
  })();
})();
