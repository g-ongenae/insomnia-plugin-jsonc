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

/**
 * Strip trailing commas before a closing `]` or `}` from a JSON string
 *
 * Must run after `stripJSONComments`, so that a comment between the comma
 * and the closing bracket does not hide it.
 *
 * @param data the JSON string without comments
 * @returns the JSON string without trailing commas
 */
const stripTrailingCommas = (data) =>
  data.replace(/"(?:\\.|[^"\\])*"|,(\s*[\]}])/g, (m, g) =>
    g === undefined ? m : g
  );

/**
 * Strip comments and trailing commas from a JSONC string
 *
 * @param data the JSONC string
 * @returns the JSON string
 */
const stripJSONC = (data) => stripTrailingCommas(stripJSONComments(data));

module.exports = { stripJSONComments, stripTrailingCommas, stripJSONC };
