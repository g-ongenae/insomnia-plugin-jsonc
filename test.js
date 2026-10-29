const { test } = require('node:test');
const assert = require('node:assert/strict');
const { requestHooks } = require('./main');

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
  ['should not alter non JSON body', { mimeType: 'non-json', text: 'foo' }, { mimeType: 'non-json', text: 'foo' }],
  ['should not alter invalid JSON body without comments', { mimeType: 'application/json', text: 'foo' }, { mimeType: 'application/json', text: 'foo' }],
  ['should not alter JSON body without comments', { mimeType: 'application/json', text: '{"foo": "bar"}' }, { mimeType: 'application/json', text: '{"foo": "bar"}' }],
  // Spaces around comments are preserved
  ['should remove inline block comment', { mimeType: 'application/json', text: '{"foo": /* hello */ "bar"}' }, { mimeType: 'application/json', text: '{"foo":  "bar"}' }],
  ['should remove leading block comment', { mimeType: 'application/json', text: '/* hello */ {"foo": "bar"}' }, { mimeType: 'application/json', text: ' {"foo": "bar"}' }],
  ['should remove line comment', { mimeType: 'application/json', text: '{"foo": "bar" // hello\n }' }, { mimeType: 'application/json', text: '{"foo": "bar" \n }' }],
];

for (const [name, givenBody, expectedBody] of cases) {
  test(name, () => {
    const [actualBody = givenBody] = runHook(givenBody);
    assert.equal(actualBody.text, expectedBody.text);
  });
}
