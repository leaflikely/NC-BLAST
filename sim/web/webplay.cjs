// NC BLAST simulator, in-browser edition: a small stand-in for the parts of Playwright the robots use.
// Instead of remote-controlling separate Chrome windows, each "device" is an iframe (a window inside the
// page) showing a copy of the app. The robots give the same instructions as before (tap, fill, evaluate,
// reload...) and this file carries them out on the iframe.
//
// How a frame is kept safe: it is loaded from robots/frame.html, which is blank. We then write the app's own
// page into it, with a "shim" placed first. The shim gives the frame its own pretend storage (so judges do
// not share logins), sends every outside request to the pretend Worker (or, for MatchMason brackets, the real
// one), and stops the app from navigating away on its own (a reload is redone through us, so it is never
// loaded without the shim).

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── runs INSIDE each frame, before the app starts ────────────────────────────
function frameShim(id) {
  const sim = window.parent.__sim;
  const dev = sim.devs[id];
  // Pretend storage: lives in the parent, so it survives a reload of the frame (like a phone's storage).
  const mkStorage = map => new Proxy({}, {
    get(_, p) {
      if (p === "getItem") return k => (map.has(String(k)) ? map.get(String(k)) : null);
      if (p === "setItem") return (k, v) => { map.set(String(k), String(v)); };
      if (p === "removeItem") return k => { map.delete(String(k)); };
      if (p === "clear") return () => map.clear();
      if (p === "key") return i => [...map.keys()][i] ?? null;
      if (p === "length") return map.size;
      if (typeof p === "symbol") return undefined;
      return map.has(p) ? map.get(p) : undefined;
    },
    set(_, p, v) { map.set(String(p), String(v)); return true; },
    deleteProperty(_, p) { map.delete(String(p)); return true; },
    has(_, p) { return map.has(String(p)); },
    ownKeys() { return [...map.keys()]; },
    getOwnPropertyDescriptor(_, p) { return map.has(String(p)) ? { value: map.get(String(p)), enumerable: true, configurable: true, writable: true } : undefined; },
  });
  const L = mkStorage(sim.stores[id].local), S = mkStorage(sim.stores[id].session);
  Object.defineProperty(window, "localStorage", { configurable: true, get: () => L });
  Object.defineProperty(window, "sessionStorage", { configurable: true, get: () => S });

  // Every outside request goes through the parent.
  window.fetch = async function (input, init) {
    const isReq = typeof Request !== "undefined" && input instanceof Request;
    const url = new URL(isReq ? input.url : String(input), location.href).href;
    const method = String((init && init.method) || (isReq && input.method) || "GET").toUpperCase();
    let body = null;
    if (init && init.body != null) body = typeof init.body === "string" ? init.body : await new Response(init.body).text();
    else if (isReq && method !== "GET" && method !== "HEAD") body = await input.clone().text();
    const headers = {};
    const addH = h => { if (!h) return; new Headers(h).forEach((v, k) => { headers[k] = v; }); };
    if (isReq) addH(input.headers);
    if (init) addH(init.headers);
    return sim.route(id, { method, url, body, headers });
  };
  if (navigator.sendBeacon) navigator.sendBeacon = function (url, data) {
    new Response(data).text().then(t => sim.route(id, { method: "POST", url: new URL(url, location.href).href, body: t, headers: { "content-type": "text/plain" } })).catch(() => {});
    return true;
  };

  // Crashes and error messages, like a Playwright "pageerror" / console error.
  window.addEventListener("error", e => dev.errors.push(String(e.message || e.error || e).slice(0, 400)));
  window.addEventListener("unhandledrejection", e => dev.errors.push(String((e.reason && e.reason.message) || e.reason || "unhandled rejection").slice(0, 400)));
  const ce = console.error.bind(console);
  console.error = function (...a) { try { dev.consoleErrors.push(a.map(x => (x && x.message) || String(x)).join(" ").slice(0, 400)); } catch (_) {} return ce(...a); };
  // Pop-ups are answered "OK", like the robots' browser did.
  window.alert = m => { dev.lastDialog = String(m); };
  window.confirm = m => { dev.lastDialog = String(m); return true; };
  window.prompt = (m, d) => { dev.lastDialog = String(m); return d || ""; };

  // The app must never leave through its own navigation (for example to reload itself): redo it through us.
  if (window.navigation) {
    window.navigation.addEventListener("navigate", e => {
      if (e.destination && e.destination.sameDocument) return;
      if (e.cancelable) { e.preventDefault(); sim.navigate(id, e.destination.url); }
    });
  } else {
    dev.errors.push("This browser has no Navigation API (use Chrome): a self-reload could not be kept inside the simulator.");
  }
}

// ── element handles, locators and the page ──────────────────────────────────

