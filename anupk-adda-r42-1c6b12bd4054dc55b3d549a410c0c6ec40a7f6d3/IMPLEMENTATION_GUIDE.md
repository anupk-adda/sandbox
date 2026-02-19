# Implementation Guide - Running Coach App

This guide provides detailed implementation instructions, code examples, and best practices for building the Running Coach application.

---

## Table of Contents

1. [Project Setup](#1-project-setup)
2. [Configuration System](#2-configuration-system)
3. [Database Implementation](#3-database-implementation)
4. [Backend API](#4-backend-api)
5. [Agent Service](#5-agent-service)
6. [Frontend Application](#6-frontend-application)
7. [Testing Strategy](#7-testing-strategy)
8. [Deployment](#8-deployment)

---

## 1. Project Setup

### 1.1 Initialize Project Structure

```bash
# Create root directory
mkdir running-coach-app
cd running-coach-app

# Create main directories
mkdir -p frontend backend agent-service config database docs scripts

# Initialize Git
git init
echo "node_modules/\n.env\n*.log\nconfig/garmin.credentials.txt\ndatabase/*.db" > .gitignore

# Create README
cat > README.md << 'EOF'
# Running Coach App

AI-powered running coach with multi-agent analysis system.

## Quick Start

1. Install dependencies: `./scripts/setup.sh`
2. Configure credentials: Edit `config/garmin.credentials.txt`
3. Start services: `./scripts/start-dev.sh`

## Documentation

- [Development Plan](DEVELOPMENT_PLAN.md)
- [Configuration Templates](CONFIG_TEMPLATES.md)
- [Implementation Guide](IMPLEMENTATION_GUIDE.md)
EOF
```

### 1.2 Setup Script

**File:** `scripts/setup.sh`

```bash
#!/bin/bash

echo "🏃 Setting up Running Coach App..."

# Check prerequisites
command -v node >/dev/null 2>&1 || { echo "Node.js is required but not installed."; exit 1; }
command -v python3 >/dev/null 2>&1 || { echo "Python 3 is required but not installed."; exit 1; }

# Setup Backend
echo "📦 Setting up Backend..."
cd backend
npm init -y
npm install express cors dotenv sqlite3 axios winston helmet express-rate-limit
npm install --save-dev typescript @types/node @types/express @types/cors ts-node nodemon jest @types/jest
npx tsc --init
cd ..

# Setup Frontend
echo "⚛️  Setting up Frontend..."
cd frontend
npm create vite@latest . -- --template react-ts
npm install axios recharts date-fns lucide-react
npm install --save-dev @types/node
cd ..

# Setup Agent Service
echo "🤖 Setting up Agent Service..."
cd agent-service
python3 -m venv venv
source venv/bin/activate
pip install langgraph langchain langchain-openai pydantic fastapi uvicorn python-dotenv
pip install --dev pytest pytest-asyncio black flake8
cd ..

# Create config directory
echo "⚙️  Creating configuration files..."
mkdir -p config
cp CONFIG_TEMPLATES.md config/README.md

# Create database directory
echo "💾 Setting up database..."
mkdir -p database/migrations database/backups

# Set permissions
chmod +x scripts/*.sh
chmod 600 config/garmin.credentials.txt 2>/dev/null || true

echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Configure your credentials in config/"
echo "2. Run './scripts/start-dev.sh' to start all services"
```

---

## 2. Configuration System

### 2.1 Configuration Loader (Node.js)

**File:** `backend/src/config/config-loader.ts`

```typescript
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

interface AppConfig {
  app: {
    name: string;
    version: string;
    environment: string;
  };
  api: {
    port: number;
    host: string;
    baseUrl: string;
  };
  agentService: {
    host: string;
    port: number;
    protocol: string;
  };
  database: {
    type: string;
    path: string;
  };
  mcp: {
    garmin: {
      command: string;
      args: string[];
      timeout: number;
    };
  };
}

class ConfigLoader {
  private config: AppConfig | null = null;

  load(): AppConfig {
    if (this.config) {
      return this.config;
    }

    const configPath = path.join(process.cwd(), '../config/app.config.json');
    const configFile = fs.readFileSync(configPath, 'utf-8');
    const rawConfig = JSON.parse(configFile);

    // Replace environment variables
    this.config = this.replaceEnvVars(rawConfig);
    
    // Validate configuration
    this.validate(this.config);

    return this.config;
  }

  private replaceEnvVars(obj: any): any {
    if (typeof obj === 'string') {
      const match = obj.match(/\$\{([^}]+)\}/);
      if (match) {
        const envVar = match[1];
        return process.env[envVar] || obj;
      }
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.replaceEnvVars(item));
    }

    if (typeof obj === 'object' && obj !== null) {
      const result: any = {};
      for (const key in obj) {
        result[key] = this.replaceEnvVars(obj[key]);
      }
      return result;
    }

    return obj;
  }

  private validate(config: AppConfig): void {
    if (!config.api.port) {
      throw new Error('API port is required');
    }
    if (!config.database.path) {
      throw new Error('Database path is required');
    }
    // Add more validations as needed
  }
}

export const configLoader = new ConfigLoader();
export const getConfig = () => configLoader.load();
```

### 2.2 Garmin Credentials Parser

**File:** `backend/src/config/garmin-credentials.ts`

```typescript
import fs from 'fs';
import path from 'path';

interface GarminCredentials {
  consumerKey: string;
  consumerSecret: string;
  accessToken?: string;
  accessTokenSecret?: string;
  tokenExpiry?: string;
  userId?: string;
  userEmail?: string;
}

export class GarminCredentialsManager {
  private credentialsPath: string;

  constructor() {
    this.credentialsPath = path.join(
      process.cwd(),
      '../config/garmin.credentials.txt'
    );
  }

  load(): GarminCredentials {
    const content = fs.readFileSync(this.credentialsPath, 'utf-8');
    const credentials: GarminCredentials = {
      consumerKey: '',
      consumerSecret: '',
    };

    const lines = content.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('#') || !trimmed.includes('=')) {
        continue;
      }

      const [key, value] = trimmed.split('=').map(s => s.trim());
      
      switch (key) {
        case 'GARMIN_CONSUMER_KEY':
          credentials.consumerKey = value;
          break;
        case 'GARMIN_CONSUMER_SECRET':
          credentials.consumerSecret = value;
          break;
        case 'GARMIN_ACCESS_TOKEN':
          credentials.accessToken = value || undefined;
          break;
        case 'GARMIN_ACCESS_TOKEN_SECRET':
          credentials.accessTokenSecret = value || undefined;
          break;
        case 'GARMIN_TOKEN_EXPIRY':
          credentials.tokenExpiry = value || undefined;
          break;
        case 'GARMIN_USER_ID':
          credentials.userId = value || undefined;
          break;
        case 'GARMIN_USER_EMAIL':
          credentials.userEmail = value || undefined;
          break;
      }
    }

    if (!credentials.consumerKey || !credentials.consumerSecret) {
      throw new Error('Garmin consumer key and secret are required');
    }

    return credentials;
  }

  update(credentials: Partial<GarminCredentials>): void {
    const current = this.load();
    const updated = { ...current, ...credentials };

    const lines: string[] = [
      '# Garmin OAuth Credentials',
      '# Auto-updated by MCP server',
      '',
      `GARMIN_CONSUMER_KEY=${updated.consumerKey}`,
      `GARMIN_CONSUMER_SECRET=${updated.consumerSecret}`,
      `GARMIN_ACCESS_TOKEN=${updated.accessToken || ''}`,
      `GARMIN_ACCESS_TOKEN_SECRET=${updated.accessTokenSecret || ''}`,
      `GARMIN_TOKEN_EXPIRY=${updated.tokenExpiry || ''}`,
      `GARMIN_USER_ID=${updated.userId || ''}`,
      `GARMIN_USER_EMAIL=${updated.userEmail || ''}`,
      '',
      `# Last Updated: ${new Date().toISOString()}`,
    ];

    fs.writeFileSync(this.credentialsPath, lines.join('\n'), 'utf-8');
  }
}
```

---

## 3. Database Implementation

### 3.1 Database Schema

**File:** `database/schema.sql`

```sql
-- Enable foreign keys
PRAGMA foreign_keys = ON;

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    garmin_user_id TEXT UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    preferences TEXT DEFAULT '{}'
);

-- Run Activities table
CREATE TABLE IF NOT EXISTS run_activities (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    garmin_activity_id TEXT UNIQUE NOT NULL,
    activity_date TIMESTAMP NOT NULL,
    distance_meters REAL,
    duration_seconds INTEGER,
    avg_pace_min_per_km REAL,
    avg_heart_rate INTEGER,
    max_heart_rate INTEGER,
    avg_cadence INTEGER,
    avg_power REAL,
    elevation_gain_meters REAL,
    run_type TEXT,
    raw_data TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Fitness Metric Snapshots table
CREATE TABLE IF NOT EXISTS fitness_metric_snapshots (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    snapshot_date TIMESTAMP NOT NULL,
    vo2_max REAL,
    training_load REAL,
    recovery_time_hours INTEGER,
    fitness_age INTEGER,
    raw_metrics TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Analysis Reports table
CREATE TABLE IF NOT EXISTS analysis_reports (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    report_type TEXT NOT NULL,
    activity_id TEXT,
    analysis_date TIMESTAMP NOT NULL,
    agent_outputs TEXT NOT NULL,
    coaching_narrative TEXT,
    key_insights TEXT,
    version TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (activity_id) REFERENCES run_activities(id) ON DELETE SET NULL
);

-- Training Plans table
CREATE TABLE IF NOT EXISTS training_plans (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    plan_type TEXT NOT NULL,
    goal_distance TEXT NOT NULL,
    goal_date DATE,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    phases TEXT NOT NULL,
    weekly_structure TEXT NOT NULL,
    safety_constraints TEXT NOT NULL,
    status TEXT DEFAULT 'active',
    version TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Agent Execution Logs table
CREATE TABLE IF NOT EXISTS agent_execution_logs (
    id TEXT PRIMARY KEY,
    report_id TEXT,
    agent_name TEXT NOT NULL,
    execution_start TIMESTAMP NOT NULL,
    execution_end TIMESTAMP,
    status TEXT NOT NULL,
    input_data TEXT,
    output_data TEXT,
    error_message TEXT,
    prompt_version TEXT,
    model_version TEXT,
    token_usage TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (report_id) REFERENCES analysis_reports(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_run_activities_user_date 
    ON run_activities(user_id, activity_date DESC);

CREATE INDEX IF NOT EXISTS idx_fitness_snapshots_user_date 
    ON fitness_metric_snapshots(user_id, snapshot_date DESC);

CREATE INDEX IF NOT EXISTS idx_analysis_reports_user_date 
    ON analysis_reports(user_id, analysis_date DESC);

CREATE INDEX IF NOT EXISTS idx_training_plans_user_status 
    ON training_plans(user_id, status);

CREATE INDEX IF NOT EXISTS idx_agent_logs_report 
    ON agent_execution_logs(report_id);

-- Triggers for updated_at
CREATE TRIGGER IF NOT EXISTS update_users_timestamp 
    AFTER UPDATE ON users
    FOR EACH ROW
    BEGIN
        UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_training_plans_timestamp 
    AFTER UPDATE ON training_plans
    FOR EACH ROW
    BEGIN
        UPDATE training_plans SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;
```

### 3.2 Database Service

**File:** `backend/src/services/database/database-service.ts`

```typescript
import sqlite3 from 'sqlite3';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

export class DatabaseService {
  private db: sqlite3.Database | null = null;

  async connect(dbPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
          reject(err);
        } else {
          console.log('Connected to SQLite database');
          this.initialize().then(resolve).catch(reject);
        }
      });
    });
  }

  private async initialize(): Promise<void> {
    const schemaPath = path.join(process.cwd(), '../database/schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf-8');
    
    await this.exec(schema);
  }

  async exec(sql: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db!.exec(sql, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async run(sql: string, params: any[] = []): Promise<sqlite3.RunResult> {
    return new Promise((resolve, reject) => {
      this.db!.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve(this);
      });
    });
  }

  async get<T>(sql: string, params: any[] = []): Promise<T | undefined> {
    return new Promise((resolve, reject) => {
      this.db!.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row as T);
      });
    });
  }

  async all<T>(sql: string, params: any[] = []): Promise<T[]> {
    return new Promise((resolve, reject) => {
      this.db!.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows as T[]);
      });
    });
  }

  async close(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.db) {
        this.db.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      } else {
        resolve();
      }
    });
  }

  // Helper method to generate UUIDs
  generateId(): string {
    return uuidv4();
  }
}

