const test = require('node:test');
const assert = require('node:assert/strict');
const { QueryTemplate, BatchStore } = require('../src/batch-queue.js');

class MockStorageArea {
    constructor(initial = {}) {
        this.data = { ...initial };
    }

    async get(keys) {
        if (keys === null) {
            return { ...this.data };
        }

        const list = Array.isArray(keys) ? keys : [keys];
        const result = {};
        for (const key of list) {
            if (key in this.data) {
                result[key] = this.data[key];
            }
        }
        return result;
    }

    async set(values) {
        Object.assign(this.data, values);
    }

    async remove(keys) {
        const list = Array.isArray(keys) ? keys : [keys];
        for (const key of list) {
            delete this.data[key];
        }
    }
}

const template = new QueryTemplate();

test('discoverPlaceholders finds unique names in order', () => {
    assert.deepEqual(
        template.discoverPlaceholders('attractions in {city} during {month}, not {city}'),
        ['city', 'month']
    );
    assert.deepEqual(template.discoverPlaceholders('no placeholders here'), []);
    assert.deepEqual(template.discoverPlaceholders('{ spaced name }'), ['spaced name']);
});

test('parseValues splits on newlines, falls back to commas and dedupes', () => {
    assert.deepEqual(template.parseValues('Madrid\nParis\n\n  Rome  '), ['Madrid', 'Paris', 'Rome']);
    assert.deepEqual(template.parseValues('Madrid, Paris, Rome'), ['Madrid', 'Paris', 'Rome']);
    assert.deepEqual(template.parseValues('Madrid\nmadrid\nParis'), ['Madrid', 'Paris']);
    assert.deepEqual(template.parseValues(''), []);
});

test('expand produces the cartesian product with the first placeholder outermost', () => {
    const result = template.expand('{city} in {month}', {
        city: 'Madrid\nParis',
        month: 'March\nJune'
    });

    assert.equal(result.error, null);
    assert.deepEqual(result.queries.map(item => item.query), [
        'Madrid in March',
        'Madrid in June',
        'Paris in March',
        'Paris in June'
    ]);
    assert.deepEqual(result.queries[0].variables, { city: 'Madrid', month: 'March' });
});

test('expand reports input problems instead of returning partial queries', () => {
    assert.match(template.expand('', {}).error, /empty/i);
    assert.match(template.expand('plain text query', {}).error, /placeholder/i);
    assert.match(template.expand('{city}', { city: '   ' }).error, /No values for \{city\}/);
});

test('expand refuses to build more than the query limit', () => {
    const cities = Array.from({ length: 40 }, (unused, index) => `City ${index}`).join('\n');
    const months = Array.from({ length: 30 }, (unused, index) => `Month ${index}`).join('\n');
    const result = template.expand('{city} {month}', { city: cities, month: months });

    assert.equal(result.queries.length, 0);
    assert.match(result.error, /limit is 1000/);
});

test('expand drops queries that would run twice', () => {
    const result = template.expand('{city} attractions', {
        city: 'New York\nNew   York'
    });

    assert.deepEqual(result.queries.map(item => item.query), ['New York attractions']);
    assert.equal(result.duplicates, 1);
});

test('buildSearchUrl encodes the query and carries language and run marker', () => {
    const url = template.buildSearchUrl('main attractions in Madrid & Paris?', {
        language: 'en',
        runId: 'run-1'
    });
    const parsed = new URL(url);

    assert.equal(parsed.origin + parsed.pathname, 'https://www.google.com/search');
    assert.equal(parsed.searchParams.get('q'), 'main attractions in Madrid & Paris?');
    assert.equal(parsed.searchParams.get('hl'), 'en');
    assert.equal(parsed.searchParams.get('aioe_run'), 'run-1');
});

test('normalizeQuery ignores case, plus signs and repeated spaces', () => {
    assert.equal(
        template.normalizeQuery('Main+Attractions   in Madrid'),
        template.normalizeQuery('main attractions in madrid')
    );
});

test('createRunId is url safe and unique', () => {
    const first = template.createRunId();
    const second = template.createRunId();

    assert.match(first, /^run-[0-9]{14}-[a-z0-9]{4}$/);
    assert.notEqual(first, second);
});

test('store round trips the run state and patches it', async () => {
    const store = new BatchStore(new MockStorageArea());
    assert.equal(await store.getState(), null);

    await store.saveState({ runId: 'run-1', status: 'running', queryIndex: 0, queries: [{ query: 'a' }] });
    const saved = await store.getState();
    assert.equal(saved.status, 'running');
    assert.ok(saved.updatedAt);

    const patched = await store.patchState({ status: 'paused' });
    assert.equal(patched.status, 'paused');
    assert.equal(patched.queryIndex, 0);
});

test('store keeps one entry per result and reads them sorted', async () => {
    const store = new BatchStore(new MockStorageArea());

    await store.saveResult({ runId: 'run-1', index: 2, status: 'no-overview', query: 'c' });
    await store.saveResult({ runId: 'run-1', index: 0, status: 'ok', query: 'a' });
    await store.saveResult({ runId: 'run-1', index: 1, status: 'ok', query: 'b' });
    await store.saveResult({ runId: 'run-2', index: 0, status: 'ok', query: 'other run' });

    const results = await store.getResults('run-1');
    assert.deepEqual(results.map(result => result.query), ['a', 'b', 'c']);

    const counts = store.countByStatus(results);
    assert.deepEqual(counts, { ok: 2, noOverview: 1, error: 0, total: 3 });
});

test('store clears results per run and across runs', async () => {
    const store = new BatchStore(new MockStorageArea());

    await store.saveResult({ runId: 'run-1', index: 0, status: 'ok', query: 'a' });
    await store.saveResult({ runId: 'run-2', index: 0, status: 'ok', query: 'b' });

    await store.clearOtherRuns('run-2');
    assert.equal((await store.getResults('run-1')).length, 0);
    assert.equal((await store.getResults('run-2')).length, 1);

    assert.equal(await store.clearResults(), 1);
    assert.equal((await store.getResults('run-2')).length, 0);
});

test('store persists the last used template, values and config', async () => {
    const store = new BatchStore(new MockStorageArea());
    const inputs = {
        template: '{city} in {month}',
        values: { city: 'Madrid', month: 'March' },
        config: { delayMs: 5000, language: 'en' }
    };

    await store.saveInputs(inputs);
    assert.deepEqual(await store.getInputs(), inputs);
});
