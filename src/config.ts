import type { MongoClientOptions } from './types/playgroundType';

/**
 * Configuration interface for the MongoDB Language Server
 */
export interface MongoDBLanguageServerConfig {
  /**
   * Connection ID for tracking the current connection
   */
  connectionId?: string | null;

  /**
   * MongoDB connection string
   * @example "mongodb://localhost:27017"
   * @example "mongodb+srv://user:pass@cluster.mongodb.net/dbname"
   */
  connectionString?: string;

  /**
   * MongoDB connection options
   */
  connectionOptions?: MongoClientOptions;

  /**
   * Extension path where the language server worker files are located
   * Required if you want to use playground evaluation features
   */
  extensionPath?: string;

  /**
   * Maximum number of problems to report
   * @default 100
   */
  maxNumberOfProblems?: number;

  /**
   * Enable verbose logging
   * @default false
   */
  verbose?: boolean;

  /**
   * Document selector patterns for which files the language server should activate
   * @default [{ pattern: '**\/*.mongodb.js' }, { pattern: '**\/*.mongodb' }]
   */
  documentSelector?: Array<{ pattern: string }>;
}

/**
 * Default configuration values
 */
export const defaultConfig: Partial<MongoDBLanguageServerConfig> = {
  maxNumberOfProblems: 100,
  verbose: false,
  documentSelector: [
    { pattern: '**/*.mongodb.js' },
    { pattern: '**/*.mongodb' },
  ],
};

/**
 * Merge user config with default config
 */
export function mergeConfig(
  userConfig: Partial<MongoDBLanguageServerConfig> = {},
): MongoDBLanguageServerConfig {
  return {
    ...defaultConfig,
    ...userConfig,
  };
}
