/** Durable, dependency-free storage for Folio. */
const DB_NAME = "folio-notes";
const DB_VERSION = 1;
const STORE_NAME = "app";
const STATE_KEY = "state";
const MAX_NOTES = 5000;
const MAX_FOLDERS = 300;
const MAX_HTML_SIZE = 20 * 1024 * 1024;
let databasePromise;

export function uid() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  if (globalThis.crypto?.getRandomValues) {
    const bytes = new Uint8Array(16);
    globalThis.crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  }
  return `note-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

const isObject = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const string = (value, fallback = "", max = 500) =>
  typeof value === "string" ? value.slice(0, max) : fallback;
const validDate = (value, fallback) =>
  typeof value === "string" && Number.isFinite(Date.parse(value))
    ? new Date(value).toISOString()
    : fallback;

export function makeNote(fields = {}) {
  const now = new Date().toISOString();
  return {
    id: string(fields.id, "", 200) || uid(),
    title: string(fields.title, "無題のノート").trim() || "無題のノート",
    html: typeof fields.html === "string" ? fields.html : "",
    folderId:
      typeof fields.folderId === "string" && fields.folderId
        ? fields.folderId.slice(0, 200)
        : null,
    tags: Array.isArray(fields.tags)
      ? [
          ...new Set(
            fields.tags
              .filter((tag) => typeof tag === "string")
              .map((tag) => tag.trim().slice(0, 80))
              .filter(Boolean),
          ),
        ].slice(0, 30)
      : [],
    favorite: fields.favorite === true,
    archived: fields.archived === true,
    deletedAt: validDate(fields.deletedAt, null),
    createdAt: validDate(fields.createdAt, now),
    updatedAt: validDate(fields.updatedAt, now),
    source: string(fields.source, "メモ", 100),
    sourceUrl: string(fields.sourceUrl, "", 4000),
    cover:
      typeof fields.cover === "string" && fields.cover ? fields.cover : null,
  };
}

export function cloneNote(note) {
  return makeNote({
    ...note,
    id: uid(),
    title: `${note.title || "無題のノート"} のコピー`,
    tags: [...(note.tags || [])],
    deletedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
}

/** Validate imported and saved data; strip UI state and repair orphaned links. */
export function normalizeState(input) {
  if (
    !isObject(input) ||
    !Array.isArray(input.notes) ||
    !Array.isArray(input.folders)
  ) {
    throw new TypeError(
      "バックアップの形式が正しくありません。Folioから書き出したJSONファイルを選んでください。",
    );
  }
  if (input.version !== undefined && input.version !== 1) {
    throw new TypeError("このバックアップのバージョンには対応していません。");
  }
  if (input.notes.length > MAX_NOTES || input.folders.length > MAX_FOLDERS) {
    throw new RangeError(
      `ノートは${MAX_NOTES}件、フォルダーは${MAX_FOLDERS}件まで読み込めます。`,
    );
  }

  const folderIds = new Set();
  const folders = input.folders.map((folder) => {
    if (!isObject(folder) || typeof folder.name !== "string") {
      throw new TypeError("フォルダーのデータが正しくありません。");
    }
    const id = string(folder.id, "", 200) || uid();
    if (folderIds.has(id))
      throw new TypeError("同じIDのフォルダーが含まれています。");
    folderIds.add(id);
    return {
      id,
      name: folder.name.trim().slice(0, 100) || "新しいフォルダー",
      color:
        typeof folder.color === "string" &&
        /^#[0-9a-f]{3}(?:[0-9a-f]{3})?$/i.test(folder.color)
          ? folder.color
          : "#e8eef8",
      parentId:
        typeof folder.parentId === "string"
          ? folder.parentId.slice(0, 200)
          : null,
    };
  });
  const folderMap = new Map(folders.map((folder) => [folder.id, folder]));
  for (const folder of folders) {
    if (!folderIds.has(folder.parentId) || folder.parentId === folder.id)
      folder.parentId = null;
    const seen = new Set([folder.id]);
    let current = folder;
    while (current?.parentId) {
      if (seen.has(current.parentId)) {
        current.parentId = null;
        break;
      }
      seen.add(current.parentId);
      current = folderMap.get(current.parentId);
    }
  }

  const noteIds = new Set();
  const notes = input.notes.map((note) => {
    if (
      !isObject(note) ||
      typeof note.title !== "string" ||
      typeof note.html !== "string"
    ) {
      throw new TypeError(
        "ノートのデータが正しくありません。タイトルと本文を確認してください。",
      );
    }
    if (
      note.html.length > MAX_HTML_SIZE ||
      (typeof note.cover === "string" && note.cover.length > MAX_HTML_SIZE)
    ) {
      throw new RangeError(
        "1件のノートが大きすぎます。画像や本文のサイズを小さくしてください。",
      );
    }
    const normalized = makeNote(note);
    if (noteIds.has(normalized.id))
      throw new TypeError("同じIDのノートが含まれています。");
    noteIds.add(normalized.id);
    if (!folderIds.has(normalized.folderId)) normalized.folderId = null;
    return normalized;
  });

  const incoming = isObject(input.settings) ? input.settings : {};
  const settings = {
    view: ["grid", "list"].includes(incoming.view) ? incoming.view : "grid",
    sort: [
      "updated",
      "created",
      "title",
      "oldest",
      "updated-desc",
      "updated-asc",
      "created-desc",
      "created-asc",
      "title-asc",
      "title-desc",
    ].includes(incoming.sort)
      ? incoming.sort
      : "updated",
    sidebarCollapsed: incoming.sidebarCollapsed === true,
  };
  // Keep small display preferences, never transient selections or dialog state.
  for (const key of [
    "theme",
    "editorFontSize",
    "compactCards",
    "showPreview",
    "showTags",
    "spellcheck",
    "defaultFolderId",
  ]) {
    const value = incoming[key];
    if (
      typeof value === "boolean" ||
      (typeof value === "number" && Number.isFinite(value)) ||
      (typeof value === "string" && value.length <= 200)
    )
      settings[key] = value;
  }
  return { version: 1, notes, folders, settings };
}

export function defaultState() {
  const folders = [
    { id: "ideas", name: "アイデア", color: "#eee9f8", parentId: null },
    {
      id: "learning",
      name: "学び・リサーチ",
      color: "#e8eef8",
      parentId: null,
    },
    { id: "life", name: "暮らし", color: "#e9f1e8", parentId: null },
    { id: "work", name: "仕事", color: "#f8eddf", parentId: null },
  ];
  const seedDate = (day, hour = 10) =>
    `2026-10-${String(day).padStart(2, "0")}T${String(hour).padStart(2, "0")}:00:00.000Z`;
  const notes = [
    makeNote({
      id: "sample-design",
      title: "デザインの引き出しを増やす5つの習慣",
      folderId: "ideas",
      tags: ["デザイン", "インスピレーション"],
      favorite: true,
      source: "ChatGPT",
      createdAt: seedDate(18),
      updatedAt: seedDate(19, 9),
      html: `<p>いいデザインは、日々の小さな「気づき」から。感性を育てるために、今日からできることをまとめました。</p>
