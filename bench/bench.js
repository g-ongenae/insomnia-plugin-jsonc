/**
 * Compare JSONC strippers on speed, CPU, memory and correctness
 *
 * Run with `npm run bench` (needs `--expose-gc`, set by the script).
 */
const { execFileSync } = require("node:child_process");

const implementations = {
  regex: require("./regex").stripJSONC,
  "scanner (fadlan)": require("./scanner-fadlan").stripJSONC,
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

const large = fixtures["JSONC (~2 MB)"];

// Measured in a child process, so that garbage from other implementations does not interfere
if (process.argv[2] === "--memory") {
  const strip = implementations[process.argv[3]];
  global.gc();
  const before = process.memoryUsage().heapUsed;
  const results = Array.from({ length: 20 }, () => strip(large));
  global.gc();
  const retained = (process.memoryUsage().heapUsed - before) / results.length;
  console.log(
    `${(retained / 1e6).toFixed(2)} MB (input ${(large.length / 1e6).toFixed(2)} MB)`,
  );
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
for (const [fixture, text] of Object.entries(fixtures)) {
  console.log(`${fixture}`);
  for (const name of names) {
    const strip = implementations[name];
    for (let i = 0; i < 20; i++) strip(text);
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
    const mbPerSecond = (text.length * iterations) / 1e3 / ms;
    const cpuPercent = ((user + system) / 1000 / ms) * 100;
    console.log(
      `  ${name.padEnd(pad)} ${perOp.toFixed(2).padStart(10)} µs/op ${mbPerSecond.toFixed(0).padStart(7)} MB/s  CPU ${cpuPercent.toFixed(0)}%`,
    );
  }
}

console.log(
  "\n## Memory: heap retained per result (JSONC ~2 MB, 20 results kept, one process each)\n",
);
for (const name of names) {
  const output = execFileSync(
    process.execPath,
    ["--expose-gc", __filename, "--memory", name],
    { encoding: "utf8" },
  );
  console.log(`  ${name.padEnd(pad)} ${output.trim()}`);
}

console.log("\n## Adversarial inputs: time of one call\n");
for (const [fixture, text] of Object.entries(adversarial)) {
  const results = names.map(
    (name) =>
      `${name}: ${time(() => implementations[name](text)).toFixed(1)} ms`,
  );
  console.log(`- ${fixture}: ${results.join(", ")}`);
}
