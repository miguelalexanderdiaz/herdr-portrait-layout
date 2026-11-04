// What a waiting agent is saying, from its screen text (hc read): for one
// that needs you, the last question on screen ("Do you want to proceed?");
// else the start of its last message (a "●" line, as Claude Code and others
// draw them). Pure: node can run it.

const BOX = /[│┃╭╮╰╯─━┌┐└┘├┤┬┴┼═║⧉]+/g;

export function askOf(text, status) {
  const lines = String(text ?? "").split("\n")
    .map((l) => l.replace(BOX, " ").replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .slice(-40);
  if (status === "blocked") {
    for (let i = lines.length - 1; i >= 0; i--) {
      const l = lines[i].replace(/^(?:[❯>›]\s*)?(?:\d+\.\s+)?/, "");
      if (l.length > 4 && /\?$/.test(l) && !/^\?/.test(l)) return l;
    }
  }
  for (let i = lines.length - 1; i >= 0; i--) {
    const m = lines[i].match(/^[●⏺•]\s+(.*)$/);
    if (m && m[1].length > 2) return m[1];
  }
  return "";
}
