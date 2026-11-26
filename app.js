import { firebaseConfig, USER_DOMAIN } from "./config.js?v=4";

const V = "10.14.1";
const [{ initializeApp }, db, auth] = await Promise.all([
  import(`https://www.gstatic.com/firebasejs/${V}/firebase-app.js`),
  import(`https://www.gstatic.com/firebasejs/${V}/firebase-database.js`),
  import(`https://www.gstatic.com/firebasejs/${V}/firebase-auth.js`),
]);
const app = initializeApp(firebaseConfig);
const database = db.getDatabase(app);
const fbAuth = auth.getAuth(app);

const $ = (s) => document.querySelector(s);
const RING = 2 * Math.PI * 52;
const setView = (v) => { document.body.dataset.view = v; };

/* ───────────── Sesión ───────────── */

const form = $("#loginForm");
const loginError = $("#loginError");
const loginBtn = $("#loginBtn");

const toEmail = (u) => {
  u = u.trim().toLowerCase();
  return u.includes("@") ? u : `${u}@${USER_DOMAIN}`;
};

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const user = $("#user").value, pass = $("#pass").value;
  if (!user.trim() || !pass) return fail("Escribe tu usuario y contraseña.");
  loginBtn.disabled = true;
  loginError.textContent = "";
  try {
    await auth.signInWithEmailAndPassword(fbAuth, toEmail(user), pass);
    $("#pass").value = "";
  } catch (err) {
    const c = err?.code || "";
    fail(c.includes("too-many-requests") ? "Demasiados intentos. Espera un momento."
      : c.includes("network") ? "Sin conexión. Revisa tu internet."
      : "Usuario o contraseña incorrectos.");
  } finally {
    loginBtn.disabled = false;
  }
});

function fail(msg) {
  loginError.textContent = msg;
  form.classList.remove("shake");
  void form.offsetWidth;
  form.classList.add("shake");
}

$("#eye").addEventListener("click", () => {
  const p = $("#pass"), show = p.type === "password";
  p.type = show ? "text" : "password";
  $("#eye").setAttribute("aria-pressed", show);
  $("#eye").setAttribute("aria-label", show ? "Ocultar contraseña" : "Mostrar contraseña");
});

$("#logout").addEventListener("click", () => auth.signOut(fbAuth));

let session = null; // funciones para cancelar las suscripciones activas
auth.onAuthStateChanged(fbAuth, (user) => {
  session?.();
  session = null;
  if (!user) {
    setView("login");
    setTimeout(() => $("#user").focus({ preventScroll: true }), 50);
    return;
  }
  setView("loading");
  db.get(db.ref(database, "personas")).then((snap) => {
    if (fbAuth.currentUser !== user) return;
    const v = snap.val();
    if (!v) { setView("login"); fail("La lista aún no está cargada en la base de datos."); return; }
    const personas = Object.entries(v)
      .filter(([, p]) => p)
      .map(([id, p]) => ({ id: Number(id), n: p.n, r: p.r }))
      .sort((a, b) => a.id - b.id);
    session = startApp(personas);
    setView("app");
  }, async () => {
    await auth.signOut(fbAuth);
    fail("Esta cuenta no tiene acceso.");
  });
});

/* ───────────── Aplicación ───────────── */

