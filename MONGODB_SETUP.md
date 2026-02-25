# 🚀 Running with Real MongoDB Connection

## Setup Instructions

### 1. Install Dependencies
```bash
pnpm install
```

This will install:
- `express` - Backend server
- `cors` - Cross-origin requests
- `concurrently` - Run multiple commands
- All existing dependencies

### 2. Verify .env Configuration
Make sure your `.env` file has:
```env
MONGODB_URI=your_mongodb_atlas_connection_string
MONGODB_DATABASE=insurance-chatbot
PORT=3001
```

### 3. Start Backend & Frontend

**Option A: Run both together** (Recommended)
```bash
pnpm run dev:all
```

This runs:
- Backend server on `http://localhost:3001`
- Frontend on `http://localhost:5173`

**Option B: Run separately**

Terminal 1 - Backend:
```bash
pnpm run server
```

Terminal 2 - Frontend:
```bash
pnpm run dev
```

## How It Works

### Architecture
```
Browser (Frontend)
    ↓ HTTP Request
Backend Server (Express.js) :3001
    ↓ MongoDB Driver
MongoDB Atlas (Cloud Database)
```

### API Endpoints

**GET /api/health**
- Health check
- Returns: `{ status: 'ok', message: 'Server is running' }`

**GET /api/comparison/providers**
- Get list of insurance providers
- Query: `?limit=20`
- Returns: `{ success: true, data: ['AIA', 'FWD', ...] }`

**POST /api/comparison/search**
- Search policies by name
- Body: `{ policyNames: ['AIA', 'FWD'] }`
- Returns: 
```json
{
  "success": true,
  "data": [
    {
      "name": "เอไอเอ",
      "coverage": {
        "life": 2000000,
        "ipd": 500000,
        "room": 3000,
        "critical": null,
        "accident": null
      },
      "document": {
        "id": "...",
        "title": "...",
        "file": "...",
        "page": 1
      }
    }
  ]
}
```

### Frontend Flow
1. User opens Comparison Page
2. Page calls `backendService.fetchPolicyProviders()`
3. Backend queries MongoDB for providers
4. User searches for policies (e.g., "AIA, FWD")
5. Frontend calls `backendService.searchPoliciesByName(['AIA', 'FWD'])`
6. Backend:
   - Searches MongoDB documents
   - Parses coverage from text
   - Returns structured data
7. Frontend displays comparison table

## Verification

### Test Backend Server
```bash
# In a new terminal
curl http://localhost:3001/api/health
```

Expected: `{"status":"ok","message":"Server is running"}`

### Test MongoDB Connection
Check terminal output when starting server:
```
🚀 Server running on http://localhost:3001
✅ MongoDB connected successfully
```

### Test API Endpoints

**Get Providers:**
```bash
curl http://localhost:3001/api/comparison/providers
```

**Search Policies:**
```bash
curl -X POST http://localhost:3001/api/comparison/search \
  -H "Content-Type: application/json" \
  -d '{"policyNames": ["AIA", "FWD"]}'
```

## Troubleshooting

### "Cannot connect to MongoDB"
- ✅ Check `.env` file has correct `MONGODB_URI`
- ✅ Verify MongoDB Atlas allows your IP
- ✅ Check database name matches

### "Failed to fetch providers"
- ✅ Ensure backend server is running on port 3001
- ✅ Check backend terminal for errors
- ✅ Verify CORS is enabled

### "No results found"
- ✅ Check if documents exist in MongoDB
- ✅ Run `node test-comparison.js` to verify data
- ✅ Try different search terms

### Port 3001 already in use
```bash
# Kill process on port 3001
lsof -ti:3001 | xargs kill -9

# Or change PORT in .env
PORT=3002
```

## Production Deployment

For production, you'll need to:
1. Deploy backend to a cloud service (Heroku, Railway, AWS, etc.)
2. Update `API_BASE_URL` in `backendService.js` to your backend URL
3. Build frontend: `pnpm run build`
4. Deploy frontend static files

## Files Changed

- ✅ `server.js` - New backend server
- ✅ `src/Pages/ComparisonPage.jsx` - Uses backendService instead of direct MongoDB
- ✅ `src/services/backendService.js` - Added comparison API methods
- ✅ `src/services/mongoService.js` - Added search & parse methods (used by backend)
- ✅ `package.json` - Added express, cors, scripts

## Next Steps

1. ✅ Start servers: `pnpm run dev:all`
2. ✅ Open browser: `http://localhost:5173`
3. ✅ Navigate to Comparison Page
4. ✅ Search for policies: "AIA, FWD, เอไอเอ"
5. ✅ View real data from MongoDB!

No more mock data - everything is connected to your MongoDB Atlas database! 🎉
