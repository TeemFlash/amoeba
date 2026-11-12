/** Opt-in test of the deployed rules using the actual application repository. */
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
import { createApplicationsRepository } from '../../../apps/mobile/src/firebase/applications';

const project = 'mobi-senior-20261110';
if (process.env.FIREBASE_LIVE_QA !== '1' || process.env.FIREBASE_LIVE_PROJECT_ID !== project) throw new Error('Explicit live opt-in and exact project required');
const requireApp = createRequire(resolve('apps/mobile/package.json'));
const { initializeApp, deleteApp } = requireApp('firebase/app');
const { getAuth, createUserWithEmailAndPassword } = requireApp('firebase/auth');
const { getFirestore, terminate } = requireApp('firebase/firestore');
const cliAuth = requireApp('firebase-tools/lib/auth');
const { requireAuth } = requireApp('firebase-tools/lib/requireAuth');
const { Client } = requireApp('firebase-tools/lib/apiv2');
const env = Object.fromEntries(readFileSync('apps/mobile/.env.local','utf8').split(/\r?\n/).filter(l=>l.startsWith('EXPO_PUBLIC_FIREBASE_')).map(l=>{const i=l.indexOf('=');return[l.slice(0,i),l.slice(i+1).trim()];}));
if(env.EXPO_PUBLIC_FIREBASE_PROJECT_ID!==project)throw new Error('Wrong client project');
const app=initializeApp({apiKey:env.EXPO_PUBLIC_FIREBASE_API_KEY,authDomain:env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,projectId:project,appId:env.EXPO_PUBLIC_FIREBASE_APP_ID,messagingSenderId:env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID},'mobi-live-ui-qa');
const auth=getAuth(app), db=getFirestore(app), repo=createApplicationsRepository(db);
const stamp=Date.now(), email=`qa-mobi-ui-${stamp}@example.test`;
const operations=[`qa-ui-new-${stamp}`,`qa-ui-legacy-${stamp}`];
const checks:string[]=[];
let uid='', cleaned=false, failure:string|null=null;
const out=resolve('docs/mvp/qa/2026-11-10-implemented-ui');
mkdirSync(out,{recursive:true});
const registry=resolve('.git/firebase-baseline/mobi-ui-live-cleanup.json');
const silent={skipLog:{reqBody:true,resBody:true}};
async function main(){
 const account=cliAuth.getGlobalDefaultAccount(); if(!account)throw new Error('CLI account unavailable for targeted cleanup');
 const options={project,nonInteractive:true};cliAuth.setActiveAccount(options,account);await requireAuth(options);
 const adminDb=new Client({urlPrefix:'https://firestore.googleapis.com',apiVersion:'v1'});
 const adminAuth=new Client({urlPrefix:'https://identitytoolkit.googleapis.com',apiVersion:'v1'});
 async function cleanup(id:string,mail:string,ops:string[]){
   if(!/^[A-Za-z0-9]{10,128}$/.test(id)||!/^qa-mobi-ui-\d+@example\.test$/.test(mail)||ops.length!==2||ops.some(o=>!/^qa-ui-(new|legacy)-\d+$/.test(o)))throw new Error('Cleanup registry scope invalid');
   const lookup=await adminAuth.post(`/projects/${project}/accounts:lookup`,{localId:[id]},{...silent});
   if(lookup.body.users?.[0]?.email!==mail)throw new Error('Cleanup identity mismatch');
   for(const op of ops)await adminDb.delete(`/projects/${project}/databases/(default)/documents/users/${id}/applications/${op}`,{...silent});
   await adminAuth.post(`/projects/${project}/accounts:delete`,{localId:id},{...silent});
   const verify=await adminAuth.post(`/projects/${project}/accounts:lookup`,{localId:[id]},{...silent});
   const documents=await adminDb.get(`/projects/${project}/databases/(default)/documents/users/${id}/applications`,{...silent});
   if(verify.body.users?.length||documents.body.documents?.length)throw new Error('Cleanup not complete');
 }
 if(existsSync(registry)){
   const prior=JSON.parse(readFileSync(registry,'utf8'));
   if(prior.project!==project)throw new Error('Prior registry project mismatch');
   if(!prior.cleaned){await cleanup(prior.uid,prior.email,prior.operations);writeFileSync(registry,JSON.stringify({...prior,cleaned:true},null,2));checks.push('prior synthetic attempt cleaned after QA helper failure');}
 }
 try{
  const result=await createUserWithEmailAndPassword(auth,email,'QA-'+randomBytes(24).toString('base64url')+'7!');uid=result.user.uid;
  writeFileSync(registry,JSON.stringify({project,uid,email,operations,cleaned:false},null,2));
  checks.push('live Email/Password synthetic account created');
  const intent={uid,operationId:operations[0]!,kind:'help' as const,serviceId:'home-help' as const,districtId:'astana-esil' as const,dateId:'demo-nov14' as const,slotId:'demo-14-16' as const,note:'Synthetic Mobi UI verification'};
  const saved=await repo.submit(intent);if(saved.kind!=='help'||saved.dateId!==intent.dateId||saved.note!==intent.note)throw new Error('Extended payload mismatch');
  checks.push('new help date and note saved through live deployed rules');
  await repo.submit({uid,operationId:operations[1]!,kind:'help',serviceId:'groceries',districtId:'demo-center',slotId:'demo-morning'});
  const entries=await repo.list(uid);const old=entries.find(e=>e.operationId===operations[1]);
  if(entries.length!==2||!old||'dateId'in old||'note'in old)throw new Error('Legacy payload changed');
  checks.push('legacy and new shapes read together without injected fields');
  const duplicate=await repo.submit(intent);if(duplicate.id!==saved.id||(await repo.list(uid)).length!==2)throw new Error('Duplicate created');
  checks.push('same operation replay is idempotent');
  let rejected=false;try{await repo.submit({...intent,note:'Changed'});}catch{rejected=true;}if(!rejected)throw new Error('Changed intent accepted');
  checks.push('same ID with changed note rejected');
  const cancelled=await repo.cancel(uid,saved.id);if(cancelled.status!=='cancelled-demo'||cancelled.kind!=='help'||cancelled.note!==intent.note||cancelled.dateId!==intent.dateId)throw new Error('Cancel changed choices');
  checks.push('live cancellation retains date and note');
 }catch(e){failure=e instanceof Error?e.message:'QA failed';throw e;}
 finally{
  writeFileSync(resolve(out,'live-data-results.json'),JSON.stringify({project,checks,failure,syntheticAccountRemoved:false},null,2));
  if(uid){
   await cleanup(uid,email,operations);
   cleaned=true;writeFileSync(registry,JSON.stringify({project,uid,email,operations,cleaned:true},null,2));
  }
  await terminate(db);await deleteApp(app);
  const report={project,verifiedAt:new Date().toISOString(),checks,failure,syntheticAccountRemoved:cleaned,syntheticDocumentsRemoved:cleaned,userAccountsTouched:false,evidence:'Live Firebase SDK and deployed rules; UI separately tested in emulator; not native device evidence'};
  writeFileSync(resolve(out,'live-data-results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 }
}
main().catch((error)=>{console.error('Live QA failed:', error instanceof Error ? error.message.replace(/key=[^\s&]+/g,'key=<redacted>') : 'unknown error');process.exitCode=1;});
