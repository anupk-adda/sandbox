# Next Steps - Running Coach App

## Setup Status

✅ **Completed:**
- Project structure created
- Configuration files set up
- Database schema defined
- Setup and startup scripts created
- Dependencies being installed

## Immediate Next Steps (After Setup Completes)

### 1. Configure Credentials

**Edit `.env` file:**
```bash
nano config/.env
```

Required values:
- `OPENAI_API_KEY` - Get from https://platform.openai.com/api-keys
- `SESSION_SECRET` - Generate with: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- `ENCRYPTION_KEY` - Generate with: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

**Edit Garmin credentials:**
```bash
nano config/garmin.credentials.txt
```

Required values:
- `GARMIN_CONSUMER_KEY` - From https://connect.garmin.com/oauthConfirm
- `GARMIN_CONSUMER_SECRET` - From https://connect.garmin.com/oauthConfirm

### 2. Implement Core Backend Components

Priority order:

#### A. Configuration Loader (backend/src/config/)
- `config-loader.ts` - Load and validate app.config.json
- `garmin-credentials.ts` - Parse Garmin credentials file
- `llm-config.ts` - Load LLM configuration

#### B. Database Service (backend/src/services/database/)
- `database-service.ts` - SQLite connection and query methods
- `models.ts` - TypeScript interfaces for data models

#### C. Logger Utility (backend/src/utils/)
- `logger.ts` - Winston-based structured logging

#### D. Express Server (backend/src/)
- `server.ts` - Main Express application
- `middleware/error-handler.ts` - Global error handling
- `middleware/auth.ts` - Authentication middleware

#### E. Basic Routes (backend/src/routes/)
- `health.routes.ts` - Health check endpoint
- `auth.routes.ts` - Authentication endpoints
- `activity.routes.ts` - Activity CRUD operations

### 3. Implement Agent Service Foundation

#### A. FastAPI Server (agent-service/src/)
- `main.py` - FastAPI application entry point
- `config.py` - Configuration loader

#### B. Pydantic Schemas (agent-service/src/schemas/)
- `analysis.py` - Data models for analysis
- `training_plan.py` - Training plan models

#### C. LLM Provider (agent-service/src/llm/)
- `base.py` - Abstract base class
- `openai_provider.py` - OpenAI implementation

### 4. Test Basic Functionality

```bash
# Start all services
./scripts/start-dev.sh

# Test health endpoints
curl http://localhost:3000/health
curl http://localhost:5000/health

# Check logs
tail -f logs/backend.log
tail -f logs/agent-service.log
```

### 5. Implement MCP Client Integration

#### A. MCP Client (backend/src/services/mcp-client/)
- `garmin-client.ts` - Garmin MCP server communication
- `mcp-protocol.ts` - MCP protocol implementation

#### B. Test Garmin Connection
```bash
# Test MCP server connection
node backend/src/services/mcp-client/test-connection.js
```

### 6. Implement First Agent

Start with Agent 1 (Current Run Analyzer):

#### A. Agent Implementation (agent-service/src/agents/)
- `current_run_analyzer.py` - Agent logic
- `base_agent.py` - Base agent class

#### B. Test Agent
```bash
cd agent-service
source venv/bin/activate
pytest tests/test_current_run_analyzer.py
```

### 7. Build LangGraph Orchestration

#### A. Workflow (agent-service/src/orchestration/)
- `graph.py` - LangGraph workflow definition
- `state.py` - Workflow state management

#### B. Test Workflow
```bash
pytest tests/test_workflow.py
```

### 8. Create Simple Frontend

#### A. Basic Components (frontend/src/)
- `App.tsx` - Main application component
- `pages/Dashboard.tsx` - Dashboard page
- `services/api-client.ts` - API client

#### B. Test Frontend
```bash
cd frontend
npm run dev
# Visit http://localhost:5173
```

## Development Workflow

### Daily Development Cycle

1. **Start services:**
   ```bash
   ./scripts/start-dev.sh
   ```

2. **Make changes** to code

