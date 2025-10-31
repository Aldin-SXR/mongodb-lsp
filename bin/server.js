#!/usr/bin/env node

/**
 * MongoDB Language Server
 *
 * Supports two modes:
 * 1. stdio mode (default) - Standard LSP over stdin/stdout
 * 2. WebSocket mode - WebSocket server for browser-based editors
 *
 * Usage:
 *   mongodb-lsp [options]
 *
 * Options:
 *   --stdio              Run in stdio mode (default)
 *   --websocket          Run in WebSocket mode
 *   --port <port>        WebSocket port (default: 3000)
 *   --host <host>        WebSocket host (default: 0.0.0.0)
 *   --config <path>      Path to configuration file
 *   --mongodb-uri <uri>  MongoDB connection URI
 *   --verbose            Enable verbose logging
 *   --help               Show help
 */

const fs = require('fs');
const path = require('path');

// Parse command line arguments
const args = parseArgs(process.argv.slice(2));

if (args.help) {
  showHelp();
  process.exit(0);
}

// Load configuration
let config = {
  connectionString: args['mongodb-uri'] || process.env.MONGODB_URI || 'mongodb://localhost:27017',
  verbose: args.verbose || false,
};

const CONFIG_PATH = args.config || process.env.MONGODB_LSP_CONFIG;
if (CONFIG_PATH && fs.existsSync(CONFIG_PATH)) {
  try {
    const fileConfig = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
    config = { ...config, ...fileConfig };
    if (config.verbose) {
      console.error(`Loaded configuration from: ${CONFIG_PATH}`);
    }
  } catch (err) {
    console.error(`Failed to load config file: ${err.message}`);
    process.exit(1);
  }
}

// Determine mode
const isWebSocket = args.websocket || args.ws;
const isStdio = args.stdio || !isWebSocket; // stdio is default

if (isWebSocket) {
  // WebSocket mode
  startWebSocketServer(args, config);
} else {
  // Stdio mode (default)
  startStdioServer(config);
}

/**
 * Start server in stdio mode (standard LSP)
 */
function startStdioServer(config) {
  const { createConnection } = require('vscode-languageserver/node');

  if (config.verbose) {
    console.error('Starting MongoDB Language Server in stdio mode...');
    console.error(`MongoDB URI: ${config.connectionString.replace(/:[^:@]+@/, ':***@')}`);
  }

  // Create connection using stdin/stdout
  const connection = createConnection(process.stdin, process.stdout);

  // Start the language server
  startLanguageServer(connection, config, 'stdio');

  if (config.verbose) {
    console.error('MongoDB Language Server ready (stdio mode)');
  }
}

/**
 * Start server in WebSocket mode
 */
function startWebSocketServer(args, config) {
  const WebSocket = require('ws');
  const { createConnection } = require('vscode-languageserver/node');
  const { createWebSocketConnection } = require('vscode-ws-jsonrpc/server');

  const PORT = args.port || process.env.PORT || 3000;
  const HOST = args.host || process.env.HOST || '0.0.0.0';

  // Create WebSocket server
  const wss = new WebSocket.Server({
    port: PORT,
    host: HOST,
    perMessageDeflate: false
  });

  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║  MongoDB Language Server (WebSocket Mode)                 ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
  console.log(`Server running on: ws://${HOST}:${PORT}`);
  console.log(`MongoDB URI: ${config.connectionString.replace(/:[^:@]+@/, ':***@')}`);
  console.log(`\nWaiting for editor connections...\n`);

  let connectionCount = 0;

  wss.on('connection', (ws, req) => {
    connectionCount++;
    const clientId = connectionCount;
    const clientIp = req.socket.remoteAddress;

    console.log(`[${new Date().toISOString()}] Client #${clientId} connected from ${clientIp}`);

    try {
      const socketConnection = createWebSocketConnection(ws);
      const serverConnection = createConnection(
        socketConnection.reader,
        socketConnection.writer
      );

      startLanguageServer(serverConnection, config, clientId);

      socketConnection.onClose(() => {
        console.log(`[${new Date().toISOString()}] Client #${clientId} disconnected`);
      });

    } catch (err) {
      console.error(`[${new Date().toISOString()}] Error setting up connection for client #${clientId}:`, err.message);
      ws.close();
    }
  });

  wss.on('error', (err) => {
    console.error('WebSocket server error:', err);
  });

  // Graceful shutdown
  process.on('SIGINT', () => shutdown(wss));
  process.on('SIGTERM', () => shutdown(wss));
}

/**
 * Start the MongoDB Language Server for a connection
 */
