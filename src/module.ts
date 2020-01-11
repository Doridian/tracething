import fetch from "node-fetch";

export interface DNSModule {
    handle(name: string[]): Promise<string[]>;
}

const MODULES: { [key: string]: DNSModule } = {};

export function getDNSModule(name: string): DNSModule {
    return MODULES[name];
}

const DASH_CHAR = '-'.charCodeAt(0);
const DOT_CHAR = '.'.charCodeAt(0);

export function cleanupDataAndSplit(data: string): string[] {
    data = data
        .replace(/[^a-zA-Z0-9\.\-]/g, '.')
        .toLowerCase()
        .replace(/\.\.+/g, '.')
        .replace(/--+/g, '-')
        .replace(/\.-/g, '.0-')
        .replace(/-\./g, '-0.');

    if (data.charCodeAt(0) === DOT_CHAR || data.charCodeAt(0) === DASH_CHAR) {
        data = `0${data}`;
    }
    if (data.charCodeAt(data.length - 1) === DASH_CHAR || data.charCodeAt(data.length - 1) === DOT_CHAR) {
        data = `${data}0`;
    }

    const spls = data.split('.');

    const res = [];
    let curStr = [];
    let curLen = 0;
    for (const spl of spls) {
        curStr.push(spl);
        curLen += spl.length;
        if (curLen > 64) {
            res.push(curStr.join('.'));
            curStr = [];
            curLen = 0;
        }
    }

    if (curLen > 0) {
        res.push(curStr.join('.'));
        curStr = [];
        curLen = 0;
    }

    return res;
}

class GistDNSModule implements DNSModule {
    async handle(name: string[]): Promise<string[]> {
        const resp = await fetch(`https://gist.githubusercontent.com/${name[1]}/${name[0]}/raw`);
        const rawData = await resp.text();
        return cleanupDataAndSplit(rawData);
    }
}

MODULES.gist = new GistDNSModule();

class WikipediaModule implements DNSModule {
    async handle(name: string[]): Promise<string[]> {
        const resp = await fetch(`https://en.wikipedia.org/w/api.php?action=query&format=json&titles=${name[0]}&prop=extracts&exintro&explaintext`);
        const rawObj = await resp.json();
        const pages = rawObj.query.pages;
        const page = <any>Object.values(pages)[0];
        return cleanupDataAndSplit(page.extract);
    }
}
MODULES.wikipedia = new WikipediaModule();
