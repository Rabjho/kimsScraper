#! /bin/bash
set -e 

sed -e "s/\${POSTGRES_USER}/$POSTGRES_USER/g" \
    -e "s/\${POSTGRES_PASSWORD}/$POSTGRES_PASSWORD/g" \
    -e "s/\${POSTGRES_DB}/$POSTGRES_DB/g" \
    /docker-entrypoint-initdb.d/init.sql > /docker-entrypoint-initdb.d/init-processed.sql

until psql -U "$POSTGRES_USER" -c '\q'; do
  >&2 echo "Postgres is unavailable - sleeping"
  sleep 1
done

>&2 echo "Postgres is up - executing command"

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -f /docker-entrypoint-initdb.d/init-processed.sql