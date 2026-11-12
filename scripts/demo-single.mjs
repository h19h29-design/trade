import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
import {existsSync} from 'node:fs';
const credentialFile=resolve(process.env.DEMO_SINGLE_ENV_FILE||'.env.single-demo');
if(existsSync(credentialFile))process.loadEnvFile(credentialFile);
if(process.env.NODE_ENV==='production')throw Error('운영 모드에서는 단일 데모를 시작할 수 없습니다.');
if(!existsSync('dist/index.html'))throw Error('먼저 npm run build를 실행하세요.');
const result=spawnSync(process.execPath,['server/index.mjs'],{stdio:'inherit',env:{...process.env,NODE_ENV:'development',DEMO_MODE:'true',SINGLE_DEMO_MODE:'true',DATA_DIR:resolve(process.env.DATA_DIR||'./data/single-demo'),HOST:process.env.HOST||'127.0.0.1',APP_ORIGIN:process.env.APP_ORIGIN||'http://localhost:4310'}});process.exit(result.status??1);
