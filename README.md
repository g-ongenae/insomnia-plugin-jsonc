# insomnia-plugin-jsonc

Write comments and trailing commas in your JSON request bodies. They are stripped before the request is sent.

## Example

What you write in Insomnia:

<!-- prettier-ignore -->
```jsonc
{
  "page": 1, // current page
  /* "debug": true, */
  "url": "https://example.com", // `//` inside strings is kept
  "tags": ["a", "b",],
}
```

What the server receives:

```json
{
  "page": 1,

  "url": "https://example.com",
  "tags": ["a", "b"]
}
```

## Installation

### Plugin Hub

Install from the [Insomnia Plugin Hub](https://insomnia.rest/plugins/insomnia-plugin-jsonc).

### From Insomnia

1. Open Preferences (Ctrl + , | Cmd + ,)
2. Go to the Plugins tab
3. Enter `insomnia-plugin-jsonc` and click Install Plugin

### Manually

Copy this folder into the Insomnia plugins directory:

- Windows: `%APPDATA%\Insomnia\plugins\`
- macOS: `~/Library/Application Support/Insomnia/plugins/`
- Linux: `~/.config/Insomnia/plugins/`

## What is stripped

- Line comments: `// ...` up to the end of the line
- Block comments: `/* ... */`, which can span several lines
- Trailing commas before `]` or `}`, even with a comment in between

Content inside strings is never touched, so `"https://example.com"` or `"a /* b */"` stay as they are.

The plugin only applies to JSON bodies: `application/json`, with or without parameters (`application/json; charset=utf-8`), and `+json` types (`application/vnd.api+json`). Other bodies are sent unchanged.

## Limitations

- Whitespace around a removed comment is kept, so the sent body may contain extra spaces or blank lines.
- The result is not validated: invalid JSON is sent as is, and the server reports the error.

## How it works

A request hook scans the body once, character by character, jumping over strings and comments. It removes comments and trailing commas, and copies the rest as is: the body is not parsed and serialized again, so its formatting is preserved. A body with nothing to strip is returned untouched.

See [`bench/`](bench/README.md) for a comparison with a regular expression, another scanner and [`strip-json-comments`](https://github.com/sindresorhus/strip-json-comments).

## License

MIT
