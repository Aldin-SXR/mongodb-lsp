# MongoDB Language Server

Standalone Language Server for MongoDB that provides intelligent autocomplete, diagnostics, and language features for MongoDB queries and aggregation pipelines. Works with any LSP-compatible editor (stdio) and supports a built-in WebSocket server for browser editors (Monaco).

## Features

- WebSocket and stdio modes
- Context-aware completions: databases, collections, fields, operators, stages
- Real-time diagnostics for common MongoDB shell pitfalls
- Multi-client support (WebSocket mode)
- Configurable via CLI, file, env, or LSP
- Optional playground code execution through custom requests

## Quick Start

### Installation

```bash
npm install -g mongodb-lsp
```

Or clone and build:

```bash
git clone https://github.com/mongodb-js/mongodb-lsp.git
cd mongodb-lsp
npm install
npm run build
```

### Run (stdio mode, default)

```bash
# Start in stdio mode
mongodb-lsp

# With custom MongoDB URI
mongodb-lsp --mongodb-uri mongodb://localhost:27017/mydb

# With configuration file
mongodb-lsp --config ./mongodb-lsp.config.json
```

### Run (WebSocket mode)

```bash
# Start WebSocket server
mongodb-lsp --websocket

# Custom port and URI
mongodb-lsp --websocket --port 4000 --mongodb-uri mongodb://localhost:27017/mydb
```

## Configuration

Configuration is merged in this order (later overrides earlier):
1) Built-in defaults
2) Configuration file
3) Environment variables
4) Command-line arguments
5) LSP didChangeConfiguration (runtime)

### CLI options

```
--stdio              Run in stdio mode (default)
--websocket, --ws    Run in WebSocket mode
--port <port>        WebSocket port (default: 3000)
--host <host>        WebSocket host (default: 0.0.0.0)
--config <path>      Path to JSON configuration file
--mongodb-uri <uri>  MongoDB connection URI
--verbose            Enable verbose logging
--help               Show help
```

### Configuration file (mongodb-lsp.config.json)

```json
{
  "connectionString": "mongodb://localhost:27017",
  "connectionOptions": {
    "serverSelectionTimeoutMS": 5000
  },
  "verbose": false
}
```

### Environment variables

```bash
export MONGODB_URI="mongodb://localhost:27017"
export MONGODB_LSP_CONFIG="./mongodb-lsp.config.json"

# WebSocket mode only
export PORT=4000
export HOST="0.0.0.0"
```

### Dynamic configuration via LSP

```typescript
client.sendNotification('workspace/didChangeConfiguration', {
  settings: {
    mongodbLanguageServer: {
      connectionString: 'mongodb://localhost:27017/newdb',
      connectionOptions: {},
      verbose: false
    }
  }
});
```

## Editor Integration

### Monaco Editor (direct WebSocket)

Start the server:
```bash
mongodb-lsp --websocket --port 3000
```

Connect from the browser using monaco-languageclient and vscode-ws-jsonrpc. See `examples/monaco-integration.ts` for a full setup.

### VS Code

Launch the LSP in stdio mode from an extension:

```typescript
import { LanguageClient, TransportKind } from 'vscode-languageclient/node';

const serverModule = 'mongodb-lsp'; // or path to bin/server.js

const serverOptions = {
  run: {
    command: serverModule,
    args: ['--mongodb-uri', 'mongodb://localhost:27017'],
    transport: TransportKind.stdio
  },
  debug: {
    command: serverModule,
    args: ['--mongodb-uri', 'mongodb://localhost:27017', '--verbose'],
    transport: TransportKind.stdio
  }
};

const client = new LanguageClient(
  'mongodbLanguageServer',
  'MongoDB Language Server',
  serverOptions,
  {
    documentSelector: [{ pattern: '**/*.mongodb.js' }]
  }
);
```

### Neovim

```lua
require'lspconfig'.mongodb_lsp.setup{
  cmd = { 'mongodb-lsp', '--mongodb-uri', 'mongodb://localhost:27017' },
  filetypes = { 'mongodb', 'javascript' },
  root_dir = function(fname) return vim.loop.cwd() end,
  settings = { mongodbLanguageServer = { verbose = false } }
}
```

### Emacs (lsp-mode)

```elisp
(with-eval-after-load 'lsp-mode
  (add-to-list 'lsp-language-id-configuration '(mongodb-mode . "mongodb"))
  (lsp-register-client
   (make-lsp-client
    :new-connection (lsp-stdio-connection '("mongodb-lsp"))
    :major-modes '(mongodb-mode js-mode)
    :server-id 'mongodb-lsp)))
```

### Other editors

- Launch command: `mongodb-lsp`
- Transport: stdio
- Document selector: `**/*.mongodb.js` or `**/*.mongodb`

## API / Custom Requests

- `ACTIVE_CONNECTION_CHANGED`: switch the active MongoDB connection
- `EXECUTE_CODE_FROM_PLAYGROUND`: execute code and return results
- `CLEAR_CACHED_COMPLETIONS`: clear cached databases/collections/fields

Examples:

```typescript
connection.sendRequest('ACTIVE_CONNECTION_CHANGED', {
  connectionId: 'production',
  connectionString: 'mongodb+srv://user:pass@cluster.mongodb.net',
  connectionOptions: {}
});

const result = await connection.sendRequest('EXECUTE_CODE_FROM_PLAYGROUND', {
  codeToEvaluate: 'db.users.find().toArray()',
  connectionId: 'my-connection'
});

connection.sendRequest('CLEAR_CACHED_COMPLETIONS', {
  databases: true,
  collections: true,
  fields: true
});
```

## Architecture (Overview)

- `bin/server.js`: CLI entry; selects stdio or WebSocket mode and starts the server
- `src/server.ts`: LSP protocol handlers (document sync, completion, requests)
- `src/mongoDBService.ts`: core language features and MongoDB connectivity
- `src/visitor.ts`: AST analysis to determine context for completions/diagnostics
- `src/worker.ts`: worker thread for isolated code execution (playgrounds)

## Development

```bash
npm install
npm run build

# Dev server
npm run dev

# Custom run
node bin/server.js --port 4000 --mongodb-uri mongodb://localhost:27017 --verbose
```

## Troubleshooting

- Server idle on start: in stdio mode it waits for an LSP client to connect
- No completions: verify MongoDB connection and editor language id
- Port in use: change with `--port` (WebSocket mode)
- Verbose logs: add `--verbose`

## Performance

- Low latency completions with caching
- Lazy schema sampling (lightweight; cached per collection)

## Security

- Do not expose WebSocket port to untrusted networks
- Prefer running behind an authenticated reverse proxy in WebSocket mode
- Use proper authentication for MongoDB connections

## Examples

See `examples/`:
- `monaco-integration.ts` – Monaco setup
- `simple-server.js` – Basic stdio server
- `websocket-server.js` – WebSocket setup

## License

Apache-2.0

## Contributing

1) Fork the repository
2) Create a feature branch
3) Make changes and add tests where applicable
4) Open a pull request

## Support

- GitHub Issues: https://github.com/mongodb-js/mongodb-lsp/issues
- MongoDB Community Forums: https://www.mongodb.com/community/forums/

## Related Projects

- MongoDB for VS Code: https://github.com/mongodb-js/vscode
- mongosh: https://github.com/mongodb-js/mongosh
- Monaco Editor: https://microsoft.github.io/monaco-editor/
- Language Server Protocol: https://microsoft.github.io/language-server-protocol/

