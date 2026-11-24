import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import plugin from '../index.js';

test('publishes the granted schema and sends a single JSON call without interpreting the prompt', async t => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), '3dr-magpie-'));
  t.after(() => rm(tmp, { recursive: true, force: true }));
  const cliPath = path.join(tmp, 'cli.mjs');
  const schema = { type: 'object', properties: { brief: { type: 'string' }, request_id: { type: 'string' } }, required: ['request_id'] };
  await writeFile(cliPath, [
    'const [, , profile, command, ...rest] = process.argv;',
    "if (profile !== '--profile=example') process.exit(2);",
    `if (command === 'tools') console.log(JSON.stringify({tools:[{name:'render_architecture',description:'Render a design',inputSchema:${JSON.stringify(schema)}}]}));`,
    "else if (command === 'call' && JSON.stringify(rest) === JSON.stringify(['render_architecture','--json','-'])) {",
    "  const chunks=[]; for await (const chunk of process.stdin) chunks.push(chunk);",
    "  const args=JSON.parse(Buffer.concat(chunks)); console.log(JSON.stringify(args));",
    "} else process.exit(3);",
  ].join('\n'));
  const { tool } = await plugin({}, { nodePath: process.execPath, cliPath, profile: 'example' });
  assert.deepEqual(Object.keys(tool), ['connection_status', 'render_architecture']);
  assert.deepEqual(tool.render_architecture.args, schema);
  const input = { brief: "Create a 'loft'; echo $PATH", request_id: 'stable-id' };
  assert.deepEqual(JSON.parse(await tool.render_architecture.execute(input, {})), input);
  assert.deepEqual(JSON.parse(await tool.connection_status.execute({}, {})).tools, ['render_architecture']);
});

test('keeps actionable diagnostics when the CLI is unavailable', async () => {
  const { tool } = await plugin({}, { nodePath: 'relative/path', cliPath: 'relative/cli.js' });
  assert.deepEqual(Object.keys(tool), ['connection_status']);
  const status = JSON.parse(await tool.connection_status.execute({}, {}));
  assert.equal(status.connected, false);
  assert.match(status.reason, /3dr config/);
  assert.match(status.next_step, /3dr login/);
});
