-- This pre-existing event-trigger helper is only used by database DDL.
-- Browser roles do not need permission to execute it.
do $$ begin
 if to_regprocedure('public.rls_auto_enable()') is not null then
  revoke execute on function public.rls_auto_enable() from public,anon,authenticated;
 end if;
end $$;
