# 08 · AUTH & SECURITY — Lathe

Cross-tenant exposure or bypass of execution permissions **must be corrected before selection** (case document). Treat this file as release-blocking.

---

## 1. Security goals

1. A caller can only ever see or affect their **own tenant's** data.
2. Only an **Operator** on an **Active** subscription with an **entitled plan** can start runs.
3. Quota and idempotency cannot be bypassed by concurrency, retries, or crafted input.
4. No secrets in source, images, logs, or Terraform outputs.
5. The scored surface is exactly what the contract defines.

## 2. Authentication

### 2.1 Credentials
- Seeded users in `Users` with **argon2id** password hashes (`argon2-cffi`, default parameters or stronger).
- Login: `POST /auth/login {email, password}`. Constant-time verification. A dummy hash is verified when the email is unknown, so timing doesn't reveal existence.
- Generic failure: `401 UNAUTHENTICATED` / "Email or password is incorrect." (never "user not found").
- Basic throttling: max 5 failures per email+IP per 5 minutes (in-memory is acceptable for this sandbox; note the limitation for multi-replica).

### 2.2 Session
- Signed JWT (HS256, `SESSION_SECRET` ≥ 32 random bytes), claims: `sub` (user_id), `tid` (tenant_id), `role`, `iat`, `exp` (default 8 h), `jti`.
- Delivered as cookie `lathe_session`: `HttpOnly; Secure; SameSite=Lax; Path=/`. Also returned as `token` for API test clients (accept `Authorization: Bearer`).
- **Re-validation per request:** after decoding, load the user and tenant from SQL (or a 30-second cache) to confirm `is_active` and the current role/subscription. A stale token must not outlive a suspended or deactivated account for longer than the cache TTL. For simplicity in the sandbox: **no cache**, load on every request.
- Algorithm pinned on decode (`algorithms=["HS256"]`); reject `none`; reject expired.
- Logout clears the cookie. (Server-side revocation list is out of scope; short TTL mitigates.)

### 2.3 CSRF
- Cookie is `SameSite=Lax`; state-changing calls require `Content-Type: application/json` and the custom `Idempotency-Key` header (POST /runs), which forces a CORS preflight from foreign origins.
- No permissive CORS: same-origin only. In dev, Vite proxies `/api`, so no CORS config is needed.
- For `/auth/login` and `/billing/*` POSTs, additionally require `X-Requested-With: lathe` header from the SPA.

## 3. Authorisation

### 3.1 Principal
```python
@dataclass(frozen=True)
class Principal:
    user_id: str
    tenant_id: str      # from verified session ONLY
    role: Literal["Operator", "Viewer"]
```
Single dependency `get_principal()`; every router (except `/health`, `/auth/login`) depends on it. A lint/test asserts that **no handler reads `tenant` from request data**.

### 3.2 Permission matrix

| Capability | Viewer | Operator | Condition |
|---|---|---|---|
| `GET /health` | ✅ public | ✅ public | — |
| `GET /tools`, `/subscription` | ✅ | ✅ | own tenant |
| `GET /runs`, `/runs/{id}/result` | ✅ | ✅ | own tenant; else 404 |
| `POST /runs` validate | ❌ 403 | ✅ | subscription Active |
| `POST /runs` process | ❌ 403 | ✅ | Pro plan **and** Active |
| `POST /billing/*` (Tier 2) | ❌ 403 | ✅ | flag on |

### 3.3 Entitlement function (single place)
```python
def authorise_submit(p: Principal, tenant: Tenant, operation: str) -> None:
    if p.role != "Operator":                raise Forbidden("FORBIDDEN_ROLE")
    if tenant.subscription_status != "Active": raise Forbidden("SUBSCRIPTION_SUSPENDED")
    if operation == "process" and tenant.plan != "Pro": raise Forbidden("FORBIDDEN_PLAN")
```
Evaluate **before** any write.

## 4. Tenant isolation

| Layer | Control |
|---|---|
| Session | `tenant_id` taken from verified claims only |
| Input | Tenant-override guard rejects any `tenant*` field/param/`X-Tenant*` header (400) |
| SQL | Every statement on `Runs`/`DailyUsage` includes `tenant_id = @tenant_id` from the principal |
| Lookups | `GET /runs/{id}` uses `WHERE run_id=@id AND tenant_id=@tenant` → 404 for others (same body as unknown) |
| Blob | Path `results/{tenant}/{run}.json`; the app builds the path from the **Run row's** tenant, never from client input |
| Logs | `tenant_id` logged for audit, never other tenants' data |
| Idempotency | Unique on `(tenant_id, key)`: tenants cannot collide or probe each other's keys |
| UI | No tenant field anywhere; tenant name shown as read-only text |

Isolation tests (A07): list as B returns none of A's runs; GET A's run as B → 404; POST with `{"tenant_id":"tnt_a", …}` → 400; header `X-Tenant-Id` → 400; query `?tenant=tnt_a` → 400.

