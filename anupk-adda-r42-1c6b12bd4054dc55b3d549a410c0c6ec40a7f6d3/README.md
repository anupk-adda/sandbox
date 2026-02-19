# Running Coach App 🏃‍♂️

AI-powered running coach with multi-agent analysis system using LangGraph and Garmin integration.

## Overview

A running-focused sports app that connects to your Garmin account via an MCP server and uses a multi-agent system to analyze your runs and generate personalized training plans.

### Features

- 🔗 Garmin Connect integration via MCP server
- 🤖 Multi-agent AI analysis (LangGraph + OpenAI)
- 📊 Intelligent run classification and analysis
- 📈 Fitness trend tracking (VO2 max, training load)
- 📅 Personalized training plans (10K, Half Marathon, Marathon)
- 🎯 Safety-constrained plan generation
- 💬 Coaching narrative and insights

## Architecture

```
┌─────────────┐
│   React     │  Frontend (Port 5173)
│  Frontend   │
└──────┬──────┘
       │
┌──────▼──────┐
│   Node.js   │  API Server (Port 3000)
│   Express   │
└──────┬──────┘
       │
       ├──────────────┐
       │              │
┌──────▼──────┐  ┌───▼────────┐
│   Python    │  │  Garmin    │
│  LangGraph  │  │    MCP     │
│   Agents    │  │   Server   │
└─────────────┘  └────────────┘
```

## Quick Start

### Prerequisites

- Node.js 18+
- Python 3.10+
- Garmin Connect account
- OpenAI API key

### Installation

1. **Clone and setup**
   ```bash
   git clone <repository>
   cd R42
   chmod +x scripts/*.sh
   ./scripts/setup.sh
   ```

2. **Configure credentials**
   ```bash
   # Copy environment template
   cp config/.env.example config/.env
   
   # Edit with your credentials
   nano config/.env
   nano config/garmin.credentials.txt
   ```

3. **Start development servers**
   ```bash
   ./scripts/start-dev.sh
   ```

4. **Access the application**
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:3000
   - Agent Service: http://localhost:5000
   - API Docs: http://localhost:3000/api/docs

## Project Structure

```
R42/
├── frontend/              # React + TypeScript
├── backend/               # Node.js + Express API
├── agent-service/         # Python + LangGraph
├── config/                # Configuration files
├── database/              # SQLite database
├── docs/                  # Documentation
└── scripts/               # Utility scripts
```

## Documentation

- [Development Plan](DEVELOPMENT_PLAN.md) - Architecture and roadmap
- [Configuration Templates](CONFIG_TEMPLATES.md) - Config file examples
- [Implementation Guide](IMPLEMENTATION_GUIDE.md) - Step-by-step guide
- [Project Summary](PROJECT_SUMMARY.md) - Quick reference

## Development

### Running Individual Services

**Backend API:**
```bash
cd backend
npm run dev
```

**Agent Service:**
```bash
cd agent-service
source venv/bin/activate
python -m uvicorn src.main:app --reload --port 5000
```

**Frontend:**
```bash
cd frontend
npm run dev
```

### Testing

**Backend:**
```bash
cd backend
npm test
```

**Agent Service:**
```bash
cd agent-service
pytest
```

## Configuration

All configuration is in the `config/` directory:

- `app.config.json` - Application settings
- `llm.config.json` - LLM provider configuration
- `garmin.credentials.txt` - Garmin OAuth credentials
- `.env` - Environment variables

See [CONFIG_TEMPLATES.md](CONFIG_TEMPLATES.md) for detailed configuration options.

## Technology Stack

| Component | Technology |
|-----------|-----------|
| Frontend | React, TypeScript, Vite |
| API | Node.js, Express |
| Agents | Python, LangGraph, LangChain |
| LLM | OpenAI GPT-4 Turbo |
| Database | SQLite |
| Integration | Garmin MCP Server |

## Roadmap

### v1.0 (Current)
- ✅ Garmin MCP integration
- ✅ Multi-agent analysis
- ✅ Training plan generation
- ✅ Coaching narratives

### v1.1 (Planned)
- Auto-sync with Garmin
- Weekly plan adaptation
- Vault-based credentials

### v2.0 (Future)
- Multi-sport support
- Advanced fatigue modeling
- Mobile app

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

[Your License Here]

## Support

For issues and questions, please open an issue on GitHub.

---

**Built with ❤️ for runners**# r42x
