// A floating window that shows a picture or a PDF clicked in the Files panel (portrait-files).
// Pictures fit the window; a PDF shows its pages as pictures, drawn one after another by
// Poppler (pdftoppm). Without Poppler, macOS shows the first page (Quick Look) and the other
// systems say how to install it. "Open in Preview" (or the default app) hands the file to the
// system; Esc or ✕ closes the window.
//
// Props: { file: absolute path on this computer, overlay }
// Pictures and pages are cached under <app home>/data/portrait-viewer/cache (logic.mjs).
import { View, div, svg, image } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { props, theme, exec, appHome, home, window, closeOverlay, notify } from "herdr";
import * as fs from "fs/promises";
import { createViewer, viewKind, previewLabel, canOpen, PDF_MAX_PAGES } from "./logic.mjs";

const PAD = 24;
const PAGE_MAX_W = 1100; // a PDF page is not drawn wider than this, however wide the window

const viewerDeps = () => ({
  exec, appHome: appHome(), home: home(), platform: window()?.platform,
  fs: {
    readFile: (p) => fs.readFile(p),
    readText: (p) => fs.readFile(p, "utf8"),
    writeFile: (p, data) => fs.writeFile(p, data),
    mkdir: (p, o) => fs.mkdir(p, o),
    unlink: (p) => fs.unlink(p),
    rmdir: (p) => fs.rmdir(p),
    readdir: (p) => fs.readdir(p),
  },
});
// One per app folder and platform (window() can be null before the app has a window).
let viewer = null, viewerKey = "", pruned = false;
const get = () => {
  const key = `${appHome()}|${window()?.platform ?? ""}`;
  if (!viewer || key !== viewerKey) { viewerKey = key; viewer = createViewer(viewerDeps()); }
  return viewer;
};

const nameOf = (p) => String(p ?? "").split(/[\\/]/).pop();
const folderOf = (p) => { const s = String(p ?? ""); return s.slice(0, Math.max(s.lastIndexOf("/"), s.lastIndexOf("\\"))); };

export default class Viewer extends View {
  init(_props, cx) {
    this.file = (props() ?? {}).file ?? null;
    this.kind = viewKind(this.file);
    this.pages = []; // pictures: [one]; PDFs: one per drawn page
    this.total = null; // a PDF's page count, when known
    this.note = null; // a line above the pictures (a missing Poppler, pages left out)
    this.error = null;
    this.width = 800; // the scroll area's width, from on_size_change
    this.handle = cx.focus_handle();
    this.handle.focus();
    cx.timer.after(80, () => this.handle.focus());
    if (this.file && this.kind) cx.spawn(async (cx) => this.load(cx));
    if (!pruned) { pruned = true; cx.spawn(async () => { await get().prune().catch(() => {}); }); }
  }

  async load(cx) {
    const v = get(), file = this.file;
    try {
      const st = await v.stamp(file);
      if (this.kind === "image") {
        const a = await v.image(file, st);
        if (a.error) this.error = a.error; else this.pages = [a];
        return;
      }
      const info = await v.pdfInfo(file, st);
      if (info.missing) {
        // No Poppler: macOS draws the first page; elsewhere only the hint.
        const first = await v.quickLook(file, st);
        if (first.error) { this.error = info.error; return; }
        this.pages = [first];
        this.note = `${info.error}. Until then only the first page shows here.`;
        return;
      }
      if (info.error) { this.error = info.error; return; }
      this.total = info.pages;
      const last = Math.min(info.pages, PDF_MAX_PAGES);
      if (info.pages > last) this.note = `The first ${last} of ${info.pages} pages; the rest open in ${previewLabel(v.platform).replace(/^Open in /, "")}.`;
      for (let n = 1; n <= last; n++) {
        if (this.closed) return;
        const page = await v.pdfPage(file, st, n);
        if (page.error) { if (n === 1) this.error = page.error; else this.note = `Page ${n}: ${page.error}`; return; }
        this.pages.push(page);
        cx.notify();
      }
    } catch (e) {
      this.error = String(e?.message ?? e);
    } finally { cx.notify(); }
  }

