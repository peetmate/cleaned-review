/* Environment: build info, capability loader, small DOM helpers. */
window.ICL = window.ICL || {};
(function (ICL) {
  const build = window.ICL_BUILD || { version: "dev", target: "offline" };
  const hasClaude = typeof window.claude === "object" && window.claude && typeof window.claude.use === "function";
  const caps = { db: null, user: null, comments: null, downloads: null, room: null };
  let resolved = false;
  const ready = (async () => {
    if (!hasClaude) { resolved = true; return caps; }
    const names = ["db", "user", "comments", "downloads"];
    await Promise.all(names.map(async (n) => { try { caps[n] = await window.claude.use(n); } catch { caps[n] = null; } }));
    resolved = true;
    return caps;
  })();

  const h = (tag, attrs, ...children) => {
    const el = document.createElement(tag);
    if (attrs) for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === "class") el.className = v;
      else if (k === "dataset") Object.assign(el.dataset, v);
      else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
      else if (k === "html") el.innerHTML = v;
      else if (v === true) el.setAttribute(k, "");
      else el.setAttribute(k, v);
    }
    for (const c of children.flat(Infinity)) {
      if (c == null || c === false) continue;
      el.append(c instanceof Node ? c : document.createTextNode(String(c)));
    }
    return el;
  };
  const uid = (p = "id") => p + "_" + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-3);
  const fmt = (n, d = 1) => (n == null || Number.isNaN(n) ? "" : Number(n).toLocaleString("en", { maximumFractionDigits: d }));
  const toast = (msg, ms = 2600) => {
    const t = document.getElementById("toast"); if (!t) return;
    t.textContent = msg; t.hidden = false; clearTimeout(t._t); t._t = setTimeout(() => (t.hidden = true), ms);
  };
  const storage = {
    get(k, fallback) { try { const v = localStorage.getItem(k); return v == null ? fallback : JSON.parse(v); } catch { return fallback; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } },
    del(k) { try { localStorage.removeItem(k); } catch {} },
  };
  const parseNumber = (raw) => {
    // "1,5" → 1.5 with a flag; "1.234,5" → 1234.5; blank → null
    if (raw == null) return { value: null, normalised: false };
    let s = String(raw).trim().replace(/\s+/g, "");
    if (s === "") return { value: null, normalised: false };
    let normalised = false;
    if (/^-?\d{1,3}(\.\d{3})+,\d+$/.test(s)) { s = s.replace(/\./g, "").replace(",", "."); normalised = true; }
    else if (/^-?\d+,\d+$/.test(s)) { s = s.replace(",", "."); normalised = true; }
    const v = Number(s);
    return Number.isFinite(v) ? { value: v, normalised } : { value: NaN, normalised };
  };
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  /** "v0.7.0 · 29 Sep 16:42" — short enough for the header, precise to the minute. */
  const buildShort = () => {
    if (!build.semver) return build.version || "dev";
    const m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}:\d{2})$/.exec(build.stamp || "");
    if (!m) return `v${build.semver}`;
    return `v${build.semver} \u00b7 ${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[4]}`;
  };
  const buildLong = () => `${build.version || "dev"}${build.sha && build.sha !== "dev" ? " \u00b7 commit " + build.sha : ""} \u00b7 ${build.target} build`;

  ICL.env = { build, hasClaude, caps, ready, isResolved: () => resolved };
  ICL.buildShort = buildShort; ICL.buildLong = buildLong;

  /** Save a text file: the runtime's downloads capability when present, a link offline, a copy box as a last resort. */
  ICL.download = async function (filename, data, mime) {
    const dl = caps.downloads;
    if (dl) { try { await dl.save({ filename, data }); ICL.toast("Saved."); return true; } catch (e) { if (e && e.code === "declined") return false; } }
    if (!hasClaude) {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([data], { type: mime || "text/plain" }));
      a.download = filename; document.body.append(a); a.click(); a.remove();
      return true;
    }
    const ta = h("textarea", { style: "width:100%;height:220px", readonly: true }, data);
    const box = h("div", { class: "card" }, h("p", null, `Copy the contents of ${filename}:`), ta,
      h("button", { type: "button", class: "btn-sm", onclick: () => navigator.clipboard.writeText(data).then(() => ICL.toast("Copied."), () => ta.select()) }, "Copy"));
    document.getElementById("screen").prepend(box);
    return true;
  };
  ICL.h = h; ICL.uid = uid; ICL.fmt = fmt; ICL.toast = toast; ICL.storage = storage; ICL.parseNumber = parseNumber;
  ICL.MONTHS = MONTHS; ICL.MONTH_DAYS = MONTH_DAYS;
})(window.ICL);
