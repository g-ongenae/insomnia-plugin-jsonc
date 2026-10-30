/**
 * Compare JSONC strippers on speed, CPU, memory and correctness
 *
 * Run with `npm run bench` (needs `--expose-gc`, set by the script).
 */
const { execFileSync } = require("node:child_process");

// ESM only, loaded with `require` (Node >= 22.12)
const { default: stripJsonComments } = require("strip-json-comments");

const implementations = {
  regex: require("./regex").stripJSONC,
  "scanner (fadlan)": require("./scanner-fadlan").stripJSONC,
  // Options matching the plugin: trailing commas removed, comments not replaced by spaces
  "strip-json-comments": (text) =>
    stripJsonComments(text, { trailingCommas: true, whitespace: false }),
  "scanner (strip.js)": require("../strip").stripJSONC,
};

/** One array item with every JSONC feature, `withBackslash` adds a Windows path ending with `\\` */
const item = (i, withBackslash) => `  {
    // item ${i}
    "id": ${i}, /* inline */ "name": "user \\"${i}\\" // not a comment",${withBackslash ? '\n    "path": "C:\\\\dir\\\\",' : ""}
    "tags": ["a", "b", "c",],
    "nested": { "x": 1.5, "y": null, "z": true, },
  },`;
const jsonc = (n, withBackslash = false) =>
  `/* header */\n[\n${Array.from({ length: n }, (_, i) => item(i, withBackslash)).join("\n")}\n]`;
const json = (n) =>
  JSON.stringify(
    Array.from({ length: n }, (_, i) => ({
      id: i,
      name: `user ${i}`,
      tags: ["a", "b"],
      nested: { x: 1.5 },
    })),
    null,
    2,
  );

/**
 * Exported payload of about `size` bytes: one record per line, a comment every 1000 records
 *
 * Built with `repeat`, so that building it leaves no garbage to skew memory measures.
 */
const dataExport = (size) => {
  const record = (i) =>
    `  ${JSON.stringify({ id: i, uuid: `5f1c${i}-aa21-4c1e-9b1a`, email: `user${i}@example.com`, url: `https://api.example.com/v1/users/${i}`, createdAt: "2026-10-30T12:00:00Z", tags: ["a", "b"], score: i * 1.5 })},\n`;
  const block = `  // batch\n${Array.from({ length: 1000 }, (_, i) => record(i)).join("")}`;
  return `/* export */\n[\n${block.repeat(Math.round(size / block.length))}]`;
};
/** Comment-heavy JSONC of about `size` bytes, built with `repeat` */
const commentHeavy = (size) => {
  const block = `${item(0)}\n`;
  return `[\n${block.repeat(Math.round(size / block.length))}{}]`;
};

/** Bodies of tens of MB, measured on fewer cases since a single call takes up to a second */
const largeFixtures = {
  "data export (~50 MB)": () => dataExport(50e6),
  "comment-heavy JSONC (~50 MB)": () => commentHeavy(50e6),
};

const fixtures = {
  "typical request (~150 B)":
    '{\n  // user\n  "name": "bob", /* id */ "id": 1,\n  "tags": ["a",],\n}',
  "JSONC (~2 KB)": jsonc(10),
  "JSONC (~200 KB)": jsonc(1000),
  "JSONC (~2 MB)": jsonc(10000),
  "plain JSON, no comments (~1.4 MB)": json(10000),
  "one long string (1 MB)": JSON.stringify({ blob: "x".repeat(1 << 20) }),
};

const adversarial = {
  'unterminated block comments ("/* " x 20k)': "/* ".repeat(20000),
  "unterminated string (1 MB)": `"${"a".repeat(1 << 20)}`,
  "comma and 1 MB of whitespace": `[1,${" ".repeat(1 << 20)}]`,
};

const memoryFixtures = {
  "JSONC (~2 MB)": () => jsonc(10000),
  ...largeFixtures,
};

