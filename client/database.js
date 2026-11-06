import {createClient} from '@supabase/supabase-js';
const client=createClient('https://cysaladzzshykauneppq.supabase.co','sb_publishable_LMdn_JjQI91RiMOzciHt2w_HXqZelOK',{
 auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false},
 global:{headers:{'X-Client-Info':'queue-skip-web/0.1'}}
});
let guestPromise;
async function ensureGuest() {
 const {data,error}=await client.auth.getSession();
 if(error) throw new Error('Your guest session could not be read. Refresh the page and try again.');
 if(data.session) return data.session;
 if(!guestPromise) guestPromise=(async()=>{
  try { localStorage.setItem('queue-skip-storage-check','1'); localStorage.removeItem('queue-skip-storage-check'); }
  catch { throw new Error('Enable browser storage so your guest receipts can be kept private and found again.'); }
  const result=await client.auth.signInAnonymously();
  if(result.error) throw new Error('We could not start guest checkout. Please wait a moment and try again.');
  return result.data.session;
 })().finally(()=>{guestPromise=null;});
 return guestPromise;
}
window.queueDatabase={
 async getMenu() {
  const [{data:stalls,error:stallError},{data:items,error:itemError}]=await Promise.all([
   client.from('stalls').select('*').order('sort_order'),
   client.from('menu_items').select('*').order('sort_order')
  ]);
  if(stallError||itemError||!stalls?.length) throw new Error('We could not load the canteen menu. Your cart is safe. Please try again.');
  return stalls.map(stall=>{
   if(!/^[a-z0-9-]+$/.test(stall.id)||!/^#[0-9a-f]{6}$/i.test(stall.color)||!['rice','noodles','prata','coffee','dessert','fruit'].includes(stall.icon)) throw new Error('A stall has invalid menu details. Please try again later.');
   return {slug:stall.id,name:stall.name,category:stall.category,label:stall.label,unit:stall.unit,icon:stall.icon,color:stall.color,description:stall.description,estimatedMinutes:stall.estimated_minutes,isOpen:stall.is_open,
    menu:items.filter(item=>item.stall_id===stall.id).map(item=>{
     if(!/^[a-z0-9-]+$/.test(item.slug)||!Number.isInteger(item.price)||item.price<0) throw new Error('A menu item has invalid details. Please try again later.');
     return [item.slug,item.name,item.description,item.price,item.available];
    })};
  });
 },
 async listOrders() {
  const {data,error}=await client.auth.getSession();
  if(error) throw new Error('We could not read your guest session. Please refresh.');
  if(!data.session) return [];
  const response=await client.rpc('get_my_receipts');
  if(response.error) throw new Error('We could not load your saved receipts. Please try again.');
  return response.data||[];
 },
 async placeOrder(draft) {
  await ensureGuest();
  // Whitelist the request: card number, holder, expiry, CVV and last-four are never sent.
  const response=await client.rpc('place_guest_order',{
   p_request_id:draft.requestId,p_student_name:draft.studentName,p_student_class:draft.studentClass,
   p_pickup_at:`${draft.pickupDate}T${draft.pickupTime}:00+08:00`,p_notes:draft.notes,
   p_payment_method:draft.paymentMethod,
   p_items:draft.items.map(item=>({id:item.menuItemId,quantity:item.quantity})),
   p_expected_total:draft.items.reduce((sum,item)=>sum+item.price*item.quantity,0)
  });
  if(response.error) throw new Error(response.error.code==='P0001'?response.error.message:'We could not confirm your order. Your cart has been kept. Please try again.');
  if(!response.data?.id) throw new Error('We could not verify the order response. Please retry; the same request will not create a duplicate.');
  return response.data;
 }
};
