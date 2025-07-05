const { spawn, exec } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

class PythonModManager {
    constructor() {
        this.modQueue = new Map(); // serverId -> array of mod slugs
        this.downloadResults = new Map(); // serverId -> download results for upload
        this.pythonScript = path.join(__dirname, 'modrinth_installer.py');
        
        this.initDirectories();
    }

    async initDirectories() {
        try {
            console.log('📁 Python Mod Manager initialized');
        } catch (error) {
            console.error('❌ Failed to initialize mod manager:', error);
        }
    }

    /**
     * Get a temporary download directory for mod processing
     */
    getTempDownloadDir() {
        return path.join(os.tmpdir(), 'modwing-downloads', Date.now().toString());
    }

    /**
     * Queue a mod for installation
     */
    queueMod(serverId, modSlug, modData) {
        if (!this.modQueue.has(serverId)) {
            this.modQueue.set(serverId, []);
        }
        
        const queue = this.modQueue.get(serverId);
        
        // Check if mod is already queued
        const existingMod = queue.find(mod => mod.slug === modSlug);
        if (existingMod) {
            console.log(`ℹ️ Mod ${modSlug} is already queued for server ${serverId}`);
            return queue;
        }
        
        // Add mod to queue
        const queuedMod = {
            slug: modSlug,
            title: modData.title || modSlug,
            status: 'queued',
            queuedAt: new Date().toISOString(),
            ...modData
        };
        
        queue.push(queuedMod);
        console.log(`📋 Queued mod ${modSlug} for server ${serverId}`);
        
        return queue;
    }

    /**
     * Remove a mod from the queue
     */
    removeMod(serverId, modSlug) {
        if (!this.modQueue.has(serverId)) {
            return [];
        }
        
        const queue = this.modQueue.get(serverId);
        const initialLength = queue.length;
        
        // Remove mod from queue
        const filteredQueue = queue.filter(mod => mod.slug !== modSlug);
        this.modQueue.set(serverId, filteredQueue);
        
        const removedCount = initialLength - filteredQueue.length;
        if (removedCount > 0) {
            console.log(`🗑️ Removed mod ${modSlug} from queue for server ${serverId}`);
        }
        
        return filteredQueue;
    }

    /**
     * Get the mod queue for a server
     */
    getModQueue(serverId) {
        return this.modQueue.get(serverId) || [];
    }

    /**
     * Clear the entire queue for a server
     */
    clearQueue(serverId) {
        this.modQueue.set(serverId, []);
        console.log(`🧹 Cleared mod queue for server ${serverId}`);
        return [];
    }

