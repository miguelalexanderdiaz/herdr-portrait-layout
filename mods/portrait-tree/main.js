// Spaces side by side, one column each, with a tree under the space's header:
// its tabs, and under each tab its panes (agents with their state, plain terminals
// with their folder). Columns come and go with spaces; a folded space shrinks to
// a thin strip. Shown in the portrait layouts' bar.

import { View, div, svg, image } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { spaces, machines, agents, panes, run, theme, shared, setShared, openOverlay, setAgentOrder, settings, home, terminals, appHome } from "herdr";
import * as fs from "fs/promises";
import {
  inkOn, mix, markText, cleanTitle, alpha, duration, tabRows, nameOf, dedupeNames, tilde, basename, dirname,
  safeStorage, readJson, writeJson, isStringArray, isChangedMap, pruneSpaceIds, pruneChanged,
  SPINE_H, createSpineStore, MIN_COL, FOLDED_COL, MARKER, WHEEL_STEP, planColumns, wheelStream,
} from "./logic.mjs";

// Same avatar colors as the shipped spaces list.
const MARK = { ansi6: "#22a99a", ansi3: "#e3814f", ansi4: "#5b8def", ansi5: "#8b7cf6", ansi2: "#3fae6a", ansi1: "#d9649a" };
const RANK = { blocked: 4, done: 3, working: 2, idle: 1 };
const WORD = { blocked: "needs you", done: "done", working: "working", idle: "idle" };
// Below this a row drops the state word and keeps only its glyph.
const WORDY_COL = 320;

// The agent's logo from the app's program table (Claude, Hermes, OpenCode, ...):
// a one-color glyph tinted like text, or a full-color picture.
function icon(p, size, color) {
  if (!p?.icon) return null;
  return p.tint ? svg(p.icon).size(size).flex_none().text_color(color) : image(p.icon).w(size).h(size).flex_none();
}

// A folded space's name runs down its strip like a book spine. Elements can't
// rotate, so each name is written once as an SVG of rotated text (tinted through
// currentColor) under data/portrait-tree-spines/, named by a hash of the name
// (logic.mjs: createSpineStore). Not inside this mod's folder: Herdr reloads a mod
// whenever its files change.

export default class PortraitTree extends View {
  init(_props, cx) {
    this.store = safeStorage(() => localStorage);
    this.folded = new Set(readJson(this.store, "folded", [], isStringArray));
    this.peeked = new Set(readJson(this.store, "peeked", [], isStringArray)); // opened by reveal()
    // Each agent's last state and when it changed; done and idle count as one.
    this.changed = readJson(this.store, "changed", {}, isChangedMap);
    this.width = 0;
    this.pressed = null; // header index being dragged
    this.over = null; // header index under the pointer during that drag
    this.tabPressed = null; // { id, space } of the tab row being dragged
    this.tabOver = null; // id of the tab row under the pointer during that drag
    this.start = 0; // first column on screen, when they don't all fit
    this.lastStart = 0;
    this.lastActive = null; // follow the active space onto the screen when it changes
    this.wheelState = null;
    this.spines = createSpineStore({ fs, root: appHome });
    this.hovered = null; // strip under the pointer: shows ←|→ instead of its badge
    // The durations ("12m") age by themselves; with no agent there is nothing to redraw.
    cx.timer.every(30000, (cx) => { if (this.hasAgents) cx.notify(); });
  }

  track(list, now) {
    let dirty = false;
    for (const a of list) {
      const s = a.status === "done" ? "idle" : a.status;
      if (this.changed[a.address]?.s === s) continue;
      this.changed[a.address] = { s, at: now };
      dirty = true;
    }
    // Dead agents' entries go once a week old (never against an empty list: the app may not have listed yet).
    if (now - (this.prunedAt ?? 0) > 60000) {
      this.prunedAt = now;
      const kept = pruneChanged(this.changed, list.map((a) => a.address), now);
      if (kept !== this.changed) { this.changed = kept; dirty = true; }
    }
    if (dirty) writeJson(this.store, "changed", this.changed);
    // Other mods (the waiting list) read when each live agent got its state.
    const who = list.map((a) => a.address).join(" ");
    if (dirty || who !== this.published) {
      this.published = who;
      setShared("agents.since", Object.fromEntries(list.map((a) => [a.address, this.changed[a.address]?.at ?? now])));
    }
  }