export const databaseService = new DatabaseService();
```

---

## 4. Backend API

### 4.1 Express Server Setup

**File:** `backend/src/server.ts`

```typescript
import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { getConfig } from './config/config-loader';
import { databaseService } from './services/database/database-service';
import { errorHandler } from './middleware/error-handler';
import { logger } from './utils/logger';

// Import routes
import authRoutes from './routes/auth.routes';
import activityRoutes from './routes/activity.routes';
import analysisRoutes from './routes/analysis.routes';
import trainingPlanRoutes from './routes/training-plan.routes';

class Server {
  private app: Express;
  private config: ReturnType<typeof getConfig>;

  constructor() {
    this.app = express();
    this.config = getConfig();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  private setupMiddleware(): void {
    // Security
    this.app.use(helmet());
    
    // CORS
    this.app.use(cors({
      origin: this.config.api.cors.origins,
      credentials: this.config.api.cors.credentials,
    }));

    // Rate limiting
    const limiter = rateLimit({
      windowMs: this.config.api.rateLimit.windowMs,
      max: this.config.api.rateLimit.maxRequests,
    });
    this.app.use(limiter);

    // Body parsing
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));

    // Request logging
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      logger.info(`${req.method} ${req.path}`);
      next();
    });
  }

  private setupRoutes(): void {
    const baseUrl = this.config.api.baseUrl;

    // Health check
    this.app.get('/health', (req: Request, res: Response) => {
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });

    // API routes
    this.app.use(`${baseUrl}/auth`, authRoutes);
    this.app.use(`${baseUrl}/activities`, activityRoutes);
    this.app.use(`${baseUrl}/analysis`, analysisRoutes);
    this.app.use(`${baseUrl}/training-plans`, trainingPlanRoutes);

    // 404 handler
    this.app.use((req: Request, res: Response) => {
      res.status(404).json({ error: 'Not found' });
    });
  }

  private setupErrorHandling(): void {
    this.app.use(errorHandler);
  }

  async start(): Promise<void> {
    try {
      // Connect to database
      await databaseService.connect(this.config.database.path);

      // Start server
      this.app.listen(this.config.api.port, this.config.api.host, () => {
        logger.info(
          `Server running on http://${this.config.api.host}:${this.config.api.port}`
        );
      });
    } catch (error) {
      logger.error('Failed to start server:', error);
      process.exit(1);
    }
  }
}

