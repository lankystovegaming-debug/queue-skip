-- Guest checkout: schema, policies, protected order transaction, and initial menu.
begin;
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create table public.stalls (
 id text primary key, name text not null, category text not null, label text not null,
 unit text not null unique, icon text not null, color text not null,
 description text not null, estimated_minutes integer not null default 5 check (estimated_minutes between 1 and 240),
 is_open boolean not null default true, sort_order integer not null
);
create table public.menu_items (
 id text primary key, stall_id text not null references public.stalls(id),
 slug text not null, name text not null, description text not null,
 price integer not null check(price between 0 and 100000), available boolean not null default true,
 sort_order integer not null, unique(stall_id,slug)
);
create index menu_items_stall_idx on public.menu_items(stall_id);
create table public.orders (
 id uuid primary key default gen_random_uuid(),
 reference text not null unique default ('QS-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,12))),
 user_id uuid not null references auth.users(id), request_id uuid not null,
 student_name text not null check(length(btrim(student_name)) between 1 and 70),
 student_class text not null check(length(btrim(student_class)) between 1 and 30),
 pickup_at timestamptz not null, notes text not null default '' check(length(notes)<=300),
 payment_method text not null check(payment_method in ('pickup','online')),
 payment_status text not null default 'demo_no_charge' check(payment_status='demo_no_charge'),
 total integer not null default 0 check(total>=0), status text not null default 'received',
 created_at timestamptz not null default now(), unique(user_id,request_id)
);
create index orders_user_created_idx on public.orders(user_id,created_at desc);
create table public.stall_orders (
 id uuid primary key default gen_random_uuid(), order_id uuid not null references public.orders(id),
 stall_id text not null references public.stalls(id), stall_name text not null, stall_unit text not null,
 status text not null default 'received' check(status in ('received','preparing','ready','collected','cancelled')),
 estimated_minutes integer not null check(estimated_minutes>0), unique(order_id,stall_id)
);
create index stall_orders_stall_idx on public.stall_orders(stall_id);
create table public.order_items (
 id uuid primary key default gen_random_uuid(), stall_order_id uuid not null references public.stall_orders(id),
 menu_item_id text not null references public.menu_items(id), item_name text not null,
 price integer not null check(price>=0), quantity integer not null check(quantity between 1 and 99),
 unique(stall_order_id,menu_item_id)
);
create index order_items_menu_idx on public.order_items(menu_item_id);

alter table public.stalls enable row level security;
alter table public.menu_items enable row level security;
alter table public.orders enable row level security;
alter table public.stall_orders enable row level security;
alter table public.order_items enable row level security;
revoke all on public.stalls,public.menu_items,public.orders,public.stall_orders,public.order_items from anon,authenticated;
grant select on public.stalls,public.menu_items to anon,authenticated;
grant select on public.orders,public.stall_orders,public.order_items to authenticated;
create policy menu_public_read on public.stalls for select to anon,authenticated using(true);
create policy items_public_read on public.menu_items for select to anon,authenticated using(true);
create policy own_orders_read on public.orders for select to authenticated using(user_id=(select auth.uid()));
create policy own_stall_orders_read on public.stall_orders for select to authenticated using(
 exists(select 1 from public.orders o where o.id=order_id and o.user_id=(select auth.uid()))
);
create policy own_items_read on public.order_items for select to authenticated using(
 exists(select 1 from public.stall_orders so join public.orders o on o.id=so.order_id
 where so.id=stall_order_id and o.user_id=(select auth.uid()))
);

create function private.order_receipt(p_order_id uuid) returns jsonb
language sql stable security invoker set search_path='' as $$
 select jsonb_build_object(
  'version',1,'source','database','id',o.reference,'createdAt',o.created_at,
  'studentName',o.student_name,'studentClass',o.student_class,
  'pickupDate',to_char(o.pickup_at at time zone 'Asia/Singapore','YYYY-MM-DD'),
  'pickupTime',to_char(o.pickup_at at time zone 'Asia/Singapore','HH24:MI'),
  'notes',o.notes,'paymentMethod',o.payment_method,'lastFour','','total',o.total,
  'items',(select jsonb_agg(jsonb_build_object('stall',so.stall_name,'unit',so.stall_unit,
    'name',oi.item_name,'price',oi.price,'quantity',oi.quantity) order by so.stall_unit,oi.item_name)
    from public.stall_orders so join public.order_items oi on oi.stall_order_id=so.id where so.order_id=o.id)
 ) from public.orders o where o.id=p_order_id
$$;
revoke all on function private.order_receipt(uuid) from public,anon;
grant execute on function private.order_receipt(uuid) to authenticated;

-- The only privileged write path. It must own the transaction so clients cannot
-- choose their owner, prices, totals, payment status, or stall preparation status.
-- Kept in a non-exposed schema, with explicit caller checks and a pinned search path.
create function private.place_guest_order(
 p_request_id uuid,p_student_name text,p_student_class text,p_pickup_at timestamptz,
 p_notes text,p_payment_method text,p_items jsonb,p_expected_total integer
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
 v_user uuid := auth.uid(); v_order uuid; v_line jsonb; v_item public.menu_items%rowtype;
 v_stall public.stalls%rowtype; v_stall_order uuid; v_quantity integer; v_total integer :=0;
begin
 if v_user is null then raise exception 'A guest session is required.' using errcode='42501'; end if;
 if p_request_id is null then raise exception 'An order request ID is required.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(v_user::text||p_request_id::text,0));
 select id into v_order from public.orders where user_id=v_user and request_id=p_request_id;
 if found then return private.order_receipt(v_order); end if;
 if p_student_name is null or length(btrim(p_student_name)) not between 1 and 70 or
    p_student_class is null or length(btrim(p_student_class)) not between 1 and 30 then
  raise exception 'Enter your name and class.';
 end if;
 if p_notes is null or length(p_notes)>300 then raise exception 'Order notes must be 300 characters or fewer.'; end if;
 if p_pickup_at is null or p_pickup_at<now()+interval '5 minutes' then raise exception 'Choose a pickup time at least 5 minutes from now.'; end if;
 if p_payment_method is null or p_payment_method not in ('pickup','online') then raise exception 'Choose a valid payment method.'; end if;
 if jsonb_typeof(p_items) is distinct from 'array' then raise exception 'Your cart must contain items.'; end if;
 if jsonb_array_length(p_items) not between 1 and 50 then raise exception 'Your cart must contain between 1 and 50 different items.'; end if;
 if (select count(distinct line->>'id') from jsonb_array_elements(p_items) line)<>jsonb_array_length(p_items) then
  raise exception 'Duplicate or missing items in your cart. Please refresh it.';
 end if;
 insert into public.orders(user_id,request_id,student_name,student_class,pickup_at,notes,payment_method)
 values(v_user,p_request_id,btrim(p_student_name),btrim(p_student_class),p_pickup_at,p_notes,p_payment_method) returning id into v_order;
 for v_line in select value from jsonb_array_elements(p_items) loop
  if jsonb_typeof(v_line->'quantity') is distinct from 'number' or (v_line->>'quantity') !~ '^[1-9][0-9]?$' then
   raise exception 'Each item quantity must be between 1 and 99.';
  end if;
  v_quantity:=(v_line->>'quantity')::integer;
  select * into v_item from public.menu_items where id=v_line->>'id' for share;
  if not found or not v_item.available then raise exception 'An item is no longer available. Refresh your cart and try again.'; end if;
  select * into v_stall from public.stalls where id=v_item.stall_id for share;
  if not found or not v_stall.is_open then raise exception 'A stall is currently closed. Refresh your cart and try again.'; end if;
  insert into public.stall_orders(order_id,stall_id,stall_name,stall_unit,estimated_minutes)
  values(v_order,v_stall.id,v_stall.name,v_stall.unit,v_stall.estimated_minutes)
  on conflict(order_id,stall_id) do nothing;
  select id into v_stall_order from public.stall_orders where order_id=v_order and stall_id=v_stall.id;
  insert into public.order_items(stall_order_id,menu_item_id,item_name,price,quantity)
  values(v_stall_order,v_item.id,v_item.name,v_item.price,v_quantity);
  v_total:=v_total+v_item.price*v_quantity;
 end loop;
 if p_expected_total is null or v_total<>p_expected_total then raise exception 'Menu prices changed. Refresh your cart and review the order again.'; end if;
 update public.orders set total=v_total where id=v_order;
 return private.order_receipt(v_order);
end $$;
revoke all on function private.place_guest_order(uuid,text,text,timestamptz,text,text,jsonb,integer) from public,anon;
grant execute on function private.place_guest_order(uuid,text,text,timestamptz,text,text,jsonb,integer) to authenticated;

create function public.place_guest_order(
 p_request_id uuid,p_student_name text,p_student_class text,p_pickup_at timestamptz,
 p_notes text,p_payment_method text,p_items jsonb,p_expected_total integer
) returns jsonb language sql security invoker set search_path='' as $$
 select private.place_guest_order(p_request_id,p_student_name,p_student_class,p_pickup_at,p_notes,p_payment_method,p_items,p_expected_total)
$$;
revoke all on function public.place_guest_order(uuid,text,text,timestamptz,text,text,jsonb,integer) from public,anon;
grant execute on function public.place_guest_order(uuid,text,text,timestamptz,text,text,jsonb,integer) to authenticated;
create function public.get_my_receipts() returns jsonb language sql stable security invoker set search_path='' as $$
 select coalesce(jsonb_agg(private.order_receipt(id) order by created_at desc),'[]'::jsonb) from public.orders
$$;
revoke all on function public.get_my_receipts() from public,anon;
grant execute on function public.get_my_receipts() to authenticated;
notify pgrst,'reload schema';

insert into public.stalls(id,name,category,label,unit,icon,color,description,estimated_minutes,sort_order)
select id,name,category,label,unit,icon,color,description,estimated_minutes,sort_order from jsonb_to_recordset('[{"id":"golden-grain","name":"Golden Grain","category":"Rice","label":"Hainanese chicken rice","unit":"01","icon":"rice","color":"#f1d58b","description":"Comfort in every grain. Fragrant rice, tender chicken, and a little extra chilli on the side.","estimated_minutes":5,"sort_order":0},{"id":"wok-and-roll","name":"Wok & Roll","category":"Noodles","label":"Wok-fired local favourites","unit":"02","icon":"noodles","color":"#edb39a","description":"Big wok hei energy. Your favourite noodles, tossed over a roaring flame and served piping hot.","estimated_minutes":5,"sort_order":1},{"id":"coconut-corner","name":"Coconut Corner","category":"Rice","label":"Nasi lemak & Malay favourites","unit":"03","icon":"rice","color":"#c4d6ad","description":"Coconut-scented rice, a generous spoon of sambal, and all the sides that make lunch special.","estimated_minutes":5,"sort_order":2},{"id":"prata-parade","name":"Prata Parade","category":"Prata","label":"Crispy prata & comforting curry","unit":"04","icon":"prata","color":"#e8c993","description":"Crisp edges, fluffy middles. Freshly flipped prata with a generous helping of curry for dipping.","estimated_minutes":5,"sort_order":3},{"id":"kopi-kakis","name":"Kopi Kakis","category":"Drinks","label":"Your daily kopi & toast fix","unit":"05","icon":"coffee","color":"#c3c7ae","description":"Good mornings start here. Traditional kopi, strong teh, and the familiar crunch of kaya toast.","estimated_minutes":5,"sort_order":4},{"id":"sweet-lah","name":"Sweet Lah","category":"Desserts","label":"A sweet finish, Singapore style","unit":"06","icon":"dessert","color":"#d9b9cc","description":"Save a little room. Cool down with colourful local desserts and a well-earned sweet treat.","estimated_minutes":5,"sort_order":5},{"id":"fresh-squeeze","name":"Fresh Squeeze","category":"Drinks","label":"Fresh fruit & freshly blended juices","unit":"07","icon":"fruit","color":"#d7dfa0","description":"A fresh little boost for your school day. Juicy fruit cups and refreshing drinks, made to order.","estimated_minutes":5,"sort_order":6}]'::jsonb) as s(id text,name text,category text,label text,unit text,icon text,color text,description text,estimated_minutes integer,sort_order integer)
on conflict(id) do update set name=excluded.name,category=excluded.category,label=excluded.label,icon=excluded.icon,color=excluded.color,description=excluded.description,estimated_minutes=excluded.estimated_minutes,sort_order=excluded.sort_order;
insert into public.menu_items(id,stall_id,slug,name,description,price,sort_order)
select id,stall_id,slug,name,description,price,sort_order from jsonb_to_recordset('[{"id":"golden-grain:chicken-rice","stall_id":"golden-grain","slug":"chicken-rice","name":"Hainanese Chicken Rice","description":"Poached chicken, fragrant rice, cucumber & house chilli.","price":450,"sort_order":0},{"id":"golden-grain:roasted-chicken","stall_id":"golden-grain","slug":"roasted-chicken","name":"Roasted Chicken Rice","description":"Golden roasted chicken with savoury soy dressing.","price":500,"sort_order":1},{"id":"golden-grain:chicken-set","stall_id":"golden-grain","slug":"chicken-set","name":"Chicken Rice Set","description":"Our classic chicken rice with soup and braised egg.","price":650,"sort_order":2},{"id":"golden-grain:braised-egg","stall_id":"golden-grain","slug":"braised-egg","name":"Braised Egg","description":"A little extra goodness for your plate.","price":100,"sort_order":3},{"id":"wok-and-roll:char-kway-teow","stall_id":"wok-and-roll","slug":"char-kway-teow","name":"Char Kway Teow","description":"Flat rice noodles, egg, cockles & Chinese sausage.","price":550,"sort_order":0},{"id":"wok-and-roll:hokkien-mee","stall_id":"wok-and-roll","slug":"hokkien-mee","name":"Hokkien Prawn Mee","description":"Yellow noodles in rich prawn stock with sambal & lime.","price":600,"sort_order":1},{"id":"wok-and-roll:mee-goreng","stall_id":"wok-and-roll","slug":"mee-goreng","name":"Mee Goreng","description":"Spicy fried noodles with tofu, egg & vegetables.","price":500,"sort_order":2},{"id":"wok-and-roll:carrot-cake","stall_id":"wok-and-roll","slug":"carrot-cake","name":"Fried Carrot Cake","description":"White radish cake fried with egg & preserved radish.","price":450,"sort_order":3},{"id":"coconut-corner:nasi-lemak","stall_id":"coconut-corner","slug":"nasi-lemak","name":"Nasi Lemak","description":"Coconut rice, fried chicken wing, egg, ikan bilis & sambal.","price":550,"sort_order":0},{"id":"coconut-corner:rendang-rice","stall_id":"coconut-corner","slug":"rendang-rice","name":"Beef Rendang Rice","description":"Slow-cooked beef rendang with rice & achar.","price":700,"sort_order":1},{"id":"coconut-corner:mee-rebus","stall_id":"coconut-corner","slug":"mee-rebus","name":"Mee Rebus","description":"Yellow noodles in a thick, gently spiced gravy.","price":450,"sort_order":2},{"id":"coconut-corner:otah","stall_id":"coconut-corner","slug":"otah","name":"Grilled Otah","description":"A fragrant, banana-leaf-wrapped fish cake.","price":180,"sort_order":3},{"id":"prata-parade:plain-prata","stall_id":"prata-parade","slug":"plain-prata","name":"Plain Prata","description":"Two crisp, freshly flipped prata with curry.","price":260,"sort_order":0},{"id":"prata-parade:egg-prata","stall_id":"prata-parade","slug":"egg-prata","name":"Egg Prata","description":"A golden prata folded around a freshly cracked egg.","price":220,"sort_order":1},{"id":"prata-parade:cheese-prata","stall_id":"prata-parade","slug":"cheese-prata","name":"Cheese Prata","description":"Crispy prata with a warm, melty cheese centre.","price":280,"sort_order":2},{"id":"prata-parade:chicken-murtabak","stall_id":"prata-parade","slug":"chicken-murtabak","name":"Chicken Murtabak","description":"A hearty parcel of spiced chicken, onion & egg.","price":750,"sort_order":3},{"id":"kopi-kakis:kopi","stall_id":"kopi-kakis","slug":"kopi","name":"Kopi","description":"Traditional coffee with condensed milk.","price":150,"sort_order":0},{"id":"kopi-kakis:kopi-o","stall_id":"kopi-kakis","slug":"kopi-o","name":"Kopi O","description":"Freshly brewed black coffee with sugar.","price":130,"sort_order":1},{"id":"kopi-kakis:iced-teh","stall_id":"kopi-kakis","slug":"iced-teh","name":"Iced Teh","description":"Milk tea poured over ice.","price":220,"sort_order":2},{"id":"kopi-kakis:kaya-toast-set","stall_id":"kopi-kakis","slug":"kaya-toast-set","name":"Kaya Toast Set","description":"Kaya butter toast, two soft-boiled eggs & hot kopi.","price":500,"sort_order":3},{"id":"sweet-lah:ice-kachang","stall_id":"sweet-lah","slug":"ice-kachang","name":"Ice Kachang","description":"Shaved ice, red beans, jelly & colourful syrup.","price":300,"sort_order":0},{"id":"sweet-lah:chendol","stall_id":"sweet-lah","slug":"chendol","name":"Chendol","description":"Pandan jelly, coconut milk & rich gula melaka.","price":320,"sort_order":1},{"id":"sweet-lah:cheng-tng","stall_id":"sweet-lah","slug":"cheng-tng","name":"Cheng Tng","description":"A refreshing longan & white fungus dessert, served cold.","price":280,"sort_order":2},{"id":"sweet-lah:grass-jelly","stall_id":"sweet-lah","slug":"grass-jelly","name":"Grass Jelly Drink","description":"Chilled grass jelly with a light sugar syrup.","price":200,"sort_order":3},{"id":"fresh-squeeze:watermelon-cup","stall_id":"fresh-squeeze","slug":"watermelon-cup","name":"Watermelon Cup","description":"Chilled, freshly cut watermelon for a refreshing snack.","price":150,"sort_order":0},{"id":"fresh-squeeze:mixed-fruit","stall_id":"fresh-squeeze","slug":"mixed-fruit","name":"Mixed Fruit Cup","description":"A colourful mix of watermelon, papaya & pineapple.","price":200,"sort_order":1},{"id":"fresh-squeeze:orange-juice","stall_id":"fresh-squeeze","slug":"orange-juice","name":"Fresh Orange Juice","description":"Freshly squeezed oranges, with no added sugar.","price":250,"sort_order":2},{"id":"fresh-squeeze:watermelon-juice","stall_id":"fresh-squeeze","slug":"watermelon-juice","name":"Watermelon Juice","description":"Fresh watermelon blended with ice.","price":220,"sort_order":3},{"id":"fresh-squeeze:apple-juice","stall_id":"fresh-squeeze","slug":"apple-juice","name":"Fresh Apple Juice","description":"Freshly juiced apples, served chilled.","price":250,"sort_order":4},{"id":"fresh-squeeze:banana-smoothie","stall_id":"fresh-squeeze","slug":"banana-smoothie","name":"Banana Milk Smoothie","description":"Banana blended with milk for a creamy break-time treat.","price":300,"sort_order":5}]'::jsonb) as m(id text,stall_id text,slug text,name text,description text,price integer,sort_order integer)
on conflict(id) do update set name=excluded.name,description=excluded.description,price=excluded.price,sort_order=excluded.sort_order;

-- This pre-existing event-trigger helper is only used by database DDL.
-- Browser roles do not need permission to execute it.
do $$ begin
 if to_regprocedure('public.rls_auto_enable()') is not null then
  revoke execute on function public.rls_auto_enable() from public,anon,authenticated;
 end if;
end $$;

commit;
