import {
  loadState,
  saveState,
  makeNote,
  cloneNote,
  uid,
  normalizeState,
  exportBackup,
} from "./store.js";
import {
  RichEditor,
  sanitizeHTML,
  plainText,
  markdownToHTML,
} from "./editor.js";

const paths = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  note: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h4"/>',
  folder:
    '<path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/>',
  star: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  search: '<circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 4 4"/>',
  down: '<path d="m8 10 4 4 4-4"/>',
  right: '<path d="m9 6 6 6-6 6"/>',
  arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>',
  back: '<path d="M19 12H5m5-5-5 5 5 5"/>',
  more: '<circle cx="5" cy="12" r=".8" fill="currentColor"/><circle cx="12" cy="12" r=".8" fill="currentColor"/><circle cx="19" cy="12" r=".8" fill="currentColor"/>',
  settings:
    '<path d="m9 3-.5 3-2 .9-2.7-1-2 3.5 2.2 2v2.2l-2.2 2 2 3.5 2.7-1 2 .9.5 3h4l.5-3 2-.9 2.7 1 2-3.5-2.2-2v-2.2l2.2-2-2-3.5-2.7 1-2-.9-.5-3Z"/><circle cx="11" cy="13" r="3"/>',
  trash: '<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/>',
  archive:
    '<rect x="3" y="3" width="18" height="5" rx="1"/><path d="M5 8v13h14V8M10 12h4"/>',
  copy: '<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V3H3v13h5"/>',
  paste:
    '<rect x="5" y="5" width="14" height="16" rx="2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="M9 12h6M9 16h4"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  checksquare:
    '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="m7 12 3 3 7-7"/>',
  list: '<path d="M9 5h12M9 12h12M9 19h12M3 5h1M3 12h1M3 19h1"/>',
  image:
    '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1.5"/><path d="m21 15-5-5L5 21"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 2-3 4M12 17v.5"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  chat: '<path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5H4l-2 2v-10a9.5 9.5 0 0 1 19-.5Z"/><path d="M7 10h9M7 14h6"/>',
  spark:
    '<path d="m12 2 2.6 7.4L22 12l-7.4 2.6L12 22l-2.6-7.4L2 12l7.4-2.6ZM20 2v4M18 4h4"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
  upload: '<path d="M12 16V4m-5 5 5-5 5 5M4 17v4h16v-4"/>',
  move: '<path d="M3 7h7l2 2h9v11H3ZM15 12l3 3-3 3M10 15h8"/>',
  tag: '<path d="M3 3h8l10 10-8 8L3 11Z"/><circle cx="7.5" cy="7.5" r="1"/>',
  edit: '<path d="m15 4 5 5M4 20l5-1L21 7l-5-5L4 14Z"/>',
  restore: '<path d="M3 10a9 9 0 1 1 1 8M3 4v6h6M12 7v5l3 2"/>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  link: '<path d="m10 14 4-4M8 16l-2 2a4.2 4.2 0 0 1-6-6l5-5a4.2 4.2 0 0 1 6 0M16 8l2-2a4.2 4.2 0 0 1 6 6l-5 5a4.2 4.2 0 0 1-6 0" transform="translate(2 0) scale(.85 1)"/>',
};
const icon = (name, cls = "") =>
  `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.note}</svg>`;
const esc = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const $ = (s) => document.querySelector(s);
let state,
  view = "all",
  folderId = null,
  tagFilter = null,
  sourceFilter = "all",
  query = "",
  searchOpen = false,
  selection = new Set(),
  selectMode = false,
  currentId = null,
  editor = null,
  noteClipboard = [],
  saveTimer,
  saveChain = Promise.resolve(),
  saveRevision = 0,
  savedRevision = 0,
  toastTimer,
  readonly = false,
  importing = false;
const activeNotes = () =>
  state.notes.filter((n) => !n.deletedAt && !n.archived);
const findNote = (id) => state.notes.find((n) => n.id === id);
const folder = (id) => state.folders.find((f) => f.id === id);
const current = () => findNote(currentId);
const titleForView = () =>
  tagFilter
    ? `# ${tagFilter}`
    : view === "folder"
      ? folder(folderId)?.name || "フォルダ"
      : {
          all: "すべてのノート",
          favorites: "お気に入り",
          recent: "最近のノート",
          archive: "アーカイブ",
          trash: "ゴミ箱",
        }[view] || "すべてのノート";
const safeURL = (url, image = false) => {
  try {
    const u = new URL(url, location.href);
    return ["https:", "http:"].includes(u.protocol) ||
      (image && /^data:image\/(png|jpe?g|gif|webp);/i.test(url))
      ? url
      : "";
  } catch {
    return "";
  }
};

