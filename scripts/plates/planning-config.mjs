// Shared by the CLI and installed planning readers. Validate before I/O.
export function planningConfig(config = {}) {
  const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const fail = message => { throw Object.assign(new Error(message), { exitCode: 2 }); };
  if (!object(config)) fail('planning config must be an object');
  const phases = config.phases === undefined ? {} : config.phases;
  if (!object(phases)) fail('phases must be an object');
  const source = Object.hasOwn(phases, 'source') ? phases.source : 'files';
  if (!['files', 'milestones'].includes(source)) fail('phases.source must be files or milestones');
  const ownerLabel = Object.hasOwn(phases, 'ownerLabel') ? phases.ownerLabel : 'keel:owner';
  if (typeof ownerLabel !== 'string' || !ownerLabel.trim()) fail('phases.ownerLabel must be a nonempty label');
  return { source, ownerLabel };
}
export const milestoneSource = config => planningConfig(config).source === 'milestones';
