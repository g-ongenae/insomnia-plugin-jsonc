const { test } = require("node:test");
const assert = require("node:assert/strict");
const fc = require("fast-check");
const { requestHooks } = require("./main");
const { stripJSONC } = require("./strip");
const { stripJSONC: stripJSONCWithRegex } = require("./bench/regex");

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
  [
    "should not alter invalid JSON body without comments",
    { mimeType: "application/json", text: "foo" },
    { mimeType: "application/json", text: "foo" },
  ],
  [
    "should not alter JSON body without comments",
    { mimeType: "application/json", text: '{"foo": "bar"}' },
    { mimeType: "application/json", text: '{"foo": "bar"}' },
  ],
  // Spaces around comments are preserved
  [
    "should remove inline block comment",
    { mimeType: "application/json", text: '{"foo": /* hello */ "bar"}' },
    { mimeType: "application/json", text: '{"foo":  "bar"}' },
  ],
  [
    "should remove leading block comment",
    { mimeType: "application/json", text: '/* hello */ {"foo": "bar"}' },
    { mimeType: "application/json", text: ' {"foo": "bar"}' },
  ],
  [
    "should remove line comment after the last item",
    { mimeType: "application/json", text: '{"a": 1 // last\n}' },
    { mimeType: "application/json", text: '{"a": 1 \n}' },
  ],
  [
    "should remove line comment",
    { mimeType: "application/json", text: '{"foo": "bar" // hello\n }' },
    { mimeType: "application/json", text: '{"foo": "bar" \n }' },
  ],
  [
    "should remove trailing comma in object",
    { mimeType: "application/json", text: '{"a": 1, }' },
    { mimeType: "application/json", text: '{"a": 1 }' },
  ],
  [
    "should remove trailing comma in array",
    { mimeType: "application/json", text: "[1,\n]" },
    { mimeType: "application/json", text: "[1\n]" },
  ],
  [
    "should remove trailing comma followed by a comment",
    { mimeType: "application/json", text: '{"a": 1, // last\n}' },
    { mimeType: "application/json", text: '{"a": 1 \n}' },
  ],
  [
    "should remove trailing comma followed by a block comment",
    { mimeType: "application/json", text: "[1, /* last */]" },
    { mimeType: "application/json", text: "[1 ]" },
  ],
  [
    "should not remove comma-like content in strings",
    { mimeType: "application/json", text: '{"a": ",}", "b": ",]"}' },
    { mimeType: "application/json", text: '{"a": ",}", "b": ",]"}' },
  ],
  [
    "should handle JSON MIME type with parameters",
    { mimeType: "application/json; charset=utf-8", text: '{"a": 1 /* b */}' },
    { mimeType: "application/json; charset=utf-8", text: '{"a": 1 }' },
  ],
  [
    "should handle JSON MIME type case-insensitively",
    { mimeType: "Application/JSON", text: '{"a": 1 /* b */}' },
    { mimeType: "Application/JSON", text: '{"a": 1 }' },
  ],
  [
    "should handle +json MIME types",
    { mimeType: "application/vnd.api+json", text: '{"a": 1 /* b */}' },
    { mimeType: "application/vnd.api+json", text: '{"a": 1 }' },
  ],
  [
    "should strip comments in an array body",
    { mimeType: "application/json", text: "[1, // c\n 2]" },
    { mimeType: "application/json", text: "[1, \n 2]" },
  ],
  [
    "should keep a comma followed by a comment and a value",
    { mimeType: "application/json", text: "[1, /* x */ 2]" },
    { mimeType: "application/json", text: "[1,  2]" },
  ],
  [
    "should remove nested trailing commas",
    { mimeType: "application/json", text: '[[1,],{"a": [],},]' },
    { mimeType: "application/json", text: '[[1],{"a": []}]' },
  ],
  [
    "should remove a trailing comma between two comments",
    { mimeType: "application/json", text: "[1/* a */,// b\n]" },
    { mimeType: "application/json", text: "[1\n]" },
  ],
  [
    "should keep an unterminated block comment",
    { mimeType: "application/json", text: '{"a": 1 /* b' },
    { mimeType: "application/json", text: '{"a": 1 /* b' },
  ],
  [
    "should keep comment-like content after an escaped quote",
    {
      mimeType: "application/json",
      text: String.raw`{"a": "\" // b", "c": "\\\" /* d */"}`,
    },
    {
      mimeType: "application/json",
      text: String.raw`{"a": "\" // b", "c": "\\\" /* d */"}`,
    },
  ],
  // A line comment ends at any JavaScript line terminator, which is kept
  ...[
    ["\\r", "\r"],
    ["\\r\\n", "\r\n"],
    ["\\u2028", "\u2028"],
    ["\\u2029", "\u2029"],
  ].map(([name, terminator]) => [
    `should end a line comment at ${name}`,
    { mimeType: "application/json", text: `[1, // c${terminator}2]` },
    { mimeType: "application/json", text: `[1, ${terminator}2]` },
  ]),
];

