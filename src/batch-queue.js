/**
 * Batch search helpers shared by the popup and the content-script batch runner.
 *
 * QueryTemplate turns "{city} in {month}" plus value lists into concrete queries.
 * BatchStore persists the run state and one storage entry per extracted result,
 * so a single slow/failed query never rewrites the whole result set.
 */

class QueryTemplate {
    constructor() {
        this.placeholderPattern = /\{([^{}]+)\}/g;
        this.maxQueries = 1000;
    }

    discoverPlaceholders(template) {
        const text = String(template || '');
        const pattern = new RegExp(this.placeholderPattern.source, 'g');
        const found = [];
        let match;

        while ((match = pattern.exec(text)) !== null) {
            const name = match[1].trim();
            if (name && !found.includes(name)) {
                found.push(name);
            }
        }

        return found;
    }

    /**
     * Values are newline separated. When the whole input is a single line,
     * commas are used as separators instead (so "Madrid, Paris" works too).
     */
    parseValues(raw) {
        if (Array.isArray(raw)) {
            return this.deduplicate(raw.map(value => String(value).trim()));
        }

        const text = String(raw || '').replace(/\r\n/g, '\n').trim();
        if (!text) {
            return [];
        }

        const parts = text.includes('\n') ? text.split('\n') : text.split(',');
        return this.deduplicate(parts.map(part => part.trim()));
    }

    deduplicate(values) {
        const seen = new Set();
        const unique = [];

        for (const value of values) {
            if (!value) {
                continue;
            }

            const key = value.toLowerCase();
            if (seen.has(key)) {
                continue;
            }

            seen.add(key);
            unique.push(value);
        }

        return unique;
    }

    expand(template, valuesByPlaceholder, limit = this.maxQueries) {
        const text = String(template || '').trim();

        if (!text) {
            return { queries: [], duplicates: 0, error: 'Query template is empty' };
        }

        const placeholders = this.discoverPlaceholders(text);
        if (placeholders.length === 0) {
            return { queries: [], duplicates: 0, error: 'Add at least one placeholder, for example {city}' };
        }

        const valueLists = [];
        for (const name of placeholders) {
            const values = this.parseValues(valuesByPlaceholder ? valuesByPlaceholder[name] : '');
            if (values.length === 0) {
                return { queries: [], duplicates: 0, error: `No values for {${name}}` };
            }
            valueLists.push({ name, values });
        }

        const total = valueLists.reduce((count, list) => count * list.values.length, 1);
        if (total > limit) {
            return { queries: [], duplicates: 0, error: `That expands to ${total} queries, the limit is ${limit}` };
        }

        let combinations = [{}];
        for (const list of valueLists) {
            const next = [];
            for (const combination of combinations) {
                for (const value of list.values) {
                    next.push({ ...combination, [list.name]: value });
                }
            }
            combinations = next;
        }

        const queries = [];
        const seen = new Set();
        let duplicates = 0;

        for (const variables of combinations) {
            const query = text
                .replace(/\{([^{}]+)\}/g, (match, name) => {
                    const key = name.trim();
                    return Object.prototype.hasOwnProperty.call(variables, key) ? variables[key] : match;
                })
                .replace(/\s+/g, ' ')
                .trim();

            const key = query.toLowerCase();
            if (seen.has(key)) {
                duplicates++;
                continue;
            }

            seen.add(key);
            queries.push({ query, variables });
        }

        return { queries, duplicates, error: null };
    }

    buildSearchUrl(query, { language = '', runId = null } = {}) {
        const params = new URLSearchParams();
        params.set('q', query);

        if (language) {
            params.set('hl', language);
        }

        if (runId) {
            // The marker keeps the runner attached to one tab: pages without it
            // never touch the queue, no matter what the user browses meanwhile.
            params.set('aioe_run', runId);
        }

        return `https://www.google.com/search?${params.toString()}`;
    }

    normalizeQuery(query) {
        return String(query || '')
            .replace(/\+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .toLowerCase();
    }

    createRunId() {
        const stamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
        const suffix = Math.random().toString(36).slice(2, 6);
        return `run-${stamp}-${suffix}`;
    }
}

class BatchStore {
    /**
     * @param {Object|null} storageArea - optional storage.local replacement (used by tests)
     */
    constructor(storageArea = null) {
        this.stateKey = 'aioe:batch:state';
        this.resultPrefix = 'aioe:batch:result';
        this.inputsKey = 'aioe:batch:inputs';
        this.injectedArea = storageArea;
    }

