import {resolve} from 'node:path';
import {existsSync} from 'node:fs';
import {openDatabase} from '../server/db.mjs';
import {seedAdditionalSamples} from '../server/demo-samples.mjs';
if(process.env.NODE_ENV==='production'||process.env.DEMO_MODE!=='true')throw Error('DEMO_MODE=true인 별도 시연 DB에서만 샘플을 추가합니다.');
const dir=resolve(process.env.DATA_DIR||'./data/single-demo');if(!existsSync(resolve(dir,'trade.sqlite')))throw Error('먼저 시연 DB를 만들어 주세요.');
const db=openDatabase(resolve(dir,'trade.sqlite'));try{console.log(await seedAdditionalSamples(db,dir,{demo:true,count:300}));}finally{db.close();}
