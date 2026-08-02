import postgres from "postgres";

/**
 * Behold DATE-kolonner som «YYYY-MM-DD»-strenger i stedet for JS-Date.
 *
 * Standardoppførselen gir `Sun Sep 18 2005 00:00:00 GMT+0000` i JSON-en som sendes til
 * modellen. Det er både uleselig og en kilde til feil: en modell som ser et tidssone-
 * formatert klokkeslett kan begynne å resonnere om tidssoner på en ren kalenderdato.
 * Datoene i arkivet er kalenderdatoer uten klokkeslett, og skal se sånn ut hele veien.
 */
const DATE_AS_STRING = {
  date: {
    to: 1082,
    from: [1082] as number[],
    serialize: (value: string) => value,
    parse: (value: string) => value,
  },
};

/**
 * Tilkoblingstypen, med de egendefinerte typene bakt inn.
 *
 * Utledes fra DATE_AS_STRING i stedet for å skrives for hånd, slik at typen følger med
 * automatisk hvis vi legger til flere typeoverstyringer senere.
 */
export type Sql = postgres.Sql<{
  [K in keyof typeof DATE_AS_STRING]: ReturnType<(typeof DATE_AS_STRING)[K]["parse"]>;
}>;

function requireUrl(name: string): string {
  const url = process.env[name];
  if (!url) {
    throw new Error(
      `${name} er ikke satt. Kopier .env.example til .env, eller hent verdien fra ` +
        `Vercel-prosjektets miljøvariabler (Neon-integrasjonen setter DATABASE_URL).`,
    );
  }
  return url;
}

/**
 * Tilkobling med fulle rettigheter. Brukes av migrasjoner, synkronisering og av
 * nettstedets vanlige spørringer. Skal aldri brukes av chattens run_sql.
 */
export function connect(url = requireUrl("DATABASE_URL")): Sql {
  return postgres(url, {
    max: 5,
    idle_timeout: 20,
    // Neon skalerer til null etter inaktivitet; første spørring etter dvale
    // trenger litt ekstra tid på å vekke instansen.
    connect_timeout: 30,
    types: DATE_AS_STRING,
    onnotice: () => {},
  });
}

/**
 * Skrivebeskyttet tilkobling for chattens run_sql, som rollen aafk_chat.
 *
 * Egen tilkoblingsstreng med vilje: da er det umulig å ved et uhell kjøre en
 * modellgenerert spørring på eierrollen, selv om koden skulle bomme et sted.
 */
export function connectReadonly(url = requireUrl("DATABASE_URL_READONLY")): Sql {
  return postgres(url, {
    max: 3,
    idle_timeout: 20,
    connect_timeout: 30,
    types: DATE_AS_STRING,
    onnotice: () => {},
  });
}

export { postgres };
