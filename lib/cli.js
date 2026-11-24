import { execFile } from 'node:child_process';
import { constants } from 'node:fs';
import { access, readdir, realpath, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';

export const installCommand = 'npm install --global git+https://github.com/3droomdesign/3droomdesign-mcp.git';
const nodeName = process.platform === 'win32' ? 'node.exe' : 'node';

async function file(candidate, mode) {
  if (typeof candidate !== 'string' || !path.isAbsolute(candidate)) return;
  try {
    await access(candidate, mode);
    if ((await stat(candidate)).isFile()) return await realpath(candidate);
  } catch { /* Try the next installation directory. */ }
}

async function searchDirectories() {
  const dirs = (process.env.PATH || '').split(path.delimiter).filter(dir => path.isAbsolute(dir));
  if (process.platform === 'win32') {
    if (process.env.APPDATA) dirs.push(path.join(process.env.APPDATA, 'npm'));
    if (process.env.ProgramFiles) dirs.push(path.join(process.env.ProgramFiles, 'nodejs'));
  } else {
    dirs.push('/opt/homebrew/bin', '/usr/local/bin');
    const versions = path.join(process.env.NVM_DIR || path.join(homedir(), '.nvm'), 'versions', 'node');
    const entries = await readdir(versions).catch(() => []);
    entries.filter(name => /^v\d+\.\d+\.\d+$/.test(name))
      .sort((a, b) => b.localeCompare(a, 'en', { numeric: true }))
      .forEach(name => dirs.push(path.join(versions, name, 'bin')));
  }
  return [...new Set(dirs)];
}

export async function resolveCli(options = {}) {
  const { nodePath, cliPath, profile = 'default', siteOrigin } = options;
  if (typeof profile !== 'string' || !/^[A-Za-z0-9._-]{1,64}$/.test(profile)) {
    throw new Error('Set profile to the same valid profile name you used with 3dr login.');
  }
  // The CLI validates and normalizes the site origin, including its loopback exception.
  if (siteOrigin !== undefined && (typeof siteOrigin !== 'string' || !siteOrigin.trim())) {
    throw new Error('Set siteOrigin to the site where you authorized 3dr.');
  }
  let node;
  let cli;
  if (nodePath !== undefined || cliPath !== undefined) {
    node = await file(nodePath, constants.X_OK);
    cli = await file(cliPath, constants.R_OK);
    if (!node || !cli) throw new Error('Set nodePath and cliPath to both absolute paths from 3dr config.');
  } else {
    const dirs = await searchDirectories();
    for (const dir of dirs) {
      // npm uses symlinks on POSIX and a .cmd shim on Windows. Invoke the JS entry directly.
      const entry = process.platform === 'win32'
        ? path.join(dir, 'node_modules', '3droomdesign-mcp', 'bin', '3dr.js')
        : path.join(dir, '3dr');
      const resolved = await file(entry, constants.R_OK);
      if (resolved && path.basename(resolved) === '3dr.js') {
        cli = resolved;
        node = await file(path.join(dir, nodeName), constants.X_OK);
        break;
      }
    }
    if (!cli) throw new Error(`Install the 3dr CLI with Node.js 22+, npm and Git: ${installCommand}`);
    if (!node) {
      for (const dir of dirs) {
        node = await file(path.join(dir, nodeName), constants.X_OK);
        if (node) break;
      }
    }
    if (!node) throw new Error('Set nodePath and cliPath to both absolute paths from 3dr config.');
  }
  return { node, cli, profile, siteOrigin };
}

export function runCli(config, argv, { input, signal, timeout = 48_000 } = {}) {
  const command = [config.cli, `--profile=${config.profile}`, ...argv];
  const json = input === undefined ? '' : JSON.stringify(input);
  if (Buffer.byteLength(json) > 1024 * 1024) throw new Error('3dr accepts up to 1 MiB of JSON arguments.');
  return new Promise((resolve, reject) => {
    const env = config.siteOrigin ? { ...process.env, THREEDR_SITE_ORIGIN: config.siteOrigin } : process.env;
    const child = execFile(config.node, command, {
      env, signal, timeout, windowsHide: true, shell: false, maxBuffer: 8 * 1024 * 1024,
    }, (error, stdout, stderr) => {
      if (error) {
        if (error.killed || signal?.aborted || error.code === 'ABORT_ERR') {
          return reject(new Error('The 3dr call was interrupted. For a submitted generation, check get_run if you have a run_id. Reuse the same request_id for any retry.'));
        }
        const message = stderr.split(/\r?\n/).find(line => line.startsWith('3DR MCP: '));
        return reject(new Error(message?.slice(0, 1500) || '3dr could not finish. Check the CLI installation, connection and site authorization.'));
      }
      try { resolve(JSON.parse(stdout)); }
      catch { reject(new Error('3dr returned an unreadable response. Verify your installed CLI with 3dr --version.')); }
    });
    // A CLI that exits before reading cannot accept more input. Its exit result is authoritative.
    child.stdin.on('error', () => {});
    child.stdin.end(json);
  });
}

export async function catalog(config, signal) {
  const result = await runCli(config, ['tools'], { signal, timeout: 15000 });
  if (!Array.isArray(result.tools)) throw new Error('3dr returned an invalid tool list. Update the CLI with 3dr update.');
  return result.tools.filter(tool => typeof tool?.name === 'string' && /^[a-z][a-z0-9_]{0,63}$/.test(tool.name) && tool.inputSchema?.type === 'object');
}
