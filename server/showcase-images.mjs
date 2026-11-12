import {readFileSync,writeFileSync,existsSync,mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {transaction,audit} from './db.mjs';
import {hash} from './auth.mjs';

export const SHOWCASE_DISPLAY_NAME='시연용 생성 이미지.webp';

export const SHOWCASE_MAP=[
 ['수업용 이동식 화이트보드','whiteboard'],
 ['서류 보관 3단 이동서랍','mobile-drawer'],
 ['회의용 무선마이크 세트','wireless-mic'],
 ['교무실 책상','staff-desk'],
 ['24인치 모니터','monitor-24'],
 ['강당 의자','meeting-chair']
];

export function showcaseAssetBytes(asset){return readFileSync(new URL('./demo-assets/'+asset+'.webp',import.meta.url));}

export function showcaseDiskName(asset,fileId){return 'showcase-'+asset+'-'+fileId+'.webp';}

// 기존 파일을 삭제하거나 덮어쓰지 않는다. 새 파일명을 만들고 DB 참조만 갱신한다.
export function refreshShowcaseImages(db,dataDir,{apply=false}={}){
 const upload=join(dataDir,'uploads');
 if(apply)mkdirSync(upload,{recursive:true});
 const items=[],skipped=[],keptPrevious=[];
 for(const [title,asset] of SHOWCASE_MAP){
  const lots=db.prepare("SELECT id,data FROM lots WHERE state='PUBLISHED' AND json_extract(data,'$.title') LIKE ? AND NOT EXISTS(SELECT 1 FROM lot_archives a WHERE a.lot_id=lots.id AND a.restored_at IS NULL)").all('%'+title+'%');
  if(!lots.length){skipped.push({title,reason:'공개 물품 없음'});continue;}
  for(const lot of lots){
   const photo=db.prepare("SELECT * FROM files WHERE lot_id=? AND kind='PHOTO' ORDER BY created_at LIMIT 1").get(lot.id);
   if(!photo){skipped.push({title,reason:'현물사진 없음'});continue;}
   const bytes=showcaseAssetBytes(asset),sha=hash(bytes),disk=showcaseDiskName(asset,photo.id);
   const unchanged=photo.sha256===sha&&photo.disk_name===disk;
   if(!unchanged)keptPrevious.push(photo.disk_name);
   items.push({lotId:lot.id,title:JSON.parse(lot.data).title,fileId:photo.id,asset,disk,unchanged});
   if(!apply||unchanged)continue;
   const path=join(upload,disk);
   if(!existsSync(path))writeFileSync(path,bytes,{mode:0o600,flag:'wx'});
   transaction(db,()=>{
    db.prepare('UPDATE files SET name=?,mime=?,disk_name=?,sha256=?,size=? WHERE id=?').run(SHOWCASE_DISPLAY_NAME,'image/webp',disk,sha,bytes.length,photo.id);
    audit(db,{org_id:photo.org_id,id:photo.created_by},'DEMO_SHOWCASE_IMAGE_REFRESH',photo.id,{asset,previousDisk:photo.disk_name,previousSha256:photo.sha256,previousFileKept:true,generatedImage:true,notRealPhoto:true});
   });
  }
 }
 return {mode:apply?'APPLIED':'DRY_RUN',changed:items.filter(x=>!x.unchanged).length,unchanged:items.filter(x=>x.unchanged).length,keptPreviousFiles:[...new Set(keptPrevious)],items:items.map(x=>({title:x.title,asset:x.asset,fileId:x.fileId,disk:x.disk,unchanged:x.unchanged})),skipped};
}
