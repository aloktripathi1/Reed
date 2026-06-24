alter table public.messages add column if not exists attachment_filename text;
alter table public.messages add column if not exists attachment_text text;
