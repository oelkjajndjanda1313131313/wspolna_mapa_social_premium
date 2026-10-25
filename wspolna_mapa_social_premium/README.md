# Wspólna Mapa Premium

Aplikacja Node.js z mapą, pokojami zaproszeń, czatem na żywo, listą znajomych zapisaną lokalnie w przeglądarce oraz dobrowolną mini-grą „Zgadnij lokalizację”.

## Uruchomienie
- Wymagany Node.js 18+.
- `npm install`
- `npm start`
- Otwórz `http://localhost:3000`.

## Render
Wgraj zawartość tego ZIP-a do głównego folderu repozytorium, tak aby `package.json` i `server.js` były w katalogu głównym. W Renderze pole Root Directory pozostaw puste. Build command: `npm install`; Start command: `npm start`. Dodaj `ADMIN_PASSWORD` w Environment, aby włączyć `/admin`.

## Prywatność
GPS wymaga osobnej zgody przeglądarki. Tryb zgadywania jest dobrowolny: gdy uczestnik go włączy, jego pinezka zostaje ukryta dla innych, a serwer odpowiada zgadującemu wyłącznie przybliżoną odległością. Lista znajomych jest lokalna dla przeglądarki i nie jest synchronizowana między urządzeniami. Pokoje, czat, lokalizacje i lista aktywnych połączeń są przechowywane w pamięci procesu i znikają po restarcie serwera. Panel admina pokazuje IP połączenia widziane przez hosting; może to być IP proxy, a nie urządzenia. Uczestnicy muszą zostać poinformowani o tej funkcji.

To jest prosty prototyp, nie system produkcyjny: nie przechowuje znajomych trwale i nie zapewnia trwałej bazy danych.