test("should not call setBody on non JSON body", () => {
  assert.deepEqual(runHook({ mimeType: "non-json", text: "foo // bar" }), []);
  assert.deepEqual(
    runHook({ mimeType: "application/jsonp", text: "foo // bar" }),
    [],
  );
  assert.deepEqual(runHook({ text: "foo // bar" }), []);
});

test("should not throw nor call setBody on empty JSON body", () => {
  assert.deepEqual(runHook({ mimeType: "application/json" }), []);
});

for (const [name, givenBody, expectedBody] of cases) {
  test(name, () => {
    const calls = runHook(givenBody);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].text, expectedBody.text);
  });
}

test("should keep comment-like content in a string after an escaped backslash", () => {
  const text = String.raw`{"a": "x\\", "b": "// y"}`;
  const [body] = runHook({ mimeType: "application/json", text });
  assert.equal(body.text, text);
  assert.deepEqual(JSON.parse(body.text), { a: "x\\", b: "// y" });
});

test("should keep a Windows path ending with an escaped backslash", () => {
  const text = String.raw`{"path": "C:\\dir\\", "url": "http://x", "tags": ["a",]}`;
  const [body] = runHook({ mimeType: "application/json", text });
  assert.deepEqual(JSON.parse(body.text), {
    path: "C:\\dir\\",
    url: "http://x",
    tags: ["a"],
  });
});

test("should keep comment-like content in a long string", () => {
  const text = JSON.stringify({
    blob: `${"x".repeat(1 << 16)} // y /* z */,]`,
  });
  const [body] = runHook({ mimeType: "application/json", text });
  assert.equal(body.text, text);
});

test("should strip comments and trailing commas inserted in any JSON document", () => {
  const comment = fc
    .string({ unit: "grapheme-ascii" })
    .filter((c) => !c.includes("*/"));
  // Block comments can span several lines
  const blockComment = fc
    .array(comment, { maxLength: 3 })
    .map((lines) => lines.join("\n"));
  const lineComments = fc.array(
    fc.record({
      block: fc.option(blockComment),
      beforeComma: fc.option(blockComment),
      line: fc.option(comment),
      trailingComma: fc.boolean(),
    }),
  );

  fc.assert(
    fc.property(fc.jsonValue(), lineComments, (value, comments) => {
      // JSON.stringify escapes newlines in strings, so each line starts and ends on a token boundary
      const json = JSON.stringify(value, null, 2);
      const text = json
        .split("\n")
        .map((line, i, lines) => {
          const {
            block = null,
            beforeComma = null,
            line: lineComment = null,
            trailingComma = false,
          } = comments[i] ?? {};
          // A trailing comma is allowed after the last value of a non-empty array or object
          const isLastValue =
            /^\s*[\]}]/.test(lines[i + 1] ?? "") && !/[[{]$/.test(line);
          // A line ending with a comma ends with a separator, since strings end with a quote
          const hasComma = line.endsWith(",");
          const content = hasComma ? line.slice(0, -1) : line;
          const comma = hasComma || (trailingComma && isLastValue) ? "," : "";
          // Insert the comment between the value and its comma, as in `1 /* x */,`
          const commentBeforeComma =
            comma && beforeComma !== null ? `/*${beforeComma}*/` : "";
          return `${block === null ? "" : `/*${block}*/`}${content}${commentBeforeComma}${comma}${lineComment === null ? "" : `//${lineComment}`}`;
        })
        .join("\n");

      // Compare with the parsed original rather than `value`, since -0 does not survive JSON
      assert.deepEqual(JSON.parse(stripJSONC(text)), JSON.parse(json));
    }),
  );
});

test("should give the same output as the 0.2.0 regex whenever it is valid JSON", () => {
  // Characters that matter to strings, comments and commas, with every line terminator
  const unit = fc.constantFrom(...'"\\/*,[]{}: \n\r\t\u2028\u2029a1');
  fc.assert(
    fc.property(fc.string({ unit, maxLength: 20 }), (text) => {
      // A backslash before a line terminator is an invalid escape. The regex no longer sees
      // a string there and may strip comment-like content inside it, which the scanner keeps.
      if (/\\[\n\r\u2028\u2029]/.test(text)) return;
      const expected = stripJSONCWithRegex(text);
      try {
        JSON.parse(expected);
      } catch {
        // Both are invalid JSON, typically on an unterminated string
        return;
      }
      assert.equal(stripJSONC(text), expected);
    }),
    { numRuns: 10000 },
  );
});
