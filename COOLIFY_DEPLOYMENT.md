# Coolify Deployment Guide

This guide will help you deploy the Electricity Prices NordPool application to your Coolify server at `192.168.0.16:8000`.

## Prerequisites

1. **Access to Coolify**: You should be able to access `http://192.168.0.16:8000`
2. **Git Repository**: Your code should be in a Git repository (GitHub, GitLab, or self-hosted)
3. **Coolify Server Setup**: Your Coolify server should have Docker and Docker Compose installed

## Deployment Options

Coolify supports multiple deployment methods. For this multi-service application, we recommend using **Docker Compose** deployment.

## Method 1: Docker Compose Deployment (Recommended)

This is the easiest method as it uses your existing `docker-compose.yml` file.

**Note**: Coolify offers two approaches:
- **"Docker Compose Empty"** - For manual compose file entry or if you want to paste your compose file directly
- **Git-based options** - If you want automatic Git integration, you might be able to use "Public Repository" or "Private Repository" and specify `docker-compose.yml` in the settings

We'll focus on "Docker Compose Empty" as it's the most straightforward for multi-service applications.

### Step 1: Prepare Your Repository

1. Make sure your code is pushed to a Git repository
2. Ensure your `docker-compose.yml` file is in the root directory (it already is)

### Step 2: Create a New Resource in Coolify

1. Log in to Coolify at `http://192.168.0.16:8000`
2. Click **"New Resource"** or **"+"** button
3. Scroll down to the **"Applications"** section
4. Under **"Docker Based"**, click on **"Docker Compose Empty"**
   - This option allows you to deploy your `docker-compose.yml` file
5. Give it a name (e.g., "electricity-prices")

### Step 3: Paste Docker Compose Content (REQUIRED)

**This field is mandatory!** You have two options:

#### Option A: Use the Optimized Version (Recommended)

