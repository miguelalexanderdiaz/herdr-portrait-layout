// "Agents waiting" (a dialog): the agents that need you and the finished ones in a
// plain list, then, under a rule, every other agent grouped by space as Go to…
// shows them. Opened by ctrl-b a and by shift-clicking the bell in the bar
// strip, with a search box on top (props.search; without it, keys only:
// ↑↓, Enter, 1-9, Esc).
// Picking one shows it (agent.focus) and closes the list.

import { View, div, svg } from "gpui-kit";
import { v_flex, h_flex, InputState, Input } from "gpui-base";
import { agents, spaces, run, hc, theme, settings, shared, setShared, props, closeOverlay } from "herdr";
import { askOf } from "./ask.js";

const ORDER = { blocked: 0, done: 1, working: 2 };
const WORD = { blocked: "needs you", done: "finished", working: "working" };
const MARK = { ansi6: "#22a99a", ansi3: "#e3814f", ansi4: "#5b8def", ansi5: "#8b7cf6", ansi2: "#3fae6a", ansi1: "#d9649a" };
const H = { head: 29, agent: 32, waiting: 46, sep: 17, earlier: 35 }; // row heights, as in Go to…
const DAY = 24 * 3600 * 1000;
// How the agents under the rule are ordered (kept in shared "attention.sort").
const SORTS = ["recent", "oldest", "space"];
const SORT_LABEL = { recent: "Recent", oldest: "Oldest", space: "Space order" };
const SORT_TIP = { recent: "Latest activity first", oldest: "Longest idle first", space: "As the space tree shows them" };
const sortNow = () => (SORTS.includes(shared("attention.sort")) ? shared("attention.sort") : "recent");
const PICK = (r) => r.kind === "agent" || r.kind === "waiting" || r.kind === "earlier"; // rows ↑↓ and Enter reach
const LIST_H = 320;

