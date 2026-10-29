const { test } = require('node:test');
const assert = require('node:assert/strict');
const fc = require('fast-check');
const { requestHooks } = require('./main');
const { stripJSONComments } = require('./strip');

/**
 * Run the hook on a fake insomnia context
 * @param {object} givenBody the body returned by getBody
 * @returns the list of bodies passed to setBody
 */
const runHook = (givenBody) => {
  const calls = [];
  requestHooks[0]({
    request: {
      getBody: () => givenBody,
      setBody: (body) => calls.push(body),
    },
  });
  return calls;
};

/**
 * List of test cases: [name, given body, expected body]
 */
const cases = [
  ['should not alter invalid JSON body without comments', { mimeType: 'application/json', text: 'foo' }, { mimeType: 'application/json', text: 'foo' }],
  ['should not alter JSON body without comments', { mimeType: 'application/json', text: '{"foo": "bar"}' }, { mimeType: 'application/json', text: '{"foo": "bar"}' }],
  // Spaces around comments are preserved
  ['should remove inline block comment', { mimeType: 'application/json', text: '{"foo": /* hello */ "bar"}' }, { mimeType: 'application/json', text: '{"foo":  "bar"}' }],
  ['should remove leading block comment', { mimeType: 'application/json', text: '/* hello */ {"foo": "bar"}' }, { mimeType: 'application/json', text: ' {"foo": "bar"}' }],
  ['should remove line comment after the last item', { mimeType: 'application/json', text: '{"a": 1 // last\n}' }, { mimeType: 'application/json', text: '{"a": 1 \n}' }],
  ['should remove line comment', { mimeType: 'application/json', text: '{"foo": "bar" // hello\n }' }, { mimeType: 'application/json', text: '{"foo": "bar" \n }' }],
];

test('should not call setBody on non JSON body', () => {
  assert.deepEqual(runHook({ mimeType: 'non-json', text: 'foo // bar' }), []);
});

for (const [name, givenBody, expectedBody] of cases) {
  test(name, () => {
    const calls = runHook(givenBody);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].text, expectedBody.text);
  });
}

test('should keep comment-like content in a string after an escaped backslash', () => {
  const text = String.raw`{"a": "x\\", "b": "// y"}`;
  const [body] = runHook({ mimeType: 'application/json', text });
  assert.equal(body.text, text);
  assert.deepEqual(JSON.parse(body.text), { a: 'x\\', b: '// y' });
});

test('should strip comments inserted in any JSON document', () => {
  const comment = fc.string({ unit: 'grapheme-ascii' }).filter((c) => !c.includes('*/'));
  const lineComments = fc.array(fc.record({ block: fc.option(comment), line: fc.option(comment) }));

  fc.assert(
    fc.property(fc.jsonValue(), lineComments, (value, comments) => {
      // JSON.stringify escapes newlines in strings, so each line starts and ends on a token boundary
      const json = JSON.stringify(value, null, 2);
      const text = json
        .split('\n')
        .map((line, i) => {
          const { block = null, line: lineComment = null } = comments[i] ?? {};
          return `${block === null ? '' : `/*${block}*/`}${line}${lineComment === null ? '' : `//${lineComment}`}`;
        })
        .join('\n');

      // Compare with the parsed original rather than `value`, since -0 does not survive JSON
      assert.deepEqual(JSON.parse(stripJSONComments(text)), JSON.parse(json));
    }),
  );
});