// Start server
const server = new Server();
server.start();
```

### 4.2 MCP Client Implementation

**File:** `backend/src/services/mcp-client/garmin-client.ts`

```typescript
import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import { getConfig } from '../../config/config-loader';
import { logger } from '../../utils/logger';

interface MCPRequest {
  id: string;
  method: string;
  params?: any;
}

interface MCPResponse {
  id: string;
  result?: any;
  error?: {
    code: number;
    message: string;
  };
}

export class GarminMCPClient extends EventEmitter {
  private process: ChildProcess | null = null;
  private connected: boolean = false;
  private requestQueue: Map<string, (response: MCPResponse) => void> = new Map();
  private config = getConfig();

  async connect(): Promise<void> {
    if (this.connected) {
      return;
    }

    const { command, args } = this.config.mcp.garmin;

    this.process = spawn(command, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    this.process.stdout?.on('data', (data) => {
      this.handleResponse(data.toString());
    });

    this.process.stderr?.on('data', (data) => {
      logger.error('MCP Server Error:', data.toString());
    });

    this.process.on('close', (code) => {
      logger.info(`MCP Server exited with code ${code}`);
      this.connected = false;
    });

    this.connected = true;
    logger.info('Connected to Garmin MCP Server');
  }

  async disconnect(): Promise<void> {
    if (this.process) {
      this.process.kill();
      this.process = null;
      this.connected = false;
    }
  }

  private handleResponse(data: string): void {
    try {
      const response: MCPResponse = JSON.parse(data);
      const callback = this.requestQueue.get(response.id);
      
      if (callback) {
        callback(response);
        this.requestQueue.delete(response.id);
      }
    } catch (error) {
      logger.error('Failed to parse MCP response:', error);
    }
  }

  private async sendRequest(method: string, params?: any): Promise<any> {
    if (!this.connected) {
      throw new Error('MCP client not connected');
    }

    const id = Math.random().toString(36).substring(7);
    const request: MCPRequest = { id, method, params };

    return new Promise((resolve, reject) => {
      this.requestQueue.set(id, (response: MCPResponse) => {
        if (response.error) {
          reject(new Error(response.error.message));
        } else {
          resolve(response.result);
        }
      });

      this.process?.stdin?.write(JSON.stringify(request) + '\n');

      // Timeout
      setTimeout(() => {
        if (this.requestQueue.has(id)) {
          this.requestQueue.delete(id);
          reject(new Error('Request timeout'));
        }
      }, this.config.mcp.garmin.timeout);
    });
  }

  async getActivities(startDate: Date, endDate: Date): Promise<any[]> {
    return this.sendRequest('getActivities', {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    });
  }

  async getActivity(activityId: string): Promise<any> {
    return this.sendRequest('getActivity', { activityId });
  }

  async getFitnessMetrics(): Promise<any> {
    return this.sendRequest('getFitnessMetrics');
  }

  async syncLatestActivities(): Promise<any[]> {
    return this.sendRequest('syncLatestActivities');
  }
}

export const garminClient = new GarminMCPClient();
```

---

## 5. Agent Service

### 5.1 LangGraph Orchestration

**File:** `agent-service/src/orchestration/graph.py`

```python
from typing import TypedDict, List, Annotated
from langgraph.graph import StateGraph, END
from langchain_core.messages import BaseMessage
import operator

from ..agents.current_run_analyzer import CurrentRunAnalyzer
from ..agents.recent_runs_comparator import RecentRunsComparator
from ..agents.fitness_trend_analyzer import FitnessTrendAnalyzer
from ..agents.coach_agent import CoachAgent
from ..schemas.analysis import (
    RunActivity,
    FitnessMetrics,
    CurrentRunAnalysis,
    RecentRunsComparison,
    FitnessTrendAnalysis,
    CoachingReport
)

class WorkflowState(TypedDict):
    """State for the coaching workflow"""
    current_run_data: RunActivity
    recent_runs_data: List[RunActivity]
    fitness_trend_data: FitnessMetrics
    agent1_output: CurrentRunAnalysis | None
    agent2_output: RecentRunsComparison | None
    agent3_output: FitnessTrendAnalysis | None
    coach_output: CoachingReport | None
    messages: Annotated[List[BaseMessage], operator.add]

class CoachingWorkflow:
    """LangGraph workflow for multi-agent coaching analysis"""
    