function toast(message, action) {
  clearTimeout(toastTimer);
  $("#toast-root").innerHTML =
    `<div class="toast" role="status"><span>${esc(message)}</span>${action ? `<button id="toast-action">${esc(action.label)}</button>` : ""}</div>`;
  if (action)
    $("#toast-action").onclick = () => {
      action.run();
      $("#toast-root").innerHTML = "";
    };
  toastTimer = setTimeout(
    () => ($("#toast-root").innerHTML = ""),
    action ? 7000 : 4200,
  );
}
function saveNow() {
  clearTimeout(saveTimer);
  if (!state) return Promise.resolve();
  const revision = saveRevision;
  const snapshot = structuredClone(state);
  saveChain = saveChain
    .catch(() => {})
    .then(async () => {
      await saveState(snapshot);
      savedRevision = Math.max(savedRevision, revision);
      updateSaveStatus();
    })
    .catch((e) => {
      updateSaveStatus(true);
      toast(`保存できませんでした：${e.message}`);
      throw e;
    });
  return saveChain;
}
function changed({ refresh = true } = {}) {
  saveRevision++;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => saveNow().catch(() => {}), 350);
  updateSaveStatus();
  if (refresh) {
    renderSidebar();
    if (!currentId) renderLibrary();
  }
}
function updateSaveStatus(error = false) {
  const el = $("#save-status");
  if (el)
    el.innerHTML = error
      ? "保存できませんでした"
      : `${icon(savedRevision >= saveRevision ? "check" : "clock")}${savedRevision >= saveRevision ? "保存済み" : "保存中…"}`;
}
function pageFrame() {
  $("#app").innerHTML =
    `<div class="shell"><div class="sidebar-scrim" data-action="close-sidebar"></div><aside class="sidebar" id="sidebar"></aside><main class="main"><header class="topbar"><button class="icon-btn mobile-menu" data-action="sidebar" aria-label="メニューを開く">${icon("menu")}</button><div class="breadcrumb"><span>マイライブラリ</span>${icon("right")}<span class="current" id="breadcrumb-current"></span></div><div class="top-actions"><button class="top-search" data-action="search">${icon("search")}<span>検索</span><kbd class="key">⌘ K</kbd></button><button class="icon-btn help-top" data-action="help" aria-label="使い方">${icon("help")}</button><button class="avatar" data-action="settings" aria-label="設定">F</button></div></header><div id="content"></div></main></div><div id="bulk-root"></div>`;
  renderSidebar();
  renderLibrary();
}
function navButton(key, label, ic, count) {
  return `<button class="nav-item ${view === key && !tagFilter ? "active" : ""}" data-action="nav" data-view="${key}">${icon(ic)}<span>${label}</span><span class="count">${count}</span></button>`;
}
function renderSidebar() {
  const count = activeNotes().length;
  const tags = [...new Set(activeNotes().flatMap((n) => n.tags))].slice(0, 6);
  function foldersHTML(parent = null, depth = 0) {
    return state.folders
      .filter((f) => f.parentId === parent)
      .map(
        (f) =>
          `<div class="nav-item folder-nav ${view === "folder" && folderId === f.id ? "active" : ""}" style="padding-left:${12 + depth * 14}px" data-action="folder" data-id="${esc(f.id)}" role="button" tabindex="0" data-drop-folder="${esc(f.id)}">${icon("folder")}<span style="width:7px;height:7px;border-radius:2px;background:${esc(f.color)};box-shadow:0 0 0 1px #0000000b;margin-left:-5px"></span><span style="overflow:hidden;text-overflow:ellipsis">${esc(f.name)}</span><span class="count">${activeNotes().filter((n) => n.folderId === f.id).length}</span><button class="folder-actions" data-action="folder-menu" data-id="${esc(f.id)}" aria-label="${esc(f.name)}の操作">${icon("more")}</button></div>${foldersHTML(f.id, depth + 1)}`,
      )
      .join("");
  }
  $("#sidebar").innerHTML =
    `<a class="brand" href="#" data-action="home" aria-label="folio ホーム"><span class="brand-icon"><i class="brand-dot"></i></span>folio<span style="color:#8b9d7c;font-size:28px;margin-left:-8px">.</span></a><div class="workspace-switch"><span class="workspace-avatar">F</span>マイライブラリ${icon("lock")}</div><nav class="nav-group" aria-label="ノートの分類">${navButton("all", "すべてのノート", "grid", count)}${navButton("favorites", "お気に入り", "star", activeNotes().filter((n) => n.favorite).length)}${navButton("recent", "最近のノート", "clock", activeNotes().filter((n) => Date.now() - Date.parse(n.updatedAt) < 7 * 864e5).length)}</nav><div class="side-section"><span>フォルダ</span><button class="icon-btn" data-action="new-folder" aria-label="フォルダを追加">${icon("plus")}</button></div><nav class="nav-group" aria-label="フォルダ">${foldersHTML()}</nav><div class="side-section"><span>タグ</span>${icon("tag")}</div><div class="tag-nav">${tags.map((t) => `<button class="tag-small ${tagFilter === t ? "active" : ""}" data-action="tag" data-tag="${esc(t)}"># ${esc(t)}</button>`).join("") || '<span style="font-size:10px;color:#a0a997">ノートにタグを付けて整理</span>'}</div><div class="sidebar-footer"><button class="install-badge" data-action="install">${icon("download")}<span>いつもの場所に、folioを。<small>ホーム画面に追加する</small></span></button>${navButton("archive", "アーカイブ", "archive", state.notes.filter((n) => n.archived && !n.deletedAt).length)}${navButton("trash", "ゴミ箱", "trash", state.notes.filter((n) => n.deletedAt).length)}<div class="footer-divider"></div><button class="nav-item settings-nav" data-action="settings">${icon("settings")}設定・バックアップ</button><div class="local-status"><span class="online-dot"></span>この端末に保存されています</div></div>`;
}
function filteredNotes() {
  let notes = state.notes.filter((n) => {
    if (view === "trash") return !!n.deletedAt;
    if (n.deletedAt) return false;
    if (view === "archive") return n.archived;
    if (n.archived) return false;
    if (view === "favorites" && !n.favorite) return false;
    if (view === "recent" && Date.now() - Date.parse(n.updatedAt) >= 7 * 864e5)
      return false;
    if (view === "folder" && n.folderId !== folderId) return false;
    return true;
  });
  if (tagFilter) notes = notes.filter((n) => n.tags.includes(tagFilter));
  if (sourceFilter === "ChatGPT")
    notes = notes.filter((n) => n.source === "ChatGPT");
  if (sourceFilter === "image")
    notes = notes.filter((n) => /<img\b/i.test(n.html) || n.cover);
  if (sourceFilter === "memo") notes = notes.filter((n) => n.source === "メモ");
  if (query.trim()) {
    const q = query.toLocaleLowerCase().trim();
    notes = notes.filter((n) =>
      `${n.title} ${plainText(n.html)} ${n.tags.join(" ")}`
        .toLocaleLowerCase()
        .includes(q),
    );
  }
  return notes.sort((a, b) =>
    state.settings.sort === "title"
      ? a.title.localeCompare(b.title, "ja")
      : state.settings.sort === "created"
        ? Date.parse(b.createdAt) - Date.parse(a.createdAt)
        : state.settings.sort === "oldest"
          ? Date.parse(a.updatedAt) - Date.parse(b.updatedAt)
          : Date.parse(b.updatedAt) - Date.parse(a.updatedAt),
  );
}
function cardHTML(n, index) {
  const f = folder(n.folderId);
  const cover = n.cover || /<img[^>]+src=["']([^"']+)/i.exec(n.html)?.[1];
  const coverURL = cover ? safeURL(cover, true) : "";
  const preview = sanitizeHTML(n.html).replace(/<img\b[^>]*>/gi, "");
  const date = new Date(n.updatedAt).toLocaleDateString("ja-JP", {
    month: "numeric",
    day: "numeric",
  });
  const tone = ["", "warm", "lilac", "blue", "warm", ""][index % 6];
  return `<article class="note-card ${selection.has(n.id) ? "selected" : ""}" data-note-id="${esc(n.id)}" data-action="open-note" data-id="${esc(n.id)}" tabindex="0" role="button" aria-label="${esc(n.title)}" draggable="true"><button class="card-select" data-action="select-note" data-id="${esc(n.id)}" aria-label="${esc(n.title)}を${selection.has(n.id) ? "選択解除" : "選択"}" aria-pressed="${selection.has(n.id)}">${selection.has(n.id) ? icon("check") : ""}</button><div class="card-preview ${coverURL ? "photo" : tone}" aria-hidden="true">${coverURL ? `<img src="${esc(coverURL)}" alt="" loading="lazy">` : `<div inert>${preview}</div>`}</div><div class="card-body"><div class="card-meta">${icon(n.source === "ChatGPT" ? "spark" : n.source === "画像" ? "image" : "note")}<span>${esc(n.source)}</span>${n.favorite ? `<span class="card-favorite">${icon("star")}</span>` : ""}</div><h3 class="card-title">${esc(n.title)}</h3><p class="card-snippet">${esc(plainText(n.html).slice(0, 110)) || "まだ内容がありません"}</p><div class="card-tags">${n.tags
    .slice(0, 3)
    .map((t) => `<span class="card-tag"># ${esc(t)}</span>`)
    .join(
      "",
    )}</div><div class="card-footer">${icon("folder")}<span class="folder-label">${esc(f?.name || "未分類")}</span><span class="date">${date}</span><button class="card-menu" data-action="note-menu" data-id="${esc(n.id)}" aria-label="${esc(n.title)}の操作">${icon("more")}</button></div></div></article>`;
}
function renderLibrary() {
  if (currentId) return;
  $("#breadcrumb-current").textContent = titleForView();
  const notes = filteredNotes();
  $("#content").innerHTML =
    `<section class="library"><div class="heading-row"><div><p class="eyebrow">YOUR PERSONAL LIBRARY</p><h1 class="page-title">${esc(titleForView())}</h1><p class="subhead">${view === "trash" ? "削除したノートを、ここから元に戻せます。" : view === "archive" ? "今は使わないけれど、残しておきたいもの。" : "集めた知識も、小さなひらめきも。ここから、また。"}</p></div><div class="heading-actions">${noteClipboard.length ? `<button class="button" data-action="paste-notes">${icon("paste")}<span>${noteClipboard.length}件貼り付け</span></button>` : ""}<button class="button new-button" data-action="new-note" aria-label="新しいノート">${icon("plus")}<span>新しいノート</span></button><button class="button primary" data-action="capture">${icon("paste")}<span>貼り付ける</span></button></div></div>${view === "all" && !query && !tagFilter ? `<div class="hero"><div><div class="hero-tag">${icon("spark")} A LITTLE SPACE FOR YOUR FINDS</div><h2>残したいものを、<br>自分だけのかたちに。</h2><p>ChatGPTの回答も、画像も、ふと思いついたアイデアも。<br>貼り付けて、整えて、あなただけのノートに。</p><button class="hero-link" data-action="help">folioの使い方${icon("arrow")}</button></div><div class="hero-art" aria-hidden="true"><div class="hero-paper back"></div><div class="hero-paper"><div class="paper-dot">${icon("spark")}</div><div class="paper-line"></div><div class="paper-line"></div><div class="paper-line short"></div></div><span class="hero-spark">✧</span><span class="hero-spark two">✦</span></div></div>` : ""}${searchOpen ? `<div class="search-bar">${icon("search")}<input id="search-input" type="search" placeholder="タイトル、本文、タグから検索" aria-label="ノートを検索" value="${esc(query)}"><button class="icon-btn" data-action="clear-search" aria-label="検索を閉じる">${icon("close")}</button></div>` : ""}<div class="collection-header"><div class="collection-title">${query ? "検索結果" : "ノート"}<span class="note-total">${notes.length}</span></div><div class="collection-controls"><select id="sort-select" class="sort-select" aria-label="並び順"><option value="updated">更新が新しい順</option><option value="created">作成が新しい順</option><option value="oldest">更新が古い順</option><option value="title">名前順</option></select><div class="view-switch"><button class="${state.settings.view !== "list" ? "active" : ""}" data-action="view-grid" aria-label="グリッド表示">${icon("grid")}</button><button class="${state.settings.view === "list" ? "active" : ""}" data-action="view-list" aria-label="リスト表示">${icon("list")}</button></div></div></div><div class="filterbar"><div class="filters">${[
      ["all", "すべて", null],
      ["ChatGPT", "ChatGPT", "spark"],
      ["image", "画像", "image"],
      ["memo", "メモ", "note"],
    ]
      .map(
        ([key, label, ic]) =>
          `<button class="filter-pill ${sourceFilter === key ? "active" : ""}" data-action="filter" data-filter="${key}">${ic ? icon(ic) : ""}${label}</button>`,
      )
      .join(
        "",
      )}</div><button class="selection-toggle" data-action="toggle-select">${icon(selectMode ? "close" : "checksquare")}${selectMode ? "選択を終了" : "選択"}</button></div><div class="note-grid ${state.settings.view === "list" ? "list" : ""} ${selectMode ? "select-mode" : ""}">${notes.map(cardHTML).join("")}</div>${!notes.length ? `<div class="empty"><div class="empty-symbol">${icon(view === "trash" ? "trash" : query ? "search" : "note")}</div><h3>${query ? "ノートが見つかりませんでした" : view === "trash" ? "ゴミ箱は空です" : "ここに、残しておきたいものを。"}</h3><p>${query ? "別の言葉や条件で探してみてください。" : "貼り付けたり、新しく作ったり。少しずつ集めていきましょう。"}</p>${view !== "trash" ? '<button class="button" data-action="new-note">ノートを作る</button>' : ""}</div>` : ""}<div class="library-foot">${icon("lock")}ノートはこの端末だけに保存されます。自分だけの、小さなライブラリ。</div></section>`;
  $("#sort-select").value = state.settings.sort;
  $("#sort-select").onchange = (e) => {
    state.settings.sort = e.target.value;
    changed();
  };
  const search = $("#search-input");
  if (search)
    search.oninput = (e) => {
      query = e.target.value;
      const pos = e.target.selectionStart;
      renderLibrary();
      $("#search-input").focus();
      try {
        $("#search-input").setSelectionRange(pos, pos);
      } catch {}
    };
  renderBulk();
}
function renderBulk() {
  const root = $("#bulk-root");
  if (currentId || !selectMode) {
    root.innerHTML = "";
    return;
  }
  root.innerHTML = `<div class="bulkbar"><span>${selection.size}件を選択</span><button data-action="select-all">${icon("checksquare")}すべて</button><i class="bulk-divider"></i><button data-action="bulk-copy" ${!selection.size ? "disabled" : ""} aria-label="選択したノートをコピー">${icon("copy")}コピー</button><button data-action="bulk-move" ${!selection.size ? "disabled" : ""}>${icon("move")}移動</button><button data-action="bulk-tag" ${!selection.size ? "disabled" : ""}>${icon("tag")}タグ</button><button data-action="bulk-trash" ${!selection.size ? "disabled" : ""}>${icon(view === "trash" ? "restore" : "trash")}${view === "trash" ? "復元" : "削除"}</button></div>`;
}
function closeSidebar() {
  $("#sidebar").classList.remove("open");
  $(".sidebar-scrim").classList.remove("open");
}
function navigate(next, id = null) {
  editor?.destroy();
  editor = null;
  currentId = null;
  readonly = false;
  view = next;
  folderId = id;
  tagFilter = null;
  sourceFilter = "all";
  query = "";
  selection.clear();
  selectMode = false;
  closeSidebar();
  renderSidebar();
  renderLibrary();
  window.scrollTo({ top: 0 });
  history.replaceState(null, "", location.pathname + location.search);
}
function openNote(id, { focus = false } = {}) {
  const n = findNote(id);
  if (!n) return;
  editor?.destroy();
  currentId = id;
  selection.clear();
  selectMode = false;
  readonly = !!n.deletedAt;
  closeSidebar();
  renderEditor();
  history.replaceState(null, "", `#note=${encodeURIComponent(id)}`);
  window.scrollTo({ top: 0 });
  if (focus) setTimeout(() => editor?.focus(), 50);
}
function renderEditor() {
  editor?.destroy();
  editor = null;
  const n = current();
  if (!n) return navigate("all");
  $("#breadcrumb-current").textContent = n.title;
  $("#bulk-root").innerHTML = "";
  const f = folder(n.folderId);
  $("#content").innerHTML =
    `<article class="editor-view"><div class="note-nav"><button class="button small" data-action="back">${icon("back")}ライブラリ</button><div class="note-nav-actions"><span class="save-status" id="save-status"></span>${n.deletedAt ? `<button class="button small" data-action="restore-current">${icon("restore")}復元</button>` : `<button class="icon-btn" data-action="toggle-read" aria-label="${readonly ? "編集する" : "閲覧モード"}">${icon(readonly ? "edit" : "eye")}</button><button class="icon-btn" data-action="favorite-current" aria-label="お気に入り" style="${n.favorite ? "color:#9caa6f" : ""}">${icon("star")}</button><button class="button small" data-action="copy-current">${icon("copy")}コピー</button>`}<button class="icon-btn" data-action="note-menu" data-id="${esc(n.id)}" aria-label="ノートの操作">${icon("more")}</button></div></div><textarea id="note-title" class="note-title-input" rows="1" maxlength="500" aria-label="ノートのタイトル" placeholder="無題のノート" ${readonly ? "readonly" : ""}>${esc(n.title === "無題のノート" ? "" : n.title)}</textarea><div class="note-properties"><button data-action="move-current">${icon("folder")}${esc(f?.name || "未分類")}${icon("down")}</button><button data-action="source-current">${icon("spark")}${esc(n.source)}</button><button data-action="tags-current">${icon("tag")}${n.tags.length ? n.tags.map((t) => "# " + esc(t)).join("　") : "タグを追加"}</button><span>${new Date(n.updatedAt).toLocaleDateString("ja-JP")} 更新</span>${n.sourceUrl && safeURL(n.sourceUrl) ? `<a href="${esc(safeURL(n.sourceUrl))}" target="_blank" rel="noopener noreferrer">参照元を開く ↗</a>` : ""}</div>${!n.html && !readonly ? `<div class="editor-hint">${icon("paste")}本文をタップしてペーストできます。回答全体でも、一部でも。書式・表・画像を可能な範囲で保持します。</div>` : ""}<div id="rich-editor" class="${readonly ? "readonly" : ""}"></div></article>`;
  const title = $("#note-title");
  const resize = () => {
    title.style.height = "auto";
    title.style.height = title.scrollHeight + "px";
  };
  resize();
  title.oninput = () => {
    n.title = title.value.trim() || "無題のノート";
    n.updatedAt = new Date().toISOString();
    $("#breadcrumb-current").textContent = n.title;
    resize();
    changed({ refresh: false });
  };
  if (readonly) {
    $("#rich-editor").innerHTML =
      `<div class="rich-content">${sanitizeHTML(n.html)}</div>`;
  } else {
    editor = new RichEditor($("#rich-editor"), {
      html: n.html,
      onToast: toast,
      onChange: (html) => {
        if (html.length > 20 * 1024 * 1024) {
          toast("1つのノートは20MBまでです。画像を別のノートに分けてください");
          editor?.setHTML(n.html);
          return;
        }
        n.html = html;
        if (html.trim()) $(".editor-hint")?.remove();
        n.updatedAt = new Date().toISOString();
        changed({ refresh: false });
      },
    });
  }
  updateSaveStatus();
}
function newNote(fields = {}) {
  const n = makeNote({
    folderId: view === "folder" ? folderId : null,
    ...fields,
  });
  state.notes.unshift(n);
  changed({ refresh: false });
  openNote(n.id, { focus: !n.html });
  return n;
}
function modal(
  title,
  body,
  { footer = "", onSubmit = null, wide = false } = {},
) {
  $("#modal-root").innerHTML =
    `<div class="modal-overlay"><section class="modal ${wide ? "wide" : ""}" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div class="modal-header"><h2 id="modal-title">${esc(title)}</h2><button class="icon-btn" data-action="close-modal" aria-label="閉じる">${icon("close")}</button></div><form id="modal-form"><div class="modal-body">${body}</div>${footer ? `<div class="modal-footer">${footer}</div>` : ""}</form></section></div>`;
  $("#modal-form").onsubmit = (e) => {
    e.preventDefault();
    onSubmit?.(new FormData(e.target));
  };
  $(".modal-overlay").onclick = (e) => {
    if (e.target === $(".modal-overlay")) closeModal();
  };
  requestAnimationFrame(() =>
    $(
      "#modal-root input:not([type=hidden]),#modal-root select,#modal-root button",
    )?.focus(),
  );
}
function closeModal() {
  if (importing) return;
  $("#modal-root").innerHTML = "";
}
const formButtons = (label = "保存する") =>
  `<button type="button" class="button" data-action="close-modal">キャンセル</button><button class="button primary" type="submit">${label}</button>`;
