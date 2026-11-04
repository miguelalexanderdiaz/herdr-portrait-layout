// The portrait bar's top strip: what the default sidebar's header and footer
// offered (search, add a machine, settings) on the left; on the right, a
// "needs you" jump and the Files / Changes / Vault panel toggles (moved here
// from the tab bar).

import { View, div, svg } from "gpui-kit";
import { h_flex } from "gpui-base";
import { run, theme, updates, layout, shared, agents, nextCommand, openOverlay } from "herdr";

function find(node, id) {
  if (node?.id === id) return node;
  for (const child of node?.children ?? []) {
    const found = find(child, id);
    if (found) return found;
  }
  return null;
}

export default class BarStrip extends View {
  init(_props, cx) {
    this.last = null; // { address, index } of the last agent the bell went to
    // `bar-strip.attention` (ctrl-b a): the list of waiting agents, with a search box.
    // `bar-strip.jump`: what a plain click on the bell does.
    cx.spawn(async (cx) => {
      for (;;) {
        const c = await nextCommand();
        if (c === "attention") this.picker(true);
        else if (c === "jump") this.attention();
        cx.notify();
      }
    });
  }

  // Agents waiting on you: first those asking for input, then those that
  // finished while you weren't looking; each group longest-waiting first
  // (lower seq = changed longer ago).
  waiting() {
    const by = (st) => agents().filter((a) => a.status === st).sort((a, b) => a.seq - b.seq);
    return [...by("blocked"), ...by("done")];
  }

  // The "Agents waiting" list (mods/attention-picker), with a search box or not.
  picker(search) {
    openOverlay({ mod: "attention-picker", kind: "dialog", width: 640, props: { search } });
  }

  // Go to the longest-waiting agent; from one of them, go to the next (wrapping).
  // A finished agent turns idle once seen and leaves the list, so when we're
  // still on the one we jumped to, the next is whatever took its place.
  attention() {
    const list = this.waiting();
    if (!list.length) return;
    const focused = agents().find((a) => a.focused)?.address;
    let at = list.findIndex((a) => a.address === focused);
    let next = at + 1;
    if (at === -1 && this.last && focused === this.last.address) next = this.last.index;
    next %= list.length;
    this.last = { address: list[next].address, index: next };
    run("agent.focus", { terminal: list[next].address });
  }

  // An icon + label button, as in the default sidebar's footer.
  button(t, id, icon, label, action, dot = false) {
    return h_flex().id(id).h(20).px(6).gap(5).flex_none().items_center().rounded(5).cursor_pointer()
      .text_color(t.muted).hover((el) => el.bg(t.hover).text_color(t.foreground))
      .on_click(action)
      .child(svg(icon).size(13))
      .child(label)
      .when(dot, (el) => el.child(div().size(6).rounded_full().bg(t.accent)));
  }

  // A right-panel toggle, as the tab bar had it: lit while its tab is open.
  // portrait-tabs notices the change and remembers it for the active space.
  panelButton(t, panel, body, id, label, icon) {
    const on = panel && !panel.hidden && body?.active === id;
    return this.button(t, `panel-${id}`, icon, label, () => {
      if (on) run("layout.hide", { id: "panel" });
      else { run("layout.select", { stack: "panel-body", child: id }); run("layout.show", { id: "panel" }); }
    }).when(on, (el) => el.bg(t.selected).text_color(t.foreground));
  }

  // "🔔 1 needs you · 2 done": who is waiting on you; lit while anyone is.
  // Click: see attention().
  bell(t) {
    const list = this.waiting();
    const asking = list.filter((a) => a.status === "blocked").length, done = list.length - asking;
    const parts = [asking && `${asking} need${asking === 1 ? "s" : ""} you`, done && `${done} done`].filter(Boolean);
    const color = asking ? t.blocked : done ? t.done : t.dim;
    return h_flex().id("attention").h(20).px(6).gap(5).flex_none().items_center().rounded(5)
      .text_color(color)
      .cursor_pointer()
      .when(list.length > 0, (el) => el.bg(color + "1f").hover((h) => h.bg(color + "33")))
      .tooltip(list.length
        ? `Go to the agent waiting longest, asking first${list.length > 1 ? "; again for the next" : ""}. Shift-click: search them all. ctrl-b a: list`
        : "No agent is waiting on you. Shift-click: search agents. ctrl-b a: list")
      // Click: straight to the longest-waiting agent. Shift-click: the list, with search.
      .on_click((e) => (e?.modifiers?.shift ? this.picker(true) : this.attention()))
      .child(svg("mods/bar-strip/bell.svg").size(13))
      .child(parts.length ? parts.join(" · ") : "Needs you");
  }

  render() {
    const t = theme();
    const root = layout(), panel = find(root, "panel"), body = find(root, "panel-body");
    const enabled = shared("workspace.panels") ?? ["files", "changes"];
    return h_flex().size_full().px(8).gap(4).items_center().bg(t.chrome).border_b(1).border_color(t.border).text_size(11.5)
      .child(this.button(t, "search", "mods/workspace-chrome/search.svg", "Search", () => run("mod.open", { name: "picker" })))
      .child(this.button(t, "machine", "mods/workspace-chrome/server.svg", "Add machine", () => run("mod.open", { name: "machine-add" })))
      // The accent dot: an app update is downloaded and waiting (as on the sidebar's Settings).
      .child(this.button(t, "settings", "mods/workspace-chrome/settings.svg", "Settings", () => run("app.settings"), Boolean(updates().app.ready)))
      .child(div().flex_1())
      .child(this.bell(t))
      .when(enabled.includes("files"), (el) => el.child(this.panelButton(t, panel, body, "files", "Files", "mods/files/file.svg")))
      .when(enabled.includes("changes"), (el) => el.child(this.panelButton(t, panel, body, "changes", "Changes", "mods/changes/changes.svg")))
      // The Obsidian vault (mods/vault), when the layout has its panel.
      .when(Boolean(find(body, "vault")), (el) => el.child(this.panelButton(t, panel, body, "vault", "Vault", "mods/vault/icons/book-open.svg")));
  }
}
