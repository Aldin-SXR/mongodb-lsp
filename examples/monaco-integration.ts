/**
 * MongoDB Language Server - Monaco Editor Integration Example
 *
 * This example demonstrates how to integrate the MongoDB Language Server
 * with Monaco Editor in a web application.
 *
 * Prerequisites:
 * - Node.js backend running the MongoDB Language Server
 * - Monaco Editor installed in your frontend
 * - monaco-languageclient for LSP communication
 */

import * as monaco from 'monaco-editor';
import {
  MonacoLanguageClient,
  CloseAction,
  ErrorAction,
  MonacoServices,
  createConnection,
} from 'monaco-languageclient';
import {
  toSocket,
  WebSocketMessageReader,
  WebSocketMessageWriter,
} from 'vscode-ws-jsonrpc';

/**
 * Backend Setup (Node.js)
 *
 * First, create a WebSocket server that runs the MongoDB Language Server:
 *
 * ```typescript
 * import { WebSocketServer } from 'ws';
 * import { createConnection, ProposedFeatures } from 'vscode-languageserver/node';
 * import { createServerProcess } from 'vscode-ws-jsonrpc/server';
 * import 'mongodb-lsp'; // This starts the language server
 *
 * const wss = new WebSocketServer({ port: 3000 });
 *
 * wss.on('connection', (ws) => {
 *   const socket = toSocket(ws);
 *   const reader = new WebSocketMessageReader(socket);
 *   const writer = new WebSocketMessageWriter(socket);
 *   const connection = createServerProcess('MongoDB LSP', 'node', ['./node_modules/mongodb-lsp/dist/index.js']);
 *
 *   connection.listen();
 * });
 * ```
 */

/**
 * Frontend Setup (Browser)
 */

// 1. Register MongoDB language with Monaco
monaco.languages.register({
  id: 'mongodb',
  extensions: ['.mongodb.js', '.mongodb'],
  aliases: ['MongoDB', 'mongodb'],
  mimetypes: ['text/mongodb', 'application/mongodb'],
});

// 2. Configure language features
monaco.languages.setLanguageConfiguration('mongodb', {
  comments: {
    lineComment: '//',
    blockComment: ['/*', '*/'],
  },
  brackets: [
    ['{', '}'],
    ['[', ']'],
    ['(', ')'],
  ],
  autoClosingPairs: [
    { open: '{', close: '}' },
    { open: '[', close: ']' },
    { open: '(', close: ')' },
    { open: '"', close: '"' },
    { open: "'", close: "'" },
    { open: '`', close: '`' },
  ],
  surroundingPairs: [
    { open: '{', close: '}' },
    { open: '[', close: ']' },
    { open: '(', close: ')' },
    { open: '"', close: '"' },
    { open: "'", close: "'" },
    { open: '`', close: '`' },
  ],
});

