import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,draft,approval,fileRecord,tomorrow} from './helpers.mjs';
import * as svc from '../server/service.mjs';
import {uid} from '../server/db.mjs';

test('시연 단일계정: 본인 검토·게시부터 같은 기관 신청·인계·인수·완료까지 한 계정으로 진행된다',()=>{
 const f=fixture();
 const op={...f.editor,demoSingle:true,demoReviewerId:f.reviewer.id};
 const lotId=svc.saveLot(f.db,op,draft());
 fileRecord(f,op,lotId,null,'PHOTO');
 fileRecord(f,op,lotId,null,'EVIDENCE');
 svc.submitLot(f.db,op,lotId);
 assert.throws(()=>svc.reviewLot(f.db,f.editor,lotId,approval()),/권한/);
 svc.reviewLot(f.db,op,lotId,approval());
 const published=f.db.prepare('SELECT state,reviewer_id,decision_status FROM lots WHERE id=?').get(lotId);
 assert.equal(published.state,'PUBLISHED');
 assert.equal(published.decision_status,'VERIFIED');
 assert.equal(published.reviewer_id,f.reviewer.id);
 assert.notEqual(published.reviewer_id,f.editor.id);
 const groupId=f.db.prepare("SELECT id FROM groups WHERE lot_id=? AND condition='GOOD'").get(lotId).id;
 assert.throws(()=>svc.apply(f.db,f.editor,{groupId,quantity:2,purpose:'교실 사용',pickupDate:tomorrow()},uid()),/같은 기관/);
 const requestId=svc.apply(f.db,op,{groupId,quantity:2,purpose:'교실 사용',pickupDate:tomorrow()},uid());
 assert.ok(requestId);
 svc.reserve(f.db,op,requestId);
 const evidence=fileRecord(f,op,null,requestId);
 for(const step of ['inquiry','agreement_sender','agreement_receiver','approval_sender','approval_receiver']){
  svc.stepCase(f.db,op,requestId,{step,reference:'시연 확인 근거',fileId:evidence});
 }
 svc.importAssets(f.db,op,[{externalId:'DEMO-A1',originalName:'의자',quantity:20}]);
 const asset=f.db.prepare('SELECT id FROM assets WHERE org_id=?').get(op.org_id);
 svc.bindAssets(f.db,op,lotId,[asset.id]);
 svc.allocateAssets(f.db,op,requestId,[{assetId:asset.id,quantity:2}]);
 svc.handover(f.db,op,requestId,{confirmed:true});
 svc.receive(f.db,op,requestId,{quantity:2,note:'정상 인수'});
 for(const step of ['ledger_sender','ledger_receiver']){
  svc.stepCase(f.db,op,requestId,{step,reference:'대장 반영 확인',fileId:evidence});
 }
 svc.completeCase(f.db,op,requestId);
 assert.equal(f.db.prepare('SELECT state FROM requests WHERE id=?').get(requestId).state,'DONE');
 assert.equal(f.db.prepare("SELECT COUNT(*) n FROM requests WHERE receiver_org=(SELECT org_id FROM users WHERE id=?)").get(op.id).n,1);
});

