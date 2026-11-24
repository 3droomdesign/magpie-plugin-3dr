import { catalog, resolveCli, runCli } from './lib/cli.js';

function guidance(options) {
  const profile = options.profile;
  const flag = typeof profile === 'string' && /^[A-Za-z0-9._-]{1,64}$/.test(profile) && profile !== 'default' ? ` --profile=${profile}` : '';
  return `On the computer running Magpie, run 3dr login${flag} for the configured site and approve in the browser. Reload the plugin to refresh available tools.`;
}

export default async function threeDrPlugin(_host, options = {}) {
  const tool = Object.create(null);
  tool.connection_status = {
    description: 'Check whether 3D Room Design is connected and list the design tools this account has granted. Use when setup or authorization changes.',
    args: { type: 'object', properties: {}, additionalProperties: false },
    async execute(_args, ctx) {
      try {
        const config = await resolveCli(options);
        const tools = await catalog(config, ctx?.abort);
        return JSON.stringify({ connected: true, tools: tools.map(entry => entry.name), next_step: 'If this list has changed, reload the plugin in Magpie.' });
      } catch (error) {
        return JSON.stringify({ connected: false, reason: error.message, next_step: guidance(options) });
      }
    },
  };
  let config;
  let tools;
  try {
    config = await resolveCli(options);
    tools = await catalog(config);
  } catch {
    // Keep the status tool available when 3dr is missing, signed out or temporarily offline.
    return { tool };
  }
  for (const entry of tools) {
    if (Object.hasOwn(tool, entry.name)) continue;
    tool[entry.name] = {
      description: entry.description,
      args: entry.inputSchema,
      async execute(args, ctx) {
        return JSON.stringify(await runCli(config, ['call', entry.name, '--json', '-'], { input: args, signal: ctx?.abort }));
      },
    };
  }
  return { tool };
}
