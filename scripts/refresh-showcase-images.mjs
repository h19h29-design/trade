import {resolve} from 'node:path';
import {existsSync} from 'node:fs';
import {openDatabase} from '../server/db.mjs';
import {refreshShowcaseImages} from '../server/showcase-images.mjs';

const dataDir=resolve(process.env.DATA_DIR||'./data');
const dbFile=resolve(dataDir,'trade.sqlite');
if(!existsSync(dbFile))throw Error('데이터 경로에서 trade.sqlite를 찾지 못했습니다. DATA_DIR을 확인하세요.');
const apply=process.argv.includes('--apply');
const db=openDatabase(dbFile);
try{
 const result=refreshShowcaseImages(db,dataDir,{apply});
 console.log(JSON.stringify(result,null,2));
 if(!apply)console.log('미리보기입니다. 실제 반영은 --apply로 실행하세요. 기존 첨부 파일은 삭제하지 않습니다.');
}finally{db.close();}
