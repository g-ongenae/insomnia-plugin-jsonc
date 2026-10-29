/**
 * Strip comments from a JSON string
 *
 * Adapted from [`json-easy-strip`](https://www.npmjs.com/package/json-easy-strip),
 * with strings matched as a whole (any escaped character included) so that
 * an escaped backslash before a closing quote is handled.
 *
 * Extracted to not parse and stringify again the JSON string
 *
 * @param data the JSON string with comments
 * @returns the JSON string without comments
 */
const stripJSONComments = (data) =>
  data.replace(/"(?:\\.|[^"\\])*"|(\/\/.*|\/\*[\s\S]*?\*\/)/g, (m, g) =>
    g ? "" : m
  );

module.exports = { stripJSONComments };
