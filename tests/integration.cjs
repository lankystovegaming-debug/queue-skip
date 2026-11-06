// Opt-in hosted API integration check. Uses throw-away guests; cleanup SQL is emitted to /tmp.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const crypto=require('node:crypto');
const {createClient}=require('@supabase/supabase-js');
const source=fs.readFileSync('client/database.js','utf8');
const [,url,key]=source.match(/createClient\('([^']+)','([^']+)'/);
const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}};
const a=createClient(url,key,options),b=createClient(url,key,options);
const guests=[];
(async()=>{
 try {
  const menu=await a.from('stalls').select('id');
  assert.ifError(menu.error); assert.equal(menu.data.length,7);
  const items=await a.from('menu_items').select('id'); assert.ifError(items.error); assert.equal(items.data.length,30);
  const forbidden=await a.from('orders').select('id'); assert.ok(forbidden.error,'unsigned browser cannot read orders');
  for(const client of [a,b]) {const {data,error}=await client.auth.signInAnonymously();assert.ifError(error);guests.push(data.user.id);}
  const request={p_request_id:crypto.randomUUID(),p_student_name:'Integration Test Guest',p_student_class:'TEST',p_pickup_at:new Date(Date.now()+86400000).toISOString(),p_notes:'Automated API check',p_payment_method:'online',p_items:[{id:'golden-grain:chicken-rice',quantity:1},{id:'fresh-squeeze:orange-juice',quantity:1}],p_expected_total:700};
  const first=await a.rpc('place_guest_order',request);assert.ifError(first.error);assert.equal(first.data.total,700);assert.equal(first.data.items.length,2);assert.equal(first.data.source,'database');assert.equal(first.data.lastFour,'');
  const again=await a.rpc('place_guest_order',request);assert.ifError(again.error);assert.equal(again.data.id,first.data.id);
  const own=await a.rpc('get_my_receipts');assert.ifError(own.error);assert.equal(own.data.length,1);
  const other=await b.rpc('get_my_receipts');assert.ifError(other.error);assert.equal(other.data.length,0);
  const otherRows=await b.from('orders').select('id').eq('reference',first.data.id);assert.ifError(otherRows.error);assert.equal(otherRows.data.length,0);
  const tamper=await b.from('orders').update({total:1}).eq('reference',first.data.id);assert.ok(tamper.error);
  const wrong=await a.rpc('place_guest_order',{...request,p_request_id:crypto.randomUUID(),p_expected_total:1});assert.ok(wrong.error);
  console.log('PASS: live public menu, invisible guest creation, multi-stall order, private receipts, idempotency, and rejected price tampering.');
 } finally {
  for(const client of [a,b]) await client.auth.signOut();
  if(guests.length) {
   const ids=guests.map(id=>{assert.match(id,/^[0-9a-f-]{36}$/);return "'"+id+"'::uuid";}).join(',');
   fs.writeFileSync('/private/tmp/queue-skip-cleanup.sql',`begin;\ndelete from public.order_items where stall_order_id in (select so.id from public.stall_orders so join public.orders o on o.id=so.order_id where o.user_id in (${ids}));\ndelete from public.stall_orders where order_id in (select id from public.orders where user_id in (${ids}));\ndelete from public.orders where user_id in (${ids});\ndelete from auth.users where id in (${ids});\ncommit;\n`);
  }
 }
})().catch(error=>{console.error(error.message);process.exitCode=1;});
