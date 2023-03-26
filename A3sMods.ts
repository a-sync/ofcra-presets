import { parse } from 'arma-class-parser';
import got from 'got';
import { Low, JSONFile } from '@commonify/lowdb';
import { A3sEventsDto } from './A3sRemoteServer';

export interface Mod {
    id: string;
    name: string;
    publishedid?: string;
    download?: string;
    dlcid?: string;
}

export interface Modlist {
    [key: string]: Mod;
}

interface Db {
    mods: Modlist;
}

const OFCRA_MOD_INDEX = 'https://ofcrav2.org/index.php?page=repository-en';

export default class A3sMods {
    private a3s_repo_url: string;
    private db_file: string;
    private overrides?: Modlist;
    private db: Low<Db> | null = null;

    /**
     * 
     * @param a3s_repo_url the ArmA3Sync repo root url
     * @param db_file db storage file
     * @param overrides mod item overrides
     * @param dl_url_tpl mod download url template
     */
    constructor(a3s_repo_url: string, db_file: string, overrides?: Modlist) {
        this.a3s_repo_url = a3s_repo_url;
        this.db_file = db_file;
        this.overrides = overrides;
    }

    async init(): Promise<void> {
        const adapter = new JSONFile<Db>(this.db_file);
        this.db = new Low<Db>(adapter);
        await this.db.read();
        this.db.data = this.db.data || { mods: {} };
    }

    async save(): Promise<void> {
        if (this.db && this.db.data) {
            return this.db.write();
        }
    }

    async parseA3sEvents(events: A3sEventsDto): Promise<void> {
        if (this.db && this.db.data) {
            const new_mods: Mod[] = [];

            let updated = false;
            for (const e of events.list) {
                for (const a in e.addonNames) {
                    if (this.db.data.mods[a] === undefined && new_mods.find(m => m.id === a) === undefined) {
                        updated = true;

                        if (this.overrides && this.overrides[a] !== undefined) {
                            this.db.data.mods[a] = this.overrides[a];
                        } else {
                            new_mods.push({
                                id: a,
                                name: a
                            });
                        }
                    }
                }
            }

            if (new_mods.length > 0) {
                const added_mods = await this.fetchRepoIndexData(new_mods);

                const promises = [];
                for (const m of added_mods) {
                    promises.push(this.fetchSourceData(m.id).catch(e => { }));
                }

                await Promise.all(promises);
            }

            if (updated) {
                this.save().catch(e => {
                    console.error(e.message);
                });
            }
        } else {
            throw new Error('Db not initialized');
        }
    }

    // Note: this function is OFCRA specific
    private async fetchRepoIndexData(new_mods: Mod[]) {
        if (this.db && this.db.data) {
            let rows: string[] = [];

            try {
                const src = await got(OFCRA_MOD_INDEX, { timeout: 3000 }).text();
                rows = src.split('<tr>').slice(2);
            } catch (err: any) {
                console.error(err?.message);
            }

            if (rows.length > 0) {
                for (const r of rows) {
                    const link_id = r.match(/<td>(.*?)<\/td><td>(.*?)<\/td>/);
                    if (link_id) {
                        const rm: Mod = {
                            id: link_id[2],
                            name: link_id[2]
                        };

                        const url = link_id[1].match(/href="(.*?)"/);
                        if (url) {
                            if (url[1].indexOf('/filedetails/?id=') !== -1) {
                                rm.publishedid = url[1].split('?id=')[1];
                            } else {
                                rm.download = url[1];
                            }
                        }

                        const nm = new_mods.find(m => m.id === rm.id);
                        if (nm) {
                            if (rm.publishedid) {
                                nm.publishedid = rm.publishedid;
                            }
                            if (rm.download) {
                                nm.download = rm.download;
                            }
                            this.db.data.mods[nm.id] = nm;
                        } else {
                            if (!this.db.data.mods[rm.id]) {
                                const nm: Mod = {
                                    id: rm.id,
                                    name: rm.id,
                                } as Mod;
                                this.db.data.mods[rm.id] = nm;
                            }
                            if (rm.publishedid) {
                                this.db.data.mods[rm.id].publishedid = rm.publishedid;
                            }
                            if (rm.download) {
                                this.db.data.mods[rm.id].download = rm.download;
                            }
                            new_mods.push(this.db.data.mods[rm.id]);
                        }
                    }
                }
            } else {
                console.warn('repo index empty');
                for (const nm of new_mods) {
                    if (!this.db.data.mods[nm.id]) {
                        this.db.data.mods[nm.id] = nm;
                    }
                }
            }
        }

        return new_mods;
    }

    private async fetchSourceData(id: string) {
        if (this.db && this.db.data && this.db.data.mods[id]) {
            let meta_cpp = await this.parseModSource(id, 'meta');
            let mod_cpp = await this.parseModSource(id, 'mod');

            if (meta_cpp) {
                if (meta_cpp.name) {
                    this.db.data.mods[id].name = meta_cpp.name;
                }
                if (meta_cpp.publishedid) {
                    this.db.data.mods[id].publishedid = String(meta_cpp.publishedid);
                }
            }

            if (mod_cpp) {
                if (mod_cpp.name && this.db.data.mods[id].name === id) {
                    const name_semver = mod_cpp.name.match(/(.*) \d\.\d\.\d$/);
                    if (name_semver) {
                        this.db.data.mods[id].name = name_semver[1];
                    } else {
                        this.db.data.mods[id].name = mod_cpp.name;
                    }
                }

                if (mod_cpp.action && this.db.data.mods[id].publishedid === undefined) {
                    if (mod_cpp.action.indexOf('/filedetails/?id=') !== -1) {
                        this.db.data.mods[id].publishedid = mod_cpp.action.split('?id=')[1];
                    } else if (this.db.data.mods[id].download === undefined) {
                        this.db.data.mods[id].download = mod_cpp.action;
                    }
                }
            }

            if (this.db.data.mods[id].publishedid && this.db.data.mods[id].name === id) {
                const stream = got.stream('https://steamcommunity.com/sharedfiles/filedetails/?id=' + this.db.data.mods[id].publishedid);
                const head: string = await new Promise((resolve, reject) => {
                    let chunks: string = '';
                    stream.on('error', reject);
                    stream.on('data', data => {
                        chunks += data;
                        if (chunks.indexOf('</title>') !== -1) {
                            stream.destroy();
                            resolve(chunks);
                        }
                    });
                    stream.on('end', () => reject());
                });

                const name = head.match(/<title>Steam Workshop::(.*?)<\/title>/);
                if (name && name[1]) {
                    this.db.data.mods[id].name = name[1];
                }
            }
        }
    }

    private async parseModSource(id: string, type: string = 'meta') {
        const file_url = this.a3s_repo_url + id + '/' + type + '.cpp';
        let cpp = null;

        let raw: Buffer | null = null;
        try {
            raw = await got(file_url, { encoding: 'binary', responseType: 'buffer', resolveBodyOnly: true, timeout: 3000 });
        } catch (err) { }

        if (raw) {
            try {
                cpp = parse(raw.toString('utf8'));
            } catch (err_utf8) {
                try {
                    cpp = parse(raw.toString('utf16le'));
                } catch (err_utf16) {
                    console.error('Parsing error', file_url);
                }
            }
        }

        return cpp;
    }

    getMods() {
        return this.db?.data?.mods;
    }
}
