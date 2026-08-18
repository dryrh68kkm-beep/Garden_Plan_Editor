# Cloudflare Worker setup — steps you need to do yourself

This covers deploying `cloudflare-worker/worker.js`, which powers two things:
- Real photo hosting for plants (so photos aren't stuck as base64 text
  inside Firestore documents forever).
- Per-plant share links with a real Open Graph preview (photo + price) when
  shared to Facebook/LINE/etc., instead of the generic shop logo.

I can't deploy or update this Worker myself — the tools available to me can
create/inspect Cloudflare R2 buckets but not create or update Worker code,
and I have no login for the Cloudflare CLI (`wrangler`) in this environment.
Every step below is manual, and you'll need to repeat the "paste the code"
step again any time the Worker's code changes in the future.

## 1. Create the Worker

1. Go to the [Cloudflare dashboard](https://dash.cloudflare.com/) → **Workers & Pages** → **Create** → **Create Worker**.
2. Name it `rinlada-showcase-og` (matches the name already referenced in `cloudflare-worker/wrangler.toml`, though that file is just documentation — it isn't used to deploy).
3. Deploy the default "Hello World" starter first (just to create the Worker), then click **Edit code**.
4. Delete everything in the editor and paste in the full contents of `cloudflare-worker/worker.js` from this repo.
5. Click **Deploy**.

## 2. Add the R2 bucket binding

The bucket (`rinlada-plant-photos`) already exists — created ahead of time.

1. On the Worker's page → **Settings** → **Bindings** → **Add binding** → **R2 Bucket**.
2. Variable name: `PLANT_PHOTOS` (must match exactly — the code reads `env.PLANT_PHOTOS`).
3. R2 bucket: select `rinlada-plant-photos`.
4. Save.

## 3. Add environment variables

Same **Settings → Variables** page, add these as plain (non-secret) variables — none of them are credentials:

| Name | Value |
|---|---|
| `FIREBASE_API_KEY` | the same value as `apiKey` in `firebase-client.js`'s `FB_CONFIG` — not a secret, see that file's comment |
| `FIREBASE_PROJECT_ID` | `rinlada-plant-stock` |
| `SHOWCASE_URL` | `https://dryrh68kkm-beep.github.io/Garden_Plan_Editor/showcase.html` |

Save, which redeploys the Worker with the new bindings/variables active.

## 4. Find your Worker's URL and wire it into the site

After deploying, the Worker's page shows its live URL — something like:

```
https://rinlada-showcase-og.<your-account-subdomain>.workers.dev
```

Copy that exact URL, then either:
- **Tell me the URL** and I'll update the code for you, or
- Edit `firebase-client.js` yourself: find the line

  ```js
  const SHOWCASE_WORKER_URL = ""; // e.g. "https://rinlada-showcase-og.<your-subdomain>.workers.dev"
  ```

  and put your URL inside the quotes, then commit and push (or open a PR — either is fine).

Until this constant is filled in, everything keeps working exactly as it
does today (photos stay base64, share links stay generic) — this one line
is the switch that turns the new behavior on.

## 5. Test it

Once `SHOWCASE_WORKER_URL` is deployed to the live site:

1. **Photo upload**: in the admin, edit or add a plant, upload a new photo, save. If it worked, the photo now shows a real `https://rinlada-showcase-og...` URL instead of a huge `data:image/...` string (you can check this in the browser's dev tools, or just notice saves feel faster since the Firestore document is much smaller).
2. **Share preview**: open that plant in the showcase, tap "🔗 แชร์", share it to yourself (e.g. paste the link in a LINE chat with yourself, or use Facebook's [Sharing Debugger](https://developers.facebook.com/tools/debug/) to preview it) — you should see that plant's own photo and price, not the generic shop logo.
3. **Old photos**: plants added before this Worker existed keep their base64 photos and keep working normally in the admin/showcase — they just won't get a rich preview image when shared (falls back to the generic shop logo) until you re-save that plant with the photo re-uploaded.

## What NOT to do

- Don't delete or rename the `rinlada-plant-photos` R2 bucket, or the `PLANT_PHOTOS` binding name — both are hardcoded expectations in the Worker code.
- Don't reuse or modify the `rinlada-line-bot` or `rinlada-video-renderer` Workers for this — those belong to a separate project (the LINE bot) that another session manages; this feature has its own dedicated Worker and R2 bucket precisely to avoid touching that.