function startApp(PERSONAS) {
  const REQ = PERSONAS.filter((p) => p.r);
  const OTHERS = PERSONAS.filter((p) => !p.r);
  const TOTAL = REQ.length;

  let state = new Map();
  let filter = "pend";
  let query = "";
  let firstSync = true;
  const mine = new Set();

  const list = $("#list");
  const rows = new Map();
  const norm = (s) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const CAM = `<svg class="cam" viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 5.5a1 1 0 0 1 1-1h1.7l1-1.5h3.6l1 1.5h1.7a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1z"/><circle cx="8" cy="8.3" r="2.2"/></svg>`;

  $("#countTotal").textContent = TOTAL;
  $("#nOthers").textContent = OTHERS.length;
  document.querySelector('[data-f="all"] span').textContent = TOTAL;

  list.textContent = "";
  for (const p of REQ) {
    p.key = norm(p.n);
    const li = document.createElement("li");
    li.className = "row";
    li.dataset.id = p.id;
    li.innerHTML = `
      <button class="row-btn" type="button" aria-pressed="false">
        <span class="box" aria-hidden="true"><svg viewBox="0 0 22 22"><path d="m6.5 11.3 3 3 6-6.4"/></svg></span>
        <span class="row-body">
          <span class="row-name">${esc(p.n)}</span>
          <span class="row-meta">${CAM}<span class="meta-text">#${p.id}</span></span>
        </span>
      </button>`;
    rows.set(p.id, li);
    list.append(li);
  }
  $("#othersList").innerHTML = OTHERS.map((p) => `<li>${esc(p.n)}</li>`).join("");

  /* Render */
  const timeFmt = new Intl.DateTimeFormat("es-CO", { hour: "numeric", minute: "2-digit" });
  const dayFmt = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short" });
  const isToday = (d) => d.toDateString() === new Date().toDateString();
  const fmtTime = (t) => { const d = new Date(t); return isToday(d) ? `Hoy, ${timeFmt.format(d)}` : `${dayFmt.format(d)}, ${timeFmt.format(d)}`; };
  const rel = (t) => {
    const s = Math.round((Date.now() - t) / 1000);
    if (s < 45) return "ahora";
    const m = Math.round(s / 60);
    if (m < 60) return `hace ${m} min`;
    const h = Math.round(m / 60);
    return h < 24 ? `hace ${h} h` : dayFmt.format(new Date(t));
  };
  const replay = (el, cls) => { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); };

  function applyState(next) {
    const prev = state;
    state = next;
    for (const p of REQ) {
      const was = prev.has(p.id), is = next.has(p.id);
      const li = rows.get(p.id);
      li.toggleAttribute("data-done", is);
      li.querySelector(".row-btn").setAttribute("aria-pressed", is);
      li.querySelector(".meta-text").textContent = is ? `Foto · ${fmtTime(next.get(p.id) || Date.now())}` : `#${p.id}`;
      if (!firstSync && was !== is) {
        if (is) replay(li, "pop");
        if (!mine.has(p.id)) {
          replay(li, "remote");
          if (is) toast(`${p.n} ya tiene foto`);
        }
      }
      mine.delete(p.id);
    }
    const changed = !firstSync;
    firstSync = false;
    updateCounts(changed);
    applyFilter();
  }

  let shown = Number($("#countNum").textContent) || 0;
  function updateCounts(changed) {
    const done = REQ.filter((p) => state.has(p.id)).length;
    const left = TOTAL - done;
    const ring = $("#ring");
    $("#ringFill").style.strokeDashoffset = RING * (1 - done / TOTAL);
    ring.classList.toggle("zero", done === 0);
    if (changed && done !== shown) replay(ring, "bump");
    animateNumber(done);
    $("#factLeft").textContent = left === 0 ? "¡Todas listas!" : left === 1 ? "Falta 1" : `Faltan ${left}`;
    $("#factPct").textContent = `${Math.round((done / TOTAL) * 100)}% completado`;
    $("#nPend").textContent = left;
    $("#nDone").textContent = done;
    updateLast();
    document.title = `${done}/${TOTAL} · Fotos Nombramientos 2027`;
  }

  function updateLast() {
    let last = null;
    for (const p of REQ) {
      const t = state.get(p.id);
      if (t && (!last || t > last.t)) last = { p, t };
    }
    $("#factLast").innerHTML = last ? `${CAM.replace('class="cam" ', "")}<b>${esc(last.p.n)}</b><span>· ${rel(last.t)}</span>` : "";
  }
  const lastTimer = setInterval(updateLast, 30_000);

  let raf;
  function animateNumber(to) {
    const el = $("#countNum");
    const from = shown;
    shown = to;
    if (from === to || matchMedia("(prefers-reduced-motion: reduce)").matches) { el.textContent = to; return; }
    const dur = Math.min(800, 260 + Math.abs(to - from) * 16);
    const t0 = performance.now();
    cancelAnimationFrame(raf);
    const step = (now) => {
      const k = Math.min(1, (now - t0) / dur);
      el.textContent = Math.round(from + (to - from) * (1 - Math.pow(1 - k, 4)));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  }

  function matches(p) {
    if (filter === "pend" && state.has(p.id)) return false;
    if (filter === "done" && !state.has(p.id)) return false;
    return !query || p.key.includes(query);
  }

  function applyFilter(animateIn = false) {
    let visible = 0;
    for (const p of REQ) {
      const li = rows.get(p.id);
      if (li.classList.contains("exit")) { visible++; continue; }
      const ok = matches(p);
      if ((animateIn || !firstSync) && ok && li.hidden) replay(li, "entering");
      li.hidden = !ok;
      if (ok) visible++;
      const name = li.querySelector(".row-name");
      if (query && ok) {
        const i = p.key.indexOf(query);
        name.innerHTML = esc(p.n.slice(0, i)) + `<mark class="hl">${esc(p.n.slice(i, i + query.length))}</mark>` + esc(p.n.slice(i + query.length));
      } else if (name.firstElementChild) {
        name.textContent = p.n;
      }
    }
    $("#empty").hidden = visible > 0;
    if (!visible) {
      $("#emptyText").textContent = query ? "Nadie con ese nombre aquí."
        : filter === "pend" ? "Todas las fotos están tomadas."
        : "Aún no hay fotos tomadas.";
    }
  }

  /* Interacción */
  function toggle(id, on) {
    const li = rows.get(id);
    const leaves = (filter === "pend" && on) || (filter === "done" && !on);
    mine.add(id);
    const next = new Map(state);
    on ? next.set(id, Date.now()) : next.delete(id);
    clearTimeout(li._t1); clearTimeout(li._t2);
    li.classList.remove("exit", "leaving");
    if (leaves) {
      li.classList.add("exit");
      li._t1 = setTimeout(() => li.classList.add("leaving"), 420);
      li._t2 = setTimeout(() => { li.classList.remove("exit", "leaving"); applyFilter(); }, 800);
    }
    applyState(next);
    db.set(db.ref(database, `fotos/${id}`), on ? { t: db.serverTimestamp() } : null)
      .catch(() => toast("No se pudo guardar. Revisa la conexión."));
  }

  function onListClick(e) {
    const li = e.target.closest(".row");
    if (!li) return;
    const id = Number(li.dataset.id);
    const p = REQ.find((x) => x.id === id);
    const on = !state.has(id);
    toggle(id, on);
    if (navigator.userActivation?.hasBeenActive) navigator.vibrate?.(on ? 12 : 6);
    const first = p.n.split(" ")[0];
    toast(on ? `Foto de ${first} lista` : `${first} desmarcada`, () => toggle(id, !on));
  }

  const chips = $("#chips");
  function onChip(e) {
    const b = e.target.closest(".chip");
    if (!b || b.getAttribute("aria-selected") === "true") return;
    chips.querySelectorAll(".chip").forEach((x) => x.setAttribute("aria-selected", x === b));
    filter = b.dataset.f;
    applyFilter(true);
  }

  const q = $("#q");
  const search = $("#search");
  const onSearch = () => {
    query = norm(q.value.trim());
    search.classList.toggle("has-value", q.value.length > 0);
    applyFilter();
  };
  const onClear = (e) => { e.preventDefault(); q.value = ""; onSearch(); q.focus(); };
  const onKey = (e) => {
    if (e.key === "/" && document.activeElement !== q) { e.preventDefault(); q.focus(); }
    if (e.key === "Escape" && document.activeElement === q) { q.value = ""; onSearch(); q.blur(); }
  };
  const onCopy = async () => {
    const pend = REQ.filter((p) => !state.has(p.id));
    const text = `Fotos pendientes · Nombramientos 2027 (${pend.length})\n\n` + pend.map((p) => `• ${p.n}`).join("\n");
    try { await navigator.clipboard.writeText(text); toast(`${pend.length} pendientes copiados`); }
    catch { toast("No se pudo copiar"); }
  };

  list.addEventListener("click", onListClick);
  chips.addEventListener("click", onChip);
  q.addEventListener("input", onSearch);
  $("#qClear").addEventListener("click", onClear);
  document.addEventListener("keydown", onKey);
  $("#copyPend").addEventListener("click", onCopy);

  /* Datos en vivo */
  const offFotos = db.onValue(db.ref(database, "fotos"), (snap) => {
    const v = snap.val() || {};
    applyState(new Map(Object.entries(v).map(([k, o]) => [Number(k), o.t])));
  });
  const offConn = db.onValue(db.ref(database, ".info/connected"), (s) =>
    s.val() ? setStatus("live", "En vivo") : setStatus("offline", "Reconectando"));

  // Limpieza al cerrar sesión
  return () => {
    offFotos(); offConn();
    clearInterval(lastTimer);
    list.removeEventListener("click", onListClick);
    chips.removeEventListener("click", onChip);
    q.removeEventListener("input", onSearch);
    $("#qClear").removeEventListener("click", onClear);
    document.removeEventListener("keydown", onKey);
    $("#copyPend").removeEventListener("click", onCopy);
    list.textContent = "";
    $("#othersList").textContent = "";
    q.value = ""; search.classList.remove("has-value");
  };
}

