# Coolify Quick Start Guide

**For beginners who want to deploy this app to Coolify at `192.168.0.16:8000`**

## What You Need

1. Your code in a Git repository (GitHub, GitLab, etc.)
2. Access to Coolify at `http://192.168.0.16:8000`

## Step-by-Step Deployment

### Step 1: Push Your Code to Git

If you haven't already:
```bash
git add .
git commit -m "Ready for Coolify deployment"
git push
```

### Step 2: Open Coolify

1. Open your browser
2. Go to `http://192.168.0.16:8000`
3. Log in to Coolify

### Step 3: Create New Resource

1. Click the **"+"** or **"New Resource"** button
2. Scroll down to **"Applications"** section
3. Under **"Docker Based"**, click on **"Docker Compose Empty"**
   - It has a blue Docker whale icon
   - Description: "You can deploy complex application easily with Docker Compose, without Git."
4. Name it: `electricity-prices` (or any name you like)

### Step 4: Paste Docker Compose Content

**This is required!** You need to paste your Docker Compose content:

**🎯 EASIEST: Use the one-click version (recommended for first-time setup)**
1. Open `docker-compose.coolify-oneclick.yml` file
2. Copy the entire contents (Ctrl+A, then Ctrl+C)
3. In Coolify, find the **"Docker Compose Raw"** field (it's a text area/editor)
4. Paste the entire content into that field (Ctrl+V)
5. **Skip Step 6** - this version works with minimal configuration!

**Or use the secure version (requires all env vars):**
1. Open `docker-compose.coolify.yml` file (no hardcoded passwords)
2. Copy the entire contents (Ctrl+A, then Ctrl+C)
3. In Coolify, find the **"Docker Compose Raw"** field
4. Paste the entire content into that field (Ctrl+V)
5. **You must complete Step 6** to set all environment variables

**Important**: Make sure you paste the complete file, including all services (db, backend, frontend, swagger-ui), volumes, and networks sections.

### Step 5: Connect Your Git Repository (Optional but Recommended)

If you want automatic updates when you push to Git:

1. Look for **"Source"**, **"Repository"**, or **"Git"** settings
2. Click **"Connect Repository"** or **"Add Git Source"**
3. Choose your Git provider (GitHub, GitLab, etc.)
4. Select your repository
5. Coolify will connect to it

**Note**: Even if you connect Git, you still need to paste the Docker Compose content in Step 4.

### Step 6: Set Environment Variables (OPTIONAL for one-click version)

**If you used `docker-compose.coolify-oneclick.yml`**: 
- ✅ **You can skip this step!** It works with defaults.
- ⚠️ **For production**, you should set `POSTGRES_PASSWORD` to a strong password.

**If you used `docker-compose.coolify.yml`**:
- ❌ **You MUST set these variables** (no defaults):

| Variable Name | Value | Notes |
|--------------|-------|-------|
| `POSTGRES_DB` | `electricity_prices` | Database name |
| `POSTGRES_USER` | `electricity_user` | Database username |
| `POSTGRES_PASSWORD` | `[Choose a strong password]` | **Use a strong password!** |
| `DATABASE_URL` | `postgresql://electricity_user:[YOUR_PASSWORD]@db:5432/electricity_prices` | Replace `[YOUR_PASSWORD]` with the same password as above |
| `FRONTEND_URL` | `http://192.168.0.16:8080` | Your app's public URL |
| `FRONTEND_PORT` | `8080` | Port for the frontend (must match your URL) |

**Optional overrides** (both versions):
- `NODE_ENV` (defaults to `production`)
- `ELERING_API_URL` (has default)
- `VITE_API_BASE_URL` (defaults to `/api/v1`)

### Step 7: Set Port

1. Go to **"Ports"** or **"Networking"**
2. Map container port **80** to host port **8080** (or any available port)
3. This means your app will be at `http://192.168.0.16:8080`

### Step 8: Deploy!

1. Click **"Deploy"** or **"Save & Deploy"**
2. Wait for it to finish (this may take 5-10 minutes the first time)
3. Watch the logs to see progress

### Step 9: Access Your App

Once deployment is complete:
- Open `http://192.168.0.16:8080` in your browser
- You should see your electricity prices app!

## What Happens During Deployment?

Coolify will:
1. ✅ Clone your code from Git
2. ✅ Build 4 Docker containers (database, backend, frontend, swagger)
3. ✅ Start all services
4. ✅ Connect them together
5. ✅ Make your app available on the port you chose

## After First Deployment

### Load Initial Data

Your app needs data! Run this command (or use the API):

```bash
curl -X POST http://192.168.0.16:8080/api/sync/trigger \
  -H "Content-Type: application/json" \
  -d '{"country": "all", "days": 7}'
```

Or visit: `http://192.168.0.16:8080/api/v1/health` to check if everything is working.

## Updating Your App

When you make changes:

1. Push to Git: `git push`
2. In Coolify, click **"Redeploy"**
3. Wait for it to finish
4. Done! Your changes are live

## Common Issues

### "Port already in use"
- Choose a different port (e.g., 8081, 3000, 9000)

### "Can't connect to database"
- Check that `POSTGRES_PASSWORD` and `DATABASE_URL` use the same password
- Make sure the database service started successfully

### "Services not starting"
- Check the logs in Coolify
- Look for error messages
- Verify all environment variables are set

### "App loads but shows errors"
- Check browser console (F12)
- Verify backend is running: `http://192.168.0.16:8080/api/v1/health`
- Check Coolify logs for backend errors

## Where to Get Help

1. **Coolify Logs**: Click on your resource → "Logs" tab
2. **Health Check**: Visit `http://192.168.0.16:8080/api/v1/health`
3. **Status Page**: Visit `http://192.168.0.16:8080/status` (if available)

## Quick Reference

- **App URL**: `http://192.168.0.16:8080`
- **API Health**: `http://192.168.0.16:8080/api/v1/health`
- **API Docs**: `http://192.168.0.16:8080/api/`
- **Coolify Dashboard**: `http://192.168.0.16:8000`

That's it! You're deployed! 🎉