  // An agent coming into focus (the bell, the waiting list, a notification,
  // agent.next) opens its space when it's folded and brings it on screen.
  // Only a change of focus does it: folding the space you're in keeps it folded,
  // and what was folded at startup stays folded. A space opened this way folds
  // again once you move to another space; opening or folding it by hand keeps
  // it as you left it.
  reveal(list, sp, machineList) {
    const a = list.find((x) => x.focused);
    const key = a?.address ?? null;
    const changed = this.lastFocus !== undefined && key !== this.lastFocus;
    this.lastFocus = key;
    let dirty = false;
    if (changed && a && this.folded.has(a.space)) {
      this.folded.delete(a.space);
      this.peeked.add(a.space);
      this.lastActive = null; // follow it even if it was already the active space
      dirty = true;
    }
    // Left behind: neither the active space nor the focused agent's.
    const active = sp.find((s) => s.active)?.id;
    for (const id of [...this.peeked]) {
      if (id === active || id === a?.space) continue;
      this.peeked.delete(id);
      if (sp.some((s) => s.id === id)) this.folded.add(id);
      dirty = true;
    }
    // Spaces that no longer exist (not while the list is empty, and not those of a machine that
    // is loading or offline: they are just not listed yet).
    for (const set of [this.folded, this.peeked]) {
      const kept = pruneSpaceIds(set, sp, machineList);
      if (kept.length !== set.size) { for (const id of [...set]) if (!kept.includes(id)) set.delete(id); dirty = true; }
    }
    if (dirty) this.saveFolds();
  }

  saveFolds() {
    writeJson(this.store, "folded", [...this.folded]);
    writeJson(this.store, "peeked", [...this.peeked]);
  }

  fold(id, cx) {
    this.folded.has(id) ? this.folded.delete(id) : this.folded.add(id);
    this.peeked.delete(id); // by hand: stays as you left it
    this.saveFolds();
    cx.notify();
  }

  glyph(t, status) {
    if (status === "working") return svg("mods/portrait-tree/spinner.svg").size(12).flex_none().text_color(t.working).spin(900);
    if (status === "blocked") return div().size(14).flex_none().rounded(4).bg(alpha(t.blocked, 0.15)).text_size(10.5).font_bold().text_color(t.blocked).flex().items_center().justify_center().child("!");
    if (status === "done") return div().size(7).mx(3).flex_none().rounded(4).bg(t.done);
    return div().size(7).mx(3).flex_none().rounded(4).border(1.5).border_color(t.idle ?? t.dim);
  }

  // "! 1  ⟳ 2" for a space's agents, most urgent first; idle only when nothing else.
  counts(t, mine) {
    const by = {};
    for (const a of mine) by[a.status] = (by[a.status] ?? 0) + 1;
    const order = ["blocked", "done", "working", "idle"].filter((s) => by[s]);
    return h_flex().flex_none().gap(8).items_center().text_size(11.5)
      .children(order.map((s) => h_flex().gap(3).items_center().text_color(s === "idle" ? t.dim : t[s]).child(this.glyph(t, s)).child(String(by[s]))));
  }

  // The same menus Herdr's own lists open (shipped `menu` mod).
  menu(props, height) {
    openOverlay({ mod: "menu", kind: "popup", width: 200, ...(height ? { height } : {}), props });
  }

  // The tab bar's + menu (a terminal, any agent, new space, worktrees) for this space.
  // It acts on the shown space, so show this one first.
  newMenu(s) {
    if (!s.active) run("space.select", { id: s.id });
    openOverlay({ mod: "new-menu", kind: "popup", width: 250, height: 512 });
  }

