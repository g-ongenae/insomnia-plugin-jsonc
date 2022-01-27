const { requestHooks } = require('./main');

/**
 * Create a fake insomnia context with a validation on the setBody
 * @param {object} givenBody
 * @param {object} expectedBody
 * @returns a fake insomnia context with a validation
 */
const fakeContext = (id, givenBody, expectedBody) => {
  return {
    request: {
      getBody: () => givenBody,
      setBody: (actualBody) => {
        const result = actualBody.text === expectedBody.text
          ? `${id} | passed`
          : `${id} | expected: '${expectedBody.text}' => received: '${actualBody.text}'`;

        console.log(result);
      },
    }
  };
};

/**
 * List of test cases
 */
const cases = [
  // Should not alter non JSON body
  [{ mimeType: 'non-json', text: 'foo' }, { mimeType: 'non-json', text: 'foo' }],
  // Should not alter JSON body without comments
  [{ mimeType: 'application/json', text: 'foo' }, { mimeType: 'application/json', text: 'foo' }],
  [{ mimeType: 'application/json', text: '{"foo": "bar"}' }, { mimeType: 'application/json', text: '{"foo": "bar"}' }],
  // Should remove comments from JSON body (space are preserved)
  [{ mimeType: 'application/json', text: '{"foo": /* hello */ "bar"}' }, { mimeType: 'application/json', text: '{"foo":  "bar"}' }],
  [{ mimeType: 'application/json', text: '/* hello */ {"foo": "bar"}' }, { mimeType: 'application/json', text: ' {"foo": "bar"}' }],
  [{ mimeType: 'application/json', text: '{"foo": "bar" // hello\n }' }, { mimeType: 'application/json', text: '{"foo": "bar" \n }' }],
];

/**
 * Call and test the hook
 */
for (const [index, test] of Object.entries(cases)) {
  requestHooks[0](fakeContext(index, ...test));
}
