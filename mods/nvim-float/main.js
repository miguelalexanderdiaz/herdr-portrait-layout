// The title bar of a floating nvim opened from the Files panel (portrait-files),
// and its "Keep" menu (the same mod, opened as a popup with `menu: true`).
//
// Bar props:  { terminal, socket, file, space, on, overlay }   (overlay = the window)
// Menu props: { menu: true, window, terminal, socket, file, space, on, overlay }
//
// Keep → New tab: the float's terminal becomes a tab (terminal.keep).
// Keep → Add to <nvim tab>: its file opens as a buffer in that kept nvim, the tab
//   gets focus, and the float's nvim quits (":confirm qa" asks first if unsaved).
// ✕: the float's nvim quits the same way; the window closes when its terminal ends.

import { View, div, svg, image } from "gpui-kit";
import { h_flex, v_flex } from "gpui-base";
import { props, run, theme, terminals, panes, spaces, exec, openOverlay, closeOverlay, notify, settings } from "herdr";

const MENU_W = 280;
const clean = (s) => (s ?? "").replace(/^[^\p{L}\p{N}.]+/u, "").trim();

// nvim through the login shell (the app's own PATH lacks Homebrew), on the
// space's machine. `script` sees its extra arguments as $0, $1, ...
async function nvim(on, script, ...rest) {
  return exec("sh", ["-c", `exec "\${SHELL:-sh}" -lc '${script}' "$@"`, "sh", ...rest], { on: on || undefined });
}
const QUIT = 'exec nvim --server "$0" --remote-send "<C-\\\\><C-N>:confirm qa<CR>"';

function icon(program, t) {
  if (!program?.icon) return div().w(14).flex_none();
  return program.tint ? svg(program.icon).size(14).flex_none().text_color(t.muted) : image(program.icon).w(14).h(14).flex_none();
}

// nvims from the Files panel kept as tabs in this space (not this float):
// [{ pane, socket, label }], label = "tab (file it shows)".
function keptEditors(spaceId, self) {
  const space = spaces().find((s) => s.id === spaceId);
  if (!space) return [];
  const tabName = new Map((space.tabs ?? []).map((t) => [t.id, t.named ? t.name : `Tab ${t.index}`]));
  const live = new Map(terminals().filter((t) => t.state === "live" && t.labels?.["editor.socket"] && t.address !== self)
    .map((t) => [t.address, t]));
  return panes().filter((p) => tabName.has(p.tab) && p.terminal && live.has(p.terminal.split("/").pop()))
    .map((p) => {
      const t = live.get(p.terminal.split("/").pop());
      const file = clean(t.title) || (t.labels["editor.file"] ?? "").split("/").pop();
      return { pane: p.pane, socket: t.labels["editor.socket"], label: `${tabName.get(p.tab)}  (${file})` };
    });
}

export default class NvimFloat extends View {
  render() {
    const p = props() ?? {};
    if (!p.terminal) return div();
    return p.menu ? this.menu(p) : this.bar(p);
  }

  bar(p) {
    const t = theme();
    const term = terminals().find((x) => x.address === p.terminal);
    const title = clean(term?.title) || (p.file ?? "").split("/").pop() || "nvim";
    const folder = (p.file ?? "").slice(0, (p.file ?? "").lastIndexOf("/"));
    const stop = (_e, cx) => cx.stop_propagation();
    const button = (id, child, action) => h_flex().id(id).h(22).px(8).gap(5).flex_none().items_center().rounded(5)
      .cursor_pointer().text_color(t.muted).hover((el) => el.bg(t.hover).text_color(t.foreground))
      .on_mouse_down("left", stop).on_click(action).child(child);
    // Presses the buttons don't stop drag the window.
    return h_flex().id("nvim-bar").size_full().px(10).gap(8).items_center().bg(t.chrome).border_b(1).border_color(t.border)
      .text_size(12.5).text_color(t.foreground)
      .child(icon(term?.program, t))
      .child(div().flex_none().font_medium().child(title))
      .child(div().flex_1().min_w(0).overflow_hidden().whitespace_nowrap().text_ellipsis_start().text_size(11.5).text_color(t.dim)
        .child(folder.replace(/^\/Users\/[^/]+/, "~")))
      // The menu opens under the button, right edges lined up. Event positions are
      // window px; overlay positions are at zoom 1, hence the division.
      .child(button("nvim-keep", h_flex().gap(4).items_center().child("Keep").child(svg("mods/workspace-chrome/chevron-down.svg").size(11)), () => {
        const z = Number(settings().zoom) || 1, b = this.keepAt;
        const at = b ? { x: Math.max(0, (b.x + b.width) / z - MENU_W), y: (b.y + b.height) / z + 4 } : "pointer";
        openOverlay({ mod: "nvim-float", kind: "popup", width: MENU_W, at, props: { ...p, menu: true, window: p.overlay } });
      }).on_mouse_down("left", (e, cx) => { cx.stop_propagation(); this.keepAt = e.bounds ?? (e.position ? { ...e.position, width: 0, height: 0 } : null); }))
      .child(button("nvim-close", svg("mods/pane/close.svg").size(13), (_e, cx) =>
        cx.spawn(async () => { await nvim(p.on, QUIT, p.socket).catch(() => {}); })));
  }

  menu(p) {
    const t = theme();
    const kept = keptEditors(p.space, p.terminal);
    const item = (id, label, hint, action) => v_flex().id(id).px(10).py(6).rounded(6).cursor_pointer()
      .hover((el) => el.bg(t.hover)).on_click(action)
      .child(div().text_size(12.5).text_color(t.foreground).child(label))
      .when(Boolean(hint), (el) => el.child(div().text_size(11).text_color(t.dim).child(hint)));
    return v_flex().id("nvim-menu").w_full().p(4).gap(1).bg(t.raised)
      .child(item("keep-tab", "New tab", "Keep this nvim as its own tab", () => {
        run("terminal.keep", { terminal: p.terminal, place: "tab" });
        closeOverlay(p.overlay);
        closeOverlay(p.window);
      }))
      // The popup closes only at the end: closing it first would stop this work.
      .children(kept.map((k, i) => item(`keep-add-${i}`, `Add to ${k.label}`, "Open this file there as a buffer", (_e, cx) => {
        if (this.busy) return;
        this.busy = true;
        cx.spawn(async () => {
          // The file the float shows now (it may have moved on from the one clicked).
          const cur = await nvim(p.on, 'exec nvim --server "$0" --remote-expr "expand(\\"%:p\\")"', p.socket).catch(() => null);
          const file = (cur?.code === 0 && cur.stdout.trim()) || p.file;
          const r = await nvim(p.on, 'exec nvim --server "$0" --remote "$1"', k.socket, file).catch((e) => ({ code: 1, stderr: String(e) }));
          if (r.code !== 0) {
            notify({ title: "Couldn't add to nvim", body: r.stderr || "nvim --remote failed", level: "error" });
            this.busy = false; closeOverlay(p.overlay); return;
          }
          run("pane.focus", { pane: k.pane });
          await nvim(p.on, QUIT, p.socket).catch(() => {});
          closeOverlay(p.overlay);
        });
      })))
      .when(kept.length === 0, (el) => el.child(div().px(10).py(6).text_size(11).text_color(t.dim).child("No nvim tab in this space to add to")));
  }
}
