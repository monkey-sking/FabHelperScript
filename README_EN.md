# Fab Helper Script

Fab Helper is a userscript tool designed to assist with Fab.com, providing automation features and interface enhancements.

[中文文档](README.md) | **English**

## Versions

- **Current Version**: `dist/fab_helper.user.js` (Build artifact, install this file)
- **Source Code**: `src/` directory (Modular development)
- **Legacy**: `legacy/` directory (Archived)

## Core Features

The Optimized Version (3.5.0, updated 2025-12-27) has been fully refactored into a modular architecture and includes the following improvements:

- **Modular Architecture**: Code split into independent functional modules for better maintenance and extensibility.
- **Robust Initialization**: Complete error handling and dependency injection mechanisms.
- **Data Caching System**: Reduces repetitive API requests.
- **Request Interceptors**: Automatically caches API responses sent by the webpage.
- **Smart Rate Limit Handling**: Automatically detects 429 errors and handles pause/resume logic.
- **Background Task Processing**: Supports multi-tab collaboration for tasks.
- **Enhanced UI**: Real-time status panel and operation controls.

## Installation

1. **Install Node.js** (Required for building).
2. Clone the repository and install dependencies:

    ```bash
    npm install
    ```

3. Build the script:

    ```bash
    npm run build
    ```

4. Install the generated `dist/fab_helper.user.js` file into your userscript manager (e.g., Tampermonkey).
5. Visit Fab.com, and the script will run automatically.

## Documentation

For detailed documentation, please check the `docs` directory:

- [User Guide](docs/USER_GUIDE.md) (Chinese)
- [API Reference](docs/API_REFERENCE.md) (Chinese)
- [Architecture](docs/ARCHITECTURE.md) (Chinese)
- [Changelog](docs/CHANGELOG.md)
- [Troubleshooting](docs/TROUBLESHOOTING.md) (Chinese)

## Contribution

Issues and feature requests are welcome. Please see the [Contribution Guide](docs/CONTRIBUTING.md) for more information.
