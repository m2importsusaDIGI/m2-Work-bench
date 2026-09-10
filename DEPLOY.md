# Deploying M2 Workbench to the cloud

This gets you a permanent `https://...` link that works from any device,
any time, even with your computer off.

## Important caveat first

Your jobs and CRM contacts are stored in the **browser's local storage**,
not in a database. That means:

- The app itself will always be reachable at your new link.
- But the data you see depends on which browser/device you're using. Open
  it on your phone and you'll see an empty CRM, not what's on your laptop.
- This is fine to get live now. If you later want the same data to show up
  everywhere (e.g. to sell this to clients), that needs a real database —
  a separate step, not part of this deploy.

## 1. Put the code on GitHub

1. Go to https://github.com/new and create a new **private** repository,
   e.g. named `m2-workbench`. Don't check any of the "initialize with"
   boxes.
2. On your computer, open a terminal/PowerShell **inside your project
   folder** (`C:\Users\m2imp\Downloads\m2-workbench\m2-workbench`) and run:

   ```
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/m2-workbench.git
   git push -u origin main
   ```

   Replace `YOUR_USERNAME` with your actual GitHub username. It'll ask you
   to log in the first time — follow the prompts.

   (If you don't have `git` yet, install it from https://git-scm.com/downloads
   first, then reopen your terminal.)

## 2. Deploy on Railway (recommended)

1. Go to https://railway.app and sign up/log in with your GitHub account.
2. Click **New Project → Deploy from GitHub repo**, pick `m2-workbench`.
3. Railway will detect the `Dockerfile` automatically and start a build.
4. Go to the project's **Variables** tab and add one:
   - `XAI_API_KEY` = your xAI key (the same one from your local `.env`)
5. Go to **Settings → Networking** and click **Generate Domain**. That's
   your permanent link — something like `m2-workbench-production.up.railway.app`.
6. Wait for the deploy to finish (watch the **Deployments** tab), then open
   the link. You should see the same app you've been running locally.

### Or: Render, if you'd rather use that

1. Go to https://render.com, sign up/log in with GitHub.
2. **New → Web Service**, connect the `m2-workbench` repo.
3. Render will detect the `Dockerfile`. Leave build/start commands blank
   (the Dockerfile handles both).
4. Under **Environment**, add `XAI_API_KEY` with your key.
5. Click **Create Web Service**. Render gives you a `https://....onrender.com`
   link once it finishes building.

## 3. Every time you make a change later

```
git add .
git commit -m "describe what changed"
git push
```

Railway/Render both watch your GitHub repo and auto-redeploy on every push
— no manual redeploy step needed.
