# Pruebas de los datos legales (sin Supabase)

Prueban en un PostgreSQL local que la cédula, el RIF y los documentos solo los vean
el dueño de la cuenta y el administrador. Usar SOLO en una base de pruebas vacía.

```bash
createdb prueba
psql -d prueba -c "create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls; create role authenticator login noinherit; grant anon, authenticated to authenticator;"
psql -d prueba -f tests/sql/00-simular-supabase.sql
psql -d prueba -f schema.sql
psql -d prueba -f tests/sql/datos-legales.test.sql 2>&1 | grep -E "✓|✗"
```
