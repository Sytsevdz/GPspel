-- Convert sparse driver overrides into complete Grand Prix participant lists.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'grand_prix_driver_entries'
      and column_name = 'is_active'
  ) then
    create temporary table migrated_gp_participants on commit drop as
      select configured.grand_prix_id,
             d.id as driver_id,
             coalesce(entry.constructor_team, d.constructor_team) as constructor_team,
             entry.driver_id is not null as was_override
      from (select distinct grand_prix_id from public.grand_prix_driver_entries) configured
      cross join public.drivers d
      left join public.grand_prix_driver_entries entry
        on entry.grand_prix_id = configured.grand_prix_id
       and entry.driver_id = d.id
      where coalesce(entry.is_active, d.active);

    delete from public.grand_prix_driver_entries;
    alter table public.grand_prix_driver_entries drop column is_active;
    insert into public.grand_prix_driver_entries (grand_prix_id, driver_id, constructor_team)
      select grand_prix_id, driver_id, constructor_team
      from (
        select *, row_number() over (
          partition by grand_prix_id, constructor_team
          order by was_override desc, driver_id
        ) as constructor_slot
        from migrated_gp_participants
      ) participants
      where constructor_slot <= 2;
  end if;
end $$;

-- unique (grand_prix_id, driver_id), created by the original migration, ensures
-- that a driver can represent only one constructor in a Grand Prix.
create or replace function public.enforce_two_grand_prix_drivers_per_constructor()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(new.grand_prix_id::text || ':' || new.constructor_team, 0));
  if (
    select count(*)
    from public.grand_prix_driver_entries
    where grand_prix_id = new.grand_prix_id
      and constructor_team = new.constructor_team
      and id <> new.id
  ) >= 2 then
    raise exception 'A constructor may have at most two drivers per Grand Prix';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_two_gp_drivers_per_constructor on public.grand_prix_driver_entries;
create trigger enforce_two_gp_drivers_per_constructor
before insert or update on public.grand_prix_driver_entries
for each row execute function public.enforce_two_grand_prix_drivers_per_constructor();

create or replace function public.replace_grand_prix_driver_entries(
  target_grand_prix_id uuid,
  participants jsonb
) returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if exists (
    select 1
    from jsonb_to_recordset(participants) as participant(constructor_team text, driver_id uuid)
    group by constructor_team
    having count(*) <> 2
  ) then
    raise exception 'Every constructor must have exactly two drivers';
  end if;

  delete from public.grand_prix_driver_entries where grand_prix_id = target_grand_prix_id;
  insert into public.grand_prix_driver_entries (grand_prix_id, constructor_team, driver_id)
    select target_grand_prix_id, constructor_team, driver_id
    from jsonb_to_recordset(participants) as participant(constructor_team text, driver_id uuid);
end;
$$;