<h2>01. 心が動いたものを集める</h2><p>ポスターの余白、喫茶店のメニュー、好きな本の装丁。理由がまだ言葉にならなくても、気になったら残しておく。</p>
<h2>02. 「なぜ好きか」を一言添える</h2><p>色・文字・余白・形・素材感のどこに惹かれたかを言葉にすると、次の制作に使える引き出しになります。</p>
<blockquote>集めるだけで終わらせない。観察して、言葉にして、自分の手で試してみる。</blockquote>
<h2>03. いつもと違う場所へ行く</h2><p>美術館でも、知らない街の小さな本屋でも。画面の外の体験が、思いがけない視点をくれます。</p>
<h2>04. ひとつの作品を分解してみる</h2><ul><li>視線はどこからどこへ動く？</li><li>情報の優先順位はどう作られている？</li><li>色は何色で構成されている？</li></ul>
<h2>05. 小さく作り続ける</h2><p>毎日15分だけでも、見つけた表現を試す時間を。完成度より、手を動かした回数を大切に。</p>`,
    }),
    makeNote({
      id: "sample-kyoto",
      title: "京都で過ごす、静かな週末",
      folderId: "life",
      tags: ["旅行", "京都"],
      source: "ChatGPT",
      favorite: true,
      createdAt: seedDate(17),
      updatedAt: seedDate(18, 16),
      html: `<p>観光地を急いで巡るより、路地を歩いて、好きな場所で足を止める。そんな2日間の小さな旅の計画。</p>
