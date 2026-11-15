const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

/**
 * markdown-generator.js is a browser script that expects TurndownService as a
 * global, so it is loaded in a vm context with a stub converter. Only the
 * string post-processing is under test here.
 */
function loadGenerator() {
    const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'markdown-generator.js'), 'utf8');
    const sandbox = {
        console: { log() {} },
        state: { output: '' }
    };

    sandbox.TurndownService = class {
        addRule() {}

        turndown() {
            return sandbox.state.output;
        }
    };

    vm.createContext(sandbox);
    vm.runInContext(`${source}\nthis.MarkdownGenerator = MarkdownGenerator;`, sandbox);

    return {
        create(output, sources = [], query = null, options = {}) {
            sandbox.state.output = output;
            return new sandbox.MarkdownGenerator().createMarkdown('ignored', sources, query, options);
        }
    };
}

test('default output keeps the AI Overview header and the search query', () => {
    const generator = loadGenerator();
    const markdown = generator.create('Madrid is mild in March.', [], 'attractions in Madrid');

    assert.ok(markdown.startsWith('# AI Overview'));
    assert.ok(markdown.includes('**Search Query:** attractions in Madrid'));
    assert.ok(markdown.includes('Madrid is mild in March.'));
});

test('batch options drop both the header and the query line', () => {
    const generator = loadGenerator();
    const markdown = generator.create(
        'Madrid is mild in March.',
        [],
        'attractions in Madrid',
        { includeHeader: false, includeSearchQuery: false }
    );

    assert.ok(markdown.startsWith('Madrid is mild in March.'), `unexpected start: ${markdown.slice(0, 60)}`);
    assert.ok(!/AI Overview/.test(markdown));
    assert.ok(!markdown.includes('attractions in Madrid'));
});

test('a leading AI Overview heading rendered by Google is removed', () => {
    const generator = loadGenerator();
    const variants = [
        '**AI Overview**\n\nMadrid is mild in March.',
        '## AI Overview\n\nMadrid is mild in March.',
        '# AI Overview\n\n**AI Overview**\n\nMadrid is mild in March.',
        'AI Overview\n\nMadrid is mild in March.'
    ];

    for (const variant of variants) {
        const markdown = generator.create(variant, [], null, { includeHeader: false, includeSearchQuery: false });
        assert.ok(markdown.startsWith('Madrid is mild in March.'), `not stripped: ${markdown.slice(0, 60)}`);
    }
});

test('an AI Overview mention inside the answer is kept', () => {
    const generator = loadGenerator();
    const markdown = generator.create(
        'Google shows an AI Overview at the top of results.',
        [],
        null,
        { includeHeader: false, includeSearchQuery: false }
    );

    assert.ok(markdown.includes('an AI Overview at the top'));
});

test('sources are appended after the body', () => {
    const generator = loadGenerator();
    const markdown = generator.create(
        'Madrid is mild in March.',
        [{ title: 'Retiro guide', url: 'https://example.com/retiro' }],
        null,
        { includeHeader: false, includeSearchQuery: false }
    );

    assert.ok(markdown.startsWith('Madrid is mild in March.'));
    assert.ok(markdown.includes('## Sources'));
    assert.ok(markdown.includes('[**Retiro guide**](https://example.com/retiro)'));
});

test('includeSources false leaves the sources out of the markdown', () => {
    const generator = loadGenerator();
    const markdown = generator.create(
        'Madrid is mild in March.',
        [{ title: 'Retiro guide', url: 'https://example.com/retiro' }],
        null,
        { includeHeader: false, includeSearchQuery: false, includeSources: false }
    );

    assert.equal(markdown.trim(), 'Madrid is mild in March.');
    assert.ok(!markdown.includes('## Sources'));
    assert.ok(!markdown.includes('example.com'));
});
