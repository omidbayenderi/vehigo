-- Telegram messages (opportunity digest, health warnings, manual scan
-- receipts) previously had no per-user language: the digest was hardcoded to
-- Farsi and the manual scan receipt was hardcoded to Turkish, so the same
-- run could deliver mixed-language messages to the same user. This column
-- lets each user's Telegram delivery follow their own choice.
alter table users_profile
  add column if not exists locale text not null default 'tr'
  check (locale in ('tr', 'fa'));
