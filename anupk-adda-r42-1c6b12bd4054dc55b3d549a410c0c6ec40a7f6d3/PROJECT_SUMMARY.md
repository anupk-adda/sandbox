# Running Coach App - Project Summary

## Overview

An AI-powered running coach application that integrates with Garmin via MCP server and uses a multi-agent LangGraph system to provide intelligent run analysis and personalized training plans.

---

## Key Architecture Decisions

### 1. **Hybrid Architecture**
- **Frontend:** React with TypeScript (Vite)
- **API Layer:** Node.js with Express
- **Agent Service:** Python with LangGraph
- **Database:** SQLite (v1) - easily upgradeable to PostgreSQL
- **Integration:** Garmin MCP Server (existing)

**Rationale:** This hybrid approach leverages LangGraph's native Python support while maintaining a familiar Node.js API layer. Each service is independently deployable and scalable.

### 2. **Modular Configuration System**

All configuration is centralized in the `config/` directory:

```
config/
├── app.config.json          # Application settings
├── llm.config.json          # LLM provider configuration
├── garmin.credentials.txt   # Garmin OAuth (v1 - text file)
├── database.config.json     # Database settings
├── agents.config.json       # Agent configurations
└── .env                     # Environment variables
```

**Key Features:**
- Environment variable substitution (`${VAR_NAME}`)
- Hierarchical configuration loading
- Validation on startup
- Easy migration path to vault (v1.1)

### 3. **Security Approach**

**v1 (Current):**
- Garmin credentials in text file with restricted permissions (chmod 600)
- API keys in environment variables
- Token encryption in database (AES-256-GCM)
- HTTPS required for production

**v1.1 (Planned):**
- Migration to HashiCorp Vault or AWS Secrets Manager
- Automatic credential rotation
- Audit logging for credential access

### 4. **Multi-Agent Orchestration**

Using LangGraph for deterministic, parallel agent execution:

```
Agent 1 (Current Run) ────┐
                          │
Agent 2 (Last 3 Runs) ────┼──▶ Coach Agent ──▶ Output
                          │
Agent 3 (3-Month Trend) ──┘
```

**Benefits:**
- Parallel execution for speed
- Explicit state management
- Reproducible results
- Easy to add new agents

### 5. **Data Model**

Five core entities with full versioning:
1. **User** - User profile and preferences
2. **RunActivity** - Individual run data from Garmin
3. **FitnessMetricSnapshot** - Point-in-time fitness metrics
4. **AnalysisReport** - Agent analysis outputs
5. **TrainingPlan** - Generated training plans

All entities include:
- UUID primary keys
- Timestamps (created_at, updated_at)
- JSON fields for flexibility
- Version tracking for reproducibility

---

## Project Structure

```
running-coach-app/
├── frontend/              # React application
│   ├── src/
│   │   ├── components/   # UI components
│   │   ├── pages/        # Page components
│   │   ├── services/     # API client
│   │   └── types/        # TypeScript types
│   └── package.json
│
├── backend/               # Node.js/Express API
│   ├── src/
│   │   ├── routes/       # API routes
│   │   ├── controllers/  # Business logic
│   │   ├── services/     # Service layer
│   │   │   ├── mcp-client/      # Garmin MCP integration
│   │   │   ├── database/        # Database operations
│   │   │   └── agent-client/    # Agent service client
│   │   └── middleware/   # Express middleware
│   └── package.json
│
├── agent-service/         # Python LangGraph service
│   ├── src/
│   │   ├── agents/       # Agent implementations
│   │   ├── orchestration/# LangGraph workflow
│   │   ├── llm/          # LLM provider abstraction
│   │   ├── training_plans/# Training plan generation
│   │   └── schemas/      # Pydantic models
│   └── requirements.txt
│
├── config/                # Configuration files
│   ├── app.config.json
│   ├── llm.config.json
│   ├── garmin.credentials.txt
│   └── .env.example
│
├── database/              # Database files
│   ├── schema.sql
│   ├── migrations/
│   └── backups/
│
├── docs/                  # Documentation
│   ├── api/
│   ├── architecture/
│   └── user-guide/
│
└── scripts/               # Utility scripts
    ├── setup.sh
    ├── start-dev.sh
    └── migrate-db.sh
```

---

## Configuration Highlights

### LLM Configuration
- **Provider:** OpenAI (with abstraction for future providers)
- **Models:** GPT-4 Turbo for all agents
- **Features:** Structured outputs, tool calling, streaming
- **Rate Limiting:** 60 requests/min, 90K tokens/min
- **Monitoring:** Token usage, latency, error tracking

### Garmin Integration
- **MCP Server Path:** `/Users/anupk/devops/mcp/garmin_mcp/`
- **Authentication:** OAuth 1.0a (managed by MCP server)
- **Data Sync:** Last 90 days, batch size 50
- **Rate Limiting:** 60 requests/min, 1000/hour

### Training Plan Safety Constraints
- Maximum 2 hard sessions per week
- Volume increase ≤ 10-12% per week
- Long run ≤ 35% of weekly volume
- Minimum 1 recovery day between hard sessions

---

## Development Phases

### Phase 1: Foundation (Weeks 1-2)
- ✓ Project structure created
- ✓ Configuration system designed
- ✓ Database schema defined
- [ ] Development environment setup

### Phase 2: Backend Core (Weeks 3-4)
- [ ] Node.js API server
- [ ] MCP client integration
- [ ] Database service layer
- [ ] Basic CRUD operations

### Phase 3: Agent Service (Weeks 5-7)
- [ ] LangGraph orchestration
- [ ] All 4 agents implemented
- [ ] LLM provider abstraction
- [ ] Training plan generator

