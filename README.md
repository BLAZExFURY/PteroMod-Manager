# 🎯 ModWing - Advanced Pterodactyl Mod Manager

> **Professional mod management for Pterodactyl panels with modern UI, automated dependency resolution, and seamless Modrinth integration.**

A sophisticated web application that revolutionizes how you browse, queue, and install Minecraft mods from Modrinth directly to your Pterodactyl servers. Features intelligent mod loader detection, dependency management, and a beautiful Bootstrap 5 interface with complete automation.

## 🔗 Repository

**GitHub:** [https://github.com/BLAZExFURY/PteroMod-Manager.git](https://github.com/BLAZExFURY/PteroMod-Manager.git)

![ModWing Interface](https://img.shields.io/badge/Status-Production%20Ready-brightgreen) ![Version](https://img.shields.io/badge/Version-1.0.0-blue) ![License](https://img.shields.io/badge/License-MIT-green) ![Python](https://img.shields.io/badge/Python-3.8+-blue) ![Node](https://img.shields.io/badge/Node.js-16+-green)

## ✨ Key Features

### 🆕 **Recent Modernization (v1.0.0)**
- **Complete Architecture Overhaul** - Migrated from Ferium to custom Python backend
- **Memory-Based Processing** - No more local file storage, everything processes in memory
- **Enhanced Security** - All configuration externalized to environment variables
- **Production Ready** - Comprehensive error handling, auto-cleanup, and robust deployment
- **Zero Bloat** - Removed all obsolete code and dependencies for clean codebase

### 🧠 **Intelligent Server Management**
- **Smart Mod Loader Detection** - Automatically detects Fabric, Forge, NeoForge, and Quilt
- **Version Auto-Detection** - Identifies Minecraft version from server configuration
- **Multi-Server Support** - Manage mods across multiple Pterodactyl servers simultaneously

### 📦 **Advanced Mod Management**
- **Modrinth Integration** - Browse and search thousands of mods directly
- **Dependency Resolution** - Automatically handles mod dependencies and conflicts
- **Queue System** - Queue multiple mods for batch installation with visual indicators
- **Duplicate Prevention** - Smart detection prevents duplicate installations

### 🚀 **Seamless Installation**
- **Memory-Based Processing** - Downloads processed in memory, no local storage bloat
- **Direct Server Upload** - Mods uploaded directly to server `/mods` folder
- **Auto-Cleanup** - Temporary files automatically removed after installation
- **Real-time Progress** - Live installation status and progress tracking
- **Zero Local Storage** - No permanent mod files stored locally after installation

### 💎 **Modern User Experience**
- **Bootstrap 5 UI** - Responsive, professional interface with custom color palette
- **Auto-Refresh** - Dynamic updates without manual page reloads
- **"Installed" Indicators** - Clear visual feedback for already installed mods
- **"Queued" Indicators** - Orange badges and highlights for queued mods
- **Mobile-Friendly** - Fully responsive design works on all devices
- **Smooth Animations** - Professional transitions and loading states
- **Accessibility Ready** - WCAG compliant design patterns

### 🛡️ **Security & Configuration**
- **Environment Variables** - Secure configuration via `.env` file
- **API Key Protection** - Separate Application and Client API keys
- **Input Validation** - Comprehensive validation and error handling
- **No Hardcoded Secrets** - All sensitive data externalized
- **Production Ready** - Robust error handling and graceful degradation

## 🚀 Quick Start

### Prerequisites
- Node.js 16+ 
- Python 3.8+ (with `requests` library)
- Pterodactyl Panel with Application API access

### Installation

1. **Clone and setup:**
   ```bash
   git clone https://github.com/BLAZExFURY/PteroMod-Manager.git
   cd PteroMod-Manager
   npm install
   ```

2. **Configure environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your settings (see Configuration section)
   ```

3. **Install Python dependencies:**
   ```bash
   pip install requests
   ```

4. **Start the application:**
   ```bash
   npm start
   # or for development:
   npm run dev
   ```

5. **Access the interface:**
   ```
   http://localhost:3000
   ```

## ⚙️ Configuration

### Environment Variables (.env)

Create a `.env` file in the project root:

```env
# Pterodactyl Panel Configuration (NO trailing slash!)
PTERODACTYL_URL=https://your-panel.example.com
APPLICATION_API_KEY=ptla_your_application_api_key_here

# Optional: Client API Key for enhanced file operations
CLIENT_API_KEY=ptlc_your_client_api_key_here

# Application Settings
PORT=3000
NODE_ENV=production
```

**⚠️ Important:** Ensure `PTERODACTYL_URL` has **no trailing slash** (`/`) at the end.

### API Key Setup

1. **Access your Pterodactyl Panel**
2. **Navigate to:** Account → API Credentials
3. **Create Application API Key** (starts with `ptla_`)
4. **Required Permissions:**
   - `server:read` - View servers
   - `server:file:read` - List server files
   - `server:file:write` - Upload mods to servers

## 🎮 How to Use

### Server Selection
1. Launch the application and view your available servers
2. Each server card shows:
   - Server name and status
   - Auto-detected mod loader (Fabric, Forge, etc.)
   - Minecraft version
   - Resource allocation

### Mod Browsing & Installation
1. **Select a server** to view compatible mods
2. **Browse mods** with automatic filtering for your server's mod loader and version
3. **Search and filter** by categories, popularity, or update date
4. **Add mods to queue** - mods show orange "Queued" badges and card highlights
5. **Install all queued mods** with one click - handles downloading and uploading automatically

### Advanced Features
- **Installed Mod Detection** - Already installed mods show with green "Installed" badges
- **Queue Visual Indicators** - Queued mods show orange "Queued" badges and card borders
- **Auto-Refresh** - UI updates automatically when new content is available
- **Dependency Resolution** - Automatically includes required dependencies
- **Error Handling** - Professional error messages and retry functionality

## 🏗️ Architecture

### Frontend
- **Framework:** Bootstrap 5 with custom CSS
- **JavaScript:** Vanilla ES6+ with modern async/await patterns
- **Features:** Auto-refresh, smooth animations, responsive design, queue indicators

### Backend
- **API Proxy:** Node.js + Express server with CORS handling
- **Mod Manager:** Custom Python script with intelligent dependency resolution
- **File Processing:** Memory-based processing with direct Pterodactyl integration
- **No Local Storage:** All mod processing happens in memory or temporary locations

### File Structure
```
├── 📄 Frontend
│   ├── index.html              # Main application interface
│   ├── script.js               # Frontend logic & API integration
│   └── styles.css              # Bootstrap 5 + custom styling
├── 🔧 Backend
│   ├── server.js               # Express proxy server
│   ├── python-mod-manager.js   # Python integration layer
│   └── modrinth_installer.py   # Custom mod installer with dependencies
├── ⚙️ Configuration
│   ├── package.json            # Node.js dependencies
│   ├── .env                    # Environment configuration
│   ├── .env.example            # Configuration template
│   └── .gitignore              # Git ignore rules
└── 📁 Runtime
    └── node_modules/           # Node.js dependencies (auto-generated)
```

## 🔧 Advanced Configuration

### Supported Mod Loaders
- **Fabric** - Auto-detected via `FABRIC_VERSION` environment variable
- **Quilt** - Auto-detected via `QUILT_VERSION` environment variable  
- **Forge** - Auto-detected via `FORGE_VERSION` or `BUILD_TYPE` variables
- **NeoForge** - Auto-detected via `NEOFORGE_VERSION` environment variable

### Server Detection Logic
The application automatically detects your server configuration by analyzing:
- Server environment variables
- Startup parameters
- Installed JAR files
- Server type configuration

### Custom Python Installer
- Downloads mods and dependencies from Modrinth API
- Processes files in memory for efficiency
- Handles version compatibility checking automatically
- Manages file naming and organization
- Integrates directly with Pterodactyl file upload API
- Zero local storage after installation completion

## 🐛 Troubleshooting

### Common Issues

**500/404 Connection Errors:**
- ❌ `PTERODACTYL_URL=http://your-panel.com/` (with trailing slash)
- ✅ `PTERODACTYL_URL=http://your-panel.com` (no trailing slash)
- Verify Pterodactyl panel URL is correct and accessible
- Ensure API key starts with `ptla_` and has proper permissions
- Check network connectivity and firewall settings

**Installation Failures:**
- Confirm server has write permissions to `/mods` directory
- Verify mod compatibility with detected loader/version
- Check Python dependencies are installed (`pip install requests`)

**UI Issues:**
- Clear browser cache and refresh
- Check browser console for JavaScript errors
- Ensure port 3000 is available and not blocked

### Debug Mode
Enable detailed logging by setting:
```env
NODE_ENV=development
```

## 🔮 Technical Details

### API Integration
- **Modrinth API v2** - For mod browsing and metadata
- **Pterodactyl Application API** - For server management and file operations
- **Custom Python Backend** - For mod processing and dependency resolution
- **Memory-Based Processing** - All endpoints use `/api/python-mod-manager/`

### Performance Optimizations
- Debounced search input (300ms delay)
- Intelligent pagination with lazy loading
- Auto-refresh with configurable intervals
- Efficient DOM manipulation and caching

### Security Features
- Environment-based configuration
- No hardcoded credentials in source code
- CORS handling via proxy server
- Input validation and sanitization

## 📦 Dependencies

### Node.js (Backend)
```json
{
  "cors": "^2.8.5",
  "dotenv": "^17.0.1", 
  "express": "^4.18.2",
  "form-data": "^4.0.3",
  "node-fetch": "^2.7.0"
}
```

### Python (Mod Processing)
```
requests>=2.28.0
```

## 🤝 Contributing

We welcome contributions! Please follow these guidelines:

1. **Code Style:** Follow existing patterns and use meaningful variable names
2. **Error Handling:** Include comprehensive error handling and user feedback
3. **Documentation:** Update README and code comments for significant changes
4. **Testing:** Test with multiple server configurations and mod loaders

### Development Setup
```bash
# Clone the repository
git clone https://github.com/BLAZExFURY/PteroMod-Manager.git
cd PteroMod-Manager

# Install dependencies
npm install
pip install requests

# Copy environment template
cp .env.example .env
# Edit .env with your Pterodactyl API keys

# Run in development mode
npm run dev

# Access with hot reload at http://localhost:3000
```

## 📄 License

**MIT License** - Feel free to modify and distribute!

## 🌟 Features in Detail

### Intelligent Mod Detection
- Automatically filters mods compatible with your server
- Shows mod loader and version requirements
- Prevents incompatible mod installation

### Professional UI/UX
- Smooth loading animations and transitions
- Mobile-responsive design for all devices
- Professional color scheme with accessibility considerations
- Intuitive navigation and user feedback

### Advanced Queue Management
- Visual queue display with orange "Queued" badges
- Orange card borders and highlights for queued mods
- Easy queue modification (add/remove mods)
- Batch installation with progress tracking
- Automatic dependency inclusion

### Real-time Updates
- Auto-refresh servers every 30 seconds
- Auto-refresh mods every 60 seconds  
- Auto-refresh queue every 10 seconds
- Instant UI updates after mod installation

## 🏆 What Makes PteroMod-Manager Special

### ⚡ **Performance & Efficiency**
- **Zero Local Storage** - All processing happens in memory or temporary locations
- **Intelligent Caching** - Smart caching strategies for optimal performance
- **Minimal Resource Usage** - Lightweight architecture with automatic cleanup
- **Scalable Design** - Handles multiple servers and large mod installations efficiently

### 🔧 **Enterprise-Grade Architecture**
- **Production Ready** - Comprehensive error handling and graceful degradation
- **Security First** - No hardcoded credentials, environment-based configuration
- **Maintainable Code** - Clean, documented, and well-structured codebase
- **Modern Standards** - Uses latest best practices and coding standards

### 🎯 **User-Centric Design**
- **Intuitive Interface** - Professional UI that requires no learning curve
- **Accessibility Ready** - Designed with WCAG compliance in mind
- **Mobile Optimized** - Full functionality on all device types
- **Real-time Feedback** - Instant visual feedback for all user actions

---

**PteroMod-Manager v1.0.0** - The most advanced Pterodactyl mod manager, built for the modern web.
