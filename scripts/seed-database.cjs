const fs=require('node:fs'),vm=require('node:vm');
const context={window:{}};
vm.runInNewContext(fs.readFileSync('assets/data.js','utf8'),context);
const stalls=context.window.STALLS.map((s,i)=>({id:s.slug,name:s.name,category:s.category,label:s.label,unit:s.unit,icon:s.icon,color:s.color,description:s.description,estimated_minutes:5,sort_order:i}));
const items=context.window.STALLS.flatMap(s=>s.menu.map((m,i)=>({id:s.slug+':'+m[0],stall_id:s.slug,slug:m[0],name:m[1],description:m[2],price:m[3],sort_order:i})));
const literal=data=>"'"+JSON.stringify(data).replaceAll("'","''")+"'::jsonb";
const seed=`begin;
insert into public.stalls(id,name,category,label,unit,icon,color,description,estimated_minutes,sort_order)
select id,name,category,label,unit,icon,color,description,estimated_minutes,sort_order from jsonb_to_recordset(${literal(stalls)}) as s(id text,name text,category text,label text,unit text,icon text,color text,description text,estimated_minutes integer,sort_order integer)
on conflict(id) do update set name=excluded.name,category=excluded.category,label=excluded.label,icon=excluded.icon,color=excluded.color,description=excluded.description,estimated_minutes=excluded.estimated_minutes,sort_order=excluded.sort_order;
insert into public.menu_items(id,stall_id,slug,name,description,price,sort_order)
select id,stall_id,slug,name,description,price,sort_order from jsonb_to_recordset(${literal(items)}) as m(id text,stall_id text,slug text,name text,description text,price integer,sort_order integer)
on conflict(id) do update set name=excluded.name,description=excluded.description,price=excluded.price,sort_order=excluded.sort_order;
commit;\n`;
fs.writeFileSync('supabase/seed.sql',seed);
console.log(`Prepared ${stalls.length} stalls and ${items.length} menu items.`);
