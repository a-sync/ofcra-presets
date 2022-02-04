import { URL } from 'url';
import { gunzipSync } from 'zlib';
import got from 'got';
// ArmA3Sync & java.io interfaces stolen from: https://github.com/gruppe-adler/node-arma3sync-lib
import { InputObjectStream } from 'java.io';
export var A3sProtocol;
(function (A3sProtocol) {
    A3sProtocol[A3sProtocol["FTP"] = 0] = "FTP";
    A3sProtocol[A3sProtocol["HTTP"] = 1] = "HTTP";
    A3sProtocol[A3sProtocol["HTTPS"] = 2] = "HTTPS";
    A3sProtocol[A3sProtocol["A3S"] = 3] = "A3S";
    A3sProtocol[A3sProtocol["FTP_BITTORRENT"] = 4] = "FTP_BITTORRENT";
    A3sProtocol[A3sProtocol["HTTP_BITTORRENT"] = 5] = "HTTP_BITTORRENT";
    A3sProtocol[A3sProtocol["HTTPS_BITTORRENT"] = 6] = "HTTPS_BITTORRENT";
    A3sProtocol[A3sProtocol["SOCKS4"] = 7] = "SOCKS4";
    A3sProtocol[A3sProtocol["SOCKS5"] = 8] = "SOCKS5";
})(A3sProtocol || (A3sProtocol = {}));
export var A3sEncryption;
(function (A3sEncryption) {
    A3sEncryption[A3sEncryption["NO_ENCRYPTION"] = 0] = "NO_ENCRYPTION";
    A3sEncryption[A3sEncryption["EXPLICIT_SSL"] = 1] = "EXPLICIT_SSL";
    A3sEncryption[A3sEncryption["IMPLICIT_SSL"] = 2] = "IMPLICIT_SSL";
})(A3sEncryption || (A3sEncryption = {}));
// --
export var A3sDataTypes;
(function (A3sDataTypes) {
    A3sDataTypes["autoconfig"] = "autoconfig";
    A3sDataTypes["serverinfo"] = "serverinfo";
    A3sDataTypes["events"] = "events";
    A3sDataTypes["changelogs"] = "changelogs";
})(A3sDataTypes || (A3sDataTypes = {}));
export default class A3sRemoteServer {
    /**
     *
     * @param url the ArmA3Sync server url or autoconfig url
     */
    constructor(url) {
        if (url.slice(-11) === '/autoconfig') {
            url = url.slice(0, -10);
        }
        if (url.slice(-1) !== '/') {
            url += '/';
        }
        const reqUrl = new URL(url);
        if (reqUrl.protocol !== 'http:' && reqUrl.protocol !== 'https:') {
            throw new Error('TODO: support protocols other than HTTP(S)');
        }
        this.url = reqUrl.href;
    }
    async loadData(types = ['autoconfig', 'serverinfo', 'events', 'changelogs']) {
        const req_promises = [];
        for (const t of types) {
            req_promises.push(this.loadSingleData(t));
        }
        return Promise.all(req_promises).then(() => Promise.resolve());
    }
    async loadSingleData(t) {
        return got(this.url + t, { decompress: false })
            .buffer()
            .then(buff => {
            this[t] = new InputObjectStream(gunzipSync(buff), false).readObject();
            // console.log(JSON.stringify(this[t], null, 2)); // debug
        });
        // .catch(e => console.error(t, e.message)); // debug
    }
}
