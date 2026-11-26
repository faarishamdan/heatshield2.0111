# HEATSHIELD AI — Firestore Security Specification

## 1. Data Invariants
1. **PII Isolation**: Emergency contact phone numbers, worker names, and site locations reside strictly inside `/users/{userId}/private/settings`, readable and writable only by the verified authenticated owner (`request.auth.uid == userId && request.auth.token.email_verified == true`).
2. **Ownership Integrity**: Every reading and safety alert must set `ownerId == request.auth.uid` on creation, and `ownerId` is immutable on updates.
3. **Immutable Telemetry History**: Sensor readings in `/users/{userId}/readings/{readingId}` are append-only (`create`, `get`, `list`, `delete` by owner; `update` denied) so recorded exposure history cannot be silently altered.
4. **Server Timestamps**: `createdAt` and `updatedAt` must equal `request.time` at write time.
5. **Strict Schema & Bounds**: Unknown shadow fields are rejected via `keys().hasOnly(...)` and `keys().hasAll(...)`, numeric sensor bounds are enforced (temperature `-40..85`, humidity `0..100`, heatIndex `-40..100`), and string lengths are strictly capped.

## 2. The "Dirty Dozen" Adversarial Payloads (Must Return PERMISSION_DENIED)
1. Unauthenticated read of `/users/userA/private/settings` -> DENIED.
2. Unverified email (`email_verified: false`) writing `/users/userA/private/settings` -> DENIED.
3. User B reading or listing User A's `/users/userA/readings` -> DENIED.
4. User A creating a reading with `ownerId: "userB"` -> DENIED.
5. User A injecting a shadow field (`isAdmin: true`) in `settings` -> DENIED.
6. User A creating a reading with out-of-range temperature (`temperature: 999`) or humidity (`humidity: -5`) -> DENIED.
7. User A forging `createdAt` with a client timestamp in the past -> DENIED.
8. User A updating an existing historical reading -> DENIED (immutable telemetry).
9. User A updating `ownerId` or `createdAt` on an alert during acknowledgment -> DENIED.
10. User A passing a >128 char or non-alphanumeric `readingId` -> DENIED (`isValidId`).
11. User A passing a >80 char `workerName` or invalid regex characters in `emergencyContactPhone` -> DENIED.
12. Any read or write to an undeclared collection `/admin/secrets` -> DENIED by global catch-all.