    def __init__(self):
        self.agent1 = CurrentRunAnalyzer()
        self.agent2 = RecentRunsComparator()
        self.agent3 = FitnessTrendAnalyzer()
        self.coach = CoachAgent()
        self.graph = self._build_graph()
    
    def _build_graph(self) -> StateGraph:
        """Build the LangGraph workflow"""
        workflow = StateGraph(WorkflowState)
        
        # Add nodes
        workflow.add_node("agent1", self._run_agent1)
        workflow.add_node("agent2", self._run_agent2)
        workflow.add_node("agent3", self._run_agent3)
        workflow.add_node("coach", self._run_coach)
        
        # Set entry point
        workflow.set_entry_point("agent1")
        
        # Add edges for parallel execution
        workflow.add_edge("agent1", "agent2")
        workflow.add_edge("agent1", "agent3")
        
        # Both agent2 and agent3 lead to coach
        workflow.add_edge("agent2", "coach")
        workflow.add_edge("agent3", "coach")
        
        # Coach is the end
        workflow.add_edge("coach", END)
        
        return workflow.compile()
    
    def _run_agent1(self, state: WorkflowState) -> WorkflowState:
        """Execute Agent 1: Current Run Analyzer"""
        result = self.agent1.execute(state["current_run_data"])
        state["agent1_output"] = result
        return state
    