    get storage() {
        if (this.injectedArea) {
            return this.injectedArea;
        }

        if (typeof browser !== 'undefined' && browser.storage && browser.storage.local) {
            return browser.storage.local;
        }

        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            return chrome.storage.local;
        }

        return null;
    }

    get changeListener() {
        if (typeof browser !== 'undefined' && browser.storage && browser.storage.onChanged) {
            return browser.storage.onChanged;
        }

        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
            return chrome.storage.onChanged;
        }

        return null;
    }

    async readKey(key) {
        const area = this.storage;
        if (!area) {
            return null;
        }

        const data = await area.get([key]);
        return data ? data[key] : null;
    }

    async writeValues(values) {
        const area = this.storage;
        if (!area) {
            return false;
        }

        await area.set(values);
        return true;
    }

    async getAll() {
        const area = this.storage;
        if (!area) {
            return {};
        }

        return await area.get(null);
    }

    async getState() {
        return (await this.readKey(this.stateKey)) || null;
    }

    async saveState(state) {
        const next = { ...state, updatedAt: new Date().toISOString() };
        await this.writeValues({ [this.stateKey]: next });
        return next;
    }

    async patchState(patch) {
        const current = await this.getState();
        if (!current) {
            return null;
        }

        return await this.saveState({ ...current, ...patch });
    }

    resultKey(runId, index) {
        return `${this.resultPrefix}:${runId}:${index}`;
    }

    async saveResult(result) {
        return await this.writeValues({ [this.resultKey(result.runId, result.index)]: result });
    }

    async getResults(runId) {
        if (!runId) {
            return [];
        }

        const all = await this.getAll();
        const prefix = `${this.resultPrefix}:${runId}:`;

        return Object.keys(all)
            .filter(key => key.startsWith(prefix))
            .map(key => all[key])
            .filter(result => result && typeof result.index === 'number')
            .sort((a, b) => a.index - b.index);
    }

    countByStatus(results) {
        const counts = { ok: 0, noOverview: 0, error: 0, total: 0 };

        for (const result of results) {
            counts.total++;
            if (result.status === 'ok') {
                counts.ok++;
            } else if (result.status === 'no-overview') {
                counts.noOverview++;
            } else {
                counts.error++;
            }
        }

        return counts;
    }

    async clearResults(runId = null) {
        const all = await this.getAll();
        const prefix = runId ? `${this.resultPrefix}:${runId}:` : `${this.resultPrefix}:`;
        const keys = Object.keys(all).filter(key => key.startsWith(prefix));

        if (keys.length === 0) {
            return 0;
        }

        await this.storage.remove(keys);
        return keys.length;
    }

    async clearOtherRuns(runId) {
        const all = await this.getAll();
        const prefix = `${this.resultPrefix}:`;
        const keepPrefix = `${this.resultPrefix}:${runId}:`;
        const keys = Object.keys(all).filter(key => key.startsWith(prefix) && !key.startsWith(keepPrefix));

        if (keys.length === 0) {
            return 0;
        }

        await this.storage.remove(keys);
        return keys.length;
    }

    async getInputs() {
        return (await this.readKey(this.inputsKey)) || null;
    }

    async saveInputs(inputs) {
        return await this.writeValues({ [this.inputsKey]: inputs });
    }

    /**
     * Callback receives the new batch state (or null when it was removed).
     */
    onStateChanged(callback) {
        const listener = this.changeListener;
        if (!listener) {
            return;
        }

        listener.addListener((changes, areaName) => {
            if (areaName && areaName !== 'local') {
                return;
            }

            if (!changes || !changes[this.stateKey]) {
                return;
            }

            callback(changes[this.stateKey].newValue || null);
        });
    }
}

if (typeof window !== 'undefined') {
    window.QueryTemplate = QueryTemplate;
    window.BatchStore = BatchStore;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { QueryTemplate, BatchStore };
}
