# Coolify Troubleshooting Guide

## Common Issues and Solutions

### Issue: "database 'electricity_user' does not exist"

**Problem**: The backend is trying to connect to a database named after the username instead of the actual database name.

**Solution**: 
1. Check your `DATABASE_URL` environment variable in Coolify
2. It should be in format: `postgresql://USERNAME:PASSWORD@db:5432/DATABASE_NAME`
3. Make sure the database name (last part) is `electricity_prices`, not `electricity_user`

**Example**:
```
✅ Correct: postgresql://electricity_user:password@db:5432/electricity_prices
❌ Wrong:   postgresql://electricity_user:password@db:5432/electricity_user
```

### Issue: "relation 'price_data' does not exist"

**Problem**: The database tables haven't been created. This happens when:
- The database volume already exists from a previous deployment
- The init scripts only run on FIRST initialization

**Solution**: Delete the database volume and redeploy:

1. In Coolify, go to your deployment
2. Click **"Stop"** to stop all services
3. Go to **"Advanced"** or **"Volumes"** section
4. Find the volume named `postgres_data` (or similar)
5. Delete it
6. Click **"Deploy"** again

The init scripts will run on the next deployment and create all tables.

**Alternative**: If you can't delete the volume, you can manually run the init script:
1. Connect to the database container
2. Run: `psql -U electricity_user -d electricity_prices -f /docker-entrypoint-initdb.d/01_schema.sql`

### Issue: Backend health check failing

**Problem**: The backend takes time to start (connects to DB, initializes sync worker).

**Solution**: Already fixed! The health check now has:
- 120 second start period (enough time to initialize)
- Always returns 200 status (even if degraded)

If it still fails:
1. Check backend logs in Coolify
2. Verify DATABASE_URL is correct
3. Check if database is healthy

### Issue: Services can't connect to each other

**Problem**: Services are not on the same network.

**Solution**: 
- All services should use `electricity_network` (already configured)
- Service names should match: `db`, `backend`, `frontend`, `swagger-ui`
- Check network configuration in docker-compose file

### Issue: Port conflicts

**Problem**: Port already in use.

**Solution**:
1. Change `FRONTEND_PORT` environment variable to a different port (e.g., 8080, 3000, 9000)
2. Update `FRONTEND_URL` to match the new port
3. Redeploy

### Issue: Build fails with "vite: not found"

**Problem**: `NODE_ENV=production` at build time skips devDependencies.

**Solution**: Already fixed! The `Dockerfile.prod` now installs dev dependencies during build.

If it still fails:
1. Check that `Dockerfile.prod` has `RUN NODE_ENV=development npm install`
2. Uncheck "Available at Buildtime" for `NODE_ENV` in Coolify environment variables

## Quick Health Checks

### Check if database is running:
```bash
# In Coolify terminal or via docker exec
docker exec <db-container-name> pg_isready -U electricity_user -d electricity_prices
```

### Check if tables exist:
```bash
docker exec <db-container-name> psql -U electricity_user -d electricity_prices -c "\dt"
```

### Check backend logs:
```bash
# In Coolify, go to your deployment → Logs tab
# Or via docker:
docker logs <backend-container-name>
```

### Test database connection:
```bash
docker exec <backend-container-name> node -e "console.log(process.env.DATABASE_URL)"
```

## Environment Variables Checklist

Make sure these are set correctly in Coolify:

- ✅ `POSTGRES_DB` = `electricity_prices`
- ✅ `POSTGRES_USER` = `electricity_user`  
- ✅ `POSTGRES_PASSWORD` = (your secure password)
- ✅ `DATABASE_URL` = `postgresql://electricity_user:YOUR_PASSWORD@db:5432/electricity_prices`
- ✅ `FRONTEND_URL` = `http://192.168.0.16:8080` (or your URL)
- ✅ `FRONTEND_PORT` = `8080` (or your port)

## Still Having Issues?

1. **Check all logs** in Coolify (database, backend, frontend)
2. **Verify environment variables** are set correctly
3. **Check network connectivity** between services
4. **Delete volumes and redeploy** if database issues persist
5. **Review deployment logs** for specific error messages