/* ───────────── Avisos y estado ───────────── */

let toastTimer, undo = null;
function toast(msg, onUndo) {
  const el = $("#toast");
  $("#toastMsg").textContent = msg;
  $("#toastUndo").hidden = !onUndo;
  undo = onUndo || null;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; undo = null; }, onUndo ? 4000 : 2600);
}
$("#toastUndo").addEventListener("click", () => {
  undo?.();
  undo = null;
  $("#toast").hidden = true;
});

function setStatus(s, label) {
  const el = $("#status");
  el.dataset.state = s;
  el.querySelector(".status-label").textContent = label;
}

/* ───────────── Tema claro / oscuro ───────────── */

function syncThemeButtons() {
  const dark = document.documentElement.dataset.theme === "dark";
  document.querySelectorAll(".theme-btn").forEach((b) =>
    b.setAttribute("aria-label", dark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"));
  document.querySelector("meta[name=theme-color]").content = dark ? "#111013" : "#f7f6f9";
}

function setTheme(next, origin) {
  const apply = () => {
    document.documentElement.dataset.theme = next;
    localStorage.setItem("tema", next);
    syncThemeButtons();
  };
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!document.startViewTransition || reduce || !origin) return apply();
  // Revela el nuevo tema en un círculo que crece desde el botón
  const r = origin.getBoundingClientRect();
  const x = r.left + r.width / 2, y = r.top + r.height / 2;
  const s = document.documentElement.style;
  s.setProperty("--vt-x", `${x}px`);
  s.setProperty("--vt-y", `${y}px`);
  s.setProperty("--vt-r", `${Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y))}px`);
  document.startViewTransition(apply);
}

document.querySelectorAll(".theme-btn").forEach((b) =>
  b.addEventListener("click", () =>
    setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark", b)));
syncThemeButtons();

// Si nunca eligió tema a mano, sigue al sistema
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => {
  if (!localStorage.getItem("tema")) {
    document.documentElement.dataset.theme = e.matches ? "dark" : "light";
    syncThemeButtons();
  }
});