function isVisible(el) {
  const win = el.ownerDocument.defaultView;
  if (!el.isConnected) return false;
  const r = el.getBoundingClientRect();
  if (r.width <= 0 || r.height <= 0) return false;
  return win.getComputedStyle(el).visibility !== "hidden";
}
function isEnabled(el) {
  return !el.disabled && !el.closest("fieldset[disabled]") && el.getAttribute("aria-disabled") !== "true";
}

// Playwright lets a selector end in " >> nth=2" (the third match). Everything else is plain CSS.
function queryAll(roots, sel) {
  const m = /^(.*?)\s*>>\s*nth=(\d+)\s*$/.exec(sel);
  const css = m ? m[1] : sel;
  let found = [];
  roots.forEach(r => found.push(...r.querySelectorAll(css)));
  found = [...new Set(found)];
  return m ? found.slice(+m[2], +m[2] + 1) : found;
}

class ElementHandle {
  constructor(el) { this.el = el; }
  asElement() { return this; }
  async isVisible() { return isVisible(this.el); }
  async isEnabled() { return isEnabled(this.el); }
  async innerText() { return this.el.innerText; }
  async getAttribute(n) { return this.el.getAttribute(n); }
  async scrollIntoViewIfNeeded() {
    const r = this.el.getBoundingClientRect(), win = this.el.ownerDocument.defaultView;
    if (r.top < 0 || r.bottom > win.innerHeight || r.left < 0 || r.right > win.innerWidth) this.el.scrollIntoView({ block: "center", inline: "center" });
  }
  async click(opts = {}) {
    const el = this.el, doc = el.ownerDocument, win = doc.defaultView;
    const end = Date.now() + (opts.timeout === undefined ? 30000 : opts.timeout);
    let why = "";
    for (;;) {
      if (!el.isConnected) throw new Error("click: element is no longer on the page");
      if (opts.force || (isVisible(el) && isEnabled(el))) {
        await this.scrollIntoViewIfNeeded();
        const r = el.getBoundingClientRect();
        const x = r.left + r.width / 2, y = r.top + r.height / 2;
        const top = doc.elementFromPoint(x, y);
        if (opts.force || (top && (top === el || el.contains(top) || top.contains(el)))) {
          const m = (type, C = win.MouseEvent) => new C(type, { bubbles: true, cancelable: true, composed: true, view: win, clientX: x, clientY: y, button: 0, buttons: type.endsWith("down") ? 1 : 0, pointerType: "mouse", isPrimary: true, detail: type === "click" ? 1 : 0 });
          const P = win.PointerEvent || win.MouseEvent;
          const t = top || el;
          t.dispatchEvent(m("pointerover", P)); t.dispatchEvent(m("mouseover"));
          t.dispatchEvent(m("pointermove", P)); t.dispatchEvent(m("mousemove"));
          t.dispatchEvent(m("pointerdown", P)); t.dispatchEvent(m("mousedown"));
          try { (el.matches("input,textarea,select,button,[tabindex],a[href]") ? el : t).focus(); } catch (_) {}
          t.dispatchEvent(m("pointerup", P)); t.dispatchEvent(m("mouseup"));
          t.dispatchEvent(m("click"));
          return;
        }
        why = "another element is on top of it";
      } else why = !isVisible(el) ? "it is not visible" : "it is disabled";
      if (Date.now() > end) throw new Error("click timed out: " + why);
      await sleep(30);
    }
  }
}

class JSHandle {
  constructor(v) { this.v = v; }
  asElement() { return this.v && this.v.nodeType === 1 ? new ElementHandle(this.v) : null; }
}

// A set of elements found by selectors (searched again each time it is used, like Playwright's locators).
class Locator {
  constructor(page, steps) { this.page = page; this.steps = steps; }   // steps: [{sel, hasText, nth}] or [{els}]
  locator(sel, opts = {}) { return new Locator(this.page, [...this.steps, { sel, hasText: opts.hasText }]); }
  first() { return new Locator(this.page, [...this.steps.slice(0, -1), { ...this.steps[this.steps.length - 1], nth: 0 }]); }
  resolve() {
    let scope = [this.page.doc];
    for (const st of this.steps) {
      if (st.els) { scope = st.els; continue; }
      let found = queryAll(scope, st.sel);
      if (st.hasText != null) { const t = String(st.hasText).toLowerCase(); found = found.filter(e => (e.textContent || "").toLowerCase().includes(t)); }
      if (st.nth != null) found = found.slice(st.nth, st.nth + 1);
      scope = found;
    }
    return scope;
  }
  async all() { return this.resolve().map(e => new Locator(this.page, [{ els: [e] }])); }
  async waitOne(timeout) {
    const end = Date.now() + timeout;
    for (;;) {
      const r = this.resolve();
      if (r.length) return r[0];
      if (Date.now() > end) throw new Error("locator found nothing: " + this.steps.map(s => s.sel || "(element)").join(" >> "));
      await sleep(30);
    }
  }
  async click(opts = {}) { const t = opts.timeout === undefined ? 5000 : opts.timeout; const el = await this.waitOne(t); return new ElementHandle(el).click({ ...opts, timeout: t }); }
  async isEnabled() { const el = await this.waitOne(500); return isEnabled(el); }
  async isVisible() { const r = this.resolve(); return r.length > 0 && isVisible(r[0]); }
  async count() { return this.resolve().length; }
  async innerText() { const el = await this.waitOne(500); return el.innerText; }
  nth(n) { return new Locator(this.page, [...this.steps.slice(0, -1), { ...this.steps[this.steps.length - 1], nth: n }]); }
}

