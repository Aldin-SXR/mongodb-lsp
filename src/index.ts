/**
 * MongoDB Language Server Protocol (LSP) Implementation
 *
 * This package provides a standalone MongoDB Language Server that can be integrated
 * with any LSP-compatible editor or IDE, including Monaco Editor.
 *
 * @packageDocumentation
 */

// Export core server components
export { connection, mongoDBService, documents } from './server';
export { default as MongoDBService } from './mongoDBService';

// Export types
export * from './types';
export * from './types/playgroundType';
export * from './types/completionsCache';

// Export configuration
export * from './config';

// Export server commands
export { ServerCommands } from './serverCommands';

// Export diagnostic codes
export { default as DIAGNOSTIC_CODES } from './diagnosticCodes';

// Export visitor for AST parsing
export { Visitor } from './visitor';
export type { CompletionState, NamespaceState } from './visitor';

// Export worker for playground execution
export { execute, getLanguage } from './worker';

/**
 * Main entry point for the language server
 * This starts the language server and begins listening for LSP messages
 */
import './server';
