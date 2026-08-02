-- Rollen chattens run_sql-verktøy kjører som.
--
-- Dette er den ytterste og viktigste guardrailen. Alle de andre lagene — parsing,
-- radtak, timeout — er kode vi selv har skrevet og kan ha misforstått. Dette laget
-- håndheves av Postgres. Selv en perfekt formulert ondsinnet spørring, eller en
-- prompt injection som overtar modellen fullstendig, kommer ikke lenger enn til
-- SELECT på de publiserte viewene.
--
-- Passordet settes av kalleren; migrasjonen tar det som psql-variabelen :'chat_password'.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'aafk_chat') THEN
    CREATE ROLE aafk_chat LOGIN;
  END IF;
END
$$;

ALTER ROLE aafk_chat WITH PASSWORD :'chat_password';

-- Ingen rettigheter arves fra PUBLIC.
REVOKE ALL ON SCHEMA public FROM aafk_chat;
REVOKE ALL ON SCHEMA core FROM aafk_chat;
REVOKE ALL ON ALL TABLES IN SCHEMA core FROM aafk_chat;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA core FROM aafk_chat;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA core FROM aafk_chat;

-- Kun lesing, kun på det publiserte skjemaet.
GRANT USAGE ON SCHEMA public_api TO aafk_chat;
GRANT SELECT ON ALL TABLES IN SCHEMA public_api TO aafk_chat;
ALTER DEFAULT PRIVILEGES IN SCHEMA public_api GRANT SELECT ON TABLES TO aafk_chat;

-- Viewene er definert av eieren og leser core på hans rettigheter, ikke chattens.
-- Derfor gir GRANT USAGE på core.name_at tilgang til funksjonen uten å åpne tabellene.
GRANT USAGE ON SCHEMA core TO aafk_chat;
GRANT EXECUTE ON FUNCTION core.name_at(jsonb, text, date) TO aafk_chat;

-- Kan ikke lage egne objekter noe sted.
REVOKE CREATE ON SCHEMA public FROM aafk_chat;
REVOKE CREATE ON SCHEMA public_api FROM aafk_chat;
REVOKE CREATE ON SCHEMA core FROM aafk_chat;

-- Belte og bukseseler: rollen kan ikke skrive selv om et GRANT skulle smette inn senere.
ALTER ROLE aafk_chat SET default_transaction_read_only = on;
-- Tak på kjøretid som gjelder selv om applikasjonen glemmer å sette sin egen.
ALTER ROLE aafk_chat SET statement_timeout = '5s';
-- Ingen parallelle arbeidere: en enkelt spørring skal ikke kunne spise hele instansen.
ALTER ROLE aafk_chat SET max_parallel_workers_per_gather = 0;
