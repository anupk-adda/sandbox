/**
 * Agent Service Client
 * Handles communication with the Python agent service
 */
import { logger } from '../../utils/logger.js';
export class AgentClient {
    baseUrl;
    timeout;
    constructor(config) {
        this.baseUrl = config?.baseUrl || process.env.AGENT_SERVICE_URL || 'http://localhost:5001';
        this.timeout = config?.timeout || 180000; // 180 seconds (3 minutes) - Agent 3 needs ~2 min for 10 runs
    }
    /**
     * Analyze the user's latest run
     */
    async analyzeLastRun(userId) {
        logger.info('Calling agent service: analyze latest run', { userId });
        try {
            const headers = {
                'Content-Type': 'application/json',
            };
            if (userId) {
                headers['X-User-ID'] = userId;
            }
            const response = await fetch(`${this.baseUrl}/analyze-latest-run`, {
                method: 'POST',
                headers,
                signal: AbortSignal.timeout(this.timeout),
            });
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || `Agent service error: ${response.status}`);
            }
            const data = await response.json();
            logger.info('Agent service response received', {
                agent: data.analysis?.agent,
                hasError: !!data.analysis?.error
            });
            return data.analysis;
        }
        catch (error) {
            logger.error('Error calling agent service', { error });
            throw error;
        }
    }
    /**
     * Analyze the user's recent runs (last 3)
     */
    async analyzeRecentRuns(userId) {
        logger.info('Calling agent service: analyze recent runs', { userId });
        try {
            const headers = {
                'Content-Type': 'application/json',
            };
            if (userId) {
                headers['X-User-ID'] = userId;
            }
            const response = await fetch(`${this.baseUrl}/analyze-recent-runs`, {
                method: 'POST',
                headers,
                signal: AbortSignal.timeout(this.timeout),
            });
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || `Agent service error: ${response.status}`);
            }
            const data = await response.json();
            logger.info('Agent service response received', {
                agent: data.analysis?.agent,
                hasError: !!data.analysis?.error
            });
            return data.analysis;
        }
        catch (error) {
            logger.error('Error calling agent service', { error });
            throw error;
        }
    }
    /**
     * Analyze the user's fitness trend (3 months)
     */
    async analyzeFitnessTrend(numRuns = 8, userId) {
        logger.info('Calling agent service: analyze fitness trend', { userId });
        const cappedRuns = Math.min(Math.max(numRuns, 1), 8);
        try {
            const headers = {
                'Content-Type': 'application/json',
            };
            if (userId) {
                headers['X-User-ID'] = userId;
            }
            const response = await fetch(`${this.baseUrl}/analyze-fitness-trends?num_runs=${encodeURIComponent(cappedRuns)}`, {
                method: 'POST',
                headers,
                signal: AbortSignal.timeout(this.timeout),
            });
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || `Agent service error: ${response.status}`);
            }
            const data = await response.json();
            logger.info('Agent service response received', {
                agent: data.analysis?.agent,
                hasError: !!data.analysis?.error
            });
            return data.analysis;
        }
        catch (error) {
            logger.error('Error calling agent service', { error });
            throw error;
        }
    }
    /**
     * Ask the coach agent a general running question
     */
    async askCoach(question) {
        logger.info('Calling agent service: coach question');
        try {
            const response = await fetch(`${this.baseUrl}/coach?question=${encodeURIComponent(question)}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                signal: AbortSignal.timeout(30000), // 30 seconds for general questions
            });
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || `Agent service error: ${response.status}`);
            }
            const data = await response.json();
            logger.info('Coach agent response received', {
                agent: data.analysis?.agent,
                hasError: !!data.analysis?.error
            });
            return data.analysis;
        }
        catch (error) {
            logger.error('Error calling coach agent', { error });
            throw error;
        }
    }
    /**
     * Ask the coach Q&A agent with optional context
     */
    async askCoachWithContext(question, context, activityId, options) {
        logger.info('Calling agent service: coach question with context');
        try {
            const response = await fetch(`${this.baseUrl}/ask-coach`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    question,
                    context,
                    activity_id: activityId,
                    force_answer: options?.force_answer || false,
                }),
                signal: AbortSignal.timeout(30000),
            });
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || `Agent service error: ${response.status}`);
            }
            const data = await response.json();
            if (data.status && data.status !== 'success') {
                return {
                    agent: data.agent || 'CoachQAAgent',
                    analysis: data.answer || '',
                    error: data.error || 'Coach agent returned an error',
                    raw_analysis: data.raw_analysis,
                };
            }
            return {
                agent: data.agent || 'CoachQAAgent',
                analysis: data.answer || data.analysis || '',
                raw_analysis: data.raw_analysis,
            };
        }
        catch (error) {
            logger.error('Error calling coach Q&A agent', { error });
            throw error;
        }
    }
    /**
     * Get running conditions based on user location
     */
    async getRunningConditions(latitude, longitude) {
        logger.info('Calling agent service: running conditions');
        try {
            const response = await fetch(`${this.baseUrl}/running-conditions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ latitude, longitude }),
                signal: AbortSignal.timeout(15000),
            });
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || `Agent service error: ${response.status}`);
            }
            const data = await response.json();
            return data.analysis;
        }
        catch (error) {
            logger.error('Error calling running conditions agent', { error });
            throw error;
        }
    }
    /**
     * LLM-based intent classification
     */
    async classifyIntent(message, context) {
        logger.info('Calling agent service: classify intent');
        const response = await fetch(`${this.baseUrl}/classify-intent`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ message, context }),
            signal: AbortSignal.timeout(8000),
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || `Agent service error: ${response.status}`);
        }
        return await response.json();
    }
    /**
     * Generate an adaptive training plan using the agent service
     */
    async generateTrainingPlan(payload) {
        logger.info('Calling agent service: generate plan');
        const response = await fetch(`${this.baseUrl}/generate-plan`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(this.timeout),
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || `Agent service error: ${response.status}`);
        }
        const data = await response.json();
        if (data.status && data.status !== 'success') {
            throw new Error(data.error || 'Agent service returned an error');
        }
        return data.plan;
    }
    /**
     * Health check for agent service
     */
    async healthCheck() {
        try {
            const response = await fetch(`${this.baseUrl}/health`, {
                signal: AbortSignal.timeout(5000),
            });
            return response.ok;
        }
        catch {
            return false;
        }
    }
    /**
     * Reset the Garmin MCP client singleton
     * Call this when a user disconnects their Garmin account
     */
    async resetGarminClient() {
        logger.info('Calling agent service: reset Garmin client');
        try {
            const response = await fetch(`${this.baseUrl}/reset-garmin-client`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                signal: AbortSignal.timeout(10000),
            });
            if (!response.ok) {
                const error = await response.json();
                logger.warn('Failed to reset Garmin client on agent service', { error });
                return { success: false, message: error.detail || 'Failed to reset Garmin client' };
            }
            const data = await response.json();
            logger.info('Garmin client reset successfully', { message: data.message });
            return { success: true, message: data.message };
        }
        catch (error) {
            logger.error('Error resetting Garmin client', { error });
            return { success: false, message: 'Failed to reset Garmin client' };
        }
    }
}
export const agentClient = new AgentClient();
// Made with Bob
//# sourceMappingURL=agent-client.js.map