  header(t, s, i, mine, color, sp) {
    const same = (from) => from !== null && from !== i && (sp[from]?.machine ?? null) === (s.machine ?? null);
    // The drop line shows on the one header under the pointer, never on a plain press.
    const target = this.over === i && same(this.pressed);
    return h_flex().id(`head-${s.id}`).relative().h(40).flex_none().px(10).gap(8).items_center()
      .border_b(1).border_color(t.border).cursor_pointer()
      .hover((el) => el.bg(t.hover))
      // The dragged header dims once the pointer is over another one.
      .when(this.pressed === i && this.over !== null && this.over !== i, (el) => el.opacity(0.5))
      // Drag a header onto another to reorder spaces (within one machine, as the sidebar).
      .when(target, (el) => el.child(div().id(`drop-${s.id}`).absolute().top(0).bottom(0).w(2).bg(t.accent).when(this.pressed < i, (l) => l.right(0)).when(this.pressed > i, (l) => l.left(0))))
      .on_mouse_down("left", (_e, cx) => { this.pressed = i; this.over = null; cx.notify(); })
      .on_mouse_move((_e, cx) => { if (this.over !== i && same(this.pressed)) { this.over = i; cx.notify(); } })
      .on_hover((on, cx) => { if (!on && this.over === i) { this.over = null; cx.notify(); } })
      .on_mouse_up("left", (_e, cx) => {
        const from = this.pressed, dropped = this.over === i;
        this.pressed = null; this.over = null;
        if (dropped && same(from)) run("space.move", { id: sp[from].id, index: i + 1 });
        else if (from === i) run("space.select", { id: s.id });
        cx.notify();
      })
      .on_mouse_down("right", (_e, cx) => { cx.stop_propagation(); this.menu({ tab: "space", target: { id: s.id } }, 260); })
      .child(div().id(`fold-${s.id}`).flex_none().p(2).rounded(4).text_color(t.dim)
        .hover((el) => el.bg(t.hover).text_color(t.foreground))
        .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
        .tooltip("Fold into a strip")
        .on_click((_e, cx) => { cx.stop_propagation(); this.fold(s.id, cx); })
        .child(svg("mods/portrait-tree/fold.svg").size(14)))
      // The space's name as the column's title, in the tree's own font one step up,
      // underlined by a 2px rule in the space's color exactly as wide as the name
      // (softened while another space is active), after the space's letter badge.
      // Badge, name and the header's icons share one centre line; the rule hangs
      // under the name outside the layout, so it doesn't push the name up.
      .child(h_flex().flex_1().min_w(0).items_center().gap(8)
        .child(h_flex().size(18).flex_none().rounded(5).bg(color).items_center().justify_center()
          .text_size(10.5).font_bold().text_color(inkOn(color)).child([...s.name][0]?.toUpperCase() ?? "?"))
        .child(div().relative().flex_initial().min_w(0)
          .child(div().truncate().text_size(15).font_semibold().text_color(s.active ? t.foreground : t.muted).child(s.name))
          .child(div().absolute().left(0).bottom(-4).w_full().h(2).rounded(1).bg(s.active ? color : mix(color, t.chrome, 0.45)))))
      // A space on another machine says which (its terminals and tabs live there).
      .when(Boolean(s.machine), (el) => el.child(h_flex().flex_none().gap(4).items_center().text_size(11).text_color(t.dim)
        .child(svg("mods/portrait-tree/server.svg").size(11)).child(s.machine)))
      .child(this.counts(t, mine))
      .child(div().id(`new-${s.id}`).size(22).flex_none().flex().items_center().justify_center().rounded(5).text_color(t.dim)
        .hover((el) => el.bg(t.hover).text_color(t.foreground))
        .tooltip("New terminal or agent here")
        .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
        .on_click((_e, cx) => { cx.stop_propagation(); this.newMenu(s); })
        .child(svg("mods/portrait-tree/plus.svg").size(13)));
  }

  // The tree lines in front of a row, in a monospace font so the levels line up.
  lines(t, text) {
    return div().flex_none().font_family("JetBrains Mono").text_size(12).text_color(t.dim).whitespace_nowrap().child(text);
  }

