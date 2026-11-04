// The site's two small behaviours. Nothing is loaded, sent or stored; the page reads the same without it.
//   - A feature picture ([data-motion]) gets "play" the first time half of it is on screen, which starts its CSS
//     animation (assets/site.css, "home page pictures"), and "run" while it stays there; it pauses when it leaves.
//     Nothing moves when the system asks for reduced motion: the picture keeps its still frame.
//   - A copy button (button[data-copy], on the home and install pages) copies the command in the cell it sits in.
(() => {
  "use strict";
  const reduce = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : { matches: false };
  const shots = [...document.querySelectorAll("[data-motion]")];

  const stop = () => shots.forEach((s) => s.classList.remove("play", "run"));
  if ("IntersectionObserver" in window && shots.length) {
    const seen = new IntersectionObserver((entries) => {
      for (const e of entries) {
        const on = e.isIntersecting && e.intersectionRatio >= 0.5 && !reduce.matches;
        if (on) e.target.classList.add("play");
        e.target.classList.toggle("run", on);
      }
    }, { threshold: [0, 0.5] });
    shots.forEach((s) => seen.observe(s));
    if (reduce.addEventListener) reduce.addEventListener("change", () => { if (reduce.matches) stop(); });
  }

  for (const button of document.querySelectorAll("button[data-copy]")) {
    const source = document.getElementById(button.dataset.copy);
    if (!source || !navigator.clipboard) continue;
    const label = button.textContent;
    let timer = 0;
    button.hidden = false;
    button.addEventListener("click", () => {
      navigator.clipboard.writeText(source.textContent.trim()).then(() => {
        button.textContent = "Copied";
        clearTimeout(timer);
        timer = setTimeout(() => { button.textContent = label; }, 2000);
      }, () => {
        // No clipboard access (an insecure page, a denied permission): select the line so it can be copied by hand.
        const range = document.createRange();
        range.selectNodeContents(source);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
      });
    });
  }
})();
