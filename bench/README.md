# Benchmark

Compares three ways to strip comments and trailing commas from a JSONC body:

- `regex`: [`regex.js`](regex.js), the two regular expressions used up to 0.2.0
- `scanner (fadlan)`: [`scanner-fadlan.js`](scanner-fadlan.js), the character scanner of [`insomnia-plugin-json-comments-fadlan`](https://github.com/mfadlanabdillah/insomnia-plugin-json-comments-fadlan), copied as is
- `scanner (strip.js)`: [`../strip.js`](../strip.js), the scanner used by the plugin

```sh
npm run bench
```

## Results

Node v24.21.0, darwin/arm64 (Apple Silicon). Each case runs for 1 s after a warmup.

### Speed

| Input                             | regex   | scanner (fadlan) | scanner (strip.js) |
| --------------------------------- | ------- | ---------------- | ------------------ |
| Typical request (~150 B)          | 1.05 µs | 0.31 µs          | **0.26 µs**        |
| JSONC (~2 KB)                     | 19.1 µs | 9.4 µs           | **5.5 µs**         |
| JSONC (~200 KB)                   | 2.08 ms | 1.06 ms          | **0.53 ms**        |
| JSONC (~2 MB)                     | 22.2 ms | 14.4 ms          | **5.8 ms**         |
| Plain JSON, no comments (~1.4 MB) | 13.0 ms | 12.8 ms          | **2.9 ms**         |
| One long string (1 MB)            | 2.2 ms  | 12.1 ms          | **0.016 ms**       |

All three use a single core. The regex goes above 100% CPU on large bodies because of the background garbage collector.

### Memory

Heap kept per result for the ~2 MB JSONC body (1.78 MB input), each implementation in its own process:

| regex   | scanner (fadlan) | scanner (strip.js) |
| ------- | ---------------- | ------------------ |
| 1.59 MB | 49.21 MB         | **1.51 MB**        |

The fadlan scanner appends one character at a time, which leaves a chain of small strings instead of one flat string.

### Adversarial inputs

| Input                                       | regex  | scanner (fadlan) | scanner (strip.js) |
| ------------------------------------------- | ------ | ---------------- | ------------------ |
| Unterminated block comments (`"/* "` × 20k) | 153 ms | 0.1 ms           | 0.3 ms             |
| Unterminated string (1 MB)                  | 4.5 ms | 17.9 ms          | 0.0 ms             |
| Comma and 1 MB of whitespace                | 0.5 ms | 21.5 ms          | 3.0 ms             |

The regex is quadratic on unterminated block comments: each `/*` is searched until the end of the body.

### Correctness

On a JSONC body containing a Windows path ending with an escaped backslash (`"C:\\dir\\"`), the fadlan scanner loses track of strings and its output no longer parses. It also keeps a trailing comma followed by a comment (`[1, // c\n]`). The two other implementations handle both.

A property test in [`test.js`](../test.js) compares `strip.js` with the regex on random short inputs, including every JavaScript line terminator (`\n`, `\r`, `\u2028`, `\u2029`). They give the same output whenever the regex output is valid JSON, except on one kind of invalid input: a backslash before a line terminator inside a string. There the regex no longer sees the string and may strip comment-like content from it, while `strip.js` leaves the string untouched. Otherwise they only differ on unterminated strings, which are invalid JSON either way.

## Why `strip.js` is faster

- Strings and block comments are skipped with `indexOf`, which is native and much faster than a JavaScript loop.
- Kept text is copied by slices joined once at the end, not character by character.
- Comments and trailing commas are removed in a single pass, with no intermediate string.
- A body with nothing to strip is returned as is, without any allocation.
