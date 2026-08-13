begin;

alter table public.v2_safety_incidents
    add column source_platform text
    not null
    default 'whatsapp';

alter table public.v2_safety_incidents
    add constraint v2_safety_incidents_source_platform_check
    check (source_platform = 'whatsapp');

comment on column public.v2_safety_incidents.source_platform is
    'Canonical source application. V2 is intentionally locked to WhatsApp until the measured 98 percent WhatsApp capture gate is approved.';

create index v2_incidents_platform_received
    on public.v2_safety_incidents (
        source_platform,
        received_at desc
    );

commit;
