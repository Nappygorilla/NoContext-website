# NoContext API

This backend provides the server-side authentication boundary for the static NoContext site.

## Security model

- Passwords are hashed with Argon2id; plaintext passwords are never stored.
- Sessions use cryptographically random opaque cookies. The raw session token is never stored in the database.
- Session cookies are `HttpOnly`, `Secure`, `__Host-` scoped, and short-lived relative to long-lived account data.
- State-changing requests require an allow-listed `Origin` and a CSRF token.
- Registration and login are rate-limited by client IP.
- Email and username inputs are normalized and constrained server-side.
- API documentation is disabled in production.
- The backend never trusts client-side license/payment state.

## Local development

```bash
python -m venv .venv
# Windows: .venv\\Scripts\\activate
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

The local default database is SQLite. For production, set `DATABASE_URL` to PostgreSQL.

## Production deployment

Set these environment variables on the host:

- `DATABASE_URL` — PostgreSQL connection string.
- `FRONTEND_ORIGIN` — exact HTTPS origin of the frontend, with no trailing slash.
- `SESSION_TTL_DAYS` — normally `30` or less.

The frontend pages currently contain an intentionally empty `window.NO_CONTEXT_API_URL`. After deploying the API, set that value to the HTTPS API origin in `login.html`, `register.html`, and `account-dashboard.html`.

Do not put database credentials, private signing keys, or provider service-account credentials in the Git repository.

## Important hosting note

For the cleanest cookie behavior, serve the frontend and API under the same registrable domain (for example `www.example.com` + `api.example.com`) rather than leaving the frontend on a different site such as `github.io`. Cross-site cookie policies vary by browser and can block credentialed authentication even when CORS is configured correctly.
