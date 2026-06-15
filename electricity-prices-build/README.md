# Electricity Prices Frontend

A modern Vue.js 3 application for monitoring electricity prices in Baltic countries (Lithuania, Estonia, Latvia, Finland) with real-time data from the Elering NordPool API.

## 🚀 **Quick Start**

### **Prerequisites**
- Node.js 18+
- Docker and Docker Compose (for full system)

### **Development Setup**

#### **Standalone Frontend Development**
```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Access: http://localhost:5173
```

#### **Full System Development**
```bash
# Start entire system in development mode
./scripts/dev.sh

# Access: http://localhost:5173 (frontend) + http://localhost:3000 (backend)
```

### **Production Build**
```bash
# Build for production
npm run build

# Or use Docker for full system
./scripts/prod.sh

# Access: http://localhost:80 (Nginx served with API proxy)
```

## 📊 **Features**

### **Core Functionality**
- ✅ **Multi-country support** (LT, EE, LV, FI)
- ✅ **Real-time price display** with DST-aware timestamps
- ✅ **Historical data viewing** with date range selection
- ✅ **Responsive design** for mobile and desktop
- ✅ **Interactive charts** and price visualization
- ✅ **Price alerts** and notifications (planned)

### **Technical Features**
- ✅ **Vue.js 3** with Composition API
- ✅ **Vite** for fast development and building
- ✅ **API proxy integration** for backend communication
- ✅ **Containerized deployment** with Nginx
- ✅ **Hot-reload** in development mode
- ✅ **Production optimization** with code splitting

## 🔧 **Architecture**

### **Development Mode**
```
┌─────────────────┐    ┌─────────────────┐
│   Vite Dev      │◄──►│   Backend API   │
│   Server        │    │   (Express)     │
│   Port: 5173    │    │   Port: 3000    │
└─────────────────┘    └─────────────────┘
```

### **Production Mode**
```
┌─────────────────────────────────────────┐
│              Nginx                      │
│              Port: 80                   │
│  ┌─────────────────┐  ┌─────────────┐   │
│  │   Vue.js App    │  │   API Proxy │   │
│  │   (Static)      │  │   (/api/v1) │   │
│  │                 │  │   (/api/)   │   │
│  └─────────────────┘  └─────────────┘   │
└─────────────────────────────────────────┘
```

## 📋 **API Integration**

### **API Endpoints**
The frontend communicates with the backend through proxy routes:

```javascript
// API base URL (configured in vite.config.js)
const API_BASE = '/api/v1'

// Available endpoints
GET /api/v1/nps/prices?date=YYYY-MM-DD&country=lt
GET /api/v1/nps/price/:country/latest
GET /api/v1/nps/price/:country/current
GET /api/v1/nps/price/all/latest
GET /api/v1/nps/price/all/current
GET /api/v1/countries
GET /api/v1/health
```

### **Proxy Configuration**
```javascript
// vite.config.js
server: {
  proxy: {
    '/api/v1': {
      target: 'http://backend:3000',
      changeOrigin: true,
      secure: false
    },
    '/api': {
      target: 'http://swagger-ui:8080',
      changeOrigin: true,
      secure: false
    }
  }
}
```

## 🏗 **Project Structure**

```
src/
├── assets/              # Static assets (CSS, images)
├── components/          # Vue components
│   ├── icons/          # Icon components
│   ├── PriceTable.vue  # Price display component
│   ├── DatePicker.vue  # Date selection component
│   └── ...
├── config/             # Configuration files
├── router/             # Vue Router configuration
├── services/           # API and business logic services
├── stores/             # Pinia stores (if using)
├── utils/              # Utility functions
├── views/              # Page components
├── App.vue             # Root component
└── main.js             # Application entry point
```

## 🔧 **Development**

### **Available Scripts**
```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run preview      # Preview production build
npm run lint         # Run ESLint
```

### **Environment Variables**
```bash
# .env.development
VITE_API_BASE_URL=/api/v1
NODE_ENV=development

# .env.production
VITE_API_BASE_URL=/api/v1
NODE_ENV=production
```

### **Hot Reload**
- **Frontend**: Changes reflect immediately in development
- **Backend**: API changes require backend restart (or use nodemon)
- **Proxy**: API calls are automatically proxied to backend

## 🚀 **Deployment**

### **Docker Deployment**
```bash
# Production build
docker-compose --env-file .env.production up -d --build

# Development build
docker-compose -f docker-compose.yml -f docker-compose.dev.yml --env-file .env.development up -d --build
```

### **Manual Deployment**
```bash
# Build the application
npm run build

# Serve with Nginx or any static file server
# Configure proxy for /api/v1/* to backend
```

## 📊 **Performance**

### **Development Performance**
- **Hot-reload**: < 100ms for most changes
- **Build time**: ~5-10 seconds for full rebuild
- **Proxy overhead**: < 5ms additional latency

### **Production Performance**
- **Bundle size**: Optimized with code splitting
- **Loading time**: < 2 seconds for initial load
- **API response**: < 100ms for typical queries
- **Caching**: Static assets cached for 1 year

## 🔮 **Future Enhancements**

### **Planned Features**
- PWA (Progressive Web App) support
- Push notifications for price alerts
- Advanced price analytics and charts
- Offline functionality
- Dark mode theme
- Multi-language support

### **Technical Improvements**
- TypeScript migration
- Unit and integration tests
- Performance monitoring
- Error tracking and analytics
- Accessibility improvements

## 📞 **Support**

### **Development Issues**
```bash
# Check logs
docker-compose logs -f frontend

# Restart frontend
docker-compose restart frontend

# Rebuild frontend
docker-compose build --no-cache frontend
```

### **API Issues**
```bash
# Test API connectivity
curl "http://localhost:5173/api/v1/health"

# Check backend logs
docker-compose logs -f backend
```

### **Swagger UI Service**
- Interactive API documentation and testing
- OpenAPI specification
- Auto-generated endpoint documentation
- Accessible at `/api/` through frontend proxy only (internal service)

---

**Status**: ✅ Production Ready  
**Last Updated**: June 2024