    def _run_agent2(self, state: WorkflowState) -> WorkflowState:
        """Execute Agent 2: Recent Runs Comparator"""
        result = self.agent2.execute(
            state["recent_runs_data"],
            state["current_run_data"]
        )
        state["agent2_output"] = result
        return state
    
    def _run_agent3(self, state: WorkflowState) -> WorkflowState:
        """Execute Agent 3: Fitness Trend Analyzer"""
        result = self.agent3.execute(state["fitness_trend_data"])
        state["agent3_output"] = result
        return state
    
    def _run_coach(self, state: WorkflowState) -> WorkflowState:
        """Execute Coach Agent"""
        result = self.coach.execute(
            state["agent1_output"],
            state["agent2_output"],
            state["agent3_output"]
        )
        state["coach_output"] = result
        return state
    
    async def execute(self, input_data: dict) -> CoachingReport:
        """Execute the workflow"""
        initial_state: WorkflowState = {
            "current_run_data": input_data["current_run"],
            "recent_runs_data": input_data["recent_runs"],
            "fitness_trend_data": input_data["fitness_metrics"],
            "agent1_output": None,
            "agent2_output": None,
            "agent3_output": None,
            "coach_output": None,
            "messages": []
        }
        
        final_state = await self.graph.ainvoke(initial_state)
        return final_state["coach_output"]
```

### 5.2 Agent Implementation Example

**File:** `agent-service/src/agents/current_run_analyzer.py`

```python
from typing import Dict, Any
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from pydantic import BaseModel, Field

from ..llm.openai_provider import OpenAIProvider
from ..schemas.analysis import RunActivity, CurrentRunAnalysis, RunType

class CurrentRunAnalyzer:
    """Agent 1: Analyzes a single run activity"""
    
