/**
 * Intent Classifier
 * Determines user intent from natural language questions
 *
 * Routes to:
 * 1. Agent 1 (Current Run Analyzer) - "Analyze my last run"
 * 2. Agent 2 (Last Runs Comparator) - "Recommend my next run"
 * 3. Agent 3 (Fitness Trend Analyzer) - "Analyze my running progress"
 * 4. Coach Agent (General Questions) - All other running-related questions
 */

export interface Intent {
  type: 'last_run' | 'recent_runs' | 'fitness_trend' | 'weather' | 'training_plan' | 'general' | 'non_running' | 'profanity';
  confidence: number;
  requiresGarminData: boolean;
  keywords: string[];
}

export class IntentClassifier {
  private patterns = {
    // Agent 2: Last Runs Comparator & Next Workout Recommender
    // Exact match: "Recommend my next run"
    recent_runs: [
      /^recommend my next run$/i,  // Exact match for guided prompt
      /^what should i (do|run) next$/i,
      /^when should i run again$/i,
      /^when should i run next$/i,
      /^when to run again$/i,
      /^when is my next run$/i,
      /\brecommend\s+(my\s+)?next\s+(run|workout|training)\b/i,
      /\bwhat\s+(should|do)\s+i\s+(do|run)\s+next\b/i,
      /\bnext\s+(run|workout)\s+recommendation\b/i,
      /\bwhen\s+should\s+i\s+run\s+(again|next)\b/i,
      /\bwhen\s+is\s+my\s+next\s+run\b/i,
    ],

    // Weather / Running Conditions
    weather: [
      /^weather$/i,
      /^running conditions$/i,
      /^running conditions near me$/i,
      /^conditions near me$/i,
      /^weather near me$/i,
      /^is it good to run/i,
      /^can i run/i,
      /\bweather\b/i,
      /\bconditions\b.*\brun\b/i,
      /\brain\b.*\brun\b/i,
      /\btemperature\b.*\brun\b/i,
      /\bwind\b.*\brun\b/i,
    ],

    // Agent 1: Current Run Analyzer
    // Exact match: "Analyze my last run"
    last_run: [
      /^analyze my last run$/i,  // Exact match for guided prompt
      /^analyze my latest run$/i,
      /^when was my last run$/i,
      /^when was my latest run$/i,
      /\bwhen\s+was\s+my\s+(last|latest|most recent)\s+(run|activity|workout)\b/i,
      /\b(analyze|review|check|tell me about)\s+(my\s+)?(last|latest|most recent|current)\s+(run|activity|workout)\b/i,
    ],
    
    // Agent 3: Fitness Trend Analyzer
    // Exact match: "Analyze my running progress"
    fitness_trend: [
      /^analyze my running progress$/i,  // Exact match for guided prompt
      /^how is my progress$/i,
      /^how am i progressing$/i,
      /\banalyze\s+(my\s+)?running\s+progress\b/i,
      /\bhow\s+(is|has been)\s+my\s+(running\s+)?progress\b/i,
      /\b(fitness|training|performance)\s+(trend|progress|trajectory)\b/i,
      /\bam\s+i\s+(getting|becoming)\s+(fitter|better|faster|stronger)\b/i,
    ],
    training_plan: [
      /\b(training\s+plan|plan)\b/i,
      /\b(make|build|create)\b.*\bplan\b/i,
      /\b(5k|10k|half|marathon)\b.*\bplan\b/i,
      /\bplan\b.*\b(5k|10k|half|marathon)\b/i,
      /\bplan\b.*\b(race|goal)\b/i,
    ],
  };

  classify(message: string): Intent {
    const normalizedMessage = message.toLowerCase().trim();
    
    // Check each pattern type
    for (const [intentType, patterns] of Object.entries(this.patterns)) {
      for (const pattern of patterns) {
        if (pattern.test(normalizedMessage)) {
          const keywords = this.extractKeywords(normalizedMessage, pattern);
          return {
            type: intentType as Intent['type'],
            confidence: 0.9,
            requiresGarminData: intentType !== 'weather',
            keywords,
          };
        }
      }
    }

    // Default to general if no pattern matches
    return {
      type: 'general',
      confidence: 0.5,
      requiresGarminData: false,
      keywords: [],
    };
  }

  async classifyAsync(message: string, context?: Record<string, any>): Promise<Intent> {
    const result = await this.classifyWithRaw(message, context);
    return result.intent;
  }

  async classifyWithRaw(
    message: string,
    context?: Record<string, any>
  ): Promise<{ intent: Intent; raw?: any }> {
    try {
      const { agentClient } = await import('./agent-client/agent-client.js');
      const result = await agentClient.classifyIntent(message, context);
      const type = result.type as Intent['type'];
      return {
        intent: {
          type,
          confidence: result.confidence ?? 0.5,
          requiresGarminData: Boolean(result.requiresGarminData),
          keywords: this.extractKeywords(message, /.+/),
        },
        raw: result,
      };
    } catch {
      return { intent: this.classify(message) };
    }
  }

  private extractKeywords(message: string, pattern: RegExp): string[] {
    const match = message.match(pattern);
    if (!match) return [];
    
    const keywords: string[] = [];
    const words = message.split(/\s+/);
    
    // Extract relevant words
    const relevantWords = ['run', 'runs', 'activity', 'fitness', 'trend', 'compare', 'last', 'recent'];
    for (const word of words) {
      if (relevantWords.some(rw => word.includes(rw))) {
        keywords.push(word);
      }
    }
    
    return keywords.slice(0, 5); // Limit to 5 keywords
  }

  getAgentEndpoint(intent: Intent): string {
    switch (intent.type) {
      case 'last_run':
        return '/analyze-latest-run';
      case 'recent_runs':
        return '/analyze-recent-runs';
      case 'fitness_trend':
        return '/analyze-fitness-trends';
      case 'weather':
        return '/running-conditions';
      case 'training_plan':
        return '/generate-plan';
      default:
        return '/chat';
    }
  }
}

export const intentClassifier = new IntentClassifier();

// Made with Bob
