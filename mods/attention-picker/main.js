// "Agents waiting" (a dialog): the agents that need you and the finished ones in a
// plain list, then, under a rule, every other agent grouped by space. Picking
// one shows it (agent.focus) and closes the dialog.
//
// Standalone: it needs no other mod. Open it with the command
// "mod.open:attention-picker" bound to any key (keys.json); mod.open passes no
// props, so the search box is on by default.
//
// Props   search   false = keys only (↑↓, Enter, 1-9, Esc); anything else = search box on.
// Shared  reads  "agents.since"  { address: ms } when a layout tracks status times (it wins);
//                "space.colors"  { spaceId: color name or #rrggbb }
//         read/write "attention.sort"  "recent" | "oldest" | "space"
// Command agent.focus {terminal}
// Without "agents.since" the waiting times come from the tab (changed_at) and
// from a first-seen record kept in this mod's localStorage (address -> status
// group and time; no screen text). Screens are read with `hc read` only while
// the dialog is open, for agents that need you or finished.
// Known callers: the portrait layout's bar strip passes { search: true|false }.
// Pure logic lives in logic.js and ask.js (tests/ runs it under node).

import { View, div, svg } from "gpui-kit";
import { v_flex, h_flex, InputState, Input } from "gpui-base";
import { agents, spaces, run, hc, theme, settings, shared, setShared, props, closeOverlay } from "herdr";
import { askOf } from "./ask.js";
import {
  ORDER, WORD, isPick, pickSearch, duration, normalizeSort, nextSort, parseSeen, trackSeen,
  buildRows, emptyState, inkOn, resolveSelection, moveSelection, createPreviewReader,
} from "./logic.js";

const HOME = "mods/attention-picker"; // this mod's folder, for its own assets
const POLL_MS = 3000; // how often waiting agents' screens are re-read
const READ_LINES = 60; // lines of each screen hc read returns
const READ_CONCURRENCY = 4; // hc read calls in flight at once
const SEEN_KEY = "attention.seen"; // localStorage: { address: { s: status group, at: ms } }
const HOME_SPACE_NAME = "~"; // Herdr names a space after its folder; the home folder shows as "~" and is drawn dim

const MARK = { ansi6: "#22a99a", ansi3: "#e3814f", ansi4: "#5b8def", ansi5: "#8b7cf6", ansi2: "#3fae6a", ansi1: "#d9649a" };
const H = { head: 29, agent: 32, waiting: 46, sep: 17, earlier: 35 }; // row heights, as in Go to…
const SORT_LABEL = { recent: "Recent", oldest: "Oldest", space: "Space order" };
const SORT_TIP = { recent: "Latest activity first", oldest: "Longest idle first", space: "As the space tree shows them" };
const sortNow = () => normalizeSort(shared("attention.sort"));
const LIST_H = 320;

function loadSeen() {
  try { return parseSeen(localStorage.getItem(SEEN_KEY)); } catch { return {}; }
}
function saveSeen(seen) {
  try { localStorage.setItem(SEEN_KEY, JSON.stringify(seen)); } catch { /* storage unavailable: times stay in memory */ }
}

// The space's color, as every other list shows it (shared "space.colors").
function spaceColor(t, s) {
  if (s.name === HOME_SPACE_NAME) return t.dim;
  const c = (shared("space.colors") ?? {})[s.id] ?? "ansi6";
  return c.startsWith("#") ? c : (MARK[c] ?? t[c]);
}

export default class AttentionPicker extends View {
  init(_props, cx) {
    this.selected = null; // key of the selected row (an address, or "earlier"); the first row when null or gone
    this.filter = "";
    this.scroll = 0;
    this.search = pickSearch(_props ?? props());
    this.showEarlier = false;
    this.dead = false;
    this.seen = loadSeen();
    this.track(agents(), Date.now()); // also drops agents that are gone
    // What each waiting agent says (its last question), read off its screen.
    this.previews = new Map(); // address → { status, text }
    this.reader = createPreviewReader({
      read: (address) => hc(["read", address, "--lines", String(READ_LINES)]),
      parse: askOf,
      concurrency: READ_CONCURRENCY,
    });
    this.readPreviews(cx);
    cx.timer.every(POLL_MS, (cx) => this.readPreviews(cx));
    this.handle = cx.focus_handle();
    if (this.search) {
      this.input = InputState.new({ placeholder: "Search agents, spaces, programs…" });
      this.input.on("change", (_e, cx) => { this.filter = this.input.value(); this.selected = null; cx.notify(); });
      this.input.on("submit", (_e, cx) => { this.go(this.selection()); cx?.notify?.(); });
      this.input.focus();
      cx.timer.after(300, () => this.input.focus());
    } else {
      this.handle.focus();
      cx.timer.after(50, () => this.handle.focus());
    }
  }

  // Keeps the first-seen record current; saved only when it changed.
  track(list, now) {
    const r = trackSeen(this.seen, list, now);
    if (!r.changed) return;
    this.seen = r.seen;
    saveSeen(this.seen);
  }

