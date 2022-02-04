import fs from 'fs';
import { createServer } from 'http';
import { URL } from 'url';
import A3sRemoteServer from './A3sRemoteServer';
import A3sMods from './A3sMods';

const OFCRA_A3S_URL = 'http://repo.ofcra.org/.a3s/';
const OFCRA_A3S_REPO_URL = 'http://repo.ofcra.org/';

const MOD_DB_FILE = process.env.MOD_DB_FILE || './mods.json';
const MOD_OVERRIDES = {
    '@ace_compat_rhs': { // Served as dl in the index but the ws version works. Source: trust me bro
        id: '@ace_compat_rhs',
        name: 'ACE RHS Compat All-in-One',
        publishedid: '2019167442'
    }
};

const CACHE_MAX_AGE = parseInt(process.env.CACHE_MAX_AGE || '0', 10);
const APP_HOST = process.env.app_host || '0.0.0.0';
const APP_PORT = parseInt(process.env.app_port || '8080', 10);
const DBG = Boolean(process.env.DBG || false);
const SECRET = process.env.SECRET || 'secret';

createServer(async (req, res) => {
    if (DBG) console.log('DBG: %j %j', (new Date()), req.url);

    const reqUrl = new URL(req.url || '', 'http://localhost');
    if (reqUrl.pathname === '/') {
        res.writeHead(200, {
            'Content-Type': 'text/html',
            'Cache-Control': 'max-age=' + String(CACHE_MAX_AGE)
        });
        fs.createReadStream('./index.html').pipe(res);
    }
    else if (reqUrl.pathname === '/data') {
        const a3srs = new A3sRemoteServer(OFCRA_A3S_URL);
        const a3sm = new A3sMods(OFCRA_A3S_REPO_URL, MOD_DB_FILE, MOD_OVERRIDES);
        const res_headers = {
            'Content-Type': 'application/json',
            'Cache-Control': 'max-age=' + String(CACHE_MAX_AGE)
        };
        try {
            await a3srs.loadData(['events', 'changelogs']);
            if (!a3srs.events) {
                throw new Error('No events returned from ArmA3Sync server');
            }
            await a3sm.init();
            await a3sm.parseA3sEvents(a3srs.events);
            res.writeHead(200, res_headers);
            res.end(JSON.stringify({
                mods: a3sm.getMods(),
                a3s: a3srs
            }, null, DBG ? 2 : 0));
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            console.error('Error: %s', msg);
            res.writeHead(404, res_headers);
            res.end(JSON.stringify({ error: msg }, null, DBG ? 2 : 0));
        }
    }
    else if (reqUrl.pathname === '/flush/' + SECRET) {
        fs.unlinkSync(MOD_DB_FILE);
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<html><head></head><body>Mods cache emptied &#x1F9F9</body></html>');
    }
    else {
        res.writeHead(404, { 'Content-Type': 'text/html' });
        res.end('<html><head></head><body>404 &#x1F4A2</body></html>');
    }
}).listen(APP_PORT);

console.log('Web service started %s:%s', APP_HOST, APP_PORT);
