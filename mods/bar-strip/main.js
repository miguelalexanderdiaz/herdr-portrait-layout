// The portrait bar's top strip: what the default sidebar's header and footer
// offered (search, add a machine, settings) on the left; on the right, a
// "needs you" jump and the Files / Changes panel toggles (moved here from the
// tab bar).

import { View, div, svg } from "gpui-kit";
import { h_flex } from "gpui-base";
import { run, theme, updates, layout, shared, agents, nextCommand, openOverlay, closeOverlay, keys } from "herdr";
import { PICKER, find, enabledPanels, alpha, keyHint, waitingAgents, nextWaiting } from "./logic.mjs";

export default class BarStrip extends View {
  init(_props, cx) {
    this.last = null; // { address, index } of the last agent the bell went to
    this.pickerId = null; // the open "Agents waiting" overlay, so a second key press doesn't stack another
    // `bar-strip.attention` (bound in keys.json): the list of waiting agents, with a search box.
    // `bar-strip.jump`: what a plain click on the bell does.
    // `bar-strip.panel-files`, `bar-strip.panel-changes`: what a click on that panel button does.
    cx.spawn(async (cx) => {
      for (;;) {
        const c = await nextCommand();
        if (c === "attention") this.picker();
        else if (c === "jump") this.attention();
        else if (c.startsWith("panel-")) this.togglePanel(c.slice(6));
        cx.notify();
      }
    });
  }

  // Agents waiting on you, most urgent first (see waitingAgents).
  waiting() {
    return waitingAgents(agents(), shared("agents.since"));
  }

  // The "Agents waiting" list (mods/attention-picker, PICKER), with its search box.
  // One at a time: an open one is closed first.
  picker() {
    if (this.pickerId) { try { closeOverlay(this.pickerId); } catch {} }
    this.pickerId = openOverlay({ mod: PICKER, kind: "dialog", width: 640, props: { search: true } });
  }

  // Go to the longest-waiting agent; from one of them, go to the next (wrapping).
  // A finished agent turns idle once seen and leaves the list, so when we're
  // still on the one we jumped to, the next is whatever took its place.
  attention() {
    const go = nextWaiting(this.waiting(), agents().find((a) => a.focused)?.address, this.last);
    if (!go) return;
    this.last = go;
    run("agent.focus", { terminal: go.address });
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
    return this.button(t, `panel-${id}`, icon, label, () => this.togglePanel(id))
      .when(on, (el) => el.bg(t.selected).text_color(t.foreground));
  }

  // Open this tab of the panel, or close the panel when it already shows it. An id the layout lacks does nothing.
  togglePanel(id) {
    const root = layout(), panel = find(root, "panel"), body = find(root, "panel-body");
    if (!find(body, id)) return;
    if (panel && !panel.hidden && body?.active === id) run("layout.hide", { id: "panel" });
    else { run("layout.select", { stack: "panel-body", child: id }); run("layout.show", { id: "panel" }); }
  }

  // "🔔 1 needs you · 2 done": who is waiting on you; lit while anyone is.
  // Click: see attention().
  bell(t) {
    const list = this.waiting();
    const key = keyHint(keys(), shared("layout"));
    const asking = list.filter((a) => a.status === "blocked").length, done = list.length - asking;
    const parts = [asking && `${asking} need${asking === 1 ? "s" : ""} you`, done && `${done} done`].filter(Boolean);
    const color = asking ? t.blocked : done ? t.done : t.dim;
    return h_flex().id("attention").h(20).px(6).gap(5).flex_none().items_center().rounded(5)
      .text_color(color)
      .cursor_pointer()
      .when(list.length > 0, (el) => el.bg(alpha(color, 0.12)).hover((h) => h.bg(alpha(color, 0.2))))
      .tooltip((list.length
        ? `Go to the agent waiting longest, asking first${list.length > 1 ? "; again for the next" : ""}. Shift-click: search them all.`
        : "No agent is waiting on you. Shift-click: search agents.") + (key ? ` ${key}: list` : ""))
      // Click: straight to the longest-waiting agent. Shift-click: the list, with search.
      .on_click((e) => (e?.modifiers?.shift ? this.picker() : this.attention()))
      .child(svg("mods/bar-strip/bell.svg").size(13))
      .child(parts.length ? parts.join(" · ") : "Needs you");
  }

  render() {
    const t = theme();
    const root = layout(), panel = find(root, "panel"), body = find(root, "panel-body");
    const enabled = enabledPanels(shared("workspace.panels"));
    return h_flex().size_full().px(8).gap(4).items_center().bg(t.chrome).border_b(1).border_color(t.border).text_size(11.5)
      .child(this.button(t, "search", "mods/bar-strip/search.svg", "Search", () => run("mod.open", { name: "picker" })))
      .child(this.button(t, "machine", "mods/bar-strip/server.svg", "Add machine", () => run("mod.open", { name: "machine-add" })))
      // The accent dot: an app update is downloaded and waiting (as on the sidebar's Settings).
      .child(this.button(t, "settings", "mods/bar-strip/settings.svg", "Settings", () => run("app.settings"), Boolean(updates().app.ready)))
      .child(div().flex_1())
      .child(this.bell(t))
      .when(enabled.includes("files"), (el) => el.child(this.panelButton(t, panel, body, "files", "Files", "mods/bar-strip/file.svg")))
      .when(enabled.includes("changes"), (el) => el.child(this.panelButton(t, panel, body, "changes", "Changes", "mods/bar-strip/changes.svg")));
  }
}
