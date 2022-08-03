# ofcra-presets
[OFCRA](https://ofcrav2.org) Arma 3 Launcher presets generated from OFCRA ArmA3Sync events.  

## Running locally
Install dependencies (`npm i`) first, then build artifacts with `npm run build` and start with `npm start` or just use `npm run dev`.  
Web service starts at `http://localhost:8080` by default.  
*Some configuration available via [env vars and local variables](server.ts).*

## API
#### GET /
Serves [index.html](index.html) which has the client side logic that handles all the events, mods and changelogs data to render the UI and generate the preset files.
#### GET /data
REST API that returns ArmA3Sync events and changelogs data and related mods data in JSON format.  
Mod data *(id, name, workshop id or download url)* is gathered from various data sources and permanently cached in the `MOD_DB_FILE`.
#### GET /flush/`SECRET`
Triggers the deletion of the `MOD_DB_FILE`.

## Data sources
#### Events, changelogs
 1. ArmA3Sync server: https://repo.ofcra.org/.a3s/
#### Mods
 1. `MOD_OVERRIDES` variable ([server.ts](server.ts#L11))
 2. mods index (https://ofcrav2.org/index.php?page=repository-en)
 3. source files in the mods repo (https://repo.ofcra.org/)
    1. meta.cpp
    2. mod.cpp
 4. steam workshop