function duration(ms) {
  const m = Math.floor(ms / 60000);
  if (m < 1) return "<1m";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h}h` : `${Math.floor(h / 24)}d`;
}

const clean = (s) => (s ?? "").replace(/^[^\p{L}\p{N}]+/u, "").trim();

// The agent's own name, as the space tree shows it: its title (a Claude
// session's name), else a named tab, else its program.
function nameOf(a) {
  const title = clean(a.title);
  if (title && !/^[~/]|^[A-Za-z]:\\/.test(title) && !title.includes("@") && title !== a.program?.name) return title;
  if (a.tab_name && !/^\d+$/.test(a.tab_name)) return a.tab_name;
  return a.program?.name || a.app || "agent";
}

// The space's color, as every other list shows it (shared "space.colors").
function spaceColor(t, s) {
  if (s.name === "~") return t.dim;
  const c = (shared("space.colors") ?? {})[s.id] ?? "ansi6";
  return c.startsWith("#") ? c : (MARK[c] ?? t[c]);
}

export default class AttentionPicker extends View {
  init(_props, cx) {
    this.at = 0;
    this.filter = "";
    this.scroll = 0;
    this.search = Boolean(props()?.search);
    this.showEarlier = false;
    // What each waiting agent says (its last question), read off its screen.
    this.previews = new Map(); // address → { status, text }
    this.readPreviews(cx);
    cx.timer.every(2000, (cx) => this.readPreviews(cx));
    this.handle = cx.focus_handle();
    if (this.search) {
      this.input = InputState.new({ placeholder: "Search agents, spaces, programs…" });
      this.input.on("change", (_e, cx) => { this.filter = this.input.value(); this.at = 0; cx.notify(); });
      this.input.on("submit", (_e, cx) => { this.go(this.agentRows()[this.at]); cx?.notify?.(); });
      this.input.focus();
      cx.timer.after(300, () => this.input.focus());
    } else {
      this.handle.focus();
      cx.timer.after(50, () => this.handle.focus());
    }
  }

  // On top, a plain list: the agents that need you, then the finished ones
  // (longest-waiting first: lower seq = changed longer ago), each with what
  // it's asking. Under a rule, every other agent grouped by space as Go to…
  // lists them, in the chosen order (sortNow: latest activity first, longest
  // idle first, or the tree's order; spaces follow their first agent); the
  // ones idle for over a day fold into an
  // "earlier" line. Filtered by the search (which also opens "earlier").
  // Returns agents, a rule, space heads and the earlier line.
  rows() {
    const q = this.filter.trim().toLowerCase();
    const since = shared("agents.since") ?? {};
    const now = Date.now();
    const rank = (a) => ORDER[a.status] ?? 3;
    const all = agents()
      .map((a, idx) => ({ a, idx, name: nameOf(a), program: a.program?.name || a.app || "", since: since[a.address] ?? null }))
      .filter((r) => !q || [r.name, r.program, r.a.space_name, r.a.tab_name].join(" ").toLowerCase().includes(q))
      .sort((x, y) => rank(x.a) - rank(y.a) || x.a.seq - y.a.seq);
    const waiting = (r) => r.a.status === "blocked" || r.a.status === "done";
    const top = all.filter(waiting)
      .map((r) => ({ ...r, kind: "waiting", sub: [r.a.space_name, r.a.tab_name].filter(Boolean).join(" · ") }));
    const sort = sortNow();
    const by = { recent: (x, y) => (y.since ?? 0) - (x.since ?? 0), oldest: (x, y) => (x.since ?? 0) - (y.since ?? 0), space: (x, y) => x.idx - y.idx }[sort];
    const rest = all.filter((r) => !waiting(r)).sort((x, y) => by(x, y) || x.idx - y.idx)
      .map((r) => ({ ...r, kind: "agent", sub: [r.program, r.a.tab_name].filter(Boolean).join(" · ") }));
    const old = (r) => r.a.status !== "working" && !r.a.focused && r.since && now - r.since > DAY;
    const recent = rest.filter((r) => !old(r)), earlier = rest.filter(old);
    const byId = new Map(spaces().map((s) => [s.id, s]));
    const grouped = (list) => {
      const groups = new Map();
      for (const r of list) {
        if (!groups.has(r.a.space)) groups.set(r.a.space, []);
        groups.get(r.a.space).push(r);
      }
      return [...groups].flatMap(([id, rs]) => [{ kind: "head", s: byId.get(id) ?? { id, name: rs[0].a.space_name ?? "space" } }, ...rs]);
    };
    const out = [...top];
    if (top.length && rest.length) out.push({ kind: "sep" });
    out.push(...grouped(recent));
    if (earlier.length) {
      const open = this.showEarlier || Boolean(q);
      out.push({ kind: "earlier", count: earlier.length, open });
      if (open) out.push(...grouped(earlier));
    }
    return out;
  }

  agentRows() { return this.rows().filter(PICK); }

  readPreviews(cx) {
    const want = agents().filter((a) => a.status === "blocked" || a.status === "done");
    cx.spawn(async (cx) => {
      let changed = false;
      await Promise.all(want.map(async (a) => {
        const r = await hc(["read", a.address]).catch(() => null);
        const text = r?.code === 0 ? askOf(r.stdout, a.status) : "";
        const old = this.previews.get(a.address);
        if (old?.text !== text || old?.status !== a.status) { this.previews.set(a.address, { status: a.status, text }); changed = true; }
      }));
      if (changed) cx.notify();
    });
  }

  close() { closeOverlay(props().overlay); }

  nextSort() {
    setShared("attention.sort", SORTS[(SORTS.indexOf(sortNow()) + 1) % SORTS.length]);
    this.at = 0;
    this.scroll = 0;
  }

  go(r) {
    if (!r) return;
    if (r.kind === "earlier") { this.showEarlier = !this.showEarlier; return; }
    this.close();
    run("agent.focus", { terminal: r.a.address });
  }

  glyph(t, st) {
    if (st === "working") return svg("mods/workspace-chrome/spinner.svg").size(12).flex_none().text_color(t.working).spin(900);
    return div().w(12).flex_none().text_color(t[st] ?? t.dim).child(st in ORDER ? "●" : "○");
  }

  render() {
    const t = theme();
    const rows = this.rows();
    const picks = rows.filter(PICK);
    const now = Date.now();
    if (this.at >= picks.length) this.at = Math.max(0, picks.length - 1);
    const sel = picks[this.at];
    const asking = picks.filter((r) => r.a?.status === "blocked").length;
    const done = picks.filter((r) => r.a?.status === "done").length;
    const title = asking ? `${asking} agent${asking === 1 ? "" : "s"} need${asking === 1 ? "s" : ""} you`
      : done ? `${done} finished` : "Nothing needs you right now";
    const hint = this.search ? "↑↓ choose · Enter go · Tab sort · Esc" : "↑↓ choose · Enter go · 1–9 jump · Tab sort · Esc";
    const sort = sortNow();

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
        return h_flex().px(10).pt(10).pb(3).gap(8).items_center().text_size(11).font_semibold().text_color(t.dim)
          .child(h_flex().size(18).rounded(5).bg(spaceColor(t, r.s)).items_center().justify_center()
            .text_size(10.5).font_bold().text_color("#ffffff").child([...r.s.name][0]?.toUpperCase() ?? "?"))
          .child(r.s.name);
      }
      const on = r === sel;
      if (r.kind === "earlier") {
        return h_flex().id("ap-earlier").mx(4).mt(6).px(10).h(H.earlier - 6).gap(8).items_center().rounded(7).cursor_pointer()
          .border_t(1).border_color(t.border).text_size(12).text_color(on ? t.foreground : t.dim)
          .when(on, (el) => el.bg(t.hover)).hover((el) => el.text_color(t.foreground))
          .on_click((_e, cx) => { this.go(r); cx.notify(); })
          .child(`earlier: ${r.count} agent${r.count > 1 ? "s" : ""} idle for over a day ${r.open ? "▴" : "▾"}`);
      }
      const i = picks.filter((x) => x.kind !== "earlier").indexOf(r), color = t[r.a.status] ?? t.dim;
      const word = WORD[r.a.status] ?? (r.a.status === "idle" ? "idle" : null);
      const ago = r.since ? duration(now - r.since) : null;
      const line = h_flex().h(20).gap(10).items_center()
        .when(!this.search, (el) => el.child(div().w(10).flex_none().text_size(11).text_color(t.dim).child(i >= 0 && i < 9 ? String(i + 1) : "")))
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
        if (k === "escape") return this.close();
        if (k === "down" && picks.length) this.at = (this.at + 1) % picks.length;
        else if (k === "up" && picks.length) this.at = (this.at + picks.length - 1) % picks.length;
        else if (k === "enter" && !this.search) { this.go(sel); if (sel?.kind !== "earlier") return; }
        else if (k === "tab") this.nextSort();
        else if (!this.search && /^[1-9]$/.test(k) && !e.modifiers?.control && !e.modifiers?.platform) return this.go(picks.filter((x) => x.kind !== "earlier")[Number(k) - 1]);
        else return;
        cx.stop_propagation();
        cx.notify();
      })
      .child(h_flex().items_center()
        .child(div().flex_1().text_size(15).font_semibold().text_color(t.foreground).child(title))
        .child(h_flex().id("ap-sort").mr(10).h(22).px(8).gap(4).items_center().rounded(6).cursor_pointer()
          .text_size(11.5).text_color(t.muted).bg(t.raised).hover((el) => el.bg(t.hover).text_color(t.foreground))
          .on_click((_e, cx) => { this.nextSort(); cx.notify(); })
          .tooltip(`${SORT_TIP[sort]} · click or Tab for ${SORT_LABEL[SORTS[(SORTS.indexOf(sort) + 1) % SORTS.length]]}`)
          .child(div().text_color(t.dim).child("Sort"))
          .child(SORT_LABEL[sort]))
        .child(div().text_size(11).text_color(t.dim).child(hint)))
      .when(this.search, (el) => el.child(h_flex().h(36).flex_none().px(10).gap(8).items_center().rounded(9).border_1().border_color(t.accent).bg(t.background)
        .child(svg("mods/workspace-chrome/search.svg").size(15).text_color(t.dim))
        .child(Input.new(this.input).flex_1().h_full().text_size(12.8).text_color(t.foreground))))
      .when(rows.length === 0, (el) => el.child(div().px(10).py(8).text_size(12).text_color(t.dim)
        .child(this.filter ? "No match" : "Nothing needs you right now")))
      .when(rows.length > 0, (el) => el.child(v_flex().id("ap-list")
        .on_size_change((size, cx) => { this.listHeight = size.height / (Number(settings().zoom) || 1); cx.notify(); })
        .h(Math.min(LIST_H, total)).min_h(0).mb(6)
        .when(fixed, (el) => el.overflow_hidden().on_scroll_wheel((e, cx) => {
          this.scroll = Math.max(0, Math.min(this.scroll - e.delta.y, maxScroll));
          // The selection follows the wheel, so the next frame doesn't scroll back to it.
          while (this.at < picks.length - 1 && tops[rows.indexOf(picks[this.at])] < this.scroll) this.at++;
          while (this.at > 0 && tops[rows.indexOf(picks[this.at])] + H[picks[this.at].kind] > this.scroll + height) this.at--;
          cx.notify();
        }))
        .children(rows.map((r, i) => (visible(i) ? place(row(r), i) : null)).filter(Boolean))));
  }
}