// Measured in a child process, so that garbage from other implementations does not interfere
if (process.argv[2] === "--memory") {
  const [, , , fixture, name] = process.argv;
  const text = memoryFixtures[fixture]();
  global.gc();
  const before = process.memoryUsage().rss;
  const result = implementations[name](text);
  result.charCodeAt(result.length >> 1); // flatten the result, as sending it would
  // maxRSS is in KiB
  const peak = process.resourceUsage().maxRSS * 1024 - before;
  console.log(`${(peak / 1e6).toFixed(0)} MB`);
  process.exit(0);
}

const names = Object.keys(implementations);
const pad = Math.max(...names.map((name) => name.length));
const time = (fn) => {
  const start = process.hrtime.bigint();
  fn();
  return Number(process.hrtime.bigint() - start) / 1e6;
};

console.log(`Node ${process.version}, ${process.platform}/${process.arch}\n`);

console.log("## Correctness: does the output parse?\n");
const correctness = {
  ...fixtures,
  "JSONC with escaped backslashes (~2 KB)": jsonc(10, true),
  "line comment ended by a lone \\r": "[1, // c\r2]",
  "trailing comma before a comment": "[1, // c\n]",
};
for (const [fixture, text] of Object.entries(correctness)) {
  const results = names.map((name) => {
    try {
      JSON.parse(implementations[name](text));
      return `${name}: ok`;
    } catch {
      return `${name}: FAIL`;
    }
  });
  console.log(`- ${fixture}: ${results.join(", ")}`);
}

console.log("\n## Throughput (1 s per case, after warmup)\n");
const throughputFixtures = {
  ...fixtures,
  ...Object.fromEntries(
    Object.entries(largeFixtures).map(([fixture, build]) => [fixture, build()]),
  ),
};
for (const [fixture, text] of Object.entries(throughputFixtures)) {
  console.log(`${fixture}`);
  for (const name of names) {
    const strip = implementations[name];
    // Up to 20 warmup calls, within 1 s for large bodies
    const warmup = process.hrtime.bigint();
    for (
      let i = 0;
      i < 20 && process.hrtime.bigint() - warmup < 1_000_000_000n;
      i++
    )
      strip(text);
    let iterations = 0;
    const cpu = process.cpuUsage();
    const ms = time(() => {
      const start = process.hrtime.bigint();
      do {
        strip(text);
        iterations++;
      } while (process.hrtime.bigint() - start < 1_000_000_000n);
    });
    const { user, system } = process.cpuUsage(cpu);
    const perOp = (ms * 1000) / iterations;
    const perOpText =
      perOp < 1000
        ? `${perOp.toFixed(2)} µs`
        : `${(perOp / 1000).toFixed(2)} ms`;
    const mbPerSecond = (text.length * iterations) / 1e3 / ms;
    const cpuPercent = ((user + system) / 1000 / ms) * 100;
    console.log(
      `  ${name.padEnd(pad)} ${perOpText.padStart(11)}/op ${mbPerSecond.toFixed(0).padStart(7)} MB/s  CPU ${cpuPercent.toFixed(0)}%`,
    );
  }
}

console.log(
  "\n## Memory: extra peak memory (RSS) of one call, one process each\n",
);
for (const fixture of Object.keys(memoryFixtures)) {
  console.log(`${fixture}`);
  for (const name of names) {
    let output;
    try {
      output = execFileSync(
        process.execPath,
        ["--expose-gc", __filename, "--memory", fixture, name],
        { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
      ).trim();
    } catch {
      output = "out of memory";
    }
    console.log(`  ${name.padEnd(pad)} ${output}`);
  }
}

console.log("\n## Adversarial inputs: time of one call\n");
for (const [fixture, text] of Object.entries(adversarial)) {
  const results = names.map(
    (name) =>
      `${name}: ${time(() => implementations[name](text)).toFixed(1)} ms`,
  );
  console.log(`- ${fixture}: ${results.join(", ")}`);
}
