# Krishna Recharge — Firestore Security Specification

## 1. Data Invariants
1. **Default-Deny Catch-All**: Every unmatched Firestore path denies all reads and writes.
2. **Verified Identity**: All reads and writes require `request.auth != null && request.auth.token.email_verified == true`.
3. **Zero Self-Escalation**: Non-admin users can only self-register as `RETAILER` with `walletBalance == 0` and cannot modify `role`, `packageId`, `parentUid`, or `admins/{uid}`.
4. **No Client Wallet Inflation**: A user cannot update their own `walletBalance` upward; wallet credits require `isAdmin()` or direct parent (`parentUid == request.auth.uid`) tied to an approved fund request or direct downline transfer.
5. **Immutable Audit Logs**: `recharges` and `ledger` entries cannot be updated or deleted after creation by non-admins; `createdAt` is locked to `request.time`.
6. **Terminal State Locking**: Once a `fund_requests` document transitions from `PENDING` to `APPROVED` or `REJECTED`, non-admins cannot alter it again.
7. **PII Isolation**: User profiles (`phone`, `email`) are readable only by the owner, their direct upline parent (`parentUid == request.auth.uid`), or a verified admin.

## 2. Dirty Dozen Adversarial Payloads (Must All Return PERMISSION_DENIED)
1. **Unauthenticated read** on `/users/uid_1` -> Denied (`request.auth == null`).
2. **Unverified email write** creating `/recharges/KR123` with `email_verified: false` -> Denied.
3. **Self-Admin escalation** creating `/users/{myUid}` with `role: "ADMIN"` as a non-admin email -> Denied.
4. **Wallet self-inflation** updating `/users/{myUid}` with `{ walletBalance: 999999 }` -> Denied (`incoming().walletBalance < existing().walletBalance` required for owner).
5. **Shadow ghost field injection** creating `/fund_requests/req1` with extra field `isAutoApproved: true` -> Denied (`keys().hasOnly(...)`).
6. **Cross-user PII scraping** listing `/users` without filtering to own/downline UIDs -> Denied (`allow list` checks `resource.data`).
7. **Double-approval replay** updating `/fund_requests/req1` from `APPROVED` back to `PENDING` -> Denied (`existing().status == 'PENDING'`).
8. **Ledger tampering** updating or deleting `/ledger/entry1` -> Denied (`allow update, delete: if false`).
9. **Spoofed timestamp** creating `/recharges/KR123` with backdated `createdAt` != `request.time` -> Denied.
10. **ID poisoning** creating `/recharges/../../../evil` -> Denied (`isValidId` regex `^[a-zA-Z0-9_\-]+$`).
11. **Oversized string DoS** creating `/fund_requests/req1` with 2KB `remark` -> Denied (`.size() <= 255`).
12. **Non-admin slab manipulation** updating `/slabs/slab1` as a Retailer -> Denied (`isAdmin()` required).
