const socket = io();
const $ = id => document.getElementById(id);
let roomId = null;
let watchId = null;
let myLocation = null;
let guessTargetId = null;
let guessPickEnabled = false;
let guessModeOn = false;
const friends = new Set(JSON.parse(localStorage.getItem("wm-friends") || "[]"));
const markers = new Map();
const latestMembers = new Map();

const map = L.map("map").setView([52.0, 19.2], 6);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
}).addTo(map);

socket.on("connect", () => $("connection").textContent = "Połączono");
socket.on("disconnect", () => $("connection").textContent = "Rozłączono");
socket.on("members", members => {
  latestMembers.clear();
  members.forEach(m => latestMembers.set(m.id, m));
  renderMembers(members);
  updateMarkers(members);
});

$("create").onclick = () => {
  socket.emit("create-room", { displayName: $("name").value }, result => {
    if (!result?.ok) return alert("Nie udało się utworzyć pokoju.");
    setRoom(result.roomId);
  });
};
$("join").onclick = () => {
  const code = $("room").value.trim().toLowerCase();
  if (!code) return alert("Wpisz kod pokoju.");
  socket.emit("join-room", { roomId: code, displayName: $("name").value }, result => {
    if (!result?.ok) return alert(result?.error || "Nie udało się dołączyć.");
    setRoom(result.roomId);
  });
};
function setRoom(id) {
  roomId = id;
  $("room").value = id;
  $("roomCode").textContent = id;
  $("roomInfo").classList.remove("hidden");
  $("share").disabled = false;
  $("shareStatus").textContent = "Pokój gotowy. Włącz GPS, gdy chcesz udostępnić pozycję.";
  $("guessMode").disabled = false;
}
$("copy").onclick = async () => {
  const invite = `${location.origin}/?room=${encodeURIComponent(roomId)}`;
  try {
    await navigator.clipboard.writeText(invite);
    $("copy").textContent = "Skopiowano!";
  } catch {
    prompt("Skopiuj link zaproszenia:", invite);
  }
};
const params = new URLSearchParams(location.search);
if (params.get("room")) $("room").value = params.get("room");

$("share").onclick = () => {
  if (!roomId) return alert("Najpierw utwórz pokój lub dołącz.");
  if (!navigator.geolocation) return alert("Ta przeglądarka nie obsługuje geolokalizacji.");
  if (!window.isSecureContext && location.hostname !== "localhost") {
    return alert("GPS wymaga bezpiecznego połączenia HTTPS. Uruchom stronę lokalnie lub wdroż ją przez HTTPS.");
  }
  $("shareStatus").textContent = "Oczekiwanie na zgodę przeglądarki…";
  watchId = navigator.geolocation.watchPosition(position => {
    const c = position.coords;
    myLocation = { latitude: c.latitude, longitude: c.longitude, accuracy: c.accuracy };
    socket.emit("location-update", myLocation);
    $("shareStatus").textContent = `Udostępniasz pozycję (dokładność ok. ${Math.round(c.accuracy)} m).`;
    $("guessMode").disabled = false;
    $("share").disabled = true;
    $("stop").disabled = false;
  }, error => {
    const messages = {
      1: "Nie udzielono zgody na lokalizację.",
      2: "Nie można ustalić lokalizacji urządzenia.",
      3: "Upłynął czas oczekiwania na GPS."
    };
    $("shareStatus").textContent = messages[error.code] || "Błąd lokalizacji.";
    stopSharing(false);
  }, { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 });
};
$("stop").onclick = () => stopSharing(true);
function stopSharing(send) {
  if (watchId !== null) navigator.geolocation.clearWatch(watchId);
  watchId = null;
  myLocation = null;
  if (send && socket.connected) socket.emit("stop-sharing");
  $("share").disabled = !roomId;
  $("stop").disabled = true;
  $("shareStatus").textContent = "Udostępnianie wyłączone.";
}

function renderMembers(members) {
  const root = $("members");
  root.innerHTML = "";
  if (!members.length) {
    root.innerHTML = '<p class="muted">Brak osób w pokoju.</p>';
    return;
  }
  members.forEach(member => {
    const row = document.createElement("div");
    row.className = "member";
    const dot = document.createElement("span");
    dot.className = "dot" + (member.location ? " active" : "");
    const main = document.createElement("div");
    main.className = "member-main";
    const name = document.createElement("div");
    name.className = "member-name";
    name.textContent = member.name + (member.id === socket.id ? " (Ty)" : "");
    const state = document.createElement("div");
    state.className = "member-state";
    state.textContent = member.location ? "Udostępnia lokalizację" : "Nie udostępnia lokalizacji";
    main.append(name, state);
    row.append(dot, main);
    root.append(row);
  });
}
function updateMarkers(members) {
  const present = new Set();
  members.forEach(member => {
    if (!member.location) {
      if (markers.has(member.id)) {
        map.removeLayer(markers.get(member.id));
        markers.delete(member.id);
      }
      return;
    }
    present.add(member.id);
    const { latitude, longitude } = member.location;
    if (!markers.has(member.id)) {
      const marker = L.marker([latitude, longitude]).addTo(map);
      markers.set(member.id, marker);
    }
    const marker = markers.get(member.id);
    marker.setLatLng([latitude, longitude]);
    marker.bindPopup(`${escapeHtml(member.name)}${member.id === socket.id ? " (Ty)" : ""}`);
  });
  for (const [id, marker] of markers) {
    if (!present.has(id)) {
      map.removeLayer(marker);
      markers.delete(id);
    }
  }
  if (members.some(m => m.location)) {
    const points = members.filter(m => m.location).map(m => [m.location.latitude, m.location.longitude]);
    if (points.length > 1) map.fitBounds(points, { padding: [40, 40], maxZoom: 14 });
    else map.setView(points[0], 14);
  }
}
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, c => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
  })[c]);
}
window.addEventListener("beforeunload", () => {
  if (watchId !== null) navigator.geolocation.clearWatch(watchId);
});