class Page {
  constructor(dev, iframe) {
    this.dev = dev; this.iframe = iframe; this.loading = false; this.url = null;
  }
  get win() { return this.iframe.contentWindow; }
  get doc() { return this.iframe.contentWindow.document; }

  async goto(url) { await this._load(url); }
  async reload() { await this._load(this.url); }
  async _load(url) {
    const u = new URL(url, location.origin);
    if (u.origin !== location.origin) throw new Error("The in-browser simulator can only open pages on this site, not " + u.origin);
    this.url = u.pathname + u.search + u.hash;
    this.loading = true;
    try {
      // 1. a blank page of our own, 2. give it the app's address, 3. write the app's page into it, shim first
      if (this.freshFrame) this.freshFrame();   // a brand-new frame each time, so nothing of the old page can interfere
      await new Promise(res => { const f = () => { this.iframe.removeEventListener("load", f); res(); }; this.iframe.addEventListener("load", f); this.iframe.src = "frame.html?" + Date.now(); });
      const src = u.pathname.replace(/\/+$/, "") === "/overlay" ? "/overlay.html" : u.pathname === "/" || u.pathname === "" ? "/index.html" : u.pathname;
      const res = await fetch(src, { cache: "no-cache" });
      if (!res.ok) throw new Error("Could not load " + src + " (HTTP " + res.status + ")");
      let html = await res.text();
      const inject = `<base href="/"><script>(${frameShim.toString()})(${JSON.stringify(this.dev.id)});</script>`;
      html = /<head[^>]*>/i.test(html) ? html.replace(/<head[^>]*>/i, m => m + inject) : inject + html;
      this.win.history.replaceState(null, "", this.url);
      this.win.__boot(html);
      for (let i = 0; i < 400; i++) { await sleep(25); if (this.doc.readyState === "complete" && this.doc.body) break; }
    } finally { this.loading = false; }
  }
  async waitForLoadState() { while (this.loading) await sleep(25); }
  async waitForTimeout(ms) { await sleep(ms); }
  async screenshot() { return null; }   // (no pictures in the in-browser edition)

  _unwrap(a) {
    if (a instanceof ElementHandle) return a.el;
    if (Array.isArray(a)) return a.map(x => this._unwrap(x));
    return a;
  }
  _fn(fn) {
    if (this.loading) throw new Error("Execution context was destroyed, most likely because of a navigation");
    if (!this.doc || !this.doc.body) throw new Error("Cannot read properties of null (page is loading)");
    return typeof fn === "string" ? this.win.eval(fn) : this.win.eval("(" + fn.toString() + ")");
  }
  async evaluate(fn, arg) {
    const f = this._fn(fn);
    return typeof fn === "string" ? f : f(this._unwrap(arg));
  }
  async evaluateHandle(fn, arg) { return new JSHandle(await this.evaluate(fn, arg)); }
  async $(sel) { const e = queryAll([this.doc], sel)[0]; return e ? new ElementHandle(e) : null; }
  async $$(sel) { return queryAll([this.doc], sel).map(e => new ElementHandle(e)); }
  async $$eval(sel, fn, arg) { const f = this._fn(fn); return f(queryAll([this.doc], sel), arg); }
  locator(sel, opts = {}) { return new Locator(this, [{ sel, hasText: opts.hasText }]); }
  async click(sel, opts = {}) { return this.locator(sel).first().click(opts); }
  async fill(sel, value) {
    const el = await this.locator(sel).first().waitOne(5000);
    const win = this.win;
    el.focus();
    const proto = el instanceof win.HTMLTextAreaElement ? win.HTMLTextAreaElement.prototype : win.HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value").set.call(el, value);
    el.dispatchEvent(new win.InputEvent("input", { bubbles: true, inputType: "insertText", data: value }));
    el.dispatchEvent(new win.Event("change", { bubbles: true }));
  }
  async press(sel, key) {
    const el = await this.locator(sel).first().waitOne(5000);
    const win = this.win;
    const codes = { Enter: 13, Escape: 27, Tab: 9 };
    const init = { key, code: key, keyCode: codes[key] || 0, which: codes[key] || 0, bubbles: true, cancelable: true };
    el.focus();
    el.dispatchEvent(new win.KeyboardEvent("keydown", init));
    el.dispatchEvent(new win.KeyboardEvent("keypress", init));
    el.dispatchEvent(new win.KeyboardEvent("keyup", init));
  }
}

module.exports = { Page, ElementHandle, Locator, frameShim };