// 3. Set up syntax highlighting (basic JavaScript-like highlighting)
monaco.languages.setMonarchTokensProvider('mongodb', {
  keywords: [
    'use',
    'db',
    'sp',
    'function',
    'return',
    'if',
    'else',
    'for',
    'while',
    'var',
    'let',
    'const',
    'new',
    'async',
    'await',
  ],
  operators: [
    '=',
    '>',
    '<',
    '!',
    '~',
    '?',
    ':',
    '==',
    '<=',
    '>=',
    '!=',
    '&&',
    '||',
    '++',
    '--',
    '+',
    '-',
    '*',
    '/',
    '&',
    '|',
    '^',
    '%',
    '<<',
    '>>',
    '>>>',
    '+=',
    '-=',
    '*=',
    '/=',
    '&=',
    '|=',
    '^=',
    '%=',
    '<<=',
    '>>=',
    '>>>=',
  ],
  symbols: /[=><!~?:&|+\-*\/\^%]+/,
  tokenizer: {
    root: [
      [
        /[a-z_$][\w$]*/,
        {
          cases: {
            '@keywords': 'keyword',
            '@default': 'identifier',
          },
        },
      ],
      [/[A-Z][\w\$]*/, 'type.identifier'],
      { include: '@whitespace' },
      [/[{}()\[\]]/, '@brackets'],
      [/[<>](?!@symbols)/, '@brackets'],
      [/@symbols/, { cases: { '@operators': 'operator', '@default': '' } }],
      [/\d*\.\d+([eE][\-+]?\d+)?/, 'number.float'],
      [/0[xX][0-9a-fA-F]+/, 'number.hex'],
      [/\d+/, 'number'],
      [/[;,.]/, 'delimiter'],
      [/"([^"\\]|\\.)*$/, 'string.invalid'],
      [/'([^'\\]|\\.)*$/, 'string.invalid'],
      [/"/, 'string', '@string_double'],
      [/'/, 'string', '@string_single'],
      [/`/, 'string', '@string_backtick'],
    ],
    whitespace: [
      [/[ \t\r\n]+/, ''],
      [/\/\*/, 'comment', '@comment'],
      [/\/\/.*$/, 'comment'],
    ],
    comment: [
      [/[^\/*]+/, 'comment'],
      [/\*\//, 'comment', '@pop'],
      [/[\/*]/, 'comment'],
    ],
    string_double: [
      [/[^\\"]+/, 'string'],
      [/\\./, 'string.escape'],
      [/"/, 'string', '@pop'],
    ],
    string_single: [
      [/[^\\']+/, 'string'],
      [/\\./, 'string.escape'],
      [/'/, 'string', '@pop'],
    ],
    string_backtick: [
      [/[^\\`$]+/, 'string'],
      [/\$\{/, { token: 'delimiter.bracket', next: '@bracketCounting' }],
      [/\\./, 'string.escape'],
      [/`/, 'string', '@pop'],
    ],
    bracketCounting: [
      [/\{/, 'delimiter.bracket', '@bracketCounting'],
      [/\}/, 'delimiter.bracket', '@pop'],
      { include: 'root' },
    ],
  },
});

/**
 * Create a Monaco Language Client connection to the MongoDB Language Server
 */
export function createMongoDBLanguageClient(
  serverUrl: string = 'ws://localhost:3000',
): Promise<MonacoLanguageClient> {
  return new Promise((resolve, reject) => {
    const webSocket = new WebSocket(serverUrl);

    webSocket.onopen = () => {
      const socket = toSocket(webSocket);
      const reader = new WebSocketMessageReader(socket);
      const writer = new WebSocketMessageWriter(socket);

      const languageClient = new MonacoLanguageClient({
        name: 'MongoDB Language Client',
        clientOptions: {
          // Use 'mongodb' as the document selector
          documentSelector: [{ language: 'mongodb' }],
          // Disable the default error handler
          errorHandler: {
            error: () => ErrorAction.Continue,
            closed: () => CloseAction.DoNotRestart,
          },
        },
        // Create a connection using the WebSocket
        connectionProvider: {
          get: (errorHandler, closeHandler) => {
            return Promise.resolve(
              createConnection(reader, writer, errorHandler, closeHandler),
            );
          },
        },
      });

      // Start the language client
      languageClient.start();
      reader.onClose(() => languageClient.stop());

      resolve(languageClient);
    };

    webSocket.onerror = (error) => {
      reject(new Error(`WebSocket error: ${error}`));
    };
  });
}

/**
 * Initialize Monaco Editor with MongoDB Language Server support
 */
export async function initializeMonacoWithMongoDB(
  container: HTMLElement,
  initialValue: string = '',
  serverUrl: string = 'ws://localhost:3000',
): Promise<{
  editor: monaco.editor.IStandaloneCodeEditor;
  languageClient: MonacoLanguageClient;
}> {
  // Install Monaco language client services
  MonacoServices.install();

  // Create the Monaco Editor instance
  const editor = monaco.editor.create(container, {
    value: initialValue,
    language: 'mongodb',
    theme: 'vs-dark',
    automaticLayout: true,
    minimap: {
      enabled: true,
    },
    suggestOnTriggerCharacters: true,
    quickSuggestions: {
      other: true,
      comments: false,
      strings: false,
    },
    parameterHints: {
      enabled: true,
    },
  });

  // Connect to the language server
  const languageClient = await createMongoDBLanguageClient(serverUrl);

  // Send connection configuration to the language server
  languageClient.sendNotification('INITIALIZE_MONGODB_SERVICE', {
    connectionId: 'monaco-connection',
    connectionString: 'mongodb://localhost:27017',
    connectionOptions: {},
  });

  return { editor, languageClient };
}

/**
 * Example usage:
 *
 * ```typescript
 * const container = document.getElementById('editor-container');
 * const initialCode = `// MongoDB Playground
 * use('myDatabase');
 *
 * db.users.find({
 *   age: { $gt: 25 }
 * }).toArray();
 * `;
 *
 * const { editor, languageClient } = await initializeMonacoWithMongoDB(
 *   container,
 *   initialCode,
 *   'ws://localhost:3000'
 * );
 *
 * // Update connection when needed
 * languageClient.sendRequest('ACTIVE_CONNECTION_CHANGED', {
 *   connectionId: 'new-connection',
 *   connectionString: 'mongodb://localhost:27017/newdb',
 *   connectionOptions: {}
 * });
 *
 * // Execute code in the editor
 * const code = editor.getValue();
 * const result = await languageClient.sendRequest('EXECUTE_CODE_FROM_PLAYGROUND', {
 *   codeToEvaluate: code,
 *   connectionId: 'monaco-connection',
 * });
 * console.log('Execution result:', result);
 * ```
 */

/**
 * Configuration for MongoDB connection
 */
export interface MongoDBConnectionConfig {
  connectionId: string;
  connectionString: string;
  connectionOptions?: Record<string, any>;
}

/**
 * Update the MongoDB connection for the language server
 */
export async function updateMongoDBConnection(
  languageClient: MonacoLanguageClient,
  config: MongoDBConnectionConfig,
): Promise<void> {
  await languageClient.sendRequest('ACTIVE_CONNECTION_CHANGED', config);
}

/**
 * Execute MongoDB code from the editor
 */
export async function executeMongoDBCode(
  languageClient: MonacoLanguageClient,
  code: string,
  connectionId: string,
): Promise<any> {
  return await languageClient.sendRequest('EXECUTE_CODE_FROM_PLAYGROUND', {
    codeToEvaluate: code,
    connectionId,
  });
}

/**
 * Clear cached completions (useful when switching databases/collections)
 */
export async function clearCompletions(
  languageClient: MonacoLanguageClient,
  options: {
    databases?: boolean;
    collections?: boolean;
    fields?: boolean;
    streamProcessors?: boolean;
  } = {},
): Promise<void> {
  await languageClient.sendRequest('CLEAR_CACHED_COMPLETIONS', options);
}
