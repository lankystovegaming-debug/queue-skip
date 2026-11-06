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
commit;
