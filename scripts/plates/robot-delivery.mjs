import { environmentValue, writeName, markerComment, markerComments, markerLines, markerHeader, readNames, robotIssueOf } from './names.mjs';
// Read-only delivery facts and a bounded GitHub REST transport; no runtime import.
import { spawnSync } from 'node:child_process';
export const robotRepo = value => typeof value === 'string' && /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(value) && !value.split('/').some(x => x === '.' || x === '..');
export const robotSha = value => typeof value === 'string' && /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(value);
export const robotId = value => Number.isSafeInteger(value) && value > 0;
export async function robotGithub({ method = 'GET', path, body }) {
  if (!['GET', 'POST', 'PATCH'].includes(method) || !/^\/repos\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:$|[/?])/.test(path) || /[\r\n#]/.test(path)) throw new Error('invalid robot API request');
  const args = ['api', '--include', '--method', method, path];
  if (body !== undefined) args.push('--input', '-');
  const r = spawnSync((environmentValue('variable:KEEL_GH', process.env) ?? 'gh'), args, { input: body === undefined ? undefined : JSON.stringify(body), encoding: 'utf8', timeout: 30_000, maxBuffer: 16 * 1024 * 1024 });
  // Never propagate gh stderr, which may contain credentials or untrusted issue text.
  if (r.error) throw new Error('robot GitHub transport unavailable');
  const match = /^HTTP\/[\d.]+ (\d+)[^\n]*\r?\n([\s\S]*?)\r?\n\r?\n([\s\S]*)$/.exec(r.stdout ?? '');
  if (!match) throw new Error('robot GitHub response unavailable');
  const status = Number(match[1]), headers = Object.fromEntries(match[2].split(/\r?\n/).map(s => { const n = s.indexOf(':'); return [s.slice(0, n).toLowerCase(), s.slice(n + 1).trim()]; }));
  let data = null;
  if (match[3].trim()) { try { data = JSON.parse(match[3]); } catch { throw new Error('robot GitHub response is not JSON'); } }
  return { status, data, headers };
}
export async function robotRead(github, path) {
  const r = await github({ method: 'GET', path });
  if (r?.status !== 200) throw new Error(`GitHub read unavailable (${r?.status ?? 'unknown'})`);
  return r.data;
}
// Old repository names are accepted only while GitHub resolves them to the
// current repository's numeric identity. Never mutate signed/canonical receipts.
export function robotRepositoryIdentity(repo, github = robotGithub) {
  if (!robotRepo(repo)) throw new Error('invalid robot repository');
  const names = new Map([[repo.toLowerCase(), true]]);
  let current;
  return { async same(candidate) {
    if (!robotRepo(candidate)) return false;
    const key = candidate.toLowerCase();
    if (names.has(key)) return names.get(key);
    if (names.size >= 8) throw new Error('robot repository alias bound exceeded');
    current ??= await robotRead(github, `/repos/${repo}`);
    if (!robotId(current?.id) || current.full_name?.toLowerCase() !== repo.toLowerCase()) throw new Error('current robot repository identity unavailable');
    const old = await robotRead(github, `/repos/${candidate}`);
    const same = old?.id === current.id && old.full_name?.toLowerCase() === repo.toLowerCase();
    names.set(key, same); return same;
  } };
}
// An array endpoint is complete only after a short page, never at an arbitrary cap.
export async function robotPages(github, path, limit = 5) {
  const rows = [];
  for (let page = 1; page <= limit; page++) {
    const data = await robotRead(github, `${path}${path.includes('?') ? '&' : '?'}per_page=100&page=${page}`);
    if (!Array.isArray(data)) throw new Error('invalid GitHub page');
    rows.push(...data);
    if (data.length < 100) return rows;
  }
  throw new Error('GitHub coverage incomplete');
}
function association({ repo, issueNumber, instanceId, author, headSha, cursor }, name) {
  if (!robotRepo(repo) || !robotId(issueNumber) || !/^[A-Za-z0-9_-]{1,128}$/.test(instanceId) || !['claude', 'codex'].includes(author) || !robotSha(headSha) || !Number.isSafeInteger(cursor) || cursor < 0) throw new Error('invalid robot association');
  return `<!-- ${name} ${JSON.stringify({ version: 1, repo, issueNumber, instanceId, author, headSha, cursor })} -->`;
}
export function robotAssociation(value) { return association(value,writeName('marker:keel:robot-delivery')); }
export function robotAssociationOf(body) {
  const matches = markerLines(body,'marker:keel:robot-delivery');
  if (matches.length !== 1) return null;
  try { const value = JSON.parse(matches[0].payload); return value.version === 1 && association(value,matches[0].name) === matches[0].raw ? value : null; } catch { return null; }
}
const hash64 = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
function authorization(value) {
  if (!value || !robotId(value.receiptId) || !hash64(value.bodyHash) || !hash64(value.policyHash) || !/^[A-Za-z0-9-]+$/.test(value.writer ?? '')) throw new Error('invalid continuation authorization');
  return {receiptId:value.receiptId,bodyHash:value.bodyHash,writer:value.writer,policyHash:value.policyHash};
}
function continuation(value,name) {
  robotAssociation(value);
  if (!robotId(value.prNumber)) throw new Error('invalid continuation PR identity');
  const {repo,prNumber,issueNumber,instanceId,author,headSha,cursor}=value;
  return `<!-- ${name} ${JSON.stringify({version:1,repo,prNumber,issueNumber,instanceId,author,headSha,cursor,authorization:authorization(value.authorization)})} -->\nTrusted robot continuation.\n\n`;
}
export function robotContinuation(value) { return continuation(value,writeName('marker:keel:robot-continuation')); }
export function robotContinuationOf(body) {
  if(typeof body!=='string' || body.length>60000)return null;
  const header=markerHeader(body,['marker:keel:robot-continuation']);
  if(!header || !header.suffix.startsWith('Trusted robot continuation.\n\n'))return null;
  const mark=header.marks['marker:keel:robot-continuation'];
  try {const value=JSON.parse(mark.payload);return value.version===1 && continuation(value,mark.name)===mark.raw+'\nTrusted robot continuation.\n\n' ? value:null;}catch{return null;}
}
export async function robotDeliveryMetadata({repo,pr,github=robotGithub,headSha=pr?.head?.sha}) {
  const initial = robotAssociationOf(pr?.body), identity = robotRepositoryIdentity(repo, github);
  if (!initial || !await identity.same(initial.repo) || !robotId(pr.number) || pr.html_url !== `https://github.com/${repo}/pull/${pr.number}` || pr.user?.type !== 'Bot' || pr.user.login !== 'github-actions[bot]' || pr.head?.repo?.full_name !== repo || pr.base?.repo?.full_name !== repo || robotIssueOf(pr.head?.ref) !== initial.issueNumber || !robotSha(headSha)) throw new Error('continuation head changed or delivery provenance unavailable');
  if (initial.headSha === headSha) {
    const marks = markerLines(pr.body,'marker:keel:robot-permission');
    let permission = null;
    if (marks.length === 1) { try { const parsed=JSON.parse(marks[0].payload); if (JSON.stringify(authorization(parsed)) === marks[0].payload) permission=parsed; } catch { /* status may still report legacy initial association */ } }
    return {association:initial,authorization:permission,source:'body'};
  }
  const comments = await robotPages(github,`/repos/${repo}/issues/${pr.number}/comments`);
  const matches = [];
  for (const comment of comments) {
    if (comment?.user?.type !== 'Bot' || comment.user.login !== 'github-actions[bot]' || !markerComments(comment.body,'marker:keel:robot-continuation').name) continue;
    const value = robotContinuationOf(comment.body);
    if (!value || !robotId(comment.id) || comment.issue_url !== `https://api.github.com/repos/${repo}/issues/${pr.number}` || !await identity.same(value.repo) || value.prNumber !== pr.number || value.issueNumber !== initial.issueNumber || value.instanceId !== initial.instanceId || value.author !== initial.author || value.cursor < initial.cursor) throw new Error('malformed continuation delivery metadata');
    if (value.headSha === headSha) matches.push({value,id:comment.id});
  }
  if (!matches.length) { const error=new Error('continuation head changed or exact-head metadata unavailable');error.code='ROBOT_HEAD_METADATA_MISSING';throw error; }
  if (matches.some(m=>JSON.stringify(m.value)!==JSON.stringify(matches[0].value))) throw new Error('conflicting continuation delivery metadata');
  const {value,id}=matches[0];
  return {association:robotAssociationOf(robotAssociation(value)),authorization:value.authorization,source:'comment',commentId:id};
}
export async function readRobotDelivery({ repo, issueNumber, instanceId, github = robotGithub }) {
  const result = { state: 'unknown', issue: { repo, number: issueNumber, instanceId }, pr: null, reasons: [] };
  try {
    if (!robotRepo(repo) || !robotId(issueNumber) || !/^[A-Za-z0-9_-]{1,128}$/.test(instanceId)) throw new Error('invalid delivery identity');
    const identity = robotRepositoryIdentity(repo, github);
    const rows = await robotPulls(github, repo, issueNumber);
    const matches = [];
    for (const row of rows) {
      if (!robotId(row.number)) throw new Error('invalid pull request identity');
      const pr = await robotRead(github, `/repos/${repo}/pulls/${row.number}`);
      const initial = robotAssociationOf(pr.body);
      if (!initial || initial.issueNumber !== issueNumber || initial.instanceId !== instanceId) continue;
      if (!await identity.same(initial.repo)) throw new Error('delivery repository identity mismatch');
      const {association:mark} = await robotDeliveryMetadata({repo,pr,github});
      if (pr.number !== row.number || pr.head?.repo?.full_name !== repo || pr.base?.repo?.full_name !== repo || robotIssueOf(pr.head?.ref) !== issueNumber || !robotSha(pr.head?.sha) || !robotSha(pr.base?.sha) || pr.html_url !== `https://github.com/${repo}/pull/${pr.number}` || mark.headSha !== pr.head.sha || pr.user?.type !== 'Bot' || pr.user?.login !== 'github-actions[bot]') throw new Error('pull request association does not match verified delivery');
      if (pr.merged_at && (!robotSha(pr.merge_commit_sha) || !Number.isFinite(Date.parse(pr.merged_at)))) throw new Error('merge facts unavailable');
      matches.push({ state: pr.merged_at ? 'merged' : pr.state === 'open' ? 'open' : pr.state === 'closed' ? 'closed' : 'unknown', pr: { number: pr.number, url: pr.html_url, headSha: pr.head.sha, baseSha: pr.base.sha, mergedAt: pr.merged_at ?? null, mergeSha: pr.merged_at ? pr.merge_commit_sha : null } });
    }
    if (matches.length > 1) return { ...result, state: 'ambiguous', reasons: ['multiple associated pull requests'] };
    return matches.length ? { ...result, ...matches[0] } : { ...result, state: 'missing' };
  } catch (error) { return { ...result, reasons: [error.message] }; }
}

/** Read both exact issue heads; duplicate API rows are one PR, never two attempts. */
export async function robotPulls(github, repo, issueNumber) {
  const rows = new Map();
  for (const prefix of readNames('git ref:keel/robot-')) {
    const found = await robotPages(github, `/repos/${repo}/pulls?state=all&head=${encodeURIComponent(repo.split('/')[0] + ':' + prefix + issueNumber)}`);
    for (const row of found) {
      if (!robotId(row.number)) throw new Error('invalid robot pull request identity');
      rows.set(row.number, row);
    }
  }
  return [...rows.values()];
}
