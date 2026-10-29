/**
 * Strip comments from a JSON string
 *
 * Taken from [`json-easy-strip`](https://www.npmjs.com/package/json-easy-strip).
 *
 * Extracted to not parse and stringify again the JSON string
 *
 * @param data the JSON string with comments
 * @returns the JSON string without comments
 */
const stripJSONComments = (data) =>
  data.replace(/\\"|"(?:\\"|[^"])*"|(\/\/.*|\/\*[\s\S]*?\*\/)/g, (m, g) =>
    g ? "" : m
  );

module.exports = { stripJSONComments };