<h2>土曜日｜本と喫茶のある一日</h2><ul><li><strong>10:00</strong> 鴨川沿いをゆっくり散歩</li><li><strong>12:00</strong> 出町柳で季節の定食を</li><li><strong>14:00</strong> 一乗寺の本屋で、気になる一冊を探す</li><li><strong>16:00</strong> 静かな喫茶店で読書</li></ul>
<h2>日曜日｜朝の空気を味わう</h2><p>早起きして哲学の道へ。朝の光を眺めながら歩いたら、パン屋に立ち寄って朝ごはん。お昼には駅へ向かい、余裕を残して帰る。</p>
<blockquote>予定を詰めすぎないこと。何もしない時間も、旅の楽しみ。</blockquote>
<h3>持っていくもの</h3><ul><li>歩きやすい靴</li><li>読みかけの文庫本</li><li>小さなカメラと充電器</li><li>折りたたみ傘</li></ul>`,
    }),
    makeNote({
      id: "sample-questions",
      title: "考えを整理するための問い",
      folderId: "ideas",
      tags: ["思考整理", "セルフリフレクション"],
      source: "メモ",
      createdAt: seedDate(16),
      updatedAt: seedDate(18, 11),
      html: `<p>頭の中がいっぱいになったら、少し立ち止まって。答えを急がず、いまの自分に問いかけたいこと。</p>
<h2>まず、ほどく</h2><ol><li>いちばん気になっていることは何？</li><li>事実と、自分の想像を分けるとどうなる？</li><li>自分で変えられることは、どこまで？</li></ol>
<h2>次の一歩を見つける</h2><ul><li>本当はどんな状態になりたい？</li><li>大切にしたいことを3つ挙げるなら？</li><li>今日、10分でできることは何？</li></ul>
<blockquote>すべてを一度に解決しなくていい。次の一歩が見えれば、それで十分。</blockquote>
<h3>今週の小さな実験</h3><p>朝、タスクを開く前に「今日大事にしたいこと」を一行だけ書く。</p>`,
    }),
    makeNote({
      id: "sample-css",
      title: "CSS GridとFlexboxの使い分け",
      folderId: "learning",
      tags: ["CSS", "Web制作"],
      source: "ChatGPT",
      createdAt: seedDate(15),
      updatedAt: seedDate(17, 14),
      html: `<p>レイアウトで迷ったときのための早見表。考えるポイントは「1方向か、2方向か」。</p>
<h2>基本の考え方</h2><table><thead><tr><th>比較</th><th>Flexbox</th><th>CSS Grid</th></tr></thead><tbody><tr><td>得意な方向</td><td>1次元（横または縦）</td><td>2次元（行と列）</td></tr><tr><td>使う場面</td><td>ナビ、ボタン、要素の整列</td><td>カード一覧、ページ全体</td></tr><tr><td>サイズの基準</td><td>中身に合わせて調整</td><td>レイアウトの枠から定義</td></tr></tbody></table>
<h2>カードを並べるならGrid</h2><pre><code>.cards {\n  display: grid;\n  grid-template-columns:\n    repeat(auto-fit, minmax(240px, 1fr));\n  gap: 24px;\n}</code></pre>
<h2>ボタンを揃えるならFlexbox</h2><pre><code>.actions {\n  display: flex;\n  align-items: center;\n  gap: 12px;\n}</code></pre><p><strong>覚えておくこと：</strong>両方を組み合わせて使ってOK。ページはGrid、カードの中はFlexbox、という組み合わせも自然です。</p>`,
    }),
    makeNote({
      id: "sample-books",
      title: "読みたい本リスト",
      folderId: "learning",
      tags: ["読書", "リスト"],
      source: "メモ",
      createdAt: seedDate(14),
      updatedAt: seedDate(16, 13),
      html: `<p>次に読みたい本、誰かにすすめてもらった本。気になるものを、少しずつ。</p>
<h2>デザインとものづくり</h2><ul><li data-checked="false">誰のためのデザイン？ — ドナルド・A・ノーマン</li><li data-checked="false">デザインのデザイン — 原研哉</li><li data-checked="true">なるほどデザイン — 筒井美希</li></ul>
<h2>ゆっくり読みたい</h2><ul><li data-checked="false">日日是好日 — 森下典子</li><li data-checked="false">旅をする木 — 星野道夫</li></ul>
<blockquote>本との出会いは、まだ知らない自分との出会い。</blockquote>`,
    }),
    makeNote({
      id: "sample-coffee",
      title: "コーヒーのある暮らし",
      folderId: "life",
      tags: ["コーヒー", "日々のこと"],
      source: "ChatGPT",
      createdAt: seedDate(13),
      updatedAt: seedDate(15, 8),
      html: `<p>朝の一杯を、少しだけ丁寧に。いつものコーヒーがおいしくなる、小さなコツ。</p>
