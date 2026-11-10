// NC BLAST simulator: small helpers for finding and tapping things on screen.
// The app draws some labels in unusual ways (text split into <span>s, or a CSS data-label),
// so these helpers compare the text a person would SEE, not the raw page code.

// Text of a button as a person reads it: inner text, else data-label/aria-label, with spaces tidied.
const SEEN_TEXT = `
  (el) => {
    let t = (el.innerText || "").replace(/\\s+/g, " ").trim();
    if (!t) {
      const parts = [...el.querySelectorAll("[data-label]")].map(x => x.getAttribute("data-label"));
      t = (parts.length ? parts.join(" ") : (el.getAttribute("aria-label") || el.textContent || "")).replace(/\\s+/g, " ").trim();
    }
    return t;
  }`;

function visibleButtonsFn() {
  return `(() => {
    const seen = ${SEEN_TEXT};
    return [...document.querySelectorAll("button,[role=button]")]
      .filter(b => b.offsetParent !== null || getComputedStyle(b).position === "fixed")
      .map(b => ({ el: b, text: seen(b), disabled: !!b.disabled }));
  })()`;
}

// Returns a handle to the first visible, enabled button whose seen text matches.
// match: a string (exact), a RegExp, or a function(text) => bool.
async function findButton(page, match, opts = {}) {
  const src = typeof match === "string" ? { kind: "exact", v: match }
    : match instanceof RegExp ? { kind: "re", v: match.source, f: match.flags }
    : null;
  if (!src) throw new Error("findButton: use a string or RegExp");
  const h = await page.evaluateHandle(([src, allowDisabled, fn]) => {
    const list = eval(fn);
    const ok = t => src.kind === "exact" ? t === src.v : new RegExp(src.v, src.f).test(t);
    const hit = list.find(b => ok(b.text) && (allowDisabled || !b.disabled));
    return hit ? hit.el : null;
  }, [src, !!opts.allowDisabled, visibleButtonsFn()]);
  const el = h.asElement();
  return el;
}

async function tap(page, match, opts = {}) {
  const timeout = opts.timeout === undefined ? 8000 : opts.timeout;
  const end = Date.now() + timeout;
  for (;;) {
    const el = await findButton(page, match, opts);
    if (el) {
      try {
        await el.scrollIntoViewIfNeeded({ timeout: 2000 }).catch(() => {});
        await el.click({ timeout: 3000 });
        return true;
      } catch (e) {
        if (Date.now() > end) throw new Error("Could not tap \"" + match + "\": " + String(e.message).split("\n")[0]);
      }
    } else if (Date.now() > end) {
      if (opts.optional) return false;
      const seen = await buttons(page);
      throw new Error("No button \"" + match + "\" on screen. Buttons: " + seen.slice(0, 40).join(" | "));
    }
    await page.waitForTimeout(150);
  }
}

async function buttons(page) {
  return page.evaluate(fn => eval(fn).filter(b => !b.disabled).map(b => b.text).filter(Boolean), visibleButtonsFn());
}

async function screenText(page) {
  return page.evaluate(() => (document.body.innerText || "").replace(/[ \t]+/g, " "));
}

async function waitForText(page, re, timeout = 8000) {
  const end = Date.now() + timeout;
  for (;;) {
    const t = await screenText(page);
    if (re.test(t)) return t;
    if (Date.now() > end) throw new Error("Timed out waiting for " + re + ". Screen starts: " + t.replace(/\n+/g, " / ").slice(0, 300));
    await page.waitForTimeout(150);
  }
}

module.exports = { tap, findButton, buttons, screenText, waitForText };

// Taps a button in the left ("p1") or right ("p2") half of the screen. The score pad shows
// the same finish buttons twice, one column per player.
async function tapSide(page, side, match, opts = {}) {
  const timeout = opts.timeout === undefined ? 6000 : opts.timeout;
  const end = Date.now() + timeout;
  const src = typeof match === "string" ? { kind: "exact", v: match } : { kind: "re", v: match.source, f: match.flags };
  for (;;) {
    const h = await page.evaluateHandle(([src, side, fn]) => {
      const list = eval(fn);
      const ok = t => src.kind === "exact" ? t === src.v : new RegExp(src.v, src.f).test(t);
      const hits = list.filter(b => ok(b.text) && !b.disabled).map(b => ({ b, x: b.el.getBoundingClientRect().left + b.el.getBoundingClientRect().width / 2 }));
      if (!hits.length) return null;
      hits.sort((a, c) => a.x - c.x);
      if (hits.length === 1) return hits[0].b.el; // only one of them: use it
      return (side === "p1" ? hits[0] : hits[hits.length - 1]).b.el;
    }, [src, side, visibleButtonsFn()]);
    const el = h.asElement();
    if (el) { await el.click({ timeout: 3000, force: !!opts.force }); return true; }
    if (Date.now() > end) {
      if (opts.optional) return false;
      throw new Error("No \"" + match + "\" button for " + side + ". Buttons: " + (await buttons(page)).slice(0, 30).join(" | "));
    }
    await page.waitForTimeout(150);
  }
}
module.exports.tapSide = tapSide;
