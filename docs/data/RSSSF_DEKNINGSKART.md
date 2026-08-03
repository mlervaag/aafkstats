# RSSSF — dekningskart

Generert 2026-08-03 av `pnpm ingest:rsssf-discover`. Ingen data er skrevet.

Kartleggingen henter årsindeksen, følger lenkene, og klassifiserer hver side både
etter hva indeksen kaller den og etter hva som faktisk står på den. Når de spriker,
er det innholdet som gjelder — etiketten er skrevet av et menneske og kan mangle.

## Sammendrag

- Årganger undersøkt: 62 (1914–1979)
- Sider undersøkt: 270
- Klassifisert som `unknown`: 19
- Klassifisert som `match_list`: 152
- Klassifisert som `mixed`: 77
- Klassifisert som `tables_only`: 22
- Sider med AaFK-kamper: 40
- AaFK-kamper funnet: **68**
- Sider som bør kontrolleres: 27

## Sider med AaFK-kamper

| År | Side | Etikett i indeksen | Innhold | AaFK-kamper | Parsefeil |
|---|---|---|---|---:|---:|
| 1917 | `Cup` | Cup | match_list | 1 | 0 |
| 1918 | `Cup` | Cup | match_list | 1 | 0 |
| 1919 | `Cup` | Cup | match_list | 1 | 0 |
| 1921 | `Cup` | Cup | match_list | 3 | 0 |
| 1922 | `Cup` | Cup | match_list | 2 | 0 |
| 1923 | `Cup` | Cup | match_list | 1 | 0 |
| 1924 | `Cup` | Cup | match_list | 2 | 0 |
| 1925 | `Cup` | Cup | match_list | 2 | 0 |
| 1926 | `Cup` | Cup | match_list | 1 | 0 |
| 1927 | `Cup` | Cup | match_list | 2 | 0 |
| 1928 | `Cup` | Cup | match_list | 2 | 0 |
| 1929 | `Cup` | Cup | match_list | 2 | 0 |
| 1930 | `Cup` | Cup | match_list | 2 | 0 |
| 1932 | `Cup` | Cup | match_list | 2 | 0 |
| 1933 | `Cup` | Cup | match_list | 1 | 0 |
| 1934 | `Cup` | Cup | match_list | 1 | 0 |
| 1935 | `Cup` | Cup | match_list | 2 | 0 |
| 1936 | `Cup` | Cup | match_list | 2 | 0 |
| 1937 | `Cup` | Cup | match_list | 1 | 0 |
| 1940 | `Cup` | Cup | match_list | 3 | 0 |
| 1945 | `Cup` | Cup | match_list | 1 | 0 |
| 1946 | `Cup` | Cup | match_list | 1 | 0 |
| 1948 | `Cup` | Cup | match_list | 1 | 0 |
| 1949 | `Cup` | Cup | match_list | 1 | 0 |
| 1951 | `Cup` | Cup | match_list | 2 | 0 |
| 1951 | `First` | First division | mixed | 3 | 0 |
| 1952 | `Cup` | Cup | match_list | 1 | 0 |
| 1954 | `Cup` | Cup | match_list | 1 | 0 |
| 1961 | `Cup` | Cup | match_list | 1 | 0 |
| 1962 | `Cup` | Cup | match_list | 3 | 0 |
| 1962 | `Landsdel` | Landsdelsserien (second division) | mixed | 3 | 0 |
| 1965 | `Cup` | Cup | match_list | 2 | 0 |
| 1966 | `Cup` | Cup | match_list | 1 | 0 |
| 1967 | `Third` | Third division | mixed | 2 | 0 |
| 1968 | `Cup` | Cup | match_list | 1 | 0 |
| 1971 | `Cup` | Cup | match_list | 2 | 0 |
| 1975 | `Cup` | Cup | match_list | 2 | 0 |
| 1976 | `Cup` | Cup | match_list | 3 | 0 |
| 1977 | `Cup` | Cup | match_list | 1 | 0 |
| 1978 | `Third` | Third division | mixed | 2 | 0 |

## Sider som bør kontrolleres

Etiketten og innholdet er uenige, eller kamper feilet i parsingen.

| År | Side | Etikett sa | Innhold er | Parsefeil |
|---|---|---|---|---:|
| 1917 | `Krets` | unknown | tables_only | 1 |
| 1952 | `First` | tables_only | match_list | 0 |
| 1953 | `First` | tables_only | match_list | 0 |
| 1954 | `First` | tables_only | match_list | 0 |
| 1955 | `First` | tables_only | match_list | 0 |
| 1956 | `First` | tables_only | match_list | 0 |
| 1957 | `First` | tables_only | match_list | 0 |
| 1958 | `Third` | tables_only | match_list | 0 |
| 1959 | `Third` | tables_only | match_list | 0 |
| 1962 | `Third` | tables_only | match_list | 0 |
| 1963 | `Fourth` | tables_only | match_list | 0 |
| 1964 | `Fourth` | tables_only | match_list | 0 |
| 1965 | `Fourth` | tables_only | match_list | 0 |
| 1966 | `Fourth` | tables_only | match_list | 0 |
| 1967 | `Fourth` | tables_only | match_list | 0 |
| 1968 | `Fourth` | tables_only | match_list | 0 |
| 1969 | `Fourth` | tables_only | match_list | 0 |
| 1970 | `Fourth` | tables_only | match_list | 0 |
| 1971 | `Fourth` | tables_only | match_list | 0 |
| 1972 | `Fourth` | tables_only | match_list | 0 |
| 1973 | `Fourth` | tables_only | match_list | 0 |
| 1974 | `Fourth` | tables_only | match_list | 0 |
| 1975 | `Fourth` | tables_only | match_list | 0 |
| 1976 | `Fourth` | tables_only | match_list | 0 |
| 1977 | `Fourth` | tables_only | match_list | 0 |
| 1978 | `Fourth` | tables_only | match_list | 0 |
| 1979 | `Fourth` | tables_only | match_list | 0 |

## Merk

En tabellside kan ikke gi enkeltkamper, men den kan brukes til kontroll: antall
kamper, mål og poeng i en sesong må stemme med det arkivet har registrert.

Denne rapporten sier hva som *finnes*, ikke hva som kan publiseres. Se
rettighetsstatusen i `data/sources/rsssf.yaml`.
