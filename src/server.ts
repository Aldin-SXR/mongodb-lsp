import type {
  CancellationToken,
  InitializeParams,
  CompletionItem,
  TextDocumentPositionParams,
  Connection,
} from 'vscode-languageserver/node';
import {
  createConnection,
  TextDocuments,
  ProposedFeatures,
  DidChangeConfigurationNotification,
  RequestType,
  TextDocumentSyncKind,
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';

import MongoDBService from './mongoDBService';
import { ServerCommands } from './serverCommands';
import type { PlaygroundEvaluateParams } from './types/playgroundType';
import type { ClearCompletionsCache } from './types/completionsCache';

// Create a connection for the server. The connection uses Node's IPC as a transport.
// Also include all preview / proposed LSP features.
const connection: Connection = createConnection(ProposedFeatures.all);

// Create a simple text document manager.
// The text document manager supports full document sync only.
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

// MongoDB language service.
const mongoDBService = new MongoDBService(connection);

let hasConfigurationCapability = false;

connection.onInitialize((params: InitializeParams) => {
  const capabilities = params.capabilities;

  // Does the client support the `workspace/configuration` request?
  // If not, we will fall back using global settings.
  hasConfigurationCapability = !!(
    capabilities.workspace && !!capabilities.workspace.configuration
  );

  return {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      textDocument: {
        completion: {
          completionItem: {
            preselectSupport: true,
          },
        },
      },
      // Tell the client that the server supports code completion.
      completionProvider: {
        resolveProvider: true,
        triggerCharacters: ['.'],
      },
    },
  };
});

connection.onInitialized(() => {
  void connection.sendNotification(
    ServerCommands.MONGODB_SERVICE_CREATED,
    'An instance of MongoDBService is created',
  );

  if (hasConfigurationCapability) {
    // Register for all configuration changes.
    void connection.client.register(
      DidChangeConfigurationNotification.type,
      undefined,
    );
  }
});

// The example settings.
interface ExampleSettings {
  maxNumberOfProblems: number;
}

// Cache the settings of all open documents.
const documentSettings: Map<string, Thenable<ExampleSettings>> = new Map();

connection.onDidChangeConfiguration((/* change */) => {
  if (hasConfigurationCapability) {
    // Reset all cached document settings.
    documentSettings.clear();
  }
});

// Only keep settings for open documents.
documents.onDidClose((e) => {
  documentSettings.delete(e.document.uri);
});

// The content of a text document has changed. This event is emitted
// when the text document first opened or when its content has changed.
documents.onDidChangeContent(async (change) => {
  const textFromEditor = change.document.getText();

  const diagnostics = mongoDBService.provideDiagnostics(
    textFromEditor ? textFromEditor : '',
  );

  // Send the computed diagnostics to VSCode.
  await connection.sendDiagnostics({ uri: change.document.uri, diagnostics });
});

connection.onRequest(new RequestType('textDocument/codeLens'), (/* event*/) => {
  // Code lens support can be added here if needed
});

connection.onDidChangeWatchedFiles((/* _change */) => {
  // Monitored files have change in VSCode.
});

// Execute a playground.
connection.onRequest(
  ServerCommands.EXECUTE_CODE_FROM_PLAYGROUND,
  (evaluateParams: PlaygroundEvaluateParams, token: CancellationToken) => {
    return mongoDBService.evaluate(evaluateParams, token);
  },
);

// Send default configurations to mongoDBService.
connection.onRequest(ServerCommands.INITIALIZE_MONGODB_SERVICE, (settings) => {
  mongoDBService.initialize(settings);
});

// Change NodeDriverServiceProvider active connection.
connection.onRequest(ServerCommands.ACTIVE_CONNECTION_CHANGED, (params) => {
  return mongoDBService.activeConnectionChanged(params);
});

// Set fields for tests.
connection.onRequest(
  ServerCommands.UPDATE_CURRENT_SESSION_FIELDS,
  ({ namespace, schemaFields }) => {
    return mongoDBService.cacheFields(namespace, schemaFields);
  },
);

// Clear cached completions by provided cache names.
connection.onRequest(
  ServerCommands.CLEAR_CACHED_COMPLETIONS,
  (clear: ClearCompletionsCache) => {
    return mongoDBService.clearCachedCompletions(clear);
  },
);

// Provide MongoDB completion items.
connection.onCompletion((params: TextDocumentPositionParams) => {
  const document = documents.get(params.textDocument.uri);

  return mongoDBService.provideCompletionItems({
    document,
    position: params.position,
  });
});

// This handler resolves additional information for the item selected in
// the completion list.
connection.onCompletionResolve((item: CompletionItem): CompletionItem => {
  return item;
});

connection.onRequest('textDocument/rangeFormatting', (event) => {
  const text = documents?.get(event?.textDocument?.uri)?.getText(event.range);

  return text;
});

connection.onRequest('textDocument/formatting', (event) => {
  const document = documents.get(event.textDocument.uri);
  const text = document?.getText();

  return text;
});

connection.onDidOpenTextDocument((/* params */) => {
  // A text document got opened in VSCode.
});

connection.onDidChangeTextDocument((/* params */) => {
  // The content of a text document did change in VSCode.
});

connection.onDidCloseTextDocument((/* params */) => {
  // A text document got closed in VSCode.
});

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// Listen on the connection
connection.listen();

export { connection, mongoDBService, documents };