    /**
     * Extract mod loader and game version from server data
     */
    extractServerInfo(serverData) {
        console.log('🔍 Extracting server info for Python installer:', {
            serverData: serverData,
            container: serverData?.container,
            environment: serverData?.environment || serverData?.container?.environment,
            modLoader: serverData?.modLoader,
            version: serverData?.version
        });

        let modLoader = 'forge'; // Default
        let gameVersion = '1.20.1'; // Default

        // First, check if server data already has detected modLoader and version
        if (serverData?.modLoader) {
            modLoader = serverData.modLoader.toLowerCase();
            console.log(`🎯 Using pre-detected mod loader: ${modLoader}`);
        }
        
        if (serverData?.version) {
            gameVersion = serverData.version;
            console.log(`🎯 Using pre-detected game version: ${gameVersion}`);
        }

        // Try to get environment from different possible locations
        let environment = serverData?.environment || serverData?.container?.environment || serverData?.data?.original?.container?.environment;
        
        if (environment) {
            // Extract game version (only if not already detected)
            if (!serverData?.version) {
                if (environment.MC_VERSION) {
                    gameVersion = environment.MC_VERSION;
                } else if (environment.VERSION) {
                    gameVersion = environment.VERSION;
                } else if (environment.MINECRAFT_VERSION) {
                    gameVersion = environment.MINECRAFT_VERSION;
                }
            }

            // Extract mod loader (only if not already detected)
            if (!serverData?.modLoader) {
                // Priority order: check for specific variables that indicate the loader
                if (environment.FABRIC_VERSION !== undefined) {
                    modLoader = 'fabric';
                    console.log(`🎯 Detected Fabric loader via FABRIC_VERSION: ${environment.FABRIC_VERSION}`);
                } else if (environment.QUILT_VERSION !== undefined) {
                    modLoader = 'quilt';
                    console.log(`🎯 Detected Quilt loader via QUILT_VERSION: ${environment.QUILT_VERSION}`);
                } else if (environment.NEOFORGE_VERSION !== undefined) {
                    modLoader = 'neoforge';
                    console.log(`🎯 Detected NeoForge loader via NEOFORGE_VERSION: ${environment.NEOFORGE_VERSION}`);
                } else if (environment.FORGE_VERSION !== undefined || 
                          (environment.BUILD_TYPE && environment.BUILD_TYPE.includes('recommended'))) {
                    modLoader = 'forge';
                    console.log(`🎯 Detected Forge loader via FORGE_VERSION or BUILD_TYPE`);
                } else if (environment.TYPE) {
                    // Fallback to TYPE field if no specific version variables found
                    const type = environment.TYPE.toLowerCase();
                    if (type.includes('fabric')) {
                        modLoader = 'fabric';
                        console.log(`🎯 Detected Fabric loader via TYPE: ${environment.TYPE}`);
                    } else if (type.includes('quilt')) {
                        modLoader = 'quilt';
                        console.log(`🎯 Detected Quilt loader via TYPE: ${environment.TYPE}`);
                    } else if (type.includes('neoforge')) {
                        modLoader = 'neoforge';
                        console.log(`🎯 Detected NeoForge loader via TYPE: ${environment.TYPE}`);
                    } else if (type.includes('forge')) {
                        modLoader = 'forge';
                        console.log(`🎯 Detected Forge loader via TYPE: ${environment.TYPE}`);
                    }
                }
            }
        }

        const result = { modLoader, gameVersion };
        console.log(`🔧 Detected server configuration:`, result);
        return result;
    }