function startLanguageServer(connection, config, clientId) {
  const { TextDocuments, TextDocumentSyncKind, DidChangeConfigurationNotification } = require('vscode-languageserver/node');
  const { TextDocument } = require('vscode-languageserver-textdocument');
  const MongoDBService = require('../dist/mongoDBService').default;
  const { ServerCommands } = require('../dist/serverCommands');

  const documents = new TextDocuments(TextDocument);
  let mongoDBService; // Initialize after connection is ready

  let hasConfigurationCapability = false;
  let hasWorkspaceConfigurationCapability = false;
  const documentSettings = new Map();

  // Current active configuration (from CLI/env/file + LSP config)
  let activeConfig = { ...config };

  // Initialize
  connection.onInitialize((params) => {
    const capabilities = params.capabilities;

    hasConfigurationCapability = !!(
      capabilities.workspace && !!capabilities.workspace.configuration
    );

    hasWorkspaceConfigurationCapability = !!(
      capabilities.workspace && !!capabilities.workspace.workspaceFolders
    );

    if (config.verbose) {
      connection.console.log(`[Client ${clientId}] Initialized with capabilities: ${JSON.stringify({
        configuration: hasConfigurationCapability,
        workspaceFolders: hasWorkspaceConfigurationCapability
      })}`);
    }

    return {
      capabilities: {
        textDocumentSync: TextDocumentSyncKind.Incremental,
        completionProvider: {
          resolveProvider: true,
          triggerCharacters: ['.'],
        },
      },
    };
  });

  connection.onInitialized(() => {
    if (config.verbose) {
      connection.console.log(`[Client ${clientId}] onInitialized called`);
    }

    // NOW create the MongoDB service (after initialization handshake is complete)
    mongoDBService = new MongoDBService(connection);

    connection.sendNotification(ServerCommands.MONGODB_SERVICE_CREATED, 'MongoDBService created');

    if (hasConfigurationCapability) {
      // Register for configuration changes
      connection.client.register(DidChangeConfigurationNotification.type, undefined);
    }

    // Initialize MongoDB connection with current config
    initializeMongoDBService(activeConfig);
  });

  // Handle configuration changes from client
  connection.onDidChangeConfiguration((change) => {
    if (config.verbose) {
      connection.console.log(`[Client ${clientId}] Configuration changed`);
    }

    if (hasConfigurationCapability) {
      // Reset cached document settings
      documentSettings.clear();
    }

    // Extract MongoDB LSP configuration
    const settings = change.settings?.mongodbLanguageServer || change.settings || {};

    // Merge with existing config (CLI/env takes precedence for connection settings if not explicitly changed)
    activeConfig = {
      ...activeConfig,
      ...(settings.connectionString && { connectionString: settings.connectionString }),
      ...(settings.connectionOptions && { connectionOptions: settings.connectionOptions }),
      ...(settings.verbose !== undefined && { verbose: settings.verbose }),
    };

    if (config.verbose) {
      connection.console.log(`[Client ${clientId}] Updated configuration: ${JSON.stringify({
        hasConnectionString: !!activeConfig.connectionString,
        hasConnectionOptions: !!activeConfig.connectionOptions,
        verbose: activeConfig.verbose
      })}`);
    }

    // Reinitialize MongoDB service with new configuration
    initializeMongoDBService(activeConfig);
  });

  // Helper to initialize/reinitialize MongoDB service
  function initializeMongoDBService(cfg) {
    if (!mongoDBService) {
      if (config.verbose) {
        connection.console.log(`[Client ${clientId}] MongoDB service not yet created, skipping initialization`);
      }
      return;
    }

    const initConfig = {
      extensionPath: path.resolve(__dirname, '..'),
      connectionId: typeof clientId === 'string' ? clientId : `client-${clientId}`,
      connectionString: cfg.connectionString,
      connectionOptions: cfg.connectionOptions || {},
    };

    mongoDBService.initialize(initConfig);

    if (cfg.verbose) {
      connection.console.log(`[Client ${clientId}] MongoDB service initialized with URI: ${cfg.connectionString?.replace(/:[^:@]+@/, ':***@')}`);
    }
  }

  // Document change handlers
  documents.onDidChangeContent(async (change) => {
    if (!mongoDBService) return;
    const textFromEditor = change.document.getText();
    const diagnostics = mongoDBService.provideDiagnostics(textFromEditor || '');
    await connection.sendDiagnostics({ uri: change.document.uri, diagnostics });
  });

  documents.onDidClose((e) => {
    documentSettings.delete(e.document.uri);
  });

  // Completion handlers
  connection.onCompletion((params) => {
    if (!mongoDBService) return [];
    const document = documents.get(params.textDocument.uri);
    return mongoDBService.provideCompletionItems({
      document,
      position: params.position,
    });
  });

  connection.onCompletionResolve((item) => item);

  // Custom request handlers
  connection.onRequest(ServerCommands.EXECUTE_CODE_FROM_PLAYGROUND, (params, token) => {
    if (!mongoDBService) return null;
    return mongoDBService.evaluate(params, token);
  });

  connection.onRequest(ServerCommands.INITIALIZE_MONGODB_SERVICE, (settings) => {
    if (!mongoDBService) {
      mongoDBService = new MongoDBService(connection);
    }
    mongoDBService.initialize(settings);
  });

  connection.onRequest(ServerCommands.ACTIVE_CONNECTION_CHANGED, (params) => {
    if (!mongoDBService) return null;
    return mongoDBService.activeConnectionChanged(params);
  });

  connection.onRequest(ServerCommands.UPDATE_CURRENT_SESSION_FIELDS, ({ namespace, schemaFields }) => {
    if (!mongoDBService) return;
    return mongoDBService.cacheFields(namespace, schemaFields);
  });

  connection.onRequest(ServerCommands.CLEAR_CACHED_COMPLETIONS, (clear) => {
    if (!mongoDBService) return;
    return mongoDBService.clearCachedCompletions(clear);
  });

  // Start listening
  documents.listen(connection);
  connection.listen();
}