  // The rows, built once per render and reused by the key and click handlers.
  view(now = Date.now()) {
    const list = agents();
    this.track(list, now);
    const rows = buildRows({
      agents: list, spaces: spaces(), sharedSince: shared("agents.since") ?? {}, seen: this.seen,
      query: this.filter, sort: sortNow(), showEarlier: this.showEarlier, now,
    });
    const picks = rows.filter(isPick);
    const numbers = new Map(); // key → 1-9 shortcut, "earlier" has none
    for (const r of picks) if (r.kind !== "earlier") numbers.set(r.key, numbers.size + 1);
    this.cache = { rows, picks, numbers, anyAgents: list.length > 0 };
    return this.cache;
  }

  selection() {
    const { picks } = this.cache ?? this.view();
    return picks[resolveSelection(picks, this.selected)];
  }

  readPreviews(cx) {
    if (this.dead || this.reader.busy) return;
    const want = agents().filter((a) => a.status === "blocked" || a.status === "done")
      .map((a) => ({ address: a.address, status: a.status }));
    if (!want.length && !this.previews.size) return;
    cx.spawn(async (cx) => {
      const changed = await this.reader.pass(want, this.previews);
      if (changed && !this.dead) cx.notify();
    });
  }

  // Not close(): that name is the host's final-cleanup hook on a View.
  dismiss() {
    this.dead = true;
    const id = props()?.overlay;
    if (id) closeOverlay(id);
    else run("overlay.close");
  }

  setSort(value) {
    setShared("attention.sort", value);
    this.selected = null;
    this.scroll = 0;
  }

  go(r) {
    if (!r) return;
    if (r.kind === "earlier") { this.showEarlier = !this.showEarlier; return; }
    this.dismiss();
    run("agent.focus", { terminal: r.a.address });
  }

  glyph(t, st) {
    if (st === "working") return svg(`${HOME}/spinner.svg`).size(12).flex_none().text_color(t.working).spin(900);
    return div().w(12).flex_none().text_color(t[st] ?? t.dim).child(st in ORDER ? "●" : "○");
  }