## 5. Input hardening

- Hard body cap 64 KiB enforced **before** JSON parsing (read at most 64 KiB + 1 byte from the stream; reject if exceeded).
- Strict parsing: reject duplicate JSON keys, NaN/Infinity, non-object bodies. Pydantic models with `extra="forbid"` and `strict=True` for top-level; per-record manual checks for R1–R4.
- Type checks use `type(x) is int` / `is str` (rejects `bool`, numeric strings).
- Text is data: never evaluated, never used in a path/SQL/command; output is JSON-encoded; UI renders via React text nodes (no `dangerouslySetInnerHTML`).
- Idempotency-Key: 1–128 chars, printable ASCII `[A-Za-z0-9._:-]`, otherwise 400.
- UUID validation on `{id}`; non-UUID → 404.

## 6. Quota and idempotency integrity

- Single atomic SQL path (`04_DATABASE.md §6.1`). No in-memory counters, no read-then-write.
- Limit derived server-side from plan. No endpoint edits `DailyUsage`; harness only, offline.
- Replay never re-executes the helper and never debits.
- Terminal runs are immutable (`WHERE status='Running'` guard).
- Concurrency tests are mandatory in CI/verify (A08, A09).

## 7. Secrets and configuration

| Secret | Where | Never |
|---|---|---|
| `SESSION_SECRET` | Container App secret (`secretRef`), `TF_VAR_session_secret` | In git, image, logs, Terraform outputs |
| SQL access | Managed identity (Entra token) | Connection strings with passwords in cloud |
| Blob access | Managed identity | Account keys / SAS in code |
| Seed password | `SEED_PASSWORD` env, sandbox only | Committed, reused anywhere else |

- `.env`, `*.tfvars` containing secrets, and `tfplan` are git-ignored. `.env.example` has placeholders only.
- Terraform state can contain secret values: keep state in a private location, never commit it.
- Run `gitleaks detect` (or `trufflehog`) before the first push and before submission.

## 8. Transport and headers

- Container Apps ingress: HTTPS only (HTTP redirect on).
- Response headers: `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `Cache-Control: no-store` on API responses, a strict `Content-Security-Policy` for the SPA (`default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'` — tighten if fonts are self-hosted; no third-party origins).
- Self-hosted fonts and assets: no external requests from the browser.

## 9. Test hook safety

- `X-Test-Force-Failure` is honoured **only** when `ENABLE_TEST_HOOKS=true` **and** `APP_ENV` ∈ {`dev`,`test`}. Otherwise ignored silently (no error that reveals the hook).
- Default `false`; `test.tfvars`/`dev.tfvars` may enable it; any production-like profile must not.
- Hook never changes quota semantics: failure occurs after acceptance.
- Harness CLI refuses to run unless `APP_ENV` ∈ {`dev`,`test`}; it is not packaged in the runtime image.

## 10. Logging and privacy

- Structured logs; redaction filter strips `authorization`, `cookie`, `password`, `token`, `text`, `records`.
- Error responses never include stack traces, SQL text, or file paths.
- Synthetic data only. No real personal data.

## 11. Threat model (STRIDE-lite)

| Threat | Vector | Mitigation |
|---|---|---|
| Spoofing | Forged/stale token | Pinned alg, strong secret, per-request user reload, short TTL |
| Tampering | Edit tenant in request | Override guard + session-only tenant |
| Repudiation | Disputed runs | `Runs.submitted_by`, structured logs |
| Info disclosure | Guessing run IDs | UUIDv4, tenant-scoped query, uniform 404 |
| Info disclosure | Blob public access | `private` container, no SAS, content proxied by API |
| DoS | Large/many requests | 64 KiB cap, 10-row cap, quota, login throttle |
| Elevation | Viewer posts runs; Basic processes | Entitlement function before writes |
| Race | Quota/key races | Single transaction, unique index, conditional update |
| Supply chain | Malicious packages | Pin versions, lockfiles, `pip-audit`, `npm audit`, ≥ 2-week-old releases where possible |

## 12. Security checklist (gate before demo)

- [ ] No handler reads tenant from request data (test passes)
- [ ] 401 / 403 / 404 / 429 matrices green (A06, A07, A08, A10)
- [ ] Concurrency tests green 10× in a row
- [ ] Blob container is private (`az storage container show` → `publicAccess: null`)
- [ ] No secrets in repo, image layers, logs, or evidence (`gitleaks`, manual grep)
- [ ] `ENABLE_TEST_HOOKS` documented and only on in dev sandbox
- [ ] Cookie flags verified in browser dev tools
- [ ] `pip-audit` / `npm audit` reviewed; no critical issues
- [ ] Verified that a Viewer's UI controls are disabled **and** the API refuses (never rely on UI)
