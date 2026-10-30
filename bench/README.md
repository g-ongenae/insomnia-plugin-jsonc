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

| Input                                              | regex   | scanner (fadlan) | strip-json-comments | scanner (strip.js) |
| -------------------------------------------------- | ------- | ---------------- | ------------------- | ------------------ |
| Typical request (~150 B)                           | 1.03 µs | 0.34 µs          | 0.87 µs             | **0.26 µs**        |
| JSONC (~2 KB)                                      | 19.0 µs | 9.9 µs           | 23.9 µs             | **5.0 µs**         |
| JSONC (~200 KB)                                    | 2.10 ms | 1.05 ms          | 2.49 ms             | **0.49 ms**        |
| JSONC (~2 MB)                                      | 21.7 ms | 14.1 ms          | 27.5 ms             | **5.5 ms**         |
| Plain JSON, no comments (~1.4 MB)                  | 13.0 ms | 12.5 ms          | 19.9 ms             | **2.7 ms**         |
| One long string (1 MB)                             | 2.3 ms  | 12.4 ms          | 3.1 ms              | **0.017 ms**       |
| Data export (~50 MB, a comment every 1000 records) | 1.12 s  | 1.60 s           | 0.55 s              | **0.058 s**        |
| Comment-heavy JSONC (~50 MB)                       | 1.04 s  | 1.33 s           | 0.89 s              | **0.19 s**         |

All four use a single core. Above 100% CPU, the background garbage collector is working too: the regex and the fadlan scanner allocate the most.

`strip-json-comments` reads the body one character at a time, strings included, and only slices out kept text. That avoids the fadlan scanner's memory cost, but each character still goes through several comparisons.

### Memory

Extra peak memory (RSS) of one call, each implementation and body in its own process:

| Input                        | regex   | scanner (fadlan) | strip-json-comments | scanner (strip.js) |
| ---------------------------- | ------- | ---------------- | ------------------- | ------------------ |
| JSONC (~2 MB)                | 62 MB   | 54 MB            | 37 MB               | **10 MB**          |
| Data export (~50 MB)         | 1549 MB | 1762 MB          | 432 MB              | **105 MB**         |
| Comment-heavy JSONC (~50 MB) | 1718 MB | 1602 MB          | 489 MB              | **291 MB**         |

The regex builds a string per match and an intermediate string between its two passes. The fadlan scanner appends one character at a time, and `strip-json-comments` one slice per comment and comma, which leaves chains of small strings. `strip.js` keeps one slice per removed comment or comma, so its memory grows with the number of comments rather than with the size of the body.

### Adversarial inputs

Time of one call:

| Input                                       | regex  | scanner (fadlan) | strip-json-comments | scanner (strip.js) |
| ------------------------------------------- | ------ | ---------------- | ------------------- | ------------------ |
| Unterminated block comments (`"/* "` × 20k) | 149 ms | 0.1 ms           | 0.8 ms              | 0.3 ms             |
| Unterminated string (1 MB)                  | 5.0 ms | 59.4 ms          | 5.6 ms              | 0.0 ms             |
| Comma and 1 MB of whitespace                | 0.7 ms | 8.7 ms           | 23.5 ms             | 2.3 ms             |

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
