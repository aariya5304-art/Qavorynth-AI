# Deployment on free hosting

Two parts: the **API** (Python) and the **web app** (static files). Deploy the API first, because the web app
needs its URL at build time.

## 1. Push to GitHub
```bash
git init && git add . && git commit -m "Qavorynth AI"
git branch -M main && git remote add origin https://github.com/<you>/qavorynth-ai.git && git push -u origin main
```

## 2. API on Render (free web service)
1. Render dashboard -> **New -> Blueprint** -> select the repo (it reads `render.yaml`), or **New -> Web Service**
   with root directory `backend`, build `pip install -r requirements.txt`, start
   `uvicorn app.main:app --host 0.0.0.0 --port $PORT`.
2. Set env var `CORS_ORIGINS` to your web-app URL once you have it (comma-separated for several).
3. Check `https://<service>.onrender.com/api/health` returns `{"status":"ok",...}`.

Free-tier notes: the service sleeps after inactivity and takes up to about a minute to wake, and in-memory state
resets on every sleep/restart. Open the API URL a minute before a live demo. Alternative: deploy `backend/Dockerfile`
to a Hugging Face Docker Space (set `PORT=7860` or follow the Space's port setting) or Fly.io.

## 3. Web app on Vercel, Netlify or Cloudflare Pages (free)
- **Vercel**: import the repo, set **Root Directory** `frontend`, framework Vite (picked up from `vercel.json`).
- **Netlify**: base directory `frontend` (uses `netlify.toml`).
- **Cloudflare Pages**: root `frontend`, build `npm run build`, output `dist`.

In every case add the environment variable **`VITE_API_BASE_URL`** = your API URL (no trailing slash), then redeploy.
Vite inlines it at build time, so changing it requires a rebuild.

Then set `CORS_ORIGINS` on the API to the final web-app URL (for Vercel previews you can also set
`CORS_ORIGIN_REGEX`).

## 4. Smoke test
Open the site, confirm the header shows **API connected**, activate *Heavy rainfall, rising water* in the Scenario
Simulator and watch metrics, map, alerts and the event log change together.

## Map tiles
The backdrop uses the public OpenStreetMap tile server, which is fine for a demo but not for heavy traffic (see the
OSM tile usage policy). For a larger audience use a tile provider with a free tier and swap the URL in
`frontend/src/components/MapView.tsx`, keeping the attribution. The backdrop can also be switched off in the layers box.
