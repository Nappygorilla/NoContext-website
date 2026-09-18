def cleanup_malformed_key_hashes():
    # A SHA-256 key hash must be 64 hexadecimal characters. Any value beginning
    # with "NC-" is an old/malformed stored hash, not a valid SHA-256 digest.
    with engine.begin() as conn:
        conn.execute(text("DELETE FROM free_keys WHERE key_hash LIKE 'NC-%'"))
        conn.execute(text("DELETE FROM licenses WHERE key_hash LIKE 'NC-%'"))

cleanup_malformed_key_hashes()

def delete_imported_keys_once():
    if os.getenv("NOCONTEXT_DELETE_IMPORTED_KEYS_ONCE", "").strip() != "1":
        return
    # Imported keys are the free_keys entries that also have a matching License
    # record. Generated free keys do not have a License row and are preserved.
    with engine.begin() as conn:
        rows = conn.execute(text("""
            SELECT fk.key_hash
            FROM free_keys fk
            WHERE EXISTS (
                SELECT 1 FROM licenses l WHERE l.key_hash = fk.key_hash
            )
        """)).scalars().all()
        if not rows:
            return
        placeholders = ", ".join(f":k{i}" for i in range(len(rows)))
        params = {f"k{i}": value for i, value in enumerate(rows)}
        conn.execute(text(f"DELETE FROM licenses WHERE key_hash IN ({placeholders})"), params)
        conn.execute(text(f"DELETE FROM free_keys WHERE key_hash IN ({placeholders})"), params)

delete_imported_keys_once()
start_license_repo_sync(engine,app)
