begin;
select set_config('test.guest_a',gen_random_uuid()::text,true),set_config('test.guest_b',gen_random_uuid()::text,true);
insert into auth.users(id,aud,role,is_anonymous) values
 (current_setting('test.guest_a')::uuid,'authenticated','authenticated',true),
 (current_setting('test.guest_b')::uuid,'authenticated','authenticated',true);
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.guest_a'),'role','authenticated','is_anonymous',true)::text,true);
do $$
declare r jsonb; r2 jsonb; req uuid:=gen_random_uuid(); bad jsonb; caught boolean;
begin
 r:=public.place_guest_order(req,'Database Test','3A',now()+interval '1 day','','online','[{"id":"golden-grain:chicken-rice","quantity":1}]',450);
 if (r->>'total')::integer<>450 or r->>'source'<>'database' then raise exception 'Wrong total or receipt source'; end if;
 r2:=public.place_guest_order(req,'Database Test','3A',now()+interval '1 day','','online','[{"id":"golden-grain:chicken-rice","quantity":1}]',450);
 if r->>'id'<>r2->>'id' or (select count(*) from public.orders)<>1 then raise exception 'Idempotency failed'; end if;
 for bad in select value from jsonb_array_elements('[[],[{"id":"golden-grain:chicken-rice","quantity":0}],[{"id":"missing","quantity":1}],[{"id":"golden-grain:chicken-rice","quantity":1},{"id":"golden-grain:chicken-rice","quantity":1}]]') loop
  caught:=false;
  begin perform public.place_guest_order(gen_random_uuid(),'Test','3A',now()+interval '1 day','','pickup',bad,450);
  exception when others then caught:=true; end;
  if not caught then raise exception 'Invalid cart was accepted'; end if;
 end loop;
 caught:=false;
 begin perform public.place_guest_order(gen_random_uuid(),'Test','3A',now()+interval '1 day','','pickup','[{"id":"golden-grain:chicken-rice","quantity":1}]',1);
 exception when others then caught:=true; end;
 if not caught then raise exception 'Client price tampering accepted'; end if;
 caught:=false;
 begin perform public.place_guest_order(gen_random_uuid(),'Test','3A',now(),'','pickup','[{"id":"golden-grain:chicken-rice","quantity":1}]',450);
 exception when others then caught:=true; end;
 if not caught then raise exception 'Past pickup accepted'; end if;
 caught:=false;
 begin update public.orders set total=1; exception when insufficient_privilege then caught:=true; end;
 if not caught then raise exception 'Direct order modification allowed'; end if;
 if (select count(*) from public.orders)<>1 then raise exception 'Failed requests left partial orders'; end if;
end $$;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.guest_b'),'role','authenticated','is_anonymous',true)::text,true);
do $$ begin
 if (select count(*) from public.orders)<>0 or (select count(*) from public.stall_orders)<>0 or (select count(*) from public.order_items)<>0
 or public.get_my_receipts()<>'[]'::jsonb then raise exception 'Guest isolation failed'; end if;
end $$;
reset role;
update public.menu_items set price=999 where id='golden-grain:chicken-rice';
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.guest_a'),'role','authenticated','is_anonymous',true)::text,true);
do $$ begin
 if (public.get_my_receipts()->0->'items'->0->>'price')::integer<>450 then raise exception 'Receipt price snapshot changed'; end if;
end $$;
select set_config('request.jwt.claims','{}',true);
do $$ declare caught boolean:=false; begin
 begin perform public.place_guest_order(gen_random_uuid(),'Test','3A',now()+interval '1 day','','pickup','[]',0);
 exception when insufficient_privilege then caught:=true; end;
 if not caught then raise exception 'Unauthenticated order accepted'; end if;
end $$;
rollback;
select 'PASS: atomic orders, authoritative prices, idempotency, validation, immutable receipt prices, guest isolation, and blocked direct writes' as result;