// Czat pokoju: wiadomości są tylko w pamięci serwera i nie są zapisywane do bazy.
const chatForm = $("chatForm");
const chatInput = $("chatInput");
const chatMessages = $("chatMessages");
function renderChatMessage(message) {
  const empty = chatMessages.querySelector(".muted");
  if (empty) empty.remove();
  const item = document.createElement("div");
  item.className = "chat-msg" + (message.id === socket.id ? " mine" : "");
  const meta = document.createElement("div");
  meta.className = "chat-meta";
  meta.textContent = message.name + (message.id === socket.id ? " · Ty" : "");
  const body = document.createElement("div");
  body.className = "chat-text";
  body.textContent = message.text;
  const time = document.createElement("div");
  time.className = "chat-time";
  time.textContent = new Date(message.at).toLocaleTimeString([], {hour:"2-digit", minute:"2-digit"});
  item.append(meta, body, time);
  chatMessages.append(item);
  while (chatMessages.children.length > 100) chatMessages.firstElementChild.remove();
  chatMessages.scrollTop = chatMessages.scrollHeight;
}
socket.on("chat-history", messages => {
  chatMessages.replaceChildren();
  if (!messages.length) {
    const empty = document.createElement("p"); empty.className = "muted"; empty.textContent = "Brak wiadomości. Napisz pierwszą!"; chatMessages.append(empty);
  } else messages.forEach(renderChatMessage);
});
socket.on("chat-message", renderChatMessage);
chatForm.addEventListener("submit", event => {
  event.preventDefault();
  const text = chatInput.value.trim();
  if (!text || !roomId) return;
  socket.emit("chat-message", text, result => {
    if (!result?.ok) { alert(result?.error || "Nie udało się wysłać wiadomości."); return; }
    chatInput.value = "";
    chatInput.focus();
  });
});
const originalSetRoom = setRoom;
setRoom = function(id) {
  originalSetRoom(id);
  chatInput.disabled = false;
  $("chatSend").disabled = false;
  if (!chatMessages.children.length) { const loading = document.createElement("p"); loading.className = "muted"; loading.textContent = "Ładowanie czatu…"; chatMessages.append(loading); }
};

function renderFriends() {
  const root = $("friendsList"); root.replaceChildren();
  if (!friends.size) { const p=document.createElement("p"); p.className="muted"; p.textContent="Twoja lista jest pusta."; root.append(p); return; }
  [...friends].forEach(name => { const item=document.createElement("div"); item.className="friend-chip"; item.textContent="✦ "+name; root.append(item); });
}
renderFriends();
$("guessMode").onclick = () => {
  if (!myLocation) { $("guessStatus").textContent = "Najpierw włącz udostępnianie GPS i zaakceptuj zgodę przeglądarki."; return; }
  guessModeOn = !guessModeOn;
  socket.emit("guess-mode", guessModeOn);
  $("guessMode").textContent = guessModeOn ? "Wyłącz tryb zgadywania" : "Włącz tryb zgadywania (udostępnij GPS)";
  $("guessStatus").textContent = guessModeOn ? "Tryb aktywny. Twoja pinezka jest ukryta; inni mogą zgadywać." : "Tryb wyłączony.";
};
$("guessPick").onclick = () => {
  guessPickEnabled = true;
  $("guessStatus").textContent = "Kliknij wybrane miejsce na mapie.";
};
map.on("click", event => {
  if (!guessPickEnabled || !guessTargetId) return;
  guessPickEnabled = false; $("guessPick").disabled = true; map.getContainer().style.cursor = "";
  socket.emit("guess-location", { latitude: event.latlng.lat, longitude: event.latlng.lng, targetId: guessTargetId }, result => {
    $("guessStatus").textContent = result?.ok ? (result.close ? "🎯 Bardzo blisko! Odległość: " : "Odległość od celu: ") + result.distance : (result?.message || "Nie udało się sprawdzić zgadywania.");
  });
});
