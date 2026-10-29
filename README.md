# insomnia-plugin-jsonc

Strip JSON comments from your request body.

## Installation

- Open Insomnia options (Ctrl + , | Cmd + ,)
- Type `insomnia-plugin-jsonc` on the Plugins tab

## Usage

Just write valid JavaScript comments in JSON body request and send your request without minding them.

## Deps

Uses a RegExp adapted from [`json-easy-strip`](https://www.npmjs.com/package/json-easy-strip) to strip comments.