  // A tab: its name (or "Tab N"), its most urgent agent state. Click shows it.
  // As in the tab bar: click shows it, double-click renames, drag onto another tab
  // of the same space reorders, right-click is the tab menu.
  tabRow(t, s, tab, last) {
    const shown = s.active && tab.active;
    const same = (from) => Boolean(from) && from.space === s.id && from.id !== tab.id;
    // The drop line shows only on the row under the pointer.
    const target = this.tabOver === tab.id && same(this.tabPressed);
    return h_flex().id(`tab-${tab.id}`).relative().h(24).flex_none().pl(12).pr(10).gap(6).items_center().rounded(6)
      .when(shown, (el) => el.bg(t.hover))
      .when(this.tabPressed?.id === tab.id && this.tabOver !== null && this.tabOver !== tab.id, (el) => el.opacity(0.5))
      .when(target, (el) => el.child(div().id(`drop-${tab.id}`).absolute().left(0).right(0).bottom(0).h(2).bg(t.accent)))
      .hover((el) => el.bg(t.hover)).cursor_pointer()
      .on_mouse_down("left", (e, cx) => {
        this.tabPressed = { id: tab.id, space: s.id }; this.tabOver = null;
        if (e.click_count === 2) run("tab.rename", { id: tab.id });
        cx.notify();
      })
      .on_mouse_move((_e, cx) => { if (this.tabOver !== tab.id && same(this.tabPressed)) { this.tabOver = tab.id; cx.notify(); } })
      .on_hover((on, cx) => { if (!on && this.tabOver === tab.id) { this.tabOver = null; cx.notify(); } })
      .on_mouse_up("left", (_e, cx) => {
        const from = this.tabPressed, dropped = this.tabOver === tab.id;
        this.tabPressed = null; this.tabOver = null;
        if (dropped && same(from)) run("tab.move", { id: from.id, index: tab.index });
        else if (from?.id === tab.id) { if (!s.active) run("space.select", { id: s.id }); run("tab.select", { id: tab.id }); }
        cx.notify();
      })
      .on_mouse_down("right", (_e, cx) => { cx.stop_propagation(); this.menu({ tab: "tab", target: { id: tab.id, space: s.id } }); })
      .child(this.lines(t, last ? "└─" : "├─"))
      .child(div().flex_1().min_w(0).truncate().text_size(12).font_medium().text_color(shown ? t.foreground : t.muted).child(tab.named ? tab.name : `Tab ${tab.index}`))
      .when(Boolean(tab.status) && tab.status !== "idle", (el) => el.child(h_flex().w(14).flex_none().justify_center().child(this.glyph(t, tab.status))));
  }

  // An agent: in a pane, or (a sub-agent) without one, under its parent's tab.
  agentRow(t, a, prefix, wordy, now) {
    const when = this.changed[a.address]?.at;
    const quiet = a.status === "idle" && !a.focused;
    const pic = icon(a.program, 15, t.foreground);
    return h_flex().id(`ag-${a.pane || a.address}`).h(26).flex_none().pl(12).pr(10).gap(6).items_center().rounded(6)
      .when(a.focused, (el) => el.bg(t.selected))
      .hover((el) => el.bg(t.hover)).cursor_pointer()
      .on_click(() => (a.pane ? run("pane.focus", { pane: a.pane }) : run("agent.focus", { terminal: a.address })))
      // The pane menu needs a pane; a sub-agent has none.
      .on_mouse_down("right", (_e, cx) => { cx.stop_propagation(); if (a.pane) this.menu({ tab: "pane", target: { pane: a.pane, terminal: a.address } }); })
      .child(this.lines(t, prefix))
      .when(Boolean(pic), (el) => el.child(pic))
      .child(div().flex_1().min_w(0).truncate().text_size(12.5).text_color(quiet ? t.muted : t.foreground).child(a.name))
      .when(wordy, (el) => el.child(div().flex_none().text_size(11).text_color(a.status === "idle" ? t.dim : t[a.status]).child(WORD[a.status] ?? a.status)))
      .when(Boolean(when), (el) => el.child(div().flex_none().text_size(11).text_color(t.dim).child(duration(now - when))))
      .child(h_flex().w(14).flex_none().justify_center().child(this.glyph(t, a.status)));
  }

