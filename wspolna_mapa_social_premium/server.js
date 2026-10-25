import express from "express";
import http from "http";
import { Server } from "socket.io";
import crypto from "crypto";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;

// Pokoje i pozycje są przechowywane tylko w pamięci procesu.
// Nie zapisujemy współrzędnych do plików ani bazy danych.
const rooms = new Map();

const connectedClients = new Map();
const roomChats = new Map();
function requireAdmin(req, res, next) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return res.status(503).send("Panel admina nie jest skonfigurowany. Ustaw ADMIN_PASSWORD w Render → Environment.");
  const header = req.headers.authorization || "";
  const [scheme, encoded] = header.split(" ");
  let supplied = "";
  if (scheme === "Basic" && encoded) {
    try { supplied = Buffer.from(encoded, "base64").toString("utf8").split(":").slice(1).join(":"); } catch {}
  }
  if (scheme !== "Basic" || !encoded || !constantTimeEqual(supplied, expected)) {
    res.set("WWW-Authenticate", 'Basic realm="Wspolna Mapa Admin", charset="UTF-8"');
    return res.status(401).send("Wymagane logowanie administratora.");
  }
  next();
}
function constantTimeEqual(a, b) {
  const aa = Buffer.from(String(a)); const bb = Buffer.from(String(b));
  return aa.length === bb.length && crypto.timingSafeEqual(aa, bb);
}
function getClientIp(socket) {
  const forwarded = socket.handshake.headers["x-forwarded-for"];
  const candidate = typeof forwarded === "string" ? forwarded.split(",")[0].trim() : socket.handshake.address;
  return String(candidate || "Nieznane").replace(/^::ffff:/, "").slice(0, 64);
}
app.get("/admin", requireAdmin, (_req, res) => {
  res.set("Cache-Control", "no-store");
  res.type("html").send(`<!doctype html><html lang="pl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Wspólna Mapa · Admin</title><style>
  *{box-sizing:border-box}body{margin:0;font:15px/1.5 Inter,system-ui,sans-serif;background:#0b1020;color:#eef3ff}main{max-width:1100px;margin:auto;padding:28px 18px}.top{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}.brand{font-size:21px;font-weight:850;letter-spacing:-.5px}.brand span{color:#85aaff}.pill{border:1px solid #283552;background:#151e33;padding:7px 11px;border-radius:99px;font-size:12px;color:#b7c5df}.hero{margin:25px 0 18px;padding:24px;border-radius:22px;background:radial-gradient(ellipse at top right,#263e72,#151e34 60%,#12182a);border:1px solid #2b3a5a}.eyebrow{color:#9dbaff;text-transform:uppercase;letter-spacing:2px;font-size:10px;font-weight:900}.hero h1{margin:6px 0;font-size:clamp(27px,5vw,40px);letter-spacing:-1.5px}.muted{color:#a0aec8;font-size:13px}.stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin:15px 0}.stat,.tablebox{background:#121a2c;border:1px solid #26334e;border-radius:17px;padding:17px}.stat small{display:block;color:#9caecb}.stat strong{display:block;font-size:29px;margin-top:4px}.tablebox{padding:0;overflow:hidden}.tablehead{padding:17px;display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}button{border:1px solid #3a4d70;border-radius:10px;padding:10px 13px;background:#1c2b48;color:#eef3ff;font-weight:750;cursor:pointer}button:hover{background:#263a61}.scroll{overflow:auto}table{border-collapse:collapse;width:100%;min-width:650px}th,td{text-align:left;padding:14px 16px;border-top:1px solid #24314a;overflow-wrap:anywhere}th{font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#9fb0cd;background:#151f34}td{font-size:13px}.ip{font-family:ui-monospace,monospace;color:#a8c4ff}.status{color:#75e2b3}.foot{font-size:11px;color:#8f9fbb;margin:14px 3px}@media(max-width:560px){main{padding:15px 10px}.stats{grid-template-columns:1fr}.hero{padding:18px}}
  
  body{background:radial-gradient(ellipse at 85% -10%,#243e77 0,transparent 36%),linear-gradient(145deg,#080d1b,#101a30 60%,#0b1220);color:#edf3ff}main{max-width:1250px;padding:clamp(18px,4vw,42px)}.brand{font-size:24px;letter-spacing:-.8px}.pill{background:#14233b;border-color:#2b4267;color:#c4d2eb}.hero{padding:clamp(24px,4vw,42px);border-radius:28px;background:radial-gradient(ellipse at 85% 0%,#3459a0 0,transparent 45%),linear-gradient(135deg,#172b4b,#111a2c 70%);border-color:#354b70;box-shadow:0 24px 70px #0003}.hero h1{font-size:clamp(32px,5vw,48px);letter-spacing:-1.8px}.eyebrow{color:#a9c5ff}.stat,.tablebox{background:rgba(17,27,47,.94);border-color:#2a3b59;border-radius:20px;box-shadow:0 15px 45px #0002}.stat{padding:22px}.stat strong{font-size:34px;letter-spacing:-1px}.tablehead{padding:21px}.tablehead strong{font-size:17px}button{border-radius:12px;background:#203657;border-color:#3c5883;padding:11px 15px}button:hover{background:#2a4770}th{background:#17243b;color:#b5c8e9}th,td{border-color:#273650;padding:15px 18px}td{color:#e4ecfc}.ip{color:#a9c5ff}.status{color:#7df0bc}.foot{color:#9aabc7}@media(max-width:560px){.hero{border-radius:22px}.stats{grid-template-columns:1fr}.stat{padding:17px}}

</style></head><body><main><div class="top"><div class="brand">⌖ Wspólna <span>Mapa</span> <small style="font-size:11px;color:#94a6c7">/ ADMIN</small></div><div class="pill">● PANEL CHRONIONY</div></div><section class="hero"><div class="eyebrow">Panel administratora</div><h1>Centrum połączeń</h1><div class="muted">Aktywni uczestnicy, pokoje i adresy IP połączeń. Widok odświeża się automatycznie.</div></section><section class="stats"><div class="stat"><small>Aktywne połączenia</small><strong id="count">—</strong></div><div class="stat"><small>Aktywne pokoje</small><strong id="rooms">—</strong></div><div class="stat"><small>Udostępniają GPS</small><strong id="gps">—</strong></div></section><section class="tablebox"><div class="tablehead"><strong>Uczestnicy online</strong><button onclick="load()">↻ Odśwież teraz</button></div><div class="scroll"><table><thead><tr><th>Nazwa</th><th>Adres IP połączenia</th><th>Pokój</th><th>GPS</th></tr></thead><tbody id="rows"><tr><td colspan="4">Ładowanie…</td></tr></tbody></table></div></section><p id="status" class="foot">Dane są przechowywane tylko w pamięci działającego procesu.</p><p class="foot">Uwaga: na hostingu za proxy IP może należeć do proxy lub infrastruktury hostingu, a nie bezpośrednio do urządzenia. Adresy IP są danymi wrażliwymi dla prywatności — korzystaj z panelu zgodnie z informacją przekazaną uczestnikom.</p></main><script>async function load(){try{const r=await fetch('/admin/data',{cache:'no-store'});if(!r.ok)throw Error('Błąd pobierania danych ('+r.status+')');const d=await r.json();document.querySelector('#count').textContent=d.length;document.querySelector('#rooms').textContent=new Set(d.map(x=>x.room).filter(Boolean)).size;document.querySelector('#gps').textContent=d.filter(x=>x.sharing).length;const body=document.querySelector('#rows');body.replaceChildren();if(!d.length){const tr=document.createElement('tr'),td=document.createElement('td');td.colSpan=4;td.textContent='Brak aktywnych połączeń';tr.append(td);body.append(tr)}d.forEach(x=>{const tr=document.createElement('tr');[x.name,x.ip,x.room||'—',x.sharing?'Udostępnia GPS':'GPS wyłączony'].forEach((v,i)=>{const td=document.createElement('td');td.textContent=v;if(i===1)td.className='ip';if(i===3&&x.sharing)td.className='status';tr.append(td)});body.append(tr)});document.querySelector('#status').textContent='Ostatnia aktualizacja: '+new Date().toLocaleTimeString()+' · automatyczne odświeżanie co 8 s'}catch(e){document.querySelector('#status').textContent=e.message}}load();setInterval(load,8000)</script></body></html>`);
});
app.get("/admin/data", requireAdmin, (_req, res) => {
  res.set("Cache-Control", "no-store");
  res.json([...connectedClients.values()].map(c => ({ name: c.name || "Łączenie…", ip: c.ip, room: c.roomId || "", sharing: Boolean(c.location) })));
});


