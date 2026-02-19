import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '../config/.env') });
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
class ConfigLoader {
    configCache = null;
    load() {
        if (this.configCache) {
            return this.configCache;
        }
        const configPath = path.join(process.cwd(), '../config/app.config.json');
        if (!fs.existsSync(configPath)) {
            throw new Error(`Configuration file not found: ${configPath}`);
        }
        const configFile = fs.readFileSync(configPath, 'utf-8');
        const rawConfig = JSON.parse(configFile);
        // Replace environment variables
        const resolvedConfig = this.replaceEnvVars(rawConfig);
        // Validate configuration
        this.validate(resolvedConfig);
        this.configCache = resolvedConfig;
        return resolvedConfig;
    }
    replaceEnvVars(obj) {
        if (typeof obj === 'string') {
            const match = obj.match(/\$\{([^}]+)\}/);
            if (match) {
                const envVar = match[1];
                const value = process.env[envVar];
                if (!value) {
                    console.warn(`Warning: Environment variable ${envVar} is not set`);
                    return obj;
                }
                return value;
            }
            return obj;
        }
        if (Array.isArray(obj)) {
            return obj.map(item => this.replaceEnvVars(item));
        }
        if (typeof obj === 'object' && obj !== null) {
            const result = {};
            for (const key in obj) {
                result[key] = this.replaceEnvVars(obj[key]);
            }
            return result;
        }
        return obj;
    }
    validate(config) {
        if (!config.api.port) {
            throw new Error('API port is required');
        }
        if (!config.database.path) {
            throw new Error('Database path is required');
        }
        if (!config.app.name) {
            throw new Error('App name is required');
        }
    }
}
const configLoader = new ConfigLoader();
export const config = configLoader.load();
// Made with Bob
//# sourceMappingURL=config-loader.js.map