  // A plain terminal (a shell, nvim, a server) or a mod pane: its program and folder.
  paneRow(t, p, prefix, files) {
    const pic = icon(p.program, 15, t.muted);
    // An editor opened from the Files panel carries its first file as a label and
    // titles itself with the file it shows now: show that name (the first file's
    // folder while it's still on it, else the cwd).
    const file = p.terminal ? files().get(p.terminal.split("/").pop()) : null;
    const base = file ? basename(file) : null;
    const shown = file ? (cleanTitle(p.title) || base) : null;
    const name = shown ?? (p.terminal ? (p.program?.name || "terminal") : (p.mod || p.title || "panel"));
    const where = file && shown === base ? tilde(dirname(file), this.home) : tilde(p.cwd, this.home);
    return h_flex().id(`pn-${p.pane}`).h(26).flex_none().pl(12).pr(10).gap(6).items_center().rounded(6)
      .when(p.focused, (el) => el.bg(t.selected))
      .hover((el) => el.bg(t.hover)).cursor_pointer()
      .on_click(() => run("pane.focus", { pane: p.pane }))
      .on_mouse_down("right", (_e, cx) => { cx.stop_propagation(); this.menu({ tab: "pane", target: { pane: p.pane, terminal: p.terminal } }); })
      .child(this.lines(t, prefix))
      // No program icon: a terminal gets a ">_" glyph, a mod's pane an empty slot of the same width.
      .child(pic ?? div().w(15).flex_none().text_size(11).text_color(t.dim).child(p.terminal ? ">_" : ""))
      .child(div().flex_none().text_size(12.5).text_color(t.muted).child(name))
      // Paths keep their end (the folder you're in) and lose the start when short of room.
      .child(div().flex_1().min_w(0).overflow_hidden().whitespace_nowrap().text_ellipsis_start().text_size(11.5).text_color(t.dim).child(where));
  }

  // Move the row by `by` columns (wheel, trackpad, or a ‹ › marker).
  shift(by, cx) {
    const next = Math.max(0, Math.min(this.lastStart, this.start + by));
    if (next !== this.start) { this.start = next; cx.notify(); }
  }

  // "‹ 2" / "› 3": how many spaces are off that side, with the most urgent state
  // among them (needs you, working). Click moves one column that way.
  marker(t, side, hidden, bySpace) {
    const top = hidden.flatMap((s) => bySpace.get(s.id) ?? [])
      .reduce((m, a) => ((RANK[a.status] ?? 0) > (RANK[m] ?? 0) ? a.status : m), null);
    const any = hidden.length > 0;
    return v_flex().id(`more-${side}`).w(MARKER).h_full().flex_none().pt(8).gap(6).items_center()
      .when(side === "left", (el) => el.border_r(1)).when(side === "right", (el) => el.border_l(1)).border_color(t.border)
      .text_size(11).text_color(any ? t.muted : t.border)
      .when(any, (el) => el.cursor_pointer().hover((h) => h.bg(t.hover).text_color(t.foreground))
        .tooltip(`${hidden.length} more: ${hidden.map((s) => s.name).join(", ")}`)
        .on_click((_e, cx) => this.shift(side === "left" ? -1 : 1, cx)))
      .child(svg(`mods/portrait-tree/chevron-${side}.svg`).size(12))
      .when(any, (el) => el.child(div().child(String(hidden.length))))
      .when(top === "blocked" || top === "working", (el) => el.child(this.glyph(t, top)));
  }

  // The spine SVG for `name` (a path under the app home) once it exists, else null.
  // Nothing is redrawn when a write fails; it is tried again a minute later.
  spine(name, cx) {
    if (this.spines.ready(name)) return this.spines.file(name);
    const writing = this.spines.request(name);
    if (writing) cx.spawn(async (cx) => { if (await writing) cx.notify(); });
    return null;
  }

  // A folded space, like a book spine: its badge on the header line (←|→ while
  // hovered), one mark per agent, then its name running down the strip.
  strip(t, s, mine, color, cx) {
    const over = this.hovered === s.id;
    const file = this.spine(s.name, cx);
    const dark = settings().dark; // false on a light theme (not typed in herdr.d.ts)
    const MAX = 6;
    return v_flex().id(`strip-${s.id}`).w(FOLDED_COL).h_full().flex_none().items_center()
      .border_r(1).border_color(t.border).cursor_pointer()
      .when(s.active, (el) => el.bg(t.selected))
      .hover((el) => el.bg(t.hover))
      .on_hover((on, cx) => { const next = on ? s.id : (this.hovered === s.id ? null : this.hovered); if (next !== this.hovered) { this.hovered = next; cx.notify(); } })
      .on_click((_e, cx) => this.fold(s.id, cx))
      .on_mouse_down("right", (_e, cx) => { cx.stop_propagation(); this.menu({ tab: "space", target: { id: s.id } }, 260); })
      .tooltip(`Expand ${s.name}`)
      // Same height and bottom rule as an open column's header, so the line runs across.
      .child(h_flex().h(40).w_full().flex_none().items_center().justify_center().border_b(1).border_color(t.border)
        .child(over
          ? svg("mods/portrait-tree/unfold.svg").size(15).text_color(t.foreground)
          : h_flex().size(18).rounded(5).bg(color).items_center().justify_center().text_size(10.5).font_bold().text_color(inkOn(color)).child([...s.name][0]?.toUpperCase() ?? "?")))
      .child(v_flex().pt(10).gap(7).items_center().flex_none()
        .children(mine.slice(0, MAX).map((a) => this.glyph(t, a.status)))
        .when(mine.length > MAX, (el) => el.child(div().text_size(10).text_color(t.dim).child(`+${mine.length - MAX}`))))
      .child(div().flex_1().min_h(0).w_full().overflow_hidden().pt(mine.length ? 12 : 8).flex().justify_center()
        .when(Boolean(file), (el) => el.child(svg(file).w(16).h(SPINE_H).flex_none().text_color(s.active ? markText(color, t.foreground, dark) : t.muted))));
  }