function folderForm(id = null) {
  const f = folder(id);
  let color = f?.color || "#eee9f8";
  modal(
    f ? "フォルダを編集" : "新しいフォルダ",
    `<label class="field">名前<input name="name" value="${esc(f?.name || "")}" placeholder="例：あとで読みたい" required maxlength="100" autofocus></label><label class="field">保存先<select name="parent"><option value="">ライブラリ直下</option>${state.folders
      .filter((x) => x.id !== id && !isDescendant(x.id, id))
      .map(
        (x) =>
          `<option value="${esc(x.id)}" ${f?.parentId === x.id ? "selected" : ""}>${esc(x.name)}</option>`,
      )
      .join(
        "",
      )}</select></label><div class="field">フォルダの色<div class="color-choices">${["#eee9f8", "#e8eef8", "#e9f1e8", "#f8eddf", "#f8e6e7", "#e6f2f1"].map((c) => `<button type="button" class="color-choice ${c === color ? "active" : ""}" style="background:${c}" data-color="${c}" aria-label="色 ${c}"></button>`).join("")}</div></div>`,
    {
      footer: formButtons(f ? "変更を保存" : "フォルダを作成"),
      onSubmit: (data) => {
        if (!String(data.get("name")).trim()) return;
        const values = {
          name: String(data.get("name")).trim(),
          color,
          parentId: data.get("parent") || null,
        };
        if (f) Object.assign(f, values);
        else state.folders.push({ id: uid(), ...values });
        closeModal();
        changed();
        toast(f ? "フォルダを変更しました" : "フォルダを作成しました");
      },
    },
  );
  $(".color-choices").onclick = (e) => {
    const b = e.target.closest("[data-color]");
    if (b) {
      color = b.dataset.color;
      document
        .querySelectorAll(".color-choice")
        .forEach((x) => x.classList.toggle("active", x === b));
    }
  };
}
function isDescendant(id, parent) {
  if (!parent) return false;
  let f = folder(id);
  const seen = new Set();
  while (f?.parentId && !seen.has(f.id)) {
    seen.add(f.id);
    if (f.parentId === parent) return true;
    f = folder(f.parentId);
  }
  return false;
}
function moveNotes(ids) {
  modal(
    "ノートを移動",
    `<p>${ids.length}件のノートの移動先を選んでください。</p><label class="field">移動先<select name="folder"><option value="">未分類</option>${state.folders.map((f) => `<option value="${esc(f.id)}" ${ids.length === 1 && findNote(ids[0])?.folderId === f.id ? "selected" : ""}>${esc(f.name)}</option>`).join("")}</select></label>`,
    {
      footer: formButtons("ここに移動"),
      onSubmit: (data) => {
        ids.forEach((id) => {
          const n = findNote(id);
          if (n) {
            n.folderId = data.get("folder") || null;
            n.updatedAt = new Date().toISOString();
          }
        });
        closeModal();
        selection.clear();
        selectMode = false;
        changed();
        if (currentId) renderEditor();
        toast(`${ids.length}件のノートを移動しました`);
      },
    },
  );
}
function tagNotes(ids) {
  const n = ids.length === 1 ? findNote(ids[0]) : null;
  modal(
    ids.length === 1 ? "タグを編集" : "まとめてタグを追加",
    `<p>${ids.length === 1 ? "カンマで区切って入力してください。" : "入力したタグを、選択したすべてのノートに追加します。"}</p><label class="field">タグ<input name="tags" placeholder="デザイン, あとで読む" value="${esc(n?.tags.join(", ") || "")}" maxlength="1000"></label>`,
    {
      footer: formButtons(),
      onSubmit: (data) => {
        const tags = [
          ...new Set(
            String(data.get("tags"))
              .split(/[,、，]/)
              .map((x) => x.trim().slice(0, 80))
              .filter(Boolean),
          ),
        ].slice(0, 30);
        ids.forEach((id) => {
          const n = findNote(id);
          if (n) {
            n.tags =
              ids.length === 1
                ? tags
                : [...new Set([...n.tags, ...tags])].slice(0, 30);
            n.updatedAt = new Date().toISOString();
          }
        });
        closeModal();
        changed();
        if (currentId) renderEditor();
        toast("タグを更新しました");
      },
    },
  );
}
function trashNotes(ids) {
  const previous = ids.map((id) => ({
    id,
    deletedAt: findNote(id)?.deletedAt,
  }));
  ids.forEach((id) => {
    const n = findNote(id);
    if (n) n.deletedAt = view === "trash" ? null : new Date().toISOString();
  });
  if (ids.includes(currentId)) navigate("all");
  selection.clear();
  selectMode = false;
  changed();
  toast(view === "trash" ? "ノートを復元しました" : "ゴミ箱に移動しました", {
    label: "元に戻す",
    run: () => {
      previous.forEach((p) => {
        const n = findNote(p.id);
        if (n) n.deletedAt = p.deletedAt;
      });
      changed();
    },
  });
}
function restoreNotes(ids) {
  ids.forEach((id) => {
    const n = findNote(id);
    if (n) n.deletedAt = null;
  });
  changed();
  if (currentId) {
    readonly = false;
    renderEditor();
  }
  toast("ノートを復元しました");
}
async function writeClipboard(html, text = plainText(html)) {
  try {
    if (navigator.clipboard?.write && globalThis.ClipboardItem) {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/html": new Blob([html], { type: "text/html" }),
          "text/plain": new Blob([text], { type: "text/plain" }),
        }),
      ]);
      return true;
    }
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {}
  modal(
    "コピーする内容",
    `<p>この端末では自動コピーが利用できません。本文を長押ししてコピーしてください。</p><textarea id="copy-fallback" style="width:100%;height:240px;padding:12px;border:1px solid #dfe5d6;border-radius:7px" readonly>${esc(text)}</textarea>`,
  );
  $("#copy-fallback").select();
  return false;
}
async function copyNotes(ids) {
  noteClipboard = ids
    .map((id) => structuredClone(findNote(id)))
    .filter(Boolean);
  const html = noteClipboard
    .map((n) => `<section><h1>${esc(n.title)}</h1>${n.html}</section>`)
    .join("<hr>");
  const ok = await writeClipboard(html);
  if (!currentId) renderLibrary();
  if (ok)
    toast(`${ids.length}件をコピーしました。別のフォルダにも貼り付けできます`);
}
function pasteNotes() {
  if (!noteClipboard.length) return;
  const fresh = noteClipboard.map((n) => ({
    ...cloneNote(n),
    folderId: view === "folder" ? folderId : n.folderId,
    archived: false,
    deletedAt: null,
  }));
  state.notes.unshift(...fresh);
  changed();
  toast(`${fresh.length}件を貼り付けました`);
}
function menu(anchor, items) {
  const rect = anchor.getBoundingClientRect();
  $("#menu-root").innerHTML =
    `<div class="menu" role="menu" style="right:${Math.max(12, innerWidth - rect.right)}px;top:${Math.min(rect.bottom + 5, innerHeight - items.length * 36 - 24)}px">${items.map((it, i) => (it === null ? '<div class="menu-rule"></div>' : `<button data-menu-index="${i}" role="menuitem" class="${it.danger ? "danger" : ""}">${icon(it.icon)}${esc(it.label)}</button>`)).join("")}</div>`;
  $(".menu").onclick = (e) => {
    const b = e.target.closest("[data-menu-index]");
    if (b) {
      $("#menu-root").innerHTML = "";
      items[+b.dataset.menuIndex].run();
    }
  };
}
function noteMenu(id, anchor) {
  const n = findNote(id);
  if (!n) return;
  menu(
    anchor,
    n.deletedAt
      ? [
          {
            label: "ノートを復元",
            icon: "restore",
            run: () => restoreNotes([id]),
          },
          {
            label: "完全に削除",
            icon: "trash",
            danger: true,
            run: () =>
              modal(
                "ノートを完全に削除",
                `<p>「${esc(n.title)}」を削除します。この操作は取り消せません。</p>`,
                {
                  footer: formButtons("完全に削除"),
                  onSubmit: () => {
                    state.notes = state.notes.filter((x) => x.id !== id);
                    closeModal();
                    if (currentId === id) navigate("trash");
                    changed();
                    toast("ノートを完全に削除しました");
                  },
                },
              ),
          },
        ]
      : [
          { label: "ノートを開く", icon: "note", run: () => openNote(id) },
          {
            label: n.favorite ? "お気に入りを解除" : "お気に入りに追加",
            icon: "star",
            run: () => {
              n.favorite = !n.favorite;
              changed();
              if (currentId === id) renderEditor();
            },
          },
          { label: "コピー", icon: "copy", run: () => copyNotes([id]) },
          {
            label: "複製",
            icon: "copy",
            run: () => {
              const cloned = cloneNote(n);
              state.notes.unshift(cloned);
              changed();
              toast("ノートを複製しました");
            },
          },
          { label: "フォルダへ移動", icon: "move", run: () => moveNotes([id]) },
          { label: "タグを編集", icon: "tag", run: () => tagNotes([id]) },
          {
            label: "HTMLで書き出す",
            icon: "download",
            run: () => exportNote(n),
          },
          null,
          {
            label: n.archived ? "アーカイブから戻す" : "アーカイブ",
            icon: "archive",
            run: () => {
              n.archived = !n.archived;
              if (currentId === id) navigate("all");
              changed();
              toast(
                n.archived ? "アーカイブしました" : "アーカイブから戻しました",
              );
            },
          },
          {
            label: "ゴミ箱へ移動",
            icon: "trash",
            danger: true,
            run: () => trashNotes([id]),
          },
        ],
  );
}
function download(name, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
function exportNote(n) {
  const html = `<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(n.title)}</title><style>body{max-width:800px;margin:40px auto;padding:0 24px;font:16px/1.9 system-ui;color:#292d27}img{max-width:100%;height:auto}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ddd;padding:8px}pre{background:#f5f5f3;padding:16px;overflow:auto}blockquote{border-left:3px solid #ddd;padding-left:18px;color:#666}</style><body><h1>${esc(n.title)}</h1>${sanitizeHTML(n.html)}</body></html>`;
  download(`${n.title.replace(/[\\/:*?"<>|]/g, "_")}.html`, html, "text/html");
  toast("ノートを書き出しました");
}
function captureModal() {
  modal(
    "残したいものを、貼り付ける",
    `<p>ChatGPTの回答全体でも、一部分でも。コピーしてから、保存方法を選んでください。</p><div class="paste-options"><button type="button" class="paste-option" data-action="capture-rich">${icon("paste")}<b>書式を保って貼り付け</b><span>文章・見出し・表を、<br>あとから編集できるノートに。</span></button><button type="button" class="paste-option" data-action="capture-image">${icon("image")}<b>画像でそのまま保存</b><span>スクリーンショットや画像を、<br>見た目を保ったままノートに。</span></button></div><p style="font-size:10px;margin-top:20px">コピー元やSafariの仕様によって、書式や画像が含まれない場合があります。完全な見た目はスクリーンショットで残せます。</p>`,
  );
}
async function captureRich() {
  closeModal();
  newNote({ source: "ChatGPT" });
  try {
    await editor.pasteFromClipboard();
  } catch {
    toast("本文を長押しして「ペースト」を選んでください");
  }
}
function settingsModal() {
  const size = new Blob([exportBackup(state)]).size;
  modal(
    "設定・バックアップ",
    `<div class="storage-box"><strong>この端末のライブラリ</strong><br>${state.notes.length}件のノート · ${state.folders.length}個のフォルダ · 約${size > 1024 * 1024 ? (size / 1024 / 1024).toFixed(1) + " MB" : Math.max(1, Math.round(size / 1024)) + " KB"}<br>保存先：このブラウザのIndexedDB</div><button type="button" class="settings-option" data-action="export-backup">${icon("download")}<span><b>バックアップを書き出す</b><small>すべてのノートと画像をJSONに保存</small></span>${icon("right")}</button><button type="button" class="settings-option" data-action="import">${icon("upload")}<span><b>ファイルを読み込む</b><small>バックアップ・HTML・Markdown・テキスト・画像</small></span>${icon("right")}</button><button type="button" class="settings-option" data-action="install">${icon("plus")}<span><b>ホーム画面に追加</b><small>iPhoneでアプリのように使う</small></span>${icon("right")}</button><button type="button" class="settings-option" data-action="help">${icon("help")}<span><b>folioの使い方</b><small>貼り付け・整理・編集のヒント</small></span>${icon("right")}</button><p style="font-size:10px;margin-top:19px">自動でクラウドには同期されません。Safariとホーム画面のアプリで保存先が分かれる場合があります。大切なノートは定期的にバックアップしてください。公開用GitHubリポジトリに、あなたのノートは送信されません。</p>`,
  );
}
function helpModal() {
  modal(
    "folioの使い方",
    `<p>いい答えも、気になる画像も。残して、整理して、自分の言葉を添えていくためのノートです。</p><h3>01　コピーしたものを残す</h3><p>ChatGPTで回答全体または一部をコピー →「貼り付ける」→「書式を保って貼り付け」。Safariで確認が出たら「ペースト」を選びます。本文を長押しして貼り付けることもできます。</p><h3>02　自分のかたちに整える</h3><p>本文をタップして編集。見出し・リスト・表・コード・リンク・画像も追加できます。文字を選択すれば、その部分だけコピーできます。本文の「ブロック選択」では複数段落のコピー・移動・削除ができます。</p><h3>03　集めたものを整理する</h3><p>フォルダは入れ子にできます。ノート一覧の「選択」から、複数のノートをまとめてコピー・移動・タグ編集。パソコンではフォルダへドラッグして移動することもできます。</p><h3>04　見た目をそのまま残す</h3><p>コピーでは画像やデザインが渡らない場合があります。画像は写真から追加でき、スクリーンショットなら見た目をそのまま残せます。画像内の文字・表は直接編集できません。参照先の画像はURLの期限によって表示されなくなることがあるため、写真として取り込むと安心です。</p><h3>05　自分のライブラリを守る</h3><p>変更は端末内に自動保存されます。ブラウザのデータ削除で消えるため、設定からJSONバックアップを書き出してください。別端末や別のURLへの移行にも使えます。</p><p style="font-size:10px">ショートカット：⌘ / Ctrl + K で検索、Esc でダイアログを閉じる。</p>`,
    { wide: true },
  );
}
function installModal() {
  modal(
    "iPhoneのホーム画面に追加",
    `<div class="storage-box"><strong>いつでも、すぐそばに。</strong><br>ホーム画面からfolioを開くと、独立したアプリのように使えます。</div><ol><li>このページを<strong>Safari</strong>で開きます。</li><li>画面下の<strong>共有ボタン（□から↑）</strong>をタップします。</li><li><strong>「ホーム画面に追加」</strong>を選びます。</li><li>名前を「folio」にして<strong>追加</strong>します。</li></ol><p style="font-size:10px">ホーム画面から開いたfolioでノートを保存してください。Safariからデータを移す場合はバックアップの書き出し・読み込みを使えます。初回に開いたあと、アプリ本体はオフラインでも起動できます。</p>`,
    {
      footer:
        '<button class="button primary" type="button" data-action="close-modal">わかりました</button>',
    },
  );
}
async function importFiles(files) {
  if (!files.length) return;
  await saveNow();
  importing = true;
  modal(
    "ファイルを読み込み中",
    "<p>ノートを確認しています。しばらくお待ちください…</p>",
  );
  $("#modal-root [data-action=close-modal]").hidden = true;
  let count = 0;
  const draft = structuredClone(state);
  try {
    for (const file of files) {
      const isJSON = /\.json$/i.test(file.name);
      if (file.size > (isJSON ? 512 : 25) * 1024 * 1024)
        throw new Error(
          isJSON
            ? "バックアップは512MB以内にしてください"
            : "1ファイルは25MB以内にしてください",
        );
      if (/\.json$/i.test(file.name)) {
        const incoming = normalizeState(JSON.parse(await file.text()));
        for (const n of incoming.notes) {
          n.html = sanitizeHTML(n.html);
          n.sourceUrl = safeURL(n.sourceUrl);
          if (n.cover) n.cover = safeURL(n.cover, true) || null;
        }
        const folderMap = new Map();
        for (const f of incoming.folders) {
          const existing = draft.folders.find((x) => x.id === f.id);
          const id = existing && existing.name !== f.name ? uid() : f.id;
          folderMap.set(f.id, id);
        }
        for (const f of incoming.folders) {
          const id = folderMap.get(f.id);
          if (!draft.folders.some((x) => x.id === id))
            draft.folders.push({
              ...f,
              id,
              parentId: folderMap.get(f.parentId) || null,
            });
        }
        for (const n of incoming.notes) {
          n.folderId = folderMap.get(n.folderId) || null;
          const existing = draft.notes.find((x) => x.id === n.id);
          if (existing && JSON.stringify(existing) === JSON.stringify(n))
            continue;
          if (existing) n.id = uid();
          draft.notes.push(n);
          count++;
        }
      } else if (file.type.startsWith("image/")) {
        const data = await new Promise((resolve, reject) => {
          const r = new FileReader();
          r.onload = () => resolve(r.result);
          r.onerror = reject;
          r.readAsDataURL(file);
        });
        if (!safeURL(data, true))
          throw new Error("PNG・JPEG・GIF・WebPの画像を選んでください");
        const n = makeNote({
          title: file.name.replace(/\.[^.]+$/, ""),
          source: "画像",
          folderId: view === "folder" ? folderId : null,
          html: `<figure><img src="${esc(data)}" alt="${esc(file.name)}"><figcaption>${esc(file.name)}</figcaption></figure>`,
          cover: data,
        });
        draft.notes.unshift(n);
        count++;
      } else {
        const text = await file.text();
        const isHTML = /\.html?$/i.test(file.name);
        const html = isHTML ? sanitizeHTML(text) : markdownToHTML(text);
        const n = makeNote({
          title: file.name.replace(/\.[^.]+$/, ""),
          html,
          source: isHTML ? "HTML" : "メモ",
          folderId: view === "folder" ? folderId : null,
        });
        draft.notes.unshift(n);
        count++;
      }
    }
    const validated = normalizeState(draft);
    await saveState(validated);
    state = validated;
    saveRevision++;
    savedRevision = saveRevision;
    importing = false;
    closeModal();
    if (currentId) navigate("all");
    else {
      renderSidebar();
      renderLibrary();
    }
    toast(`${count}件のノートを読み込みました`);
  } catch (e) {
    importing = false;
    closeModal();
    toast(`読み込み：${e.message}`);
  }
}

document.addEventListener("click", async (e) => {
  if (importing) {
    e.preventDefault();
    return;
  }
  const el = e.target.closest("[data-action]");
  if (
    !e.target.closest(".menu") &&
    !e.target.closest('[data-action="note-menu"],[data-action="folder-menu"]')
  )
    $("#menu-root").innerHTML = "";
  if (!el) return;
  const { action, id } = el.dataset;
  try {
    switch (action) {
      case "home":
        e.preventDefault();
        navigate("all");
        break;
      case "nav":
        navigate(el.dataset.view);
        break;
      case "folder":
        navigate("folder", id);
        break;
      case "sidebar":
        $("#sidebar").classList.add("open");
        $(".sidebar-scrim").classList.add("open");
        break;
      case "close-sidebar":
        closeSidebar();
        break;
      case "tag":
        navigate("all");
        tagFilter = el.dataset.tag;
        renderSidebar();
        renderLibrary();
        break;
      case "new-folder":
        folderForm();
        break;
      case "folder-menu": {
        const f = folder(id);
        menu(el, [
          { label: "フォルダを編集", icon: "edit", run: () => folderForm(id) },
          {
            label: "サブフォルダを作成",
            icon: "plus",
            run: () => {
              folderForm();
              $("#modal-root select[name=parent]").value = id;
            },
          },
          {
            label: "フォルダを削除",
            icon: "trash",
            danger: true,
            run: () =>
              modal(
                "フォルダを削除",
                `<p>「${esc(f.name)}」を削除します。中のノートとサブフォルダは未分類・ライブラリ直下に移ります。</p>`,
                {
                  footer: formButtons("フォルダを削除"),
                  onSubmit: () => {
                    state.notes.forEach((n) => {
                      if (n.folderId === id) n.folderId = null;
                    });
                    state.folders.forEach((x) => {
                      if (x.parentId === id) x.parentId = f.parentId;
                    });
                    state.folders = state.folders.filter((x) => x.id !== id);
                    closeModal();
                    if (folderId === id) navigate("all");
                    changed();
                    toast("フォルダを削除しました");
                  },
                },
              ),
          },
        ]);
        break;
      }
      case "new-note":
        newNote();
        break;
      case "open-note":
        if (selectMode) {
          selection.has(id) ? selection.delete(id) : selection.add(id);
          renderLibrary();
        } else openNote(id);
        break;
      case "select-note":
        selectMode = true;
        selection.has(id) ? selection.delete(id) : selection.add(id);
        renderLibrary();
        break;
      case "toggle-select":
        selectMode = !selectMode;
        selection.clear();
        renderLibrary();
        break;
      case "select-all": {
        const notes = filteredNotes();
        if (selection.size === notes.length) selection.clear();
        else notes.forEach((n) => selection.add(n.id));
        renderLibrary();
        break;
      }
      case "filter":
        sourceFilter = el.dataset.filter;
        selection.clear();
        renderLibrary();
        break;
      case "view-grid":
        state.settings.view = "grid";
        changed();
        break;
      case "view-list":
        state.settings.view = "list";
        changed();
        break;
      case "search":
        if (currentId) navigate("all");
        searchOpen = true;
        renderLibrary();
        $("#search-input").focus();
        break;
      case "clear-search":
        query = "";
        searchOpen = false;
        renderLibrary();
        break;
      case "capture":
        captureModal();
        break;
      case "capture-rich":
        await captureRich();
        break;
      case "capture-image":
        closeModal();
        $("#import-file").accept = "image/png,image/jpeg,image/webp,image/gif";
        $("#import-file").click();
        break;
      case "back":
        await saveNow();
        navigate(view, folderId);
        break;
      case "note-menu":
        noteMenu(id, el);
        break;
      case "favorite-current":
        current().favorite = !current().favorite;
        changed({ refresh: false });
        renderEditor();
        break;
      case "toggle-read":
        readonly = !readonly;
        editor?.destroy();
        editor = null;
        renderEditor();
        break;
      case "copy-current":
        if (
          await writeClipboard(
            `<h1>${esc(current().title)}</h1>${current().html}`,
          )
        )
          toast("ノート全体をコピーしました");
        break;
      case "move-current":
        moveNotes([currentId]);
        break;
      case "tags-current":
        tagNotes([currentId]);
        break;
      case "source-current": {
        const n = current();
        modal(
          "ノートの参照元",
          `<label class="field">種類<select name="source">${["ChatGPT", "メモ", "画像", "HTML", "Web"].map((s) => `<option ${n.source === s ? "selected" : ""}>${s}</option>`).join("")}</select></label><label class="field">参照元のURL（任意）<input name="url" type="url" value="${esc(n.sourceUrl)}" placeholder="https://chatgpt.com/…"></label>`,
          {
            footer: formButtons(),
            onSubmit: (d) => {
              n.source = d.get("source");
              n.sourceUrl = safeURL(String(d.get("url")));
              closeModal();
              changed({ refresh: false });
              renderEditor();
            },
          },
        );
        break;
      }
      case "restore-current":
        restoreNotes([currentId]);
        break;
      case "bulk-copy":
        await copyNotes([...selection]);
        break;
      case "bulk-move":
        moveNotes([...selection]);
        break;
      case "bulk-tag":
        tagNotes([...selection]);
        break;
      case "bulk-trash":
        trashNotes([...selection]);
        break;
      case "paste-notes":
        pasteNotes();
        break;
      case "close-modal":
        closeModal();
        break;
      case "settings":
        settingsModal();
        break;
      case "help":
        helpModal();
        break;
      case "install":
        installModal();
        break;
      case "export-backup":
        await saveNow();
        download(
          `folio-backup-${new Date().toISOString().slice(0, 10)}.json`,
          exportBackup(state),
          "application/json",
        );
        toast("バックアップを書き出しました");
        break;
      case "import":
        $("#import-file").accept =
          ".json,.html,.htm,.md,.txt,image/png,image/jpeg,image/webp,image/gif";
        $("#import-file").click();
        break;
    }
  } catch (err) {
    toast(err.message || "操作に失敗しました");
    console.error(err);
  }
});
$("#import-file").onchange = (e) => {
  importFiles([...e.target.files]);
  e.target.value = "";
};
document.addEventListener("keydown", (e) => {
  if (importing) {
    e.preventDefault();
    return;
  }
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
    e.preventDefault();
    if (currentId) navigate("all");
    searchOpen = true;
    renderLibrary();
    $("#search-input").focus();
  }
  if (e.key === "Escape") {
    closeModal();
    $("#menu-root").innerHTML = "";
    closeSidebar();
    if (selectMode) {
      selectMode = false;
      selection.clear();
      renderLibrary();
    }
  }
  if (
    (e.key === "Enter" || e.key === " ") &&
    e.target.matches(".note-card,.folder-nav")
  ) {
    e.preventDefault();
    e.target.click();
  }
  if (e.key === "Tab" && $(".modal")) {
    const focusable = [
      ...$(".modal").querySelectorAll("button,input,select,textarea,a[href]"),
    ].filter((x) => !x.disabled);
    const first = focusable[0],
      last = focusable.at(-1);
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last?.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first?.focus();
    }
  }
});
document.addEventListener("dragstart", (e) => {
  const card = e.target.closest(".note-card");
  if (!card) return;
  const ids = selection.has(card.dataset.id)
    ? [...selection]
    : [card.dataset.id];
  e.dataTransfer.setData("application/x-folio-notes", JSON.stringify(ids));
  e.dataTransfer.effectAllowed = "move";
});
document.addEventListener("dragover", (e) => {
  if (e.dataTransfer.types.includes("application/x-folio-notes")) {
    const f = e.target.closest("[data-drop-folder]");
    if (f) {
      e.preventDefault();
      f.classList.add("dragover");
    }
  } else if (e.dataTransfer.types.includes("Files") && !currentId)
    e.preventDefault();
});
document.addEventListener("dragleave", (e) =>
  e.target.closest?.("[data-drop-folder]")?.classList.remove("dragover"),
);
document.addEventListener("drop", (e) => {
  const f = e.target.closest("[data-drop-folder]");
  document
    .querySelectorAll(".dragover")
    .forEach((x) => x.classList.remove("dragover"));
  if (f && e.dataTransfer.types.includes("application/x-folio-notes")) {
    e.preventDefault();
    try {
      const ids = JSON.parse(
        e.dataTransfer.getData("application/x-folio-notes"),
      );
      ids.forEach((id) => {
        const n = findNote(id);
        if (n) {
          n.folderId = f.dataset.dropFolder;
          n.updatedAt = new Date().toISOString();
        }
      });
      selection.clear();
      selectMode = false;
      changed();
      toast("ノートを移動しました");
    } catch {}
  } else if (e.dataTransfer.files.length && !currentId) {
    e.preventDefault();
    importFiles([...e.dataTransfer.files]);
  }
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden && saveRevision > savedRevision)
    saveNow().catch(() => {});
});
window.addEventListener("pagehide", () => {
  if (saveRevision > savedRevision) saveNow().catch(() => {});
});
window.addEventListener("beforeunload", (e) => {
  if (saveRevision > savedRevision) {
    e.preventDefault();
    e.returnValue = "";
  }
});
async function boot() {
  try {
    // A second writer could overwrite a whole local snapshot. Keep one editing
    // window per storage area; the browser releases this lock on window close.
    if (navigator.locks) {
      const acquired = await new Promise((resolve) => {
        navigator.locks
          .request("folio-edit-session", { ifAvailable: true }, (lock) => {
            if (!lock) {
              resolve(false);
              return;
            }
            resolve(true);
            return new Promise(() => {});
          })
          .catch(() => resolve(true));
      });
      if (!acquired) {
        $("#app").innerHTML =
          `<div class="error-panel"><span class="boot-mark">f.</span><h1>別の画面でfolioを開いています</h1><p>ノートの変更が重ならないよう、編集は1つの画面で行います。先に開いているfolioを閉じてから、こちらを開き直してください。</p><button class="button" onclick="location.reload()">ライブラリを開き直す</button></div>`;
        return;
      }
    }
    state = await loadState();
    const sample = state.notes.find((n) => n.id === "sample-kyoto");
    if (sample && !sample.cover) {
      sample.cover = "./assets/kyoto.jpg";
      await saveState(state);
    }
    pageFrame();
    const id = new URLSearchParams(location.hash.slice(1)).get("note");
    if (id && findNote(id)) openNote(id);
    if (
      "serviceWorker" in navigator &&
      ["http:", "https:"].includes(location.protocol)
    )
      navigator.serviceWorker.register("./sw.js").catch(() => {});
  } catch (e) {
    $("#app").innerHTML =
      `<div class="error-panel"><h1>ライブラリを開けませんでした</h1><p>端末内の保存機能を使えませんでした。Safariの通常タブで開き直し、空き容量やブラウザ設定を確認してください。</p><p>${esc(e.message)}</p><button class="button" onclick="location.reload()">もう一度開く</button></div>`;
  }
}
boot();