1. Open `docker-compose.coolify.yml` file (I've created this optimized version for you)
2. Select all content (Ctrl+A / Cmd+A) and copy it (Ctrl+C / Cmd+C)
3. In Coolify, locate the **"Docker Compose Raw"** field
   - This is typically a large text area or code editor
   - It may be labeled as "Docker Compose", "Compose File", or "Raw YAML"
4. Paste the entire content into this field (Ctrl+V / Cmd+V)

**Why use the optimized version?**
- ✅ Removed development volume mounts (not needed in production)
- ✅ Added health checks for better service management
- ✅ Made port configurable via `FRONTEND_PORT` environment variable
- ✅ Better dependency management with health check conditions

#### Option B: Use Original docker-compose.yml

1. Open your project's `docker-compose.yml` file (located in the root directory)
2. Select all content (Ctrl+A / Cmd+A) and copy it (Ctrl+C / Cmd+C)
3. In Coolify, locate the **"Docker Compose Raw"** field
4. Paste the entire content into this field (Ctrl+V / Cmd+V)

**Important Notes**:
- Make sure you paste the complete file including:
  - All services (db, backend, frontend, swagger-ui)
  - Volumes section
  - Networks section
- The file should start with `services:` and end with the networks definition
- Double-check that all indentation is preserved (YAML is sensitive to spacing)
- **Note**: The original `docker-compose.yml` includes development volume mounts that aren't needed in production, but they won't cause issues

### Step 4: Connect Your Git Repository (Optional)

If you want automatic updates when you push code changes:

1. Look for **"Source"**, **"Repository"**, or **"Git"** section in the settings
2. Connect your Git repository:
   - If using GitHub/GitLab: Click "Connect" and authorize Coolify
   - If using a private repository: Enter the repository URL and credentials
   - If using a self-hosted Git server: Enter the full repository URL

**Note**: Even with Git connected, you still need to have the Docker Compose content in the "Docker Compose Raw" field. Git connection is mainly for automatic redeployments when you push changes.

### Step 5: Set Environment Variables

Click on **"Environment Variables"** and add the following:

**REQUIRED Variables** (must be set - no hardcoded defaults in `docker-compose.coolify.yml`):

```env
# Database Configuration (REQUIRED)
POSTGRES_DB=electricity_prices
POSTGRES_USER=electricity_user
POSTGRES_PASSWORD=your_secure_password_here

# Backend Configuration (REQUIRED)
DATABASE_URL=postgresql://electricity_user:your_secure_password_here@db:5432/electricity_prices
FRONTEND_URL=http://192.168.0.16:8080

# Frontend Configuration (REQUIRED)
FRONTEND_PORT=8080
```

**OPTIONAL Variables** (have defaults, but you can override):

```env
# Optional - defaults provided
NODE_ENV=production
ELERING_API_URL=https://dashboard.elering.ee/api/nps/price
VITE_API_BASE_URL=/api/v1
```

**Important Notes**:
- **Replace `your_secure_password_here`** with a strong, unique password
- Use the **same password** for both `POSTGRES_PASSWORD` and in `DATABASE_URL`
- Make sure `FRONTEND_PORT` matches the port in `FRONTEND_URL`
- The optimized `docker-compose.coolify.yml` has **no hardcoded passwords** - all sensitive values must be set via environment variables

### Step 6: Configure Ports

1. Go to **"Ports"** or **"Networking"** settings
2. Map port **80** (container) to a host port (e.g., **8080** or **3000**)
   - This will make your app accessible at `http://192.168.0.16:8080` (or whatever port you choose)

### Step 7: Deploy

1. Click **"Deploy"** or **"Save & Deploy"**
2. Coolify will:
   - Clone your repository
   - Build all Docker images
   - Start all services
   - Show you the deployment logs

### Step 8: Access Your Application

Once deployed, access your application at:
- **Frontend**: `http://192.168.0.16:8080` (or your chosen port)
- **API**: `http://192.168.0.16:8080/api/v1/health`
- **Swagger UI**: `http://192.168.0.16:8080/api/`

## Method 2: Individual Service Deployment

If you prefer to deploy services separately (more control, but more complex):

### Deploy Database First

1. Create a new resource → **PostgreSQL**
2. Set database name: `electricity_prices`
3. Set username: `electricity_user`
4. Set password: `your_secure_password_here`
5. Note the internal connection string (e.g., `postgresql://electricity_user:password@postgres:5432/electricity_prices`)

### Deploy Backend

1. Create a new resource → **Dockerfile**
2. Connect your Git repository
3. **Dockerfile Path**: `backend/Dockerfile`
4. **Port**: `3000`
5. **Environment Variables**:
   ```env
   DATABASE_URL=postgresql://electricity_user:password@postgres:5432/electricity_prices
   NODE_ENV=production
   ELERING_API_URL=https://dashboard.elering.ee/api/nps/price
   ```
6. **Networking**: Connect to the database service

### Deploy Frontend

1. Create a new resource → **Dockerfile**
2. Connect your Git repository
3. **Dockerfile Path**: `electricity-prices-build/Dockerfile.prod`
4. **Port**: `80`
5. **Environment Variables**:
   ```env
   VITE_API_BASE_URL=/api/v1
   NODE_ENV=production
   ```
6. **Networking**: Connect to the backend service
7. **Note**: You'll need to modify `nginx.conf` to use the backend service name instead of `backend:3000`

## Troubleshooting

### Issue: Build fails with "vite: not found" or similar build tool errors

**Solution**: This happens when `NODE_ENV=production` is set at build time, which causes npm to skip devDependencies. The `Dockerfile.prod` has been updated to handle this, but if you still see this error:

1. In Coolify, go to **Environment Variables**
2. Find `NODE_ENV` 
3. **Uncheck "Available at Buildtime"** for `NODE_ENV` (or set it to "development" only at build time)
4. Redeploy

Alternatively, the `Dockerfile.prod` now explicitly installs dev dependencies during build, so this should be resolved.

### Issue: Services can't connect to each other

**Solution**: Make sure all services are in the same network. In Coolify, this is usually automatic for Docker Compose deployments.

### Issue: Database connection errors

**Solution**: 
1. Check that the `DATABASE_URL` environment variable matches your database configuration
2. Ensure the database service is running and healthy
3. Verify network connectivity between services

### Issue: Frontend can't reach backend

**Solution**: 
1. Check the nginx.conf proxy settings
2. Verify the backend service name matches (should be `backend` in docker-compose)
3. Check backend logs: `docker-compose logs backend`

### Issue: Port already in use

**Solution**: 
1. Change the host port mapping in Coolify
2. Or stop the service using that port

### Viewing Logs

In Coolify:
1. Go to your resource
2. Click on **"Logs"** tab
3. Or use the terminal/console feature

From command line (if you have SSH access):
```bash
docker-compose logs -f
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f db
```

### Manual Sync (After Deployment)

Once deployed, you can trigger a manual data sync:

```bash
# Via API
curl -X POST http://192.168.0.16:8080/api/sync/trigger \
  -H "Content-Type: application/json" \
  -d '{"country": "all", "days": 7}'
```

## Updating Your Application

1. Push changes to your Git repository
2. In Coolify, go to your resource
3. Click **"Redeploy"** or **"Deploy"**
4. Coolify will pull the latest code and rebuild

## Environment-Specific Configuration

### Development Environment

If you want a separate development deployment:
1. Create a new resource in Coolify
2. Use `docker-compose.dev.yml` instead of `docker-compose.yml`
3. Set `NODE_ENV=development`
4. Use different ports (e.g., 5173 for frontend, 3000 for backend)

### Production Environment

Use the default `docker-compose.yml` with:
- `NODE_ENV=production`
- Strong database passwords
- Proper port mappings
- SSL/TLS if available (Coolify can handle this)

## Security Considerations

1. **Database Password**: Use a strong, unique password
2. **Environment Variables**: Never commit sensitive data to Git
3. **Network**: Services should only be accessible internally (except frontend)
4. **SSL/TLS**: If Coolify supports it, enable HTTPS for production

## Monitoring

After deployment, monitor:
- Service health: `http://192.168.0.16:8080/api/v1/health`
- Sync status: `http://192.168.0.16:8080/api/sync/status`
- Coolify dashboard for resource usage

## Next Steps

1. **Initial Data Sync**: After first deployment, trigger a historical sync:
   ```bash
   curl -X POST http://192.168.0.16:8080/api/sync/all-historical \
     -H "Content-Type: application/json" \
     -d '{"country": "lt"}'
   ```

2. **Set Up Automatic Updates**: Configure Coolify to auto-deploy on Git push (if available)

3. **Backup Strategy**: Set up database backups in Coolify (if supported)

## Need Help?

- Check Coolify documentation: https://coolify.io/docs
- Review application logs in Coolify dashboard
- Check service health endpoints
- Verify environment variables are set correctly