3. **Test changes:**
   - Backend: `cd backend && npm test`
   - Agents: `cd agent-service && pytest`
   - Frontend: Check browser at http://localhost:5173

4. **Check logs:**
   ```bash
   tail -f logs/backend.log
   tail -f logs/agent-service.log
   ```

5. **Commit changes:**
   ```bash
   git add .
   git commit -m "Description of changes"
   ```

### Testing Strategy

1. **Unit Tests** - Test individual functions
2. **Integration Tests** - Test service interactions
3. **End-to-End Tests** - Test complete workflows

### Code Quality

Run before committing:
```bash
# Backend
cd backend
npm run lint

# Agent Service
cd agent-service
black src/
flake8 src/
mypy src/

# Frontend
cd frontend
npm run lint
```

## Implementation Priority

### Week 1: Foundation
- ✅ Project setup
- ✅ Configuration system
- ✅ Database schema
- [ ] Backend server with health check
- [ ] Agent service with health check
- [ ] Basic frontend shell

### Week 2: Core Services
- [ ] Database service implementation
- [ ] MCP client integration
- [ ] LLM provider abstraction
- [ ] Logger and error handling

### Week 3: First Agent
- [ ] Agent 1: Current Run Analyzer
- [ ] Agent output schemas
- [ ] Basic LangGraph workflow
- [ ] Agent testing

### Week 4: Complete Agent System
- [ ] Agent 2: Recent Runs Comparator
- [ ] Agent 3: Fitness Trend Analyzer
- [ ] Coach Agent
- [ ] Full workflow integration

### Week 5: Training Plans
- [ ] Training plan generator
- [ ] Safety constraints
- [ ] Plan storage and retrieval

### Week 6: Frontend Development
- [ ] Dashboard UI
- [ ] Run analysis view
- [ ] Training plan view
- [ ] Data visualization

### Week 7-8: Integration & Testing
- [ ] End-to-end testing
- [ ] Performance optimization
- [ ] Bug fixes
- [ ] Documentation

## Useful Commands

### Backend
```bash
cd backend
npm run dev          # Start development server
npm test            # Run tests
npm run build       # Build for production
npm run lint        # Lint code
```

### Agent Service
```bash
cd agent-service
source venv/bin/activate
python -m uvicorn src.main:app --reload  # Start server
pytest                                    # Run tests
black src/                               # Format code
flake8 src/                              # Lint code
```

### Frontend
```bash
cd frontend
npm run dev         # Start development server
npm run build       # Build for production
npm run preview     # Preview production build
```

### Database
```bash
# View database
sqlite3 database/running_coach.db

# Run migrations
./scripts/migrate-db.sh

# Backup database
cp database/running_coach.db database/backups/backup-$(date +%Y%m%d).db
```

## Troubleshooting

### Common Issues

**Port already in use:**
```bash
# Find and kill process
lsof -ti:3000 | xargs kill -9  # Backend
lsof -ti:5000 | xargs kill -9  # Agent service
lsof -ti:5173 | xargs kill -9  # Frontend
```

**Python virtual environment issues:**
```bash
cd agent-service
rm -rf venv
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

**Node modules issues:**
```bash
cd backend  # or frontend
rm -rf node_modules package-lock.json
npm install
```

**Database locked:**
```bash
# Close all connections and restart
rm database/running_coach.db-wal
rm database/running_coach.db-shm
```

## Resources

- **LangGraph Docs:** https://langchain-ai.github.io/langgraph/
- **OpenAI API:** https://platform.openai.com/docs
- **FastAPI:** https://fastapi.tiangolo.com/
- **Express.js:** https://expressjs.com/
- **React:** https://react.dev/
- **SQLite:** https://www.sqlite.org/docs.html

## Questions?

Check the documentation:
- [DEVELOPMENT_PLAN.md](DEVELOPMENT_PLAN.md)
- [IMPLEMENTATION_GUIDE.md](IMPLEMENTATION_GUIDE.md)
- [CONFIG_TEMPLATES.md](CONFIG_TEMPLATES.md)

---

**Ready to build! 🚀**