### Phase 4: Frontend (Weeks 8-9)
- [ ] React application
- [ ] Dashboard and analysis views
- [ ] Training plan interface
- [ ] Data visualization

### Phase 5: Integration & Testing (Weeks 10-11)
- [ ] End-to-end integration
- [ ] Agent workflow testing
- [ ] Performance optimization
- [ ] Security hardening

### Phase 6: Documentation & Deployment (Week 12)
- [ ] Logging and monitoring
- [ ] API documentation
- [ ] User guides
- [ ] Deployment preparation

---

## Quick Start Guide

### Prerequisites
- Node.js 18+
- Python 3.10+
- Garmin Connect account
- OpenAI API key

### Setup Steps

1. **Clone and Setup**
   ```bash
   git clone <repository>
   cd running-coach-app
   ./scripts/setup.sh
   ```

2. **Configure Credentials**
   ```bash
   # Edit Garmin credentials
   nano config/garmin.credentials.txt
   
   # Set environment variables
   cp config/.env.example config/.env
   nano config/.env
   ```

3. **Start Development**
   ```bash
   ./scripts/start-dev.sh
   ```

4. **Access Services**
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:3000
   - Agent Service: http://localhost:5000

---

## Key Features

### v1.0 (Current Plan)
- ✅ Garmin MCP integration
- ✅ Multi-agent analysis system
- ✅ Training plan generation (10K, Half, Marathon)
- ✅ Coaching narrative generation
- ✅ Run classification and analysis
- ✅ Fitness trend tracking
- ✅ Safety-constrained planning

### v1.1 (Future)
- Auto-sync with Garmin
- Weekly plan adaptation
- Vault-based credential management
- Enhanced observability

### v2.0 (Future)
- Multi-sport support
- Advanced fatigue modeling
- Social features
- Mobile app

---

## Documentation

All documentation is available in the project:

1. **[`sports_app_spec.md`](sports_app_spec.md)** - Original specification
2. **[`DEVELOPMENT_PLAN.md`](DEVELOPMENT_PLAN.md)** - Detailed development plan with architecture
3. **[`CONFIG_TEMPLATES.md`](CONFIG_TEMPLATES.md)** - Complete configuration templates
4. **[`IMPLEMENTATION_GUIDE.md`](IMPLEMENTATION_GUIDE.md)** - Step-by-step implementation guide
5. **[`PROJECT_SUMMARY.md`](PROJECT_SUMMARY.md)** - This document

---

## Technology Stack Summary

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | React + TypeScript + Vite | User interface |
| API | Node.js + Express | REST API server |
| Agents | Python + LangGraph | Multi-agent orchestration |
| LLM | OpenAI GPT-4 Turbo | AI analysis and generation |
| Database | SQLite | Data persistence |
| Integration | Garmin MCP Server | Garmin data access |
| Testing | Jest + Pytest | Unit and integration tests |
| Deployment | Docker (optional) | Containerization |

---

## Security Considerations

### Current Implementation (v1)
1. **Credentials:** Text file with chmod 600
2. **API Keys:** Environment variables
3. **Tokens:** Encrypted in database (AES-256-GCM)
4. **Transport:** HTTPS in production
5. **Rate Limiting:** Enabled on all endpoints
6. **CORS:** Configured for specific origins

### Best Practices
- Never commit credentials to version control
- Use strong encryption keys
- Implement proper session management
- Regular security audits
- Keep dependencies updated

---

## Observability

### Logging
- Structured JSON logs
- Correlation IDs for request tracing
- Log levels: DEBUG, INFO, WARN, ERROR
- Automatic log rotation

### Monitoring
- Agent execution metrics
- API response times
- Database query performance
- Token usage and costs
- Error rates and types

### Tracking
- Prompt versions
- Model versions
- Data quality flags
- User actions

---

## Next Steps

1. **Review Planning Documents**
   - Read through all planning documents
   - Clarify any questions
   - Approve the architecture

2. **Environment Setup**
   - Run `./scripts/setup.sh`
   - Configure credentials
   - Test Garmin MCP connection

3. **Begin Implementation**
   - Start with Phase 1 (Foundation)
   - Follow the implementation guide
   - Test each module before proceeding

4. **Iterative Development**
   - Complete one phase at a time
   - Test thoroughly at each stage
   - Document any deviations from plan

---

## Support and Resources

### Documentation
- LangGraph: https://langchain-ai.github.io/langgraph/
- OpenAI API: https://platform.openai.com/docs
- Express.js: https://expressjs.com/
- React: https://react.dev/

### Project Files
- All configuration templates in `CONFIG_TEMPLATES.md`
- Code examples in `IMPLEMENTATION_GUIDE.md`
- Architecture diagrams in `DEVELOPMENT_PLAN.md`

---

## Notes

- **Modularity:** Each service is independently deployable
- **Scalability:** Easy migration to PostgreSQL and microservices
- **Extensibility:** LLM provider abstraction allows easy switching
- **Security:** Designed for vault migration from day one
- **Observability:** Built-in logging and tracking
- **Testing:** Comprehensive test strategy included

---

## Success Criteria

The project will be considered successful when:

1. ✅ User can connect Garmin account via MCP
2. ✅ System analyzes runs using multi-agent workflow
3. ✅ Coaching narrative is generated and displayed
4. ✅ Training plans are created with safety constraints
5. ✅ All data is properly stored and versioned
6. ✅ System is observable and debuggable
7. ✅ Security best practices are implemented
8. ✅ Documentation is complete and accurate

---

**Ready to build an amazing running coach app! 🏃‍♂️💪**