    def __init__(self):
        self.llm_provider = OpenAIProvider()
        self.system_prompt = """You are an expert running coach analyzing a single run activity.
        
Your task is to:
1. Classify the run type (easy, tempo, interval, long, recovery)
2. Analyze pacing consistency and strategy
3. Evaluate heart rate response and drift
4. Assess cadence and power metrics
5. Identify execution quality and areas for improvement

Provide specific, actionable insights based on the data."""
    
    def execute(self, activity: RunActivity) -> CurrentRunAnalysis:
        """Analyze a single run activity"""
        
        # Prepare the prompt
        prompt = self._create_prompt(activity)
        
        # Call LLM with structured output
        response = self.llm_provider.generate(
            prompt=prompt,
            system_prompt=self.system_prompt,
            response_model=CurrentRunAnalysis
        )
        
        return response
    
    def _create_prompt(self, activity: RunActivity) -> str:
        """Create analysis prompt from activity data"""
        return f"""Analyze this running activity:

Distance: {activity.distance_meters / 1000:.2f} km
Duration: {activity.duration_seconds // 60} minutes
Average Pace: {activity.avg_pace_min_per_km:.2f} min/km
Average Heart Rate: {activity.avg_heart_rate} bpm
Max Heart Rate: {activity.max_heart_rate} bpm
Average Cadence: {activity.avg_cadence} spm
Elevation Gain: {activity.elevation_gain_meters} m

Provide a comprehensive analysis including:
1. Run type classification
2. Pacing analysis
3. Heart rate analysis
4. Biomechanics assessment
5. Overall execution quality
6. Key observations and recommendations"""
    
    def classify_run_type(self, activity: RunActivity) -> RunType:
        """Classify the type of run based on metrics"""
        # Simple heuristic-based classification
        pace = activity.avg_pace_min_per_km
        hr = activity.avg_heart_rate
        distance = activity.distance_meters / 1000
        
        if pace > 6.5:
            return RunType.RECOVERY
        elif distance > 15:
            return RunType.LONG
        elif hr > 170:
            return RunType.INTERVAL
        elif pace < 5.0:
            return RunType.TEMPO
        else:
            return RunType.EASY
```

---

## 6. Frontend Application

### 6.1 API Client Service

**File:** `frontend/src/services/api-client.ts`

```typescript
import axios, { AxiosInstance } from 'axios';

class APIClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1',
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('auth_token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          // Handle unauthorized
          localStorage.removeItem('auth_token');
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );
  }

  // Activities
  async getActivities(startDate?: Date, endDate?: Date) {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate.toISOString());
    if (endDate) params.append('endDate', endDate.toISOString());
    
    const response = await this.client.get(`/activities?${params}`);
    return response.data;
  }

  async getActivity(id: string) {
    const response = await this.client.get(`/activities/${id}`);
    return response.data;
  }

  async syncActivities() {
    const response = await this.client.post('/activities/sync');
    return response.data;
  }

  // Analysis
  async analyzeRun(activityId: string) {
    const response = await this.client.post('/analysis/run', { activityId });
    return response.data;
  }

  async getAnalysis(id: string) {
    const response = await this.client.get(`/analysis/${id}`);
    return response.data;
  }

  // Training Plans
  async getTrainingPlans() {
    const response = await this.client.get('/training-plans');
    return response.data;
  }

  async generateTrainingPlan(goal: string, targetDate: Date) {
    const response = await this.client.post('/training-plans/generate', {
      goal,
      targetDate: targetDate.toISOString(),
    });
    return response.data;
  }
}