  close() { this.closed = true; }

  openOutside() {
    if (!canOpen(this.file)) return;
    get().openOutside(this.file).then((r) => {
      if (r?.code) notify({ title: "Couldn't open the file", body: r.stderr || nameOf(this.file), level: "error" });
    }).catch((e) => notify({ title: "Couldn't open the file", body: String(e?.message ?? e), level: "error" }));
  }

  closeWindow() {
    const p = props() ?? {};
    if (p.overlay) closeOverlay(p.overlay);
  }

  bar(t) {
    const stop = (_e, cx) => cx.stop_propagation();
    const button = (id, child, action, hint) => h_flex().id(id).h(24).px(8).gap(5).flex_none().items_center().rounded(5)
      .cursor_pointer().text_color(t.muted).hover((el) => el.bg(t.hover).text_color(t.foreground))
      .on_mouse_down("left", stop).on_click(action).tooltip(hint).child(child);
    const pages = this.kind === "pdf" && this.total ? `${this.total} page${this.total === 1 ? "" : "s"}` : null;
    // Presses the buttons don't stop drag the window.
    return h_flex().id("viewer-bar").h(36).flex_none().px(12).gap(8).items_center().bg(t.chrome).border_b(1).border_color(t.border)
      .text_size(12.5).text_color(t.foreground)
      .child(div().flex_none().font_medium().child(nameOf(this.file)))
      .when(Boolean(pages), (el) => el.child(div().flex_none().text_size(11.5).text_color(t.dim).child(pages)))
      .child(div().flex_1().min_w(0).overflow_hidden().whitespace_nowrap().text_ellipsis_start().text_size(11.5).text_color(t.dim)
        .child(folderOf(this.file)))
      .child(button("viewer-open", previewLabel(get().platform), () => this.openOutside(), "Open it in the system's app"))
      .child(button("viewer-close", svg("mods/portrait-viewer/close.svg").size(13), () => this.closeWindow(), "Close (Esc)"));
  }

  picture(t, a, i) {
    const room = Math.max(120, this.width - 2 * PAD);
    let w = a.w, h = a.h;
    // A picture only shrinks to fit; a PDF page fills the width, up to PAGE_MAX_W.
    const target = this.kind === "pdf" ? Math.min(room, PAGE_MAX_W) : Math.min(room, w);
    if (w !== target) { h = (h * target) / w; w = target; }
    return h_flex().id(`viewer-page-${i}`).w_full().flex_none().justify_center()
      .child(image(a.path).w(Math.round(w)).h(Math.round(h)).flex_none().rounded(this.kind === "pdf" ? 3 : 0));
  }

  render() {
    const t = theme();
    const line = (text, color) => div().w_full().flex_none().text_size(12.5).text_color(color).child(text);
    const body = v_flex().id("viewer-scroll").flex_1().min_h(0).overflow_y_scrollbar().on_mouse_down("left", (_e, cx) => cx.stop_propagation())
      .child(v_flex().id("viewer-column").w_full().p(PAD).gap(14)
        .on_size_change((size, cx) => { const w = Math.round(size.width); if (Math.abs(w - this.width) > 2) { this.width = w; cx.notify(); } })
        .when(!this.file || !this.kind, (el) => el.child(line("Pick a picture or a PDF in the Files panel", t.dim)))
        .when(Boolean(this.note), (el) => el.child(line(this.note, t.dim)))
        .when(Boolean(this.error), (el) => el.child(line(this.error, t.blocked)))
        .when(!this.error && !this.pages.length && Boolean(this.kind), (el) => el.child(line("Loading…", t.dim)))
        .children(this.pages.map((a, i) => this.picture(t, a, i))));
    return v_flex().id("viewer").track_focus(this.handle).size_full().min_h(0).bg(t.background).text_color(t.foreground)
      .on_key_down((e, cx) => { if (e.key === "escape") { cx.stop_propagation(); this.closeWindow(); } })
      .child(this.bar(t))
      .child(body);
  }
}