app.use(express.static(path.join(__dirname, "public")));
app.get("/health", (_req, res) => res.json({ ok: true }));

io.on("connection", socket => {
  connectedClients.set(socket.id, { ip: getClientIp(socket), name: "Łączenie…", roomId: "", location: null, guessMode: false });
  socket.on("create-room", ({ displayName }, callback) => {
    const roomId = crypto.randomBytes(5).toString("hex");
    const safeName = cleanName(displayName);
    rooms.set(roomId, { members: new Map() });
    joinRoom(socket, roomId, safeName);
    callback?.({ ok: true, roomId });
  });

  socket.on("join-room", ({ roomId, displayName }, callback) => {
    const id = String(roomId || "").trim().toLowerCase();
    if (!rooms.has(id)) return callback?.({ ok: false, error: "Nie znaleziono pokoju. Sprawdź kod zaproszenia." });
    const room = rooms.get(id);
    if (room.members.size >= 2 && !room.members.has(socket.id)) {
      return callback?.({ ok: false, error: "W tym pokoju są już dwie osoby." });
    }
    joinRoom(socket, id, cleanName(displayName));
    callback?.({ ok: true, roomId: id });
  });

  socket.on("guess-mode", enabled => {
    const roomId = socket.data.roomId;
    if (!roomId || !rooms.has(roomId)) return;
    const room = rooms.get(roomId), member = room.members.get(socket.id);
    if (!member) return;
    member.guessMode = Boolean(enabled) && Boolean(member.location);
    broadcastMembers(roomId);
  });
  socket.on("guess-location", ({ latitude, longitude, targetId }, callback) => {
    const roomId = socket.data.roomId;
    const room = roomId && rooms.get(roomId);
    const target = room && room.members.get(String(targetId || ""));
    if (!room || !target || !target.guessMode || !target.location) {
      return callback?.({ ok: false, message: "Ta osoba nie włączyła trybu zgadywania." });
    }
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) ||
        latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return callback?.({ ok: false, message: "Nieprawidłowy punkt na mapie." });
    }
    const rad = n => n * Math.PI / 180;
    const a = target.location;
    const dLat = rad(a.latitude - latitude), dLon = rad(a.longitude - longitude);
    const h = Math.sin(dLat/2)**2 + Math.cos(rad(latitude))*Math.cos(rad(a.latitude))*Math.sin(dLon/2)**2;
    const distance = 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1-h));
    callback?.({ ok: true, distance: distance < 1000 ? `${Math.round(distance)} m` : `${(distance/1000).toFixed(1)} km`, close: distance < 250 });
  });

  socket.on("chat-message", (rawText, callback) => {
    const roomId = socket.data.roomId;
    if (!roomId || !rooms.has(roomId)) return callback?.({ ok: false, error: "Najpierw dołącz do pokoju." });
    const text = String(rawText ?? "").trim().slice(0, 500);
    if (!text) return callback?.({ ok: false, error: "Wiadomość jest pusta." });
    const room = rooms.get(roomId);
    const member = room.members.get(socket.id);
    if (!member) return callback?.({ ok: false, error: "Nie jesteś członkiem tego pokoju." });
    const message = { id: socket.id, name: member.name, text, at: Date.now() };
    const history = roomChats.get(roomId) || [];
    history.push(message);
    if (history.length > 100) history.shift();
    roomChats.set(roomId, history);
    io.to(roomId).emit("chat-message", message);
    callback?.({ ok: true });
  });

  socket.on("location-update", ({ latitude, longitude, accuracy }) => {
    const roomId = socket.data.roomId;
    if (!roomId || !rooms.has(roomId)) return;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) ||
        latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return;
    const room = rooms.get(roomId);
    const member = room.members.get(socket.id);
    if (!member) return;
    member.location = {
      latitude, longitude,
      accuracy: Number.isFinite(accuracy) ? Math.max(0, accuracy) : null,
      updatedAt: Date.now()
    };
    const client = connectedClients.get(socket.id); if (client) client.location = member.location;
    broadcastMembers(roomId);
  });

  socket.on("stop-sharing", () => {
    const roomId = socket.data.roomId;
    if (!roomId || !rooms.has(roomId)) return;
    const room = rooms.get(roomId);
    const member = room.members.get(socket.id);
    if (member) member.location = null;
    const client = connectedClients.get(socket.id); if (client) client.location = null;
    broadcastMembers(roomId);
  });

  socket.on("disconnect", () => {
    connectedClients.delete(socket.id);
    const roomId = socket.data.roomId;
    if (!roomId || !rooms.has(roomId)) return;
    const room = rooms.get(roomId);
    room.members.delete(socket.id);
    if (room.members.size === 0) { rooms.delete(roomId); roomChats.delete(roomId); }
    else broadcastMembers(roomId);
  });
});

function cleanName(value) {
  const name = String(value || "").trim().replace(/[<>]/g, "").slice(0, 24);
  return name || "Użytkownik";
}
function joinRoom(socket, roomId, displayName) {
  // Jeden socket należy tylko do jednego pokoju.
  const previous = socket.data.roomId;
  if (previous && rooms.has(previous)) {
    rooms.get(previous).members.delete(socket.id);
    broadcastMembers(previous);
  }
  socket.join(roomId);
  socket.data.roomId = roomId;
  const room = rooms.get(roomId);
  room.members.set(socket.id, { id: socket.id, name: displayName, location: null, guessMode: false });
  const client = connectedClients.get(socket.id);
  if (client) { client.name = displayName; client.roomId = roomId; client.location = null; }
  broadcastMembers(roomId);
  socket.emit("chat-history", roomChats.get(roomId) || []);
}
function broadcastMembers(roomId) {
  const room = rooms.get(roomId);
  if (!room) return;
  io.to(roomId).emit("members", [...room.members.values()].map(m => ({
    id: m.id, name: m.name, location: m.location
  })));
}
server.listen(PORT, () => console.log(`Wspólna Mapa działa: http://localhost:${PORT}`));