export const apiClient = new APIClient();
```

---

## 7. Testing Strategy

### 7.1 Backend Unit Tests

**File:** `backend/tests/services/database-service.test.ts`

```typescript
import { DatabaseService } from '../../src/services/database/database-service';
import fs from 'fs';
import path from 'path';

describe('DatabaseService', () => {
  let dbService: DatabaseService;
  const testDbPath = path.join(__dirname, 'test.db');

  beforeEach(async () => {
    dbService = new DatabaseService();
    await dbService.connect(testDbPath);
  });

  afterEach(async () => {
    await dbService.close();
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  test('should connect to database', async () => {
    expect(dbService).toBeDefined();
  });

  test('should create user', async () => {
    const userId = dbService.generateId();
    await dbService.run(
      'INSERT INTO users (id, email) VALUES (?, ?)',
      [userId, 'test@example.com']
    );

    const user = await dbService.get(
      'SELECT * FROM users WHERE id = ?',
      [userId]
    );

    expect(user).toBeDefined();
    expect(user.email).toBe('test@example.com');
  });
});
```

### 7.2 Agent Integration Tests

**File:** `agent-service/tests/test_workflow.py`

```python
import pytest
from src.orchestration.graph import CoachingWorkflow
from src.schemas.analysis import RunActivity, FitnessMetrics

@pytest.mark.asyncio
async def test_coaching_workflow():
    """Test the complete coaching workflow"""
    workflow = CoachingWorkflow()
    
    # Prepare test data
    input_data = {
        "current_run": RunActivity(
            id="test-1",
            distance_meters=5000,
            duration_seconds=1500,
            avg_pace_min_per_km=5.0,
            avg_heart_rate=150,
            max_heart_rate=165,
            avg_cadence=180,
            elevation_gain_meters=50
        ),
        "recent_runs": [],
        "fitness_metrics": FitnessMetrics(
            vo2_max=50.0,
            training_load=300,
            recovery_time_hours=24
        )
    }
    
    # Execute workflow
    result = await workflow.execute(input_data)
    
    # Assertions
    assert result is not None
    assert result.coaching_narrative is not None
    assert len(result.training_plans) > 0
```

---

## 8. Deployment

### 8.1 Development Startup Script

**File:** `scripts/start-dev.sh`

```bash
#!/bin/bash

echo "🏃 Starting Running Coach App (Development Mode)..."

# Start Backend API
echo "📦 Starting Backend API..."
cd backend
npm run dev &
BACKEND_PID=$!
cd ..

# Start Agent Service
echo "🤖 Starting Agent Service..."
cd agent-service
source venv/bin/activate
python -m uvicorn src.main:app --reload --port 5000 &
AGENT_PID=$!
cd ..

# Start Frontend
echo "⚛️  Starting Frontend..."
cd frontend
npm run dev &
FRONTEND_PID=$!
cd ..

echo ""
echo "✅ All services started!"
echo ""
echo "Services:"
echo "- Frontend: http://localhost:5173"
echo "- Backend API: http://localhost:3000"
echo "- Agent Service: http://localhost:5000"
echo ""
echo "Press Ctrl+C to stop all services"

# Wait for Ctrl+C
trap "kill $BACKEND_PID $AGENT_PID $FRONTEND_PID; exit" INT
wait
```

---

## Next Steps

1. Review this implementation guide
2. Execute setup script: `./scripts/setup.sh`
3. Configure credentials in `config/`
4. Start development: `./scripts/start-dev.sh`
5. Begin implementing modules sequentially

For detailed module specifications, refer to [`DEVELOPMENT_PLAN.md`](DEVELOPMENT_PLAN.md).