/* Folio's dependency-free rich clipboard editor. */
const ALLOWED = new Set(
  "a abbr b blockquote br caption code col colgroup dd del details div dl dt em figcaption figure h1 h2 h3 h4 h5 h6 hr i img kbd li mark ol p pre s section small span strong sub summary sup table tbody td th thead tr u ul".split(
    " ",
  ),
);
const DROP = new Set(
  "script style iframe frame frameset object embed form button select textarea option meta link base svg math canvas video audio source".split(
    " ",
  ),
);
const STYLE = new Set(
  "color background-color font-weight font-style font-size font-family text-align text-decoration text-decoration-line text-decoration-color line-height letter-spacing white-space word-break overflow-wrap border border-color border-style border-width border-top border-bottom border-left border-right border-radius padding padding-top padding-right padding-bottom padding-left margin margin-top margin-right margin-bottom margin-left width max-width min-width height max-height vertical-align border-collapse border-spacing list-style-type display".split(
    " ",
  ),
);
const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );

function safeURL(value, image = false) {
  const url = String(value || "").trim();
  if (
    image &&
    /^data:image\/(?:png|jpeg|jpg|gif|webp|avif);base64,[\da-z+/=\s]+$/i.test(
      url,
    )
  )
    return url;
  if (/^https?:\/\//i.test(url)) return url;
  if (!image && /^(?:mailto:|tel:|#)/i.test(url)) return url;
  return "";
}

/** Keep semantic HTML and safe presentation, while removing executable content. */
export function sanitizeHTML(html) {
  const doc = new DOMParser().parseFromString(String(html || ""), "text/html");
  const clean = (node) => {
    for (const child of [...node.childNodes]) {
      if (child.nodeType === Node.COMMENT_NODE) {
        child.remove();
        continue;
      }
      if (child.nodeType !== Node.ELEMENT_NODE) continue;
      const tag = child.tagName.toLowerCase();
      if (DROP.has(tag)) {
        child.remove();
        continue;
      }
      if (tag === "input") {
        if (child.getAttribute("type") === "checkbox") {
          // TipTap / ChatGPT task lists already carry their state on the list item.
          // The editor paints that checkbox; avoid retaining a second text glyph.
          if (
            child.closest('li[data-checked="true"],li[data-checked="false"]')
          ) {
            child.remove();
            continue;
          }
          const box = doc.createElement("span");
          box.textContent = child.hasAttribute("checked") ? "☑ " : "☐ ";
          child.replaceWith(box);
        } else child.remove();
        continue;
      }
      clean(child);
      if (!ALLOWED.has(tag)) {
        child.replaceWith(...child.childNodes);
        continue;
      }
      const attributes = Object.fromEntries(
        [...child.attributes].map((a) => [a.name, a.value]),
      );
      for (const attr of [...child.attributes])
        child.removeAttribute(attr.name);
      if (attributes.style) {
        const probe = doc.createElement("span");
        probe.setAttribute("style", attributes.style);
        for (const property of Array.from(
          { length: probe.style.length },
          (_, index) => probe.style.item(index),
        )) {
          const value = probe.style.getPropertyValue(property);
          if (
            STYLE.has(property) &&
            !/url\s*\(|expression\s*\(|javascript|@import|var\s*\(/i.test(value)
          ) {
            if (
              property === "display" &&
              ![
                "inline",
                "block",
                "inline-block",
                "table",
                "table-row",
                "table-cell",
                "list-item",
              ].includes(value)
            )
              continue;
            child.style.setProperty(property, value);
          }
        }
      }
      for (const name of ["title", "dir", "lang"])
        if (attributes[name]) child.setAttribute(name, attributes[name]);
      if (tag === "a") {
        const href = safeURL(attributes.href);
        if (href) {
          child.setAttribute("href", href);
          child.setAttribute("target", "_blank");
          child.setAttribute("rel", "noopener noreferrer");
        }
      }
      if (tag === "img") {
        const src = safeURL(attributes.src, true);
        if (!src) {
          child.replaceWith(doc.createTextNode(attributes.alt || ""));
          continue;
        }
        child.setAttribute("src", src);
        child.setAttribute("alt", attributes.alt || "貼り付けた画像");
        child.setAttribute("loading", "lazy");
        child.setAttribute("referrerpolicy", "no-referrer");
        for (const name of ["width", "height"])
          if (/^\d{1,4}$/.test(attributes[name] || ""))
            child.setAttribute(name, attributes[name]);
      }
      if (["td", "th"].includes(tag))
        for (const name of ["colspan", "rowspan"])
          if (/^\d{1,2}$/.test(attributes[name] || ""))
            child.setAttribute(name, attributes[name]);
      if (tag === "ol" && /^\d{1,5}$/.test(attributes.start || ""))
        child.setAttribute("start", attributes.start);
      if (tag === "details" && "open" in attributes)
        child.setAttribute("open", "");
      if (
        tag === "li" &&
        ["true", "false"].includes(attributes["data-checked"])
      )
        child.setAttribute("data-checked", attributes["data-checked"]);
    }
  };
  clean(doc.body);
  return doc.body.innerHTML;
}

export function plainText(html) {
  const doc = new DOMParser().parseFromString(sanitizeHTML(html), "text/html");
  doc
    .querySelectorAll("li[data-checked]")
    .forEach((el) =>
      el.prepend(el.dataset.checked === "true" ? "[x] " : "[ ] "),
    );
  doc.querySelectorAll("br").forEach((el) => el.replaceWith("\n"));
  doc.querySelectorAll("td,th").forEach((el) => el.append("\t"));
  doc
    .querySelectorAll("p,div,section,h1,h2,h3,h4,h5,h6,li,tr,blockquote,pre,hr")
    .forEach((el) => el.append("\n"));
  return (doc.body.textContent || "")
    .replace(/\t\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function inlineMarkdown(text) {
  const tokens = [];
  let value = esc(text).replace(/`([^`]+)`/g, (_, code) => {
    tokens.push(`<code>${code}</code>`);
    return `\u0000${tokens.length - 1}\u0000`;
  });
  value = value
    .replace(
      /!\[([^\]]*)\]\((https?:\/\/[^\s)]+)(?:\s+&quot;.*?&quot;)?\)/g,
      (_, alt, src) => `<img src="${src}" alt="${alt}">`,
    )
    .replace(
      /\[([^\]]+)\]\(([^\s)]+)\)/g,
      (_, label, href) => `<a href="${href}">${label}</a>`,
    )
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/__([^_]+)__/g, "<strong>$1</strong>")
    .replace(/(^|[\s(])\*([^*\n]+)\*/g, "$1<em>$2</em>")
    .replace(/~~([^~]+)~~/g, "<del>$1</del>")
    .replace(/\u0000(\d+)\u0000/g, (_, index) => tokens[Number(index)]);
  return value;
}

/** Small, safe Markdown reader covering the formats most often copied from ChatGPT. */
export function markdownToHTML(text) {
  const lines = String(text || "")
    .replace(/\r\n?/g, "\n")
    .split("\n");
  const output = [];
  let i = 0;
  const cells = (line) =>
    line
      .trim()
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split(/(?<!\\)\|/)
      .map((s) => s.trim().replace(/\\\|/g, "|"));
  const separator = (line) =>
    /^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line || "");
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }
    if (/^\s*```/.test(line) || /^\s*~~~/.test(line)) {
      const marker = line.trim().slice(0, 3);
      const language = line.trim().slice(3).trim();
      const code = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith(marker))
        code.push(lines[i++]);
      output.push(
        `<pre><code${language ? ` title="${esc(language)}"` : ""}>${esc(code.join("\n"))}</code></pre>`,
      );
      i++;
      continue;
    }
    if (line.includes("|") && separator(lines[i + 1])) {
      const headers = cells(line);
      const align = cells(lines[i + 1]).map((s) =>
        s.endsWith(":") ? (s.startsWith(":") ? "center" : "right") : "left",
      );
      i += 2;
      const rows = [];
      while (i < lines.length && lines[i].trim() && lines[i].includes("|"))
        rows.push(cells(lines[i++]));
      output.push(
        `<table><thead><tr>${headers.map((h, n) => `<th style="text-align:${align[n]}">${inlineMarkdown(h)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${headers.map((_, n) => `<td style="text-align:${align[n]}">${inlineMarkdown(row[n] || "")}</td>`).join("")}</tr>`).join("")}</tbody></table>`,
      );
      continue;
    }
    const heading = line.match(/^\s{0,3}(#{1,6})\s+(.+)$/);
    if (heading) {
      output.push(
        `<h${heading[1].length}>${inlineMarkdown(heading[2].replace(/\s+#+$/, ""))}</h${heading[1].length}>`,
      );
      i++;
      continue;
    }
    if (/^\s*(?:---+|\*\*\*+|___+)\s*$/.test(line)) {
      output.push("<hr>");
      i++;
      continue;
    }
    if (/^\s*>/.test(line)) {
      const quote = [];
      while (i < lines.length && /^\s*>/.test(lines[i]))
        quote.push(lines[i++].replace(/^\s*>\s?/, ""));
      output.push(
        `<blockquote>${markdownToHTML(quote.join("\n"))}</blockquote>`,
      );
      continue;
    }
    const list = line.match(/^\s*(?:([-+*])|\d+[.)])\s+(.+)$/);
    if (list) {
      const ordered = !list[1];
      const items = [];
      while (i < lines.length) {
        const item = lines[i].match(/^\s*(?:([-+*])|\d+[.)])\s+(.+)$/);
        if (!item || Boolean(!item[1]) !== ordered) break;
        const check = item[2].match(/^\[([ xX])\]\s*(.*)$/);
        items.push(
          check
            ? `<li data-checked="${check[1] !== " "}">${inlineMarkdown(check[2])}</li>`
            : `<li>${inlineMarkdown(item[2])}</li>`,
        );
        i++;
      }
      output.push(
        `<${ordered ? "ol" : "ul"}>${items.join("")}</${ordered ? "ol" : "ul"}>`,
      );
      continue;
    }
    const paragraph = [line];
    i++;
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^\s*(?:#{1,6}\s|[-+*]\s|\d+[.)]\s|>|```|~~~)/.test(lines[i]) &&
      !(lines[i].includes("|") && separator(lines[i + 1]))
    )
      paragraph.push(lines[i++]);
    output.push(`<p>${paragraph.map(inlineMarkdown).join("<br>")}</p>`);
  }
  return sanitizeHTML(output.join(""));
}

const ICONS = {
  bold: '<path d="M6 4h6a4 4 0 0 1 0 8H6zm0 8h7a4 4 0 0 1 0 8H6z"/>',
  italic: '<path d="M10 4h8M6 20h8M14 4 10 20"/>',
  underline: '<path d="M6 4v7a6 6 0 0 0 12 0V4M4 21h16"/>',
  highlight: '<path d="m8 15 7-11 5 4-8 10H7zm-2 4-2 2h9"/>',
  list: '<path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01"/>',
  ordered:
    '<path d="M10 6h10M10 12h10M10 18h10M3 4h2v5M3 13c3-2 4 1 1 3l-1 2h3"/>',
  check:
    '<rect x="3" y="4" width="16" height="16" rx="3"/><path d="m7 12 3 3 8-9"/>',
  quote: '<path d="M10 6H4v7h6v5H4M20 6h-6v7h6v5h-6"/>',
  code: '<path d="m8 7-5 5 5 5m8-10 5 5-5 5m-3-14-2 18"/>',
  table:
    '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M9 4v16M15 4v16M3 15h18"/>',
  link: '<path d="m10 13 4-4m-6 6-2 2a3.5 3.5 0 0 0 5 5l5-5a3.5 3.5 0 0 0 0-5m-8 0a3.5 3.5 0 0 1 0-5l5-5a3.5 3.5 0 0 1 5 5l-2 2"/>',
  image:
    '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1.5"/><path d="m3 17 5-5 4 4 4-6 5 7"/>',
  undo: '<path d="m8 4-5 5 5 5M3 9h11a6 6 0 0 1 0 12"/>',
  redo: '<path d="m16 4 5 5-5 5m5-5H10a6 6 0 0 0 0 12"/>',
  copy: '<rect x="8" y="8" width="12" height="13" rx="2"/><path d="M15 8V4a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h4"/>',
  blocks:
    '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><path d="m14 17 3 3 5-6"/>',
  clear: '<path d="m6 6 12 12M6 18 18 6"/>',
  up: '<path d="m6 13 6-6 6 6M12 7v14"/>',
  down: '<path d="m6 11 6 6 6-6M12 3v14"/>',
  trash: '<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/>',
};
const icon = (name) =>
  `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ICONS.clear}</svg>`;
const tool = (name, label, command) =>
  `<button type="button" class="rich-tool" data-action="${command || name}" title="${label}" aria-label="${label}">${icon(name)}</button>`;

export class RichEditor {
  constructor(
    container,
    { html = "", onChange = () => {}, onToast = () => {} } = {},
  ) {
    this.destroyed = false;
    this.container = container;
    this.onChange = onChange;
    this.onToast = (message) => {
      if (!this.destroyed) onToast(message);
    };
    this.abort = new AbortController();
    this.range = null;
    this.blockMode = false;
    this.selected = new Set();
    container.classList.add("rich-editor");
    container.innerHTML = `<div class="rich-toolbar" role="toolbar" aria-label="書式設定">
      <select class="rich-format" aria-label="段落のスタイル"><option value="p">標準テキスト</option><option value="h1">大見出し</option><option value="h2">中見出し</option><option value="h3">小見出し</option></select><span class="rich-divider"></span>
      ${tool("bold", "太字 ⌘B")}${tool("italic", "斜体 ⌘I")}${tool("underline", "下線 ⌘U")}${tool("highlight", "ハイライト")}<span class="rich-divider"></span>
      ${tool("list", "箇条書き")}${tool("ordered", "番号付きリスト")}${tool("check", "チェックリスト")}${tool("quote", "引用")}${tool("code", "コードブロック")}<span class="rich-divider"></span>
      ${tool("link", "リンク")}${tool("image", "画像を追加")}${tool("table", "表を追加")}<span class="rich-divider"></span>
      ${tool("undo", "元に戻す")}${tool("redo", "やり直す")}<span class="rich-toolbar-spacer"></span>${tool("blocks", "ブロックを複数選択")}
    </div><div class="rich-selection-bar" hidden><span class="rich-selection-count">0 個を選択</span><button type="button" data-block-action="all">すべて選択</button><button type="button" data-block-action="copy">${icon("copy")}コピー</button><button type="button" data-block-action="duplicate">複製</button><button type="button" data-block-action="highlight">${icon("highlight")}強調</button><button type="button" data-block-action="up" aria-label="上へ移動">${icon("up")}</button><button type="button" data-block-action="down" aria-label="下へ移動">${icon("down")}</button><button type="button" data-block-action="delete" aria-label="選択したブロックを削除">${icon("trash")}</button><button type="button" data-block-action="done">完了</button></div>
    <div class="rich-content" contenteditable="true" role="textbox" aria-label="ノートの本文" aria-multiline="true" data-placeholder="残しておきたいことを、ここに。\nChatGPT の回答や画像を、そのままペーストできます。" spellcheck="false"></div>
    <input class="rich-image-input" type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/avif" multiple hidden>`;
    this.content = container.querySelector(".rich-content");
    this.toolbar = container.querySelector(".rich-toolbar");
    this.selectionBar = container.querySelector(".rich-selection-bar");
    this.fileInput = container.querySelector(".rich-image-input");
    this.setHTML(html);
    const listen = (target, type, fn) =>
      target.addEventListener(type, fn, { signal: this.abort.signal });
    listen(document, "selectionchange", () => this.saveSelection());
    listen(this.content, "input", () => this.changed());
    listen(this.content, "paste", (e) => this.handlePaste(e));
    listen(this.content, "click", (e) => this.handleClick(e));
    listen(this.content, "keydown", (e) => this.handleKey(e));
    listen(this.content, "dragover", (e) => {
      if ([...e.dataTransfer.types].includes("Files")) e.preventDefault();
    });
    listen(this.content, "drop", (e) => {
      const images = [...e.dataTransfer.files].filter((f) =>
        f.type.startsWith("image/"),
      );
      if (images.length) {
        e.preventDefault();
        this.addImages(images);
      }
    });
    listen(this.toolbar, "mousedown", (e) => {
      if (e.target.closest("button")) e.preventDefault();
    });
    listen(this.toolbar, "click", (e) => {
      const button = e.target.closest("[data-action]");
      if (button) this.action(button.dataset.action);
    });
    listen(this.toolbar.querySelector("select"), "change", (e) =>
      this.command("formatBlock", e.target.value),
    );
    listen(this.selectionBar, "click", (e) => {
      const button = e.target.closest("[data-block-action]");
      if (button) this.blockAction(button.dataset.blockAction);
    });
    listen(this.fileInput, "change", () => {
      this.addImages([...this.fileInput.files]);
      this.fileInput.value = "";
    });
  }

  getHTML() {
    const copy = this.content.cloneNode(true);
    copy
      .querySelectorAll("[data-rich-selected]")
      .forEach((el) => el.removeAttribute("data-rich-selected"));
    return sanitizeHTML(copy.innerHTML);
  }
  setHTML(html) {
    this.content.innerHTML = sanitizeHTML(html);
    this.selected.clear();
    this.range = null;
    if (this.blockMode) this.updateSelection();
  }
  focus() {
    if (!this.destroyed) this.content.focus({ preventScroll: true });
  }
  saveSelection() {
    const selection = window.getSelection();
    if (
      selection?.rangeCount &&
      this.content.contains(selection.anchorNode) &&
      this.content.contains(selection.focusNode)
    )
      this.range = selection.getRangeAt(0).cloneRange();
  }
  restoreSelection() {
    this.focus();
    const selection = window.getSelection();
    if (
      this.range &&
      this.content.contains(this.range.commonAncestorContainer)
    ) {
      selection.removeAllRanges();
      selection.addRange(this.range);
    } else {
      const range = document.createRange();
      range.selectNodeContents(this.content);
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
      this.range = range;
    }
  }
  changed() {
    if (!this.destroyed) this.onChange(this.getHTML());
  }
  insertHTML(html) {
    if (this.destroyed) return;
    if (this.blockMode) this.toggleBlocks(false);
    const clean = sanitizeHTML(html);
    if (!clean) return;
    if (this.getHTML().length + clean.length > 20 * 1024 * 1024) {
      this.onToast(
        "1 件のノートは 20 MB までです。画像を小さくするか、別のノートに追加してください",
      );
      return false;
    }
    this.restoreSelection();
    if (!document.execCommand("insertHTML", false, clean)) {
      const selection = window.getSelection();
      const range = selection.getRangeAt(0);
      range.deleteContents();
      const fragment = range.createContextualFragment(clean);
      const last = fragment.lastChild;
      range.insertNode(fragment);
      if (last) {
        range.setStartAfter(last);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
      }
    }
    this.saveSelection();
    this.changed();
    return true;
  }
  command(command, value = null) {
    if (this.destroyed) return;
    if (this.blockMode) this.toggleBlocks(false);
    this.restoreSelection();
    document.execCommand(command, false, value);
    this.saveSelection();
    this.changed();
  }
  action(action) {
    const commands = {
      bold: "bold",
      italic: "italic",
      underline: "underline",
      list: "insertUnorderedList",
      ordered: "insertOrderedList",
      undo: "undo",
      redo: "redo",
    };
    if (commands[action]) return this.command(commands[action]);
    if (action === "highlight") return this.command("hiliteColor", "#fef0a8");
    if (action === "quote") return this.command("formatBlock", "blockquote");
    if (action === "code") return this.command("formatBlock", "pre");
    if (action === "check")
      return this.insertHTML(
        '<ul><li data-checked="false">チェック項目</li></ul><p><br></p>',
      );
    if (action === "table")
      return this.insertHTML(
        "<table><thead><tr><th>項目</th><th>内容</th><th>メモ</th></tr></thead><tbody><tr><td><br></td><td><br></td><td><br></td></tr><tr><td><br></td><td><br></td><td><br></td></tr></tbody></table><p><br></p>",
      );
    if (action === "image") {
      this.saveSelection();
      return this.fileInput.click();
    }
    if (action === "blocks") return this.toggleBlocks();
    if (action === "link") {
      this.saveSelection();
      const url = window.prompt("リンク先の URL を入力", "https://");
      if (!url) return;
      const safe = safeURL(url);
      if (!safe)
        return this.onToast("https:// で始まる URL を入力してください");
      const selection = window.getSelection();
      if (selection?.toString()) this.command("createLink", safe);
      else this.insertHTML(`<a href="${esc(safe)}">${esc(safe)}</a>`);
    }
  }
  async handlePaste(event) {
    const data = event.clipboardData;
    if (!data) return;
    event.preventDefault();
    const html = data.getData("text/html");
    const text = data.getData("text/plain");
    const images = [...data.files].filter((file) =>
      file.type.startsWith("image/"),
    );
    if (html) {
      const safe = sanitizeHTML(html);
      if (plainText(safe) || /<(?:img|table|hr)\b/i.test(safe)) {
        if (this.insertHTML(safe)) this.warnRemoteImages(safe);
        return;
      }
    }
    if (images.length) return this.addImages(images);
    if (text) this.insertHTML(markdownToHTML(text));
  }
  async pasteFromClipboard() {
    this.saveSelection();
    try {
      if (navigator.clipboard?.read) {
        const items = await navigator.clipboard.read();
        if (this.destroyed) return;
        let pasted = false;
        for (const item of items) {
          if (item.types.includes("text/html")) {
            const html = await (await item.getType("text/html")).text();
            if (this.insertHTML(html)) this.warnRemoteImages(html);
            pasted = true;
          } else if (item.types.some((t) => t.startsWith("image/"))) {
            const type = item.types.find((t) => t.startsWith("image/"));
            await this.addImages([await item.getType(type)]);
            pasted = true;
          } else if (item.types.includes("text/plain")) {
            this.insertHTML(
              markdownToHTML(await (await item.getType("text/plain")).text()),
            );
            pasted = true;
          }
        }
        if (!pasted) this.onToast("コピーした内容が見つかりませんでした");
      } else if (navigator.clipboard?.readText)
        this.insertHTML(markdownToHTML(await navigator.clipboard.readText()));
      else this.onToast("本文を長押しして「ペースト」を選んでください");
    } catch {
      this.focus();
      this.onToast("本文を長押しして「ペースト」を選んでください");
    }
  }
  warnRemoteImages(html) {
    if (/<img\b[^>]*\bsrc\s*=\s*["']?https?:/i.test(html))
      this.onToast(
        "画像を貼り付けました。外部画像の URL は期限切れになる場合があります",
      );
  }
  async addImages(files) {
    let count = 0;
    for (const file of files) {
      if (!/^image\/(png|jpeg|jpg|webp|gif|avif)$/i.test(file.type)) {
        this.onToast("PNG・JPEG・WebP・GIF 画像を選んでください");
        continue;
      }
      if (file.size > 12 * 1024 * 1024) {
        this.onToast("画像は 1 枚 12 MB 以下にしてください");
        continue;
      }
      try {
        const src = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        if (this.destroyed) return;
        const inserted = this.insertHTML(
          `<figure><img src="${src}" alt="${esc(file.name || "貼り付けた画像")}"><figcaption></figcaption></figure><p><br></p>`,
        );
        if (inserted) count++;
      } catch {
        this.onToast("画像を読み込めませんでした");
      }
    }
    if (count && count === files.length)
      this.onToast(`${count} 枚の画像を追加しました`);
  }
  async copyHTML(html = this.getHTML()) {
    const clean = sanitizeHTML(html);
    const text = plainText(clean);
    try {
      if (navigator.clipboard?.write && window.ClipboardItem)
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/html": new Blob([clean], { type: "text/html" }),
            "text/plain": new Blob([text], { type: "text/plain" }),
          }),
        ]);
      else {
        const temp = document.createElement("div");
        temp.contentEditable = "true";
        temp.innerHTML = clean;
        temp.style.cssText = "position:fixed;left:-9999px;top:0;";
        document.body.append(temp);
        const range = document.createRange();
        range.selectNodeContents(temp);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        const success = document.execCommand("copy");
        temp.remove();
        if (!success) throw new Error("copy");
      }
      this.onToast("書式付きでコピーしました");
      return true;
    } catch {
      try {
        await navigator.clipboard.writeText(text);
        this.onToast("テキストとしてコピーしました");
        return true;
      } catch {
        this.onToast("本文を長押しして範囲を選び、コピーしてください");
        return false;
      }
    }
  }
  handleClick(event) {
    if (this.blockMode) {
      event.preventDefault();
      let node = event.target;
      while (node && node.parentElement !== this.content)
        node = node.parentElement;
      if (node && node !== this.content) {
        if (this.selected.has(node)) this.selected.delete(node);
        else this.selected.add(node);
        this.updateSelection();
      }
      return;
    }
    const item = event.target.closest("li[data-checked]");
    if (item && event.clientX < item.getBoundingClientRect().left + 28) {
      item.dataset.checked = String(item.dataset.checked !== "true");
      this.changed();
    }
    if (event.target.closest("a")) event.preventDefault();
  }
  handleKey(event) {
    if (event.key === "Escape" && this.blockMode) {
      event.preventDefault();
      this.toggleBlocks(false);
      return;
    }
    if (event.key === "Tab") {
      const anchor = window.getSelection()?.anchorNode;
      const cell = (
        anchor?.nodeType === Node.ELEMENT_NODE ? anchor : anchor?.parentElement
      )?.closest("td,th");
      if (cell && this.content.contains(cell)) {
        const table = cell.closest("table");
        const cells = [...table.querySelectorAll("td,th")];
        let next = cells[cells.indexOf(cell) + (event.shiftKey ? -1 : 1)];
        if (!next && !event.shiftKey) {
          const row = document.createElement("tr");
          for (const original of cell.parentElement.children) {
            const td = document.createElement("td");
            td.innerHTML = "<br>";
            if (original.colSpan > 1) td.colSpan = original.colSpan;
            row.append(td);
          }
          (
            table.tBodies[table.tBodies.length - 1] || table.createTBody()
          ).append(row);
          next = row.firstElementChild;
          this.changed();
        }
        if (next) {
          event.preventDefault();
          const range = document.createRange();
          range.selectNodeContents(next);
          range.collapse(true);
          const selection = window.getSelection();
          selection.removeAllRanges();
          selection.addRange(range);
          this.saveSelection();
        }
      } else {
        event.preventDefault();
        this.command(event.shiftKey ? "outdent" : "indent");
      }
    }
  }
  toggleBlocks(force) {
    this.blockMode = force ?? !this.blockMode;
    this.selected.clear();
    this.content.contentEditable = String(!this.blockMode);
    this.content.classList.toggle("rich-block-mode", this.blockMode);
    this.selectionBar.hidden = !this.blockMode;
    this.toolbar
      .querySelector('[data-action="blocks"]')
      .setAttribute("aria-pressed", String(this.blockMode));
    this.toolbar
      .querySelectorAll('button:not([data-action="blocks"]),select')
      .forEach((el) => (el.disabled = this.blockMode));
    // Native contenteditable Enter can wrap an entire HTML paste in one bare div.
    // Unwrap those browser containers so paragraphs and tables remain selectable.
    if (this.blockMode) {
      let unwrap = true;
      while (unwrap) {
        unwrap = false;
        for (const child of [...this.content.children]) {
          if (
            child.tagName === "DIV" &&
            !child.attributes.length &&
            [...child.children].some((el) =>
              /^(P|DIV|H[1-6]|UL|OL|TABLE|BLOCKQUOTE|PRE|FIGURE|HR)$/.test(
                el.tagName,
              ),
            )
          ) {
            child.replaceWith(...child.childNodes);
            unwrap = true;
          }
        }
      }
      for (const child of [...this.content.childNodes])
        if (child.nodeType === Node.TEXT_NODE && child.textContent.trim()) {
          const p = document.createElement("p");
          child.replaceWith(p);
          p.append(child);
        }
    }
    this.updateSelection();
  }
  updateSelection() {
    for (const child of this.content.children) {
      if (this.selected.has(child))
        child.setAttribute("data-rich-selected", "");
      else child.removeAttribute("data-rich-selected");
    }
    this.selectionBar.querySelector(".rich-selection-count").textContent =
      `${this.selected.size} 個を選択`;
    this.selectionBar
      .querySelectorAll("[data-block-action]")
      .forEach((button) => {
        button.disabled =
          !["all", "done"].includes(button.dataset.blockAction) &&
          !this.selected.size;
      });
  }
  blockAction(action) {
    const selected = [...this.content.children].filter((el) =>
      this.selected.has(el),
    );
    if (action === "done") return this.toggleBlocks(false);
    if (action === "all") {
      this.selected = new Set(this.content.children);
      return this.updateSelection();
    }
    if (action === "copy")
      return this.copyHTML(selected.map((el) => el.outerHTML).join(""));
    if (action === "delete") {
      selected.forEach((el) => el.remove());
      this.selected.clear();
    }
    if (action === "duplicate") {
      for (const el of selected) {
        const copy = el.cloneNode(true);
        copy.removeAttribute("data-rich-selected");
        el.after(copy);
      }
      this.onToast("選択したブロックを複製しました");
    }
    if (action === "highlight")
      for (const el of selected)
        el.style.backgroundColor = el.style.backgroundColor ? "" : "#fef0a8";
    if (action === "up")
      for (const el of selected) {
        const before = el.previousElementSibling;
        if (before && !this.selected.has(before)) before.before(el);
      }
    if (action === "down")
      for (const el of [...selected].reverse()) {
        const after = el.nextElementSibling;
        if (after && !this.selected.has(after)) after.after(el);
      }
    this.updateSelection();
    this.changed();
  }
  destroy() {
    this.destroyed = true;
    this.abort.abort();
    this.container.innerHTML = "";
    this.container.classList.remove("rich-editor");
    this.selected.clear();
    this.range = null;
  }
}
