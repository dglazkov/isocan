import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {harnessVars} from '../../packages/api/src/harness.ts';

/** A named local CLI session is a distinct recorded agent, with only the fixture's synthetic credential. */
export function continuationCli(f) {
  return async(...args)=>{
    const env={...process.env};for(const key of Object.keys(env))if(key.startsWith('ISOCAN_')||harnessVars.includes(key))delete env[key];
    Object.assign(env,{ISOCAN_HOME:f.clientHome,ISOCAN_DIRECT:f.base,ISOCAN_PORT:new URL(f.base).port,ISOCAN_DEFAULT_HOME_URL:'',ISOCAN_SESSION_ID:'design-systems-continuation',ISOCAN_HARNESS:'codex'});
    const child=spawn(process.execPath,[fileURLToPath(new URL('../../packages/cli/bin/isocan.js',import.meta.url)),...args],{cwd:f.clientHome,env,stdio:['ignore','pipe','pipe']});let stdout='',stderr='';child.stdout.on('data',data=>stdout+=data);child.stderr.on('data',data=>stderr+=data);
    const timeout=setTimeout(()=>child.kill('SIGKILL'),30000);
    try {const code=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',resolve)});assert.equal(code,0,`Continuation CLI ${args.join(' ')}: ${stderr}`);try{return JSON.parse(stdout)}catch{return stdout}}
    finally{clearTimeout(timeout);}
  };
}
