# Changelog

All notable changes to the MongoDB Language Server will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-01-XX

### Added
- Initial release of standalone MongoDB Language Server
- Intelligent autocomplete for MongoDB queries and aggregation pipelines
  - Database and collection name completions
  - Field name completions based on schema
  - MongoDB shell method completions
  - Aggregation pipeline stage and operator completions
  - Query operator completions
  - BSON type completions
  - System variable completions
- Real-time diagnostics for invalid shell syntax
- Code execution support for MongoDB playgrounds
- Schema-aware completions with automatic caching
- Support for Atlas Stream Processors
- Monaco Editor integration example
- Configurable connection management
- TypeScript definitions for all exported APIs

### Features
- Context-aware autocomplete based on cursor position
- AST-based parsing using Babel for accurate code analysis
- Incremental text synchronization for performance
- Support for both `.mongodb.js` and `.mongodb` file extensions
- Bracket notation support for collections with special characters
- Default database detection from connection string

### Technical Details
- Built on Language Server Protocol (LSP)
- Uses `@mongosh/*` packages for MongoDB shell compatibility
- Leverages `mongodb-schema` for schema analysis
- Supports Node.js 18.0.0 and above
- Apache-2.0 licensed

[1.0.0]: https://github.com/mongodb-js/mongodb-lsp/releases/tag/v1.0.0
