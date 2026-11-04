// What a waiting agent is saying, from its screen text (hc read): for one
// that needs you, the last question on screen ("Do you want to proceed?");
// else the start of its last message (a "●" line, as Claude Code and similar
// agents draw them), skipping the tool calls drawn the same way
// ("● Bash(npm test)") unless the screen holds nothing else.
// Pure: node can run it.

// Characters that start an agent's message line.
export const MARKERS = ["●", "⏺", "•"];
// Longest text returned; the row truncates anyway, this keeps the Map small.
export const MAX_LEN = 200;

const MARKER_LINE = new RegExp(`^[${MARKERS.join("")}]\\s+(.*)$`);
const BOX = /[│┃╭╮╰╯─━┌┐└┘├┤┬┴┼═║⧉]+/g;
// Terminal escapes: CSI (colors, cursor) and OSC (titles, links).
const ANSI = /\x1b\[[0-9;?]*[ -/]*[@-~]|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g;
// "(y/n)", "[y/N]", "(yes/no)" at the end of a question.
const HINT = /\s*[[(](?:[yY](?:es)?(?:\/[nN]o?)?|[nN]o?)[\])]\s*$/;
// "Bash(npm test)", "Update(src/a.js)", "mcp__x__y(...)": a tool call, not prose.
const TOOL_CALL = /^(?:[A-Z][A-Za-z0-9]*|mcp__[\w-]+)\(.*$/;

const cap = (s) => (s.length > MAX_LEN ? `${s.slice(0, MAX_LEN - 1)}…` : s);

export function askOf(text, status) {
  const lines = String(text ?? "").replace(ANSI, "").split(/\r\n|\r|\n/)
    .map((l) => l.replace(BOX, " ").replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .slice(-40);
  if (status === "blocked") {
    for (let i = lines.length - 1; i >= 0; i--) {
      const l = lines[i].replace(/^(?:[❯>›]\s*)?(?:\d+\.\s+)?/, "");
      if (l.length > 4 && /\?$/.test(l.replace(HINT, "")) && !/^\?/.test(l)) return cap(l);
    }
  }
  let call = "";
  for (let i = lines.length - 1; i >= 0; i--) {
    const m = lines[i].match(MARKER_LINE);
    if (!m || m[1].length <= 2) continue;
    if (!TOOL_CALL.test(m[1])) return cap(m[1]);
    if (!call) call = m[1];
  }
  return cap(call);
}
