# Benchmark

Compares four ways to strip comments and trailing commas from a JSONC body:

- `regex`: [`regex.js`](regex.js), the two regular expressions used up to 0.2.0
- `scanner (fadlan)`: [`scanner-fadlan.js`](scanner-fadlan.js), the character scanner of [`insomnia-plugin-json-comments-fadlan`](https://github.com/mfadlanabdillah/insomnia-plugin-json-comments-fadlan), copied as is
- `strip-json-comments`: the [`strip-json-comments`](https://github.com/sindresorhus/strip-json-comments) package (dev dependency), called with `{ trailingCommas: true, whitespace: false }` to match the plugin's output. By default it replaces comments with spaces and keeps trailing commas.
- `scanner (strip.js)`: [`../strip.js`](../strip.js), the scanner used by the plugin

```sh
npm run bench
```

## Results

Node v24.21.0, darwin/arm64 (Apple Silicon). Each case runs for 1 s after a warmup.

### Speed

| Input                             | regex   | scanner (fadlan) | strip-json-comments | scanner (strip.js) |
| --------------------------------- | ------- | ---------------- | ------------------- | ------------------ |
| Typical request (~150 B)          | 1.04 µs | 0.33 µs          | 0.83 µs             | **0.24 µs**        |
| JSONC (~2 KB)                     | 18.9 µs | 9.9 µs           | 23.3 µs             | **4.7 µs**         |
| JSONC (~200 KB)                   | 2.03 ms | 1.06 ms          | 2.39 ms             | **0.48 ms**        |
| JSONC (~2 MB)                     | 22.4 ms | 15.1 ms          | 27.5 ms             | **5.1 ms**         |
| Plain JSON, no comments (~1.4 MB) | 12.6 ms | 13.2 ms          | 20.2 ms             | **2.6 ms**         |
| One long string (1 MB)            | 2.1 ms  | 12.2 ms          | 3.1 ms              | **0.016 ms**       |

All four use a single core. The regex goes above 100% CPU on large bodies because of the background garbage collector.

`strip-json-comments` reads the body one character at a time, strings included, and only slices out kept text. That avoids the fadlan scanner's memory cost, but each character still goes through several comparisons.

### Memory

Heap kept per result for the ~2 MB JSONC body (1.78 MB input), each implementation in its own process:

| regex   | scanner (fadlan) | strip-json-comments | scanner (strip.js) |
| ------- | ---------------- | ------------------- | ------------------ |
| 1.59 MB | 49.21 MB         | 9.20 MB             | **1.51 MB**        |

The fadlan scanner appends one character at a time, and `strip-json-comments` appends one slice per comment and comma. Both leave a chain of small strings instead of one flat string.

### Adversarial inputs

| Input                                       | regex  | scanner (fadlan) | strip-json-comments | scanner (strip.js) |
| ------------------------------------------- | ------ | ---------------- | ------------------- | ------------------ |
| Unterminated block comments (`"/* "` × 20k) | 149 ms | 0.1 ms           | 0.7 ms              | 0.3 ms             |
| Unterminated string (1 MB)                  | 3.8 ms | 14.7 ms          | 5.4 ms              | 0.0 ms             |
| Comma and 1 MB of whitespace                | 0.5 ms | 18.3 ms          | 20.8 ms             | 2.4 ms             |

The regex is quadratic on unterminated block comments: each `/*` is searched until the end of the body.

### Correctness

On a JSONC body containing a Windows path ending with an escaped backslash (`"C:\\dir\\"`), the fadlan scanner loses track of strings and its output no longer parses. It also keeps a trailing comma followed by a comment (`[1, // c\n]`). The three other implementations handle both.

A line comment ended by a lone `\r` (`[1, // c\r2]`) swallows the rest of the body with the fadlan scanner and `strip-json-comments`, which only end line comments at `\n`. The regex and `strip.js` end them at any JavaScript line terminator.

A property test in [`test.js`](../test.js) compares `strip.js` with the regex on random short inputs, including every JavaScript line terminator (`\n`, `\r`, `\u2028`, `\u2029`). They give the same output whenever the regex output is valid JSON, except on one kind of invalid input: a backslash before a line terminator inside a string. There the regex no longer sees the string and may strip comment-like content from it, while `strip.js` leaves the string untouched. Otherwise they only differ on unterminated strings, which are invalid JSON either way.

## Why `strip.js` is faster

- Strings and block comments are skipped with `indexOf`, which is native and much faster than a JavaScript loop.
- Kept text is copied by slices joined once at the end, not character by character.
- Comments and trailing commas are removed in a single pass, with no intermediate string.
- A body with nothing to strip is returned as is, without any allocation.