<h2>基本のハンドドリップ</h2><table><tbody><tr><th>コーヒー豆</th><td>15g（中挽き）</td></tr><tr><th>お湯</th><td>250ml / 90〜93℃</td></tr><tr><th>抽出時間</th><td>約2分30秒〜3分</td></tr></tbody></table>
<ol><li>フィルターをお湯で湿らせて、器具を温める。</li><li>粉全体に少量のお湯を注ぎ、30秒蒸らす。</li><li>中心から小さな円を描くように、2〜3回に分けて注ぐ。</li><li>落ちきる前にドリッパーを外す。</li></ol>
<h2>好みを見つけるメモ</h2><p>酸味を楽しみたい日は浅煎り、ミルクと合わせたい日は深煎り。その日の気分で選ぶのも楽しみのひとつ。</p><blockquote>お湯を沸かす数分を、自分のための余白に。</blockquote>`,
    }),
  ];
  return {
    version: 1,
    notes,
    folders,
    settings: { view: "grid", sort: "updated", sidebarCollapsed: false },
  };
}

function openDatabase() {
  if (!globalThis.indexedDB)
    return Promise.reject(
      new Error(
        "このブラウザでは保存機能を利用できません。Safariの通常モードで開いてください。",
      ),
    );
  if (databasePromise) return databasePromise;
  databasePromise = new Promise((resolve, reject) => {
    let request;
    try {
      request = globalThis.indexedDB.open(DB_NAME, DB_VERSION);
    } catch (error) {
      reject(error);
      return;
    }
    let finished = false;
    const fail = (error) => {
      if (finished) return;
      finished = true;
      reject(error);
    };
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME))
        request.result.createObjectStore(STORE_NAME);
    };
    request.onerror = () =>
      fail(request.error || new Error("保存領域を開けませんでした。"));
    request.onblocked = () =>
      fail(new Error("ほかのタブを閉じてから、もう一度開いてください。"));
    request.onsuccess = () => {
      const database = request.result;
      if (finished) {
        database.close();
        return;
      }
      finished = true;
      database.onversionchange = () => {
        database.close();
        databasePromise = undefined;
      };
      database.onclose = () => {
        databasePromise = undefined;
      };
      resolve(database);
    };
  }).catch((error) => {
    databasePromise = undefined;
    throw error;
  });
  return databasePromise;
}

export async function loadState() {
  const database = await openDatabase();
  const saved = await new Promise((resolve, reject) => {
    let value;
    const transaction = database.transaction(STORE_NAME, "readonly");
    const request = transaction.objectStore(STORE_NAME).get(STATE_KEY);
    request.onsuccess = () => {
      value = request.result;
    };
    transaction.oncomplete = () => resolve(value);
    transaction.onerror = () =>
      reject(transaction.error || new Error("ノートを読み込めませんでした。"));
    transaction.onabort = () =>
      reject(
        transaction.error || new Error("ノートの読み込みが中断されました。"),
      );
  });
  if (saved !== undefined) return normalizeState(saved);
  const initial = defaultState();
  await saveState(initial);
  return initial;
}

export async function saveState(state) {
  const normalized = normalizeState(state);
  const database = await openDatabase();
  await new Promise((resolve, reject) => {
    let transaction;
    try {
      // Safari may not support the durability option yet.
      try {
        transaction = database.transaction(STORE_NAME, "readwrite", {
          durability: "strict",
        });
      } catch {
        transaction = database.transaction(STORE_NAME, "readwrite");
      }
      transaction.oncomplete = () => resolve();
      transaction.onerror = () =>
        reject(
          transaction.error ||
            new Error("保存できませんでした。空き容量を確認してください。"),
        );
      transaction.onabort = () =>
        reject(transaction.error || new Error("保存が中断されました。"));
      transaction.objectStore(STORE_NAME).put(normalized, STATE_KEY);
    } catch (error) {
      try {
        transaction?.abort();
      } catch {}
      reject(error);
    }
  });
  return normalized;
}

export function exportBackup(state) {
  return JSON.stringify(normalizeState(state), null, 2);
}
