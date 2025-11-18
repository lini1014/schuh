SET default_tablespace = schuhspace;

CREATE SCHEMA IF NOT EXISTS AUTHORIZATION schuh;
ALTER ROLE schuh SET search_path = 'schuh';
SET search_path TO 'schuh';

CREATE TYPE schuhtyp AS ENUM ('Sneaker', 'Laufschuh', 'Freizeitschuh', 'Skateschuh', 'Tennisschuh');

CREATE TABLE IF NOT EXISTS schuh (
    id            integer GENERATED ALWAYS AS IDENTITY(START WITH 1000) PRIMARY KEY,
    version       integer NOT NULL DEFAULT 0,
    artikelnummer text NOT NULL UNIQUE,
    bewertung     integer NOT NULL CHECK (bewertung >= 0 AND bewertung <= 5),
    typ           schuhtyp,
    preis         decimal(8,2) NOT NULL,
    rabattsatz    decimal(4,3) NOT NULL,
    verfuegbar    boolean NOT NULL DEFAULT FALSE,
    erscheinungsdatum date,
    homepage      text,
    schlagwoerter jsonb,
    erstellt_am   timestamp NOT NULL DEFAULT NOW(),
    aktualisiert_am timestamp NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS modell (
    id          integer GENERATED ALWAYS AS IDENTITY(START WITH 1000) PRIMARY KEY,
    modell       text NOT NULL,
    farbe  text,
                -- https://www.postgresql.org/docs/current/ddl-constraints.html#DDL-CONSTRAINTS-FK
    schuh_id     integer NOT NULL UNIQUE REFERENCES schuh ON DELETE CASCADE
);


CREATE TABLE IF NOT EXISTS abbildung (
    id              integer GENERATED ALWAYS AS IDENTITY(START WITH 1000) PRIMARY KEY,
    beschriftung    text NOT NULL,
    content_type    text NOT NULL,
    schuh_id         integer NOT NULL REFERENCES schuh ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS abbildung_schuh_id_idx ON abbildung(schuh_id);

CREATE TABLE IF NOT EXISTS schuh_file (
    id              integer GENERATED ALWAYS AS IDENTITY(START WITH 1000) PRIMARY KEY,
    data            bytea NOT NULL,
    filename        text NOT NULL,
    mimetype        text,
    schuh_id         integer NOT NULL UNIQUE REFERENCES schuh ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS schuh_file_schuh_id_idx ON schuh_file(schuh_id);

