"""Application package startup hooks."""

# One-time database cleanup. Keep PURGE_FREE_KEYS_ON_STARTUP unset normally.
if __import__("os").getenv("PURGE_FREE_KEYS_ON_STARTUP", "").strip() == "1":
    import os
    try:
        import psycopg
        database_url = os.getenv("DATABASE_URL", "").strip()
        if database_url:
            with psycopg.connect(database_url, sslmode="require") as connection:
                with connection.cursor() as cursor:
                    cursor.execute("DELETE FROM free_keys")
                    cursor.execute("DELETE FROM workink_grants")
                    cursor.execute("DELETE FROM licenses")
                connection.commit()
    except Exception:
        pass
