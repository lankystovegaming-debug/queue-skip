const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
async function render(page,{changeMenu,cart={},receipts=[],failMenu=false}={}) {
 const nodes=new Map();const node=id=>{if(!nodes.has(id))nodes.set(id,{innerHTML:'',textContent:'',addEventListener(){}});return nodes.get(id);};
 const storage=new Map([['queue-skip-cart-v1',JSON.stringify(cart)]]);
 const context={window:{addEventListener(){}},document:{body:{dataset:{page,base:page?'../':'./'}},getElementById:node,querySelectorAll:()=>[]},localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)},sessionStorage:{getItem:()=>null},location:{search:''},Intl,URLSearchParams,setTimeout,clearTimeout};
 vm.createContext(context);vm.runInContext(fs.readFileSync('assets/data.js','utf8'),context);vm.runInContext(fs.readFileSync('assets/orders.js','utf8'),context);
 const menu=JSON.parse(JSON.stringify(context.window.STALLS));if(changeMenu)changeMenu(menu);
 context.window.queueDatabase={getMenu:async()=>{if(failMenu)throw new Error('Menu connection failed');return menu;},listOrders:async()=>receipts};
 vm.runInContext(fs.readFileSync('assets/app.js','utf8'),context);await new Promise(resolve=>setImmediate(resolve));
 return {html:node('app').innerHTML,nodes};
}
(async()=>{
 const home=await render('');assert.match(home.html,/7 stalls/);assert.match(home.html,/Receipts/);
 const dynamic=await render('cart',{changeMenu:menu=>menu[0].menu.push(['new-dish','New Live Dish','Database menu addition',375,true]),cart:{'golden-grain:new-dish':1}});
 assert.match(dynamic.html,/New Live Dish/);assert.match(dynamic.html,/S\$3.75/);
 const escaped=await render('',{changeMenu:menu=>menu[0].name='<img src=x onerror=alert(1)>'});assert.ok(!escaped.html.includes('<img src=x'));assert.match(escaped.html,/&lt;img/);
 const receipt={version:1,source:'database',id:'QS-ABCDEF123456',createdAt:'2026-11-06T03:00:00Z',studentName:'Guest',studentClass:'3A',pickupDate:'2026-11-07',pickupTime:'10:30',notes:'',paymentMethod:'online',lastFour:'',total:450,items:[{stall:'Golden Grain',unit:'01',name:'Chicken Rice',price:450,quantity:1}]};
 const history=await render('receipts',{receipts:[receipt]});assert.match(history.html,/QS-ABCDEF123456/);
 const saved=await render('order-confirmation',{receipts:[receipt]});assert.match(saved.html,/Saved to Queue Skip/);assert.ok(!saved.html.includes('Test card ending .'));
 const failed=await render('checkout',{failMenu:true,cart:{'golden-grain:chicken-rice':1}});assert.match(failed.html,/Retry loading/);assert.equal(failed.nodes.get('load-error-message').textContent,'Menu connection failed');
 console.log('Passed app rendering checks: live menu additions, cart preservation, escaped menu text, database receipts, and load-error retry.');
})().catch(error=>{console.error(error);process.exitCode=1;});