  render() {
    const t = theme();
    const now = Date.now();
    const { rows, picks, numbers, anyAgents } = this.view(now);
    const selIdx = resolveSelection(picks, this.selected);
    const sel = picks[selIdx];
    const asking = picks.filter((r) => r.a?.status === "blocked").length;
    const done = picks.filter((r) => r.a?.status === "done").length;
    const title = asking ? `${asking} agent${asking === 1 ? "" : "s"} need${asking === 1 ? "s" : ""} you`
      : done ? `${done} finished` : (emptyState({ anyAgents }).title ?? "Nothing needs you right now");
    const hint = this.search ? "↑↓ choose · Enter go · Tab sort · Esc" : "↑↓ choose · Enter go · 1–9 jump · Tab sort · Esc";
    const sort = sortNow();
    const sortAfter = nextSort(sort);

    // One strip, each row at a fixed y, scrolled only as far as it takes to keep
    // the selected agent in view (as Go to… does).
    const tops = [];
    let y = 0;
    for (const r of rows) { tops.push(y); y += H[r.kind]; }
    const total = y;
    const height = Math.min(LIST_H, this.listHeight ?? LIST_H);
    const fixed = total > height;
    const maxScroll = Math.max(0, total - height);
    this.scroll = Math.max(0, Math.min(this.scroll, maxScroll));
    const si = rows.indexOf(sel);
    if (si >= 0) {
      // Keep the space's name in view with its first agent.
      const top = si > 0 && rows[si - 1].kind === "head" ? tops[si - 1] : tops[si];
      if (top < this.scroll) this.scroll = top;
      if (tops[si] + H[sel.kind] > this.scroll + height) this.scroll = tops[si] + H[sel.kind] - height;
    }
    const place = (el, i) => (fixed
      ? el.absolute().left(0).right(0).top(tops[i] - this.scroll).bottom(height - (tops[i] + H[rows[i].kind] - this.scroll))
      : el);
    const visible = (i) => !fixed || (tops[i] + H[rows[i].kind] > this.scroll && tops[i] < this.scroll + height);

    const row = (r) => {
      if (r.kind === "sep") return v_flex().h(H.sep).px(10).justify_center().child(div().h(1).bg(t.border));
      if (r.kind === "head") {
        const tile = spaceColor(t, r.s);
        return h_flex().px(10).pt(10).pb(3).gap(8).items_center().text_size(11).font_semibold().text_color(t.dim)
          .child(h_flex().size(18).rounded(5).bg(tile).items_center().justify_center()
            .text_size(10.5).font_bold().text_color(inkOn(tile)).child([...r.s.name][0]?.toUpperCase() ?? "?"))
          .child(r.s.name);
      }
      const on = r === sel;
      if (r.kind === "earlier") {
        return h_flex().id("ap-earlier").mx(4).mt(6).px(10).h(H.earlier - 6).gap(8).items_center().rounded(7).cursor_pointer()
          .border_t(1).border_color(t.border).text_size(12).text_color(on ? t.foreground : t.dim)
          .when(on, (el) => el.bg(t.hover)).hover((el) => el.text_color(t.foreground))
          .on_click((_e, cx) => { this.selected = r.key; this.go(r); cx.notify(); })
          .child(`earlier: ${r.count} agent${r.count > 1 ? "s" : ""} idle for over a day ${r.open ? "▴" : "▾"}`);
      }
      const color = t[r.a.status] ?? t.dim;
      const word = WORD[r.a.status] ?? (r.a.status === "idle" ? "idle" : null);
      const ago = r.since ? duration(now - r.since) : null;
      const num = numbers.get(r.key);
      const line = h_flex().h(20).gap(10).items_center()
        .when(!this.search, (el) => el.child(div().w(10).flex_none().text_size(11).text_color(t.dim).child(num && num <= 9 ? String(num) : "")))
        .child(this.glyph(t, r.a.status))
        .child(div().flex_1().min_w(0).truncate().text_color(t.foreground).child(r.name))
        .child(h_flex().flex_none().gap(5).items_center().text_size(11)
          .when(Boolean(word), (el) => el.child(div().text_color(r.a.status in WORD ? color : t.dim).child(word)))
          .when(Boolean(ago), (el) => el.child(div().text_color(t.dim).child(ago))))
        .child(div().flex_none().max_w(200).truncate().text_size(11).text_color(t.dim).child(r.sub));
      const ask = r.kind === "waiting" ? this.previews.get(r.a.address) : null;
      const said = ask && ask.status === r.a.status ? ask.text : "";
      return v_flex().id(`ap-${r.a.address}`).mx(4).px(10).h(H[r.kind]).justify_center().rounded(7).cursor_pointer()
        .when(on, (el) => el.bg(t.hover)).hover((el) => el.bg(t.hover))
        .on_click(() => this.go(r))
        .child(line)
        .when(r.kind === "waiting", (el) => el.child(div().pl(this.search ? 22 : 42).truncate().text_size(11.5)
          .text_color(t.muted).child(said || (ask ? "" : "…"))));
    };

    return v_flex().id("attention-picker").track_focus(this.handle).w_full().min_h(0).p(18).gap(10).bg(t.popover).text_size(13)
      .on_key_down((e, cx) => {
        const k = e.key;
        if (k === "escape") return this.dismiss();
        if (k === "down" && picks.length) this.selected = moveSelection(picks, this.selected, 1);
        else if (k === "up" && picks.length) this.selected = moveSelection(picks, this.selected, -1);
        else if (k === "enter" && !this.search) { this.go(sel); if (sel?.kind !== "earlier") return; }
        else if (k === "tab") this.setSort(nextSort(sort, e.modifiers?.shift ? -1 : 1));
        else if (!this.search && /^[1-9]$/.test(k) && !e.modifiers?.control && !e.modifiers?.platform) return this.go(picks.find((x) => numbers.get(x.key) === Number(k)));
        else return;
        cx.stop_propagation();
        cx.notify();
      })
      .child(h_flex().items_center()
        .child(div().flex_1().text_size(15).font_semibold().text_color(t.foreground).child(title))
        .child(h_flex().id("ap-sort").mr(10).h(22).px(8).gap(4).items_center().rounded(6).cursor_pointer()
          .text_size(11.5).text_color(t.muted).bg(t.raised).hover((el) => el.bg(t.hover).text_color(t.foreground))
          .on_click((_e, cx) => { this.setSort(sortAfter); cx.notify(); })
          .tooltip(`${SORT_TIP[sort]} · click or Tab for ${SORT_LABEL[sortAfter]}`)
          .child(div().text_color(t.dim).child("Sort"))
          .child(SORT_LABEL[sort]))
        .child(div().text_size(11).text_color(t.dim).child(hint)))
      .when(this.search, (el) => el.child(h_flex().h(36).flex_none().px(10).gap(8).items_center().rounded(9).border_1().border_color(t.accent).bg(t.background)
        .child(svg(`${HOME}/search.svg`).size(15).text_color(t.dim))
        .child(Input.new(this.input).flex_1().h_full().text_size(12.8).text_color(t.foreground))))
      .when(rows.length === 0, (el) => el.child(div().px(10).py(8).text_size(12).text_color(t.dim)
        .child(emptyState({ anyAgents, filter: this.filter }).body)))
      .when(rows.length > 0, (el) => el.child(v_flex().id("ap-list")
        .on_size_change((size, cx) => { this.listHeight = size.height / (Number(settings().zoom) || 1); cx.notify(); })
        .h(Math.min(LIST_H, total)).min_h(0).mb(6)
        .when(fixed, (el) => el.overflow_hidden().on_scroll_wheel((e, cx) => {
          this.scroll = Math.max(0, Math.min(this.scroll - e.delta.y, maxScroll));
          // The selection follows the wheel, so the next frame doesn't scroll back to it.
          let at = selIdx;
          while (at < picks.length - 1 && tops[rows.indexOf(picks[at])] < this.scroll) at++;
          while (at > 0 && tops[rows.indexOf(picks[at])] + H[picks[at].kind] > this.scroll + height) at--;
          if (picks[at]) this.selected = picks[at].key;
          cx.notify();
        }))
        .children(rows.map((r, i) => (visible(i) ? place(row(r), i) : null)).filter(Boolean))));
  }
}
