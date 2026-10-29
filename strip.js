const QUOTE = 34; // "
const SLASH = 47; // /
const STAR = 42; // *
const BACKSLASH = 92; // \
const COMMA = 44; // ,
const CLOSING_BRACKET = 93; // ]
const CLOSING_BRACE = 125; // }

/**
 * Check if a character code is JSON whitespace
 * @param code the character code
 * @returns whether it is a space, a tab, a line feed or a carriage return
 */
const isWhitespace = (code) =>
  code === 32 || code === 10 || code === 13 || code === 9;

/**
 * Find the end of the string opening at `start`
 *
 * A quote preceded by an odd number of backslashes is escaped, so `"C:\\"` ends on its last quote.
 *
 * @param data the JSONC string
 * @param start the index of the opening quote
 * @returns the index after the closing quote, or -1 if the string is not terminated
 */
const skipString = (data, start) => {
  let i = start;
  for (;;) {
    const quote = data.indexOf('"', i + 1);
    if (quote === -1) return -1;
    let backslash = quote - 1;
    while (data.charCodeAt(backslash) === BACKSLASH) backslash--;
    if ((quote - 1 - backslash) % 2 === 0) return quote + 1;
    i = quote;
  }
};

/**
 * Strip comments and trailing commas from a JSONC string
 *
 * Scans the string once, jumping over strings and comments with `indexOf`, and copies
 * the kept text by slices. The string is returned as is when nothing is removed.
 *
 * An unterminated block comment is kept, so that invalid JSON is sent as is.
 *
 * @param data the JSONC string
 * @returns the JSON string
 */
const stripJSONC = (data) => {
  const length = data.length;
  /** Kept slices, only allocated once something is removed */
  let parts = null;
  /** First index not copied to `parts` yet */
  let start = 0;
  /** Index of a comma only followed by whitespace or comments so far */
  let comma = -1;
  /** Index in `parts` of that comma, once copied */
  let commaPart = -1;
  /** Whether a block comment can still be closed, to not search the rest again for each opening */
  let hasBlockEnd = true;

  const flush = (end) => {
    parts ??= [];
    if (end > start) parts.push(data.slice(start, end));
  };

  // Copy a pending comma in its own part, to be able to drop it on a closing bracket
  const detachComma = () => {
    if (comma === -1 || commaPart !== -1) return;
    flush(comma);
    commaPart = parts.push(",") - 1;
    start = comma + 1;
  };

  for (let i = 0; i < length;) {
    const code = data.charCodeAt(i);
    if (code === QUOTE) {
      const end = skipString(data, i);
      if (end === -1) break;
      comma = -1;
      i = end;
    } else if (code === SLASH && data.charCodeAt(i + 1) === SLASH) {
      detachComma();
      flush(i);
      const lineFeed = data.indexOf("\n", i + 2);
      i = start = lineFeed === -1 ? length : lineFeed;
    } else if (
      code === SLASH &&
      data.charCodeAt(i + 1) === STAR &&
      hasBlockEnd
    ) {
      const end = data.indexOf("*/", i + 2);
      if (end === -1) {
        // No later block comment can be terminated either
        hasBlockEnd = false;
        continue;
      }
      detachComma();
      flush(i);
      i = start = end + 2;
    } else if (code === COMMA) {
      comma = i;
      commaPart = -1;
      i++;
    } else if (code === CLOSING_BRACKET || code === CLOSING_BRACE) {
      if (comma !== -1 && commaPart !== -1) {
        parts[commaPart] = "";
      } else if (comma !== -1) {
        flush(comma);
        start = comma + 1;
      }
      comma = -1;
      i++;
    } else {
      if (!isWhitespace(code)) comma = -1;
      i++;
    }
  }

  if (parts === null) return data;
  flush(length);
  return parts.join("");
};

module.exports = { stripJSONC };
