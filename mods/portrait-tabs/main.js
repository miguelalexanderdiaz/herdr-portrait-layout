import { View, div, svg, image } from "gpui-kit";
import { h_flex } from "gpui-base";
import { spaces, machines, panes, run, openOverlay, theme, window, shared, layout, settings } from "herdr";
import { safeStorage, readJson, writeJson, isPanels, prunePanels, find, enabledPanels, wheelStream, WHEEL_STEP } from "./logic.mjs";

export default class Tabs extends View {
  init() {
    this.pressed = null;
    this.store = safeStorage(() => localStorage);
    this.panels = readJson(this.store, "panels", {}, isPanels);
    this.wheel = null;
  }

  // Portrait copy: the Files / Changes buttons live in the bar's top strip
  // (mods/bar-strip); this copy still remembers the panel per space.

  // The side panel is remembered per space: switching shows that space's choice
  // (closed if it never had one), and opening or closing it records it.
  syncPanel(space, panel, body, enabled) {
    if (!space || !panel) return;
    const now = panel.hidden ? null : body?.active ?? null;
    if (space.id !== this.space) {
      const first = this.space === undefined;
      this.space = space.id; this.pending = null;
      if (!(first && !(space.id in this.panels))) {
        const stored = this.panels[space.id] ?? null, want = enabled.includes(stored) ? stored : null;
        if (want !== now) {
          this.pending = { want, until: Date.now() + 1000 };
          if (want) { run("layout.select", { stack: "panel-body", child: want }); run("layout.show", { id: "panel" }); }
          else run("layout.hide", { id: "panel" });
          return;
        }
      }
    }
    // Until the restore lands (or something else won), the old state isn't a choice.
    if (this.pending) {
      if (this.pending.want !== now && Date.now() < this.pending.until) return;
      this.pending = null;
    }
    if (this.panels[space.id] === now) return;
    this.panels[space.id] = now;
    writeJson(this.store, "panels", this.panels);
  }

  render() {
    const t = theme();
    const all = spaces(), space = all.find(p => p.active);
    // Spaces that are gone lose their remembered panel (not while the list is empty or their machine is not ready).
    const kept = prunePanels(this.panels, all, machines());
    if (kept !== this.panels) { this.panels = kept; writeJson(this.store, "panels", kept); }
    const shown = space?.tabs ?? [];
    const stop = (_e, cx) => cx.stop_propagation();
    const button = (id, label, action) => div().id(id).size(26).flex_none().flex().items_center().justify_center().rounded(6).text_color(t.dim).hover(s => s.bg(t.hover).text_color(t.foreground))
      .on_mouse_down("left", stop).on_click(action).child(label);
    const allPanes = panes(); // marshals every pane: once per render, not once per tab
    const item = (c, i) => {
      const mine = allPanes.filter(p => p.tab === c.id);
      const program = (mine.find(p => p.program?.agent) ?? mine[0])?.program;
      const name = /^tb\d+$/.test(c.name) ? program?.name ?? "Terminal" : c.name;
      return h_flex().id(`tab-${c.id}`).h(29).px(10).gap(7).rounded(7).items_center().flex_none().text_size(12.8)
        .border(1).border_color(c.active ? t.border : t.chrome).bg(c.active ? t.raised : t.chrome).text_color(c.active ? t.foreground : t.muted)
        .hover(s => s.bg(t.hover))
        .on_mouse_down("left", (e, cx) => { cx.stop_propagation(); this.pressed = i; if (e.click_count === 2) run("tab.rename", { id: c.id }); })
        .on_mouse_up("left", () => {
          const from = this.pressed; this.pressed = null;
          if (from !== null && from !== i && shown[from]) run("tab.move", { id: shown[from]?.id, index: space.tabs.findIndex(x => x.id === c.id) + 1 });
          else run("tab.select", { id: c.id });
        })
        .on_mouse_down("right", (_e, cx) => { cx.stop_propagation(); openOverlay({ mod: "menu", kind: "popup", width: 200, props: { tab: "tab", target: { id: c.id, space: space.id } } }); })
        .when(Boolean(program?.icon), el => el.child(program.tint ? svg(program.icon).size(14).text_color(t.muted) : image(program.icon).size(14)))
        .child(div().max_w(170).truncate().child(c.zoomed ? `${name} Z` : name))
        .when(c.status === "working", el => el.child(svg("mods/portrait-tabs/spinner.svg").size(12).flex_none().text_color(t.working).spin(900)))
        .when(c.status === "blocked" || c.status === "done", el => el.child(div().size(6).rounded(3).bg(t[c.status])))
        .when(c.active, el => el.child(div().id(`close-${c.id}`).text_color(t.dim).on_mouse_down("left", stop).on_click((_e, cx) => { cx.stop_propagation(); run("tab.close", { id: c.id }); }).child(svg("mods/portrait-tabs/close.svg").size(12))));
    };
    const root = layout(), sidebar = find(root, "sidebar"), w = window();
    // Old saved rails and a dragged-narrow sidebar can be smaller than the window buttons.
    const lightsPadding = w?.platform === "macos" && w.titlebar === "none" && !w.fullscreen && root?.traffic_lights
      ? Math.max(10, (root.traffic_lights[0] + 64) / (Number(settings().zoom) || 1) - (sidebar?.hidden ? 0 : sidebar?.size?.px ?? 0))
      : 10;
    const panel = find(root, "panel"), body = find(root, "panel-body");
    const enabled = enabledPanels(shared("workspace.panels"));
    this.syncPanel(space, panel, body, enabled);
    return h_flex().size_full().min_w(0).px(10).pl(lightsPadding).gap(3).items_center().bg(t.chrome).border_b(1).border_color(t.border)
      .on_mouse_up("left", () => { this.pressed = null; })
      .on_scroll_wheel(e => {
        // A mouse wheel notch is one tab. A swipe with inertia sends dozens of pixel events: one tab
        // per WHEEL_STEP px, at most 3 at once.
        if (!(e.delta?.y ?? 0)) return;
        this.wheel = wheelStream(this.wheel, e, "y", Date.now(), WHEEL_STEP);
        for (let n = Math.min(3, Math.abs(this.wheel.steps)); n > 0; n--) run(this.wheel.steps > 0 ? "tab.prev" : "tab.next");
      })
      .child(h_flex().id("tab-scroll").flex_1().min_w(0).h_full().items_center().gap(3).overflow_x_scrollbar().children(shown.map(item)))
      .child(button("tab-new", "+", () => openOverlay({ mod: "new-menu", kind: "popup", width: 250, height: 512 })))
      .when(w?.buttons, el => el.child(button("minimize", w.platform === "windows" ? svg("mods/portrait-tabs/win-min.svg").size(16) : "−", () => run("window.minimize")))
        .child(button("maximize", w.platform === "windows" ? svg(`mods/portrait-tabs/${w.maximized ? "win-restore" : "win-max"}.svg`).size(16) : "□", () => run("window.maximize")))
        .child(button("close-window", w.platform === "windows" ? svg("mods/portrait-tabs/win-close.svg").size(16) : svg("mods/portrait-tabs/close.svg").size(13), () => run("window.close"))));
  }
}
