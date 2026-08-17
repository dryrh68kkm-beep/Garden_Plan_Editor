# Firestore security & operations — steps you need to do yourself

This covers everything in the security/performance overhaul that **cannot be
done from code** — they require access to the Firebase Console or the
Firebase CLI logged in as you. Nothing in this repo can do these for you.

## 1. Rotate the old shared password (do this first, and do it regardless)

The admin app used to sign in with one shared email/password pair that was
embedded directly in `firebase-client.js` — a file shipped to every visitor's
browser. Treat that password as **already exposed**, even though this repo
is private, because anyone who ever loaded the old admin page had it sitting
in their browser's cached JavaScript.

Steps:
1. Go to the [Firebase Console](https://console.firebase.google.com/) →
   project **rinlada-plant-stock** → **Authentication** → **Users**.
2. Find the old shared account and either:
   - Click it → **Reset password**, and set a new, unique password you don't
     reuse anywhere else, **or**
   - Delete it entirely if you're creating a brand-new admin account instead
     (recommended — see step 2).
3. Do this even if you're about to create a new account per step 2 — the old
   credential must stop working either way.

## 2. Create a real admin account for the new login screen

The admin page (`index.html`) now shows a login form before it lets you in,
and only accepts a real Firebase Authentication user — there is no
credential baked into the code anymore.

1. Firebase Console → **Authentication** → **Users** → **Add user**.
2. Enter the email and a strong password you'll use to log into the admin
   panel going forward. Write it down somewhere safe (a password manager) —
   there's no recovery flow wired up in the app itself.
3. If **Authentication** isn't enabled at all yet for this project:
   **Authentication** → **Get started** → enable the **Email/Password**
   sign-in provider first, then add the user as above.
4. Open the admin page and log in with that email/password. A successful
   login is stored (as a refresh token) in that browser so you won't need to
   type the password in again every visit — but you will need to on a new
   device/browser, or after clicking "ออกจากระบบ" (log out).

You can create more than one admin user here later (e.g. for staff) the same
way — every one of them can log in and has full write access.

## 3. Deploy `firestore.rules`

The rules file in this repo (`firestore.rules`) is what actually enforces
"public can read, only signed-in admins can write." Until you deploy it,
Firestore is still running on whatever rules are currently live in the
Console — deploying is what makes this real.

One-time setup (skip any step already done on your machine):
```
npm install -g firebase-tools
firebase login
```
This opens a browser to sign in with the Google account that has access to
the `rinlada-plant-stock` project.

Deploy (run from the repo root, after `firebase login`):
```
firebase deploy --only firestore:rules
```
`.firebaserc` in this repo already points at the `rinlada-plant-stock`
project, so you shouldn't need `--project`. If the CLI asks you to pick a
project interactively, choose `rinlada-plant-stock`.

**Do this only after step 2** (a real admin account exists) — otherwise
nobody, including you, will be able to write to Firestore once the rules go
live, since the old shared-login write path is gone from the code and the
new rules require a real signed-in user.

To sanity-check afterwards: open the showcase (public site) in a private/
incognito window — it should load normally with no login. Then try editing
something from the Firestore Console directly as an anonymous read (or ask
me to verify with a quick unauthenticated request) — writes without being
logged into the admin app should fail.

## 4. Turn on budget alerts (optional but recommended)

Firestore rules and the new caching/polling changes cut down on billed
reads, but a budget alert is still worth having as a safety net.

1. [Google Cloud Console](https://console.cloud.google.com/) → make sure the
   project selector at the top is set to `rinlada-plant-stock`.
2. **Billing** → **Budgets & alerts** → **Create budget**.
3. Set a monthly amount you're comfortable with, and add yourself as a
   recipient for the alert thresholds (e.g. 50%, 90%, 100%).

**Important:** a budget alert only **emails you** when spending crosses a
threshold — it does **not** automatically stop Firestore from serving
requests or cut off billing. If you get an alert, that's your cue to look at
Firestore usage (next section) and investigate, not something that resolves
itself.

## 5. Reading Firestore usage / estimating reads per page view

Firebase Console → project → **Firestore Database** → **Usage** tab shows
daily read/write/delete counts for the whole project.

To estimate reads for one visit to the showcase, in this codebase:
- **First visit / first load after the catalog changed:** `initFromFirestore()`
  in `showcase.js` reads `styleOverrides`, `plantOverrides`,
  `plantShowcaseIndex`, `gardenPortfolio`, `gardenSupplies`, and
  `catalogMeta/public` — 5 collection listings + 1 single-document read.
  Each collection listing counts as **1 Firestore read per document
  returned**, not per collection — so the total scales with how many rows
  are in each collection, not a fixed number.
- **Every 10 minutes after that (or when the tab regains focus), if nothing
  changed:** only `catalogMeta/public` is read — exactly **1 read**,
  regardless of how many plants/styles/products exist.
- **Opening a specific real plant's detail view:** one extra document read
  for that plant's full gallery (lazy-loaded on demand, not upfront).

This is a large drop from the previous behavior, which re-read all ~5-6
collections in full every 2 minutes for every open tab, forever.

## 6. What NOT to do

- Don't hand-edit documents in the Firestore Console in a way that removes
  the `revision`/`updatedAt` fields on `catalogMeta/public` — the showcase
  depends on `revision` changing (it doesn't care what value it has, only
  that it's different from before) to know new data exists.
- Don't re-enable the old shared-login flow — it no longer exists in the
  code, and reintroducing it would put a password back into browser-shipped
  JavaScript again.