    /**
     * Install all queued mods using Python script
     */
    async installQueuedMods(serverId, serverData) {
        const queue = this.getModQueue(serverId);
        
        if (queue.length === 0) {
            throw new Error('No mods in queue to install');
        }

        console.log(`🚀 Installing ${queue.length} queued mods for server ${serverId} using Python installer...`);

        // Declare tempDownloadDir at function scope
        let tempDownloadDir;

        try {
            // Extract server configuration
            const { modLoader, gameVersion } = this.extractServerInfo(serverData);
            
            // Create temporary download directory
            tempDownloadDir = this.getTempDownloadDir();
            await fs.mkdir(tempDownloadDir, { recursive: true });
            console.log(`📁 Using temporary download directory: ${tempDownloadDir}`);
            
            // Install each mod using Python script to temp directory
            const downloadedFiles = [];
            const failedMods = [];
            
            for (const mod of queue) {
                try {
                    mod.status = 'installing';
                    console.log(`📦 Installing mod: ${mod.title} (${mod.slug})...`);
                    
                    // Run Python installer for this mod
                    const result = await this.runPythonInstaller(
                        mod.slug,
                        modLoader,
                        gameVersion,
                        tempDownloadDir
                    );
                    
                    if (result.success) {
                        mod.status = 'installed';
                        mod.installedAt = new Date().toISOString();
                        console.log(`✅ Python installer reported success for: ${mod.title}`);
                    } else {
                        mod.status = 'error';
                        mod.error = result.error;
                        failedMods.push(mod);
                        console.error(`❌ Failed to install ${mod.title}: ${result.error}`);
                    }
                    
                } catch (error) {
                    console.error(`❌ Error installing mod ${mod.slug}:`, error.message);
                    mod.status = 'error';
                    mod.error = error.message;
                    failedMods.push(mod);
                }
            }
            
            // Get all newly downloaded files from temp directory
            let allFiles = [];
            let jarFiles = [];
            
            try {
                allFiles = await fs.readdir(tempDownloadDir);
                jarFiles = allFiles.filter(f => f.endsWith('.jar'));
                console.log(`📁 Found ${allFiles.length} total files in temp directory: ${allFiles.join(', ')}`);
                console.log(`📦 Found ${jarFiles.length} JAR files: ${jarFiles.join(', ')}`);
            } catch (readDirError) {
                console.error(`❌ Failed to read temp directory ${tempDownloadDir}:`, readDirError.message);
                jarFiles = [];
            }
            
            // Get detailed info for newly downloaded files
            const downloadedFileStats = [];
            if (jarFiles.length > 0) {
                for (const file of jarFiles) {
                    try {
                        const filePath = path.join(tempDownloadDir, file);
                        const stats = await fs.stat(filePath);
                        downloadedFileStats.push({
                            name: file,
                            size: stats.size,
                            modified: stats.mtime.toISOString(),
                            path: filePath,
                            sizeFormatted: `${(stats.size / 1024 / 1024).toFixed(2)} MB`
                        });
                        console.log(`✅ Verified file: ${file} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
                    } catch (statError) {
                        console.error(`❌ Failed to stat file ${file}:`, statError.message);
                    }
                }
            } else {
                console.log(`⚠️ No JAR files found in temp directory after installation`);
            }
            
            console.log(`✅ Downloaded ${downloadedFileStats.length} NEW files (mods + dependencies)`);
            downloadedFileStats.forEach(file => {
                console.log(`  📦 NEW: ${file.name} (${file.sizeFormatted})`);
            });
            
            const successfulMods = queue.filter(mod => mod.status === 'installed');
            console.log(`✅ Python installer completed ${successfulMods.length}/${queue.length} mods for server ${serverId}`);
            
            // Verify that we have files for the successful mods
            if (successfulMods.length > 0 && downloadedFileStats.length === 0) {
                console.warn(`⚠️ Warning: ${successfulMods.length} mods reported as successful but no files found in temp directory`);
                console.log(`📁 Temp directory contents:`, allFiles);
                
                // Try to re-scan the directory one more time
                try {
                    const rescannedFiles = await fs.readdir(tempDownloadDir);
                    const rescannedJars = rescannedFiles.filter(f => f.endsWith('.jar'));
                    console.log(`🔍 Re-scan found ${rescannedJars.length} JAR files: ${rescannedJars.join(', ')}`);
                } catch (rescanError) {
                    console.error(`❌ Re-scan failed:`, rescanError.message);
                }
            }
            
            // Store download results for later upload
            this.storeDownloadResults(serverId, {
                directory: tempDownloadDir,
                files: downloadedFileStats,
                successfulMods: successfulMods.length,
                failedMods: failedMods.length
            });
            
            console.log(`✅ Successfully installed ${successfulMods.length} mods to queue for server ${serverId}`);
            
            // Read all downloaded files into memory for upload
            const fileData = [];
            for (const fileInfo of downloadedFileStats) {
                try {
                    const filePath = path.join(tempDownloadDir, fileInfo.name);
                    const fileBuffer = await fs.readFile(filePath);
                    fileData.push({
                        name: fileInfo.name,
                        data: fileBuffer,
                        size: fileInfo.size
                    });
                    console.log(`📋 Loaded ${fileInfo.name} into memory for upload`);
                } catch (readError) {
                    console.error(`❌ Failed to read ${fileInfo.name}: ${readError.message}`);
                }
            }
            
            const results = {
                success: true,
                queue: queue,
                downloadedFiles: fileData, // Store actual file data, not paths
                totalFiles: fileData.length,
                successfulMods: successfulMods.length,
                failedMods: failedMods.length
            };
            
            // Store results for upload
            this.storeDownloadResults(serverId, results);
            
            return results;
            
        } catch (error) {
            console.error(`❌ Failed to install mods for server ${serverId}:`, error);
            
            // Mark all mods as failed
            queue.forEach(mod => {
                if (mod.status === 'installing') {
                    mod.status = 'error';
                    mod.error = error.message;
                }
            });
            
            throw error;
        } finally {
            // Clean up temporary directory
            if (tempDownloadDir) {
                try {
                    await fs.rm(tempDownloadDir, { recursive: true, force: true });
                    console.log(`🧹 Cleaned up temporary directory: ${tempDownloadDir}`);
                } catch (cleanupError) {
                    console.warn(`⚠️ Failed to clean up temp directory: ${cleanupError.message}`);
                }
            }
        }
    }

    /**
     * Run the Python installer script for a single mod
     */
    async runPythonInstaller(modSlug, loader, gameVersion, downloadDir) {
        return new Promise((resolve) => {
            const args = [
                this.pythonScript,
                modSlug,
                '--loader', loader,
                '--game-version', gameVersion,
                '--download-dir', downloadDir
            ];
            
            console.log(`🐍 Running: python3 ${args.join(' ')}`);
            
            const process = spawn('python3', args, {
                stdio: ['pipe', 'pipe', 'pipe']
            });
            
            let stdout = '';
            let stderr = '';
            let isResolved = false;
            
            // Set a timeout to prevent hanging processes (2 minutes)
            const timeout = setTimeout(() => {
                if (!isResolved) {
                    console.log(`⏰ Python installer timeout for ${modSlug}, killing process...`);
                    process.kill('SIGTERM');
                    isResolved = true;
                    resolve({
                        success: false,
                        error: `Installation timeout after 2 minutes for ${modSlug}`,
                        stdout: stdout,
                        stderr: stderr
                    });
                }
            }, 120000); // 2 minutes timeout
            
            process.stdout.on('data', (data) => {
                const output = data.toString();
                stdout += output;
                // Log Python output in real-time
                output.split('\\n').forEach(line => {
                    if (line.trim()) {
                        console.log(`  🐍 ${line.trim()}`);
                    }
                });
            });
            
            process.stderr.on('data', (data) => {
                stderr += data.toString();
            });
            
            process.on('close', (code) => {
                if (!isResolved) {
                    clearTimeout(timeout);
                    isResolved = true;
                    
                    if (code === 0) {
                        resolve({
                            success: true,
                            stdout: stdout,
                            stderr: stderr
                        });
                    } else {
                        resolve({
                            success: false,
                            error: `Python installer failed with code ${code}${stderr ? ': ' + stderr : ''}`,
                            stdout: stdout,
                            stderr: stderr
                        });
                    }
                }
            });
            
            process.on('error', (error) => {
                if (!isResolved) {
                    clearTimeout(timeout);
                    isResolved = true;
                    resolve({
                        success: false,
                        error: `Failed to run Python installer: ${error.message}`,
                        stdout: stdout,
                        stderr: stderr
                    });
                }
            });
        });
    }

    /**
     * Get list of downloaded mod files in a directory
     */
    async getDownloadedMods(modDirectory) {
        try {
            const files = await fs.readdir(modDirectory);
            const modFiles = files.filter(file => file.endsWith('.jar'));
            
            const fileStats = await Promise.all(
                modFiles.map(async (file) => {
                    const filePath = path.join(modDirectory, file);
                    const stats = await fs.stat(filePath);
                    return {
                        name: file,
                        size: stats.size,
                        modified: stats.mtime.toISOString(),
                        path: filePath,
                        sizeFormatted: `${(stats.size / 1024 / 1024).toFixed(2)} MB`
                    };
                })
            );
            
            return fileStats;
        } catch (error) {
            console.error('❌ Error reading mod directory:', error);
            return [];
        }
    }

    /**
     * Store download results for later upload
     */
    storeDownloadResults(serverId, results) {
        this.downloadResults.set(serverId, results);
    }

    /**
     * Get stored download results for upload
     */
    getLastDownloadResults(serverId) {
        return this.downloadResults.get(serverId);
    }

    /**
     * Clear download results after upload
     */
    clearDownloadResults(serverId) {
        this.downloadResults.delete(serverId);
    }
}

module.exports = PythonModManager;