/**
 * Graceful shutdown for WebSocket server
 */
function shutdown(wss) {
  console.log('\n\nShutting down MongoDB Language Server...');
  wss.close(() => {
    console.log('Server stopped');
    process.exit(0);
  });

  setTimeout(() => {
    console.log('Forcing exit...');
    process.exit(1);
  }, 5000);
}

/**
 * Parse command line arguments
 */
function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      if (['help', 'verbose', 'stdio', 'websocket', 'ws'].includes(key)) {
        args[key] = true;
      } else if (i + 1 < argv.length) {
        args[key] = argv[++i];
      }
    }
  }
  return args;
}

/**
 * Show help message
 */
function showHelp() {
  console.log(`
MongoDB Language Server

A Language Server Protocol (LSP) implementation for MongoDB that provides
intelligent autocomplete, diagnostics, and code execution for MongoDB queries.

MODES:

  stdio (default)    Standard LSP over stdin/stdout
                     Use this with most editors and custom WebSocket proxies

  WebSocket          WebSocket server for browser-based editors
                     Use this for direct browser connections (Monaco Editor)

USAGE:

  # Stdio mode (default) - for use with editors or WS proxies
  mongodb-lsp

  # WebSocket mode - for direct browser connections
  mongodb-lsp --websocket --port 3000

OPTIONS:

  --stdio              Run in stdio mode (default)
  --websocket, --ws    Run in WebSocket mode
  --port <port>        WebSocket port (default: 3000, WebSocket mode only)
  --host <host>        WebSocket host (default: 0.0.0.0, WebSocket mode only)
  --config <path>      Path to JSON configuration file
  --mongodb-uri <uri>  MongoDB connection URI (default: mongodb://localhost:27017)
  --verbose            Enable verbose logging
  --help               Show this help message

ENVIRONMENT VARIABLES:

  MONGODB_URI          MongoDB connection URI
  MONGODB_LSP_CONFIG   Path to configuration file
  PORT                 WebSocket port (WebSocket mode only)
  HOST                 WebSocket host (WebSocket mode only)

CONFIGURATION FILE:

  Create mongodb-lsp.config.json:

  {
    "connectionString": "mongodb://localhost:27017",
    "connectionOptions": {
      "serverSelectionTimeoutMS": 5000
    },
    "verbose": false
  }

EXAMPLES:

  # Stdio mode with default MongoDB
  mongodb-lsp

  # Stdio mode with custom MongoDB URI
  mongodb-lsp --mongodb-uri mongodb://localhost:27017/mydb

  # Stdio mode with configuration file
  mongodb-lsp --config ./mongodb-lsp.config.json

  # WebSocket mode on port 4000
  mongodb-lsp --websocket --port 4000

  # WebSocket mode with verbose logging
  mongodb-lsp --websocket --verbose

USING WITH EDITORS:

  Stdio mode (recommended):
    Most editors and LSP clients expect stdio mode. Configure your editor
    to launch: mongodb-lsp

  WebSocket mode:
    For browser-based editors or when you need multiple clients to connect
    to the same server instance. Start the server:
      mongodb-lsp --websocket
    Then connect from your editor to: ws://localhost:3000

USING WITH CUSTOM WEBSOCKET PROXY:

  If you have a custom WebSocket proxy that forwards to stdio:

  1. Start the LSP in stdio mode (default):
     mongodb-lsp

  2. Your proxy handles WebSocket connections and forwards LSP messages
     to the stdio process

  3. Editors connect to your proxy's WebSocket endpoint

MORE INFO:

  Documentation: https://github.com/mongodb-js/mongodb-lsp
  Issues: https://github.com/mongodb-js/mongodb-lsp/issues
`);
}
