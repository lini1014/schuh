CREATE USER schuh PASSWORD 'p';
CREATE DATABASE schuh;
GRANT ALL ON DATABASE schuh TO schuh;
CREATE TABLESPACE schuhspace OWNER schuh LOCATION '/var/lib/postgresql/tablespace/schuh';