  render(cx) {
    const t = theme();
    const now = Date.now();
    const sp = spaces();
    const list = agents();
    this.track(list, now);
    this.reveal(list, sp, machines());
    const colors = shared("space.colors") ?? {};

    // Agents per space and by pane; a name repeated within a tab is numbered.
    this.hasAgents = list.length > 0;
    const named = list.map((a) => ({ ...a, name: nameOf(a) }));
    const names = dedupeNames(named);
    const bySpace = new Map(sp.map((s) => [s.id, []]));
    const byPane = new Map();
    for (const a of named) {
      a.name = names.get(a.address) ?? a.name;
      bySpace.get(a.space)?.push(a);
      if (a.pane) byPane.set(a.pane, a);
    }
    // Every pane per tab, in layout order: agents and plain terminals alike; and the agents
    // without a pane (sub-agents) per tab.
    const byTab = new Map(), looseByTab = new Map();
    for (const p of panes()) {
      if (!byTab.has(p.tab)) byTab.set(p.tab, []);
      byTab.get(p.tab).push(p);
    }
    for (const a of named) {
      if (a.pane || !a.tab) continue;
      if (!looseByTab.has(a.tab)) looseByTab.set(a.tab, []);
      looseByTab.get(a.tab).push(a);
    }
    this.home = home();
    // terminal address -> file, for editors opened from the Files panel. Read only if
    // a plain terminal row needs it (terminals() marshals every terminal of the core).
    let editors = null;
    const files = () => editors ??= new Map(terminals().filter((x) => x.labels?.["editor.file"]).map((x) => [x.address, x.labels["editor.file"]]));

    // agent.next / agent.prev follow the tree.
    setAgentOrder(sp.filter((s) => !this.folded.has(s.id)).flatMap((s) => bySpace.get(s.id).map((a) => a.address)));
    // Spines of spaces that were renamed or closed.
    if (sp.length && !this.pruned) { this.pruned = true; this.spines.prune(sp.map((s) => s.name)); }

    // Columns: open ones MIN_COL or wider (they share what's left), folded ones a
    // strip. When they don't all fit, only a run of whole columns is shown, with
    // ‹ › markers for the rest; the wheel, a trackpad swipe or the markers move
    // the run, and it follows the active space when that changes (planColumns).
    // The reported size is unzoomed; sizes given to elements are scaled by zoom.
    const act = sp.findIndex((s) => s.active), actId = sp[act]?.id;
    const follow = Boolean(actId) && actId !== this.lastActive;
    const plan = planColumns({ widths: sp.map((s) => (this.folded.has(s.id) ? FOLDED_COL : MIN_COL)), width: this.width,
      zoom: settings().zoom, active: act, follow, start: this.start });
    if (plan.windowed && follow) this.lastActive = actId;
    this.start = plan.start; this.lastStart = plan.lastStart;
    const { windowed, room, start, end } = plan;
    const shown = sp.slice(start, end);

    const open = shown.filter((s) => !this.folded.has(s.id)).length;
    const roomOpen = room - (shown.length - open) * FOLDED_COL;
    const wordy = open > 0 && roomOpen / open >= WORDY_COL;

    const column = (s, i, gi) => { // i: place on screen, gi: place among all spaces
      const mine = bySpace.get(s.id) ?? [];
      const c = typeof colors[s.id] === "string" ? colors[s.id] : "ansi6";
      const color = c.startsWith("#") ? c : (MARK[c] ?? t[c] ?? t.accent);
      if (this.folded.has(s.id)) return this.strip(t, s, mine, color, cx);
      return v_flex().id(`col-${s.id}`).flex_1().min_w(MIN_COL).h_full()
        .when(i < shown.length - 1, (el) => el.border_r(1).border_color(t.border))
        .when(s.active, (el) => el.bg(t.raised))
        .child(this.header(t, s, gi, mine, color, sp))
        // Right-click on the column's empty space: Herdr's general menu (New space, ...).
        .child(v_flex().id(`list-${s.id}`).flex_1().min_h(0).px(4).py(4).overflow_y_scrollbar()
          .on_mouse_down("right", () => this.menu({ tab: "global", target: {} }))
          .children((s.tabs ?? []).flatMap((tab, ti, tabs) => {
            const lastTab = ti === tabs.length - 1;
            return [
              this.tabRow(t, s, tab, lastTab),
              ...tabRows(byTab.get(tab.id) ?? [], looseByTab.get(tab.id)).map((row) => {
                const prefix = (lastTab ? "   " : "│  ") + row.branch;
                if (row.kind === "agent") return this.agentRow(t, row.agent, prefix, wordy, now);
                const a = row.pane.pane ? byPane.get(row.pane.pane) : null;
                return a ? this.agentRow(t, a, prefix, wordy, now) : this.paneRow(t, row.pane, prefix, files);
              }),
            ];
          })));
    };

    // After the last column, a thin "+" for a new space (as the Spaces list's +).
    const add = v_flex().id("space-new").w(FOLDED_COL).h_full().flex_none().pt(8).items_center()
      .border_l(1).border_color(t.border).text_color(t.dim).cursor_pointer()
      .hover((el) => el.bg(t.hover).text_color(t.foreground))
      .tooltip("New space")
      .on_click(() => run("space.new"))
      .on_mouse_down("right", (_e, cx) => { cx.stop_propagation(); this.menu({ tab: "global", target: {} }); })
      .child(svg("mods/portrait-tree/plus.svg").size(14));

    // A thin bar under the columns: where the shown run sits among all spaces.
    const track = (el) => el.child(div().h(5).w_full().relative().flex_none().bg(t.border)
      .child(div().absolute().top(0).h(5).rounded(3).bg(t.muted)
        .left(room * start / sp.length).w(Math.max(12, room * (end - start) / sp.length))));

    // Horizontal swipes (or shift + wheel) step through columns; plain vertical
    // scrolling stays with the column lists. A notch of a mouse wheel is one column.
    const onWheel = (e, cx) => {
      const dx = e.delta?.x ?? 0, dy = e.delta?.y ?? 0;
      const axis = Math.abs(dx) > Math.abs(dy) ? "x" : (e.modifiers?.shift ? "y" : null);
      if (!axis || !(axis === "x" ? dx : dy)) return;
      this.wheelState = wheelStream(this.wheelState, e, axis, Date.now(), WHEEL_STEP);
      if (this.wheelState.steps) this.shift(-this.wheelState.steps, cx);
    };

    return h_flex().id("root").size_full().min_w(0).bg(t.chrome)
      .on_size_change((size, cx) => { if (Math.abs(size.width - this.width) >= 1) { this.width = size.width; cx.notify(); } })
      // A drag released outside any row ends without moving anything.
      .on_mouse_up("left", (_e, cx) => { this.pressed = null; this.over = null; this.tabPressed = null; this.tabOver = null; cx.notify(); })
      .when(windowed, (el) => el.child(this.marker(t, "left", sp.slice(0, start), bySpace)))
      .child(v_flex().id("cols-wrap").flex_1().h_full().min_w(0)
        .child(h_flex().id("cols").flex_1().min_h(0).w_full().on_scroll_wheel(onWheel)
          .children(shown.map((s, i) => column(s, i, start + i))))
        .when(windowed, track))
      .when(windowed, (el) => el.child(this.marker(t, "right", sp.slice(end), bySpace)))
      .child(add);
  }
}
