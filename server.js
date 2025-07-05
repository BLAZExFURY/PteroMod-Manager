const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const path = require('path');
const FormData = require('form-data');
const PythonModManager = require('./python-mod-manager'); // Python-based mod manager

// Load environment variables from .env file
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize Python Mod Manager
const pythonModManager = new PythonModManager(); // Python-based mod manager instance

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.raw({ limit: '50mb', type: 'application/octet-stream' }));

// Serve static files (your HTML, CSS, JS)
app.use(express.static('.'));

// Pterodactyl configuration - Use environment variables (required)
const PTERODACTYL_URL = process.env.PTERODACTYL_URL;
const APPLICATION_API_KEY = process.env.APPLICATION_API_KEY;
let CLIENT_API_KEY = process.env.CLIENT_API_KEY;

// Validate required environment variables
if (!PTERODACTYL_URL) {
    console.error('❌ PTERODACTYL_URL environment variable is required');
    console.error('📋 Please copy .env.example to .env and configure your settings');
    process.exit(1);
}

if (!APPLICATION_API_KEY) {
    console.error('❌ APPLICATION_API_KEY environment variable is required');
    console.error('📋 Please copy .env.example to .env and configure your settings');
    process.exit(1);
}

console.log('✅ Configuration loaded:');
console.log(`🌐 Pterodactyl URL: ${PTERODACTYL_URL}`);
console.log(`🔑 Application API Key: ${APPLICATION_API_KEY.substring(0, 10)}...`);
console.log(`🔑 Client API Key: ${CLIENT_API_KEY ? `${CLIENT_API_KEY.substring(0, 10)}...` : 'Not set (will prompt user)'}`);

// Proxy endpoint for Pterodactyl API
app.get('/api/pterodactyl/servers', async (req, res) => {
    try {
        console.log('🔄 Fetching servers from Pterodactyl...');
        
        const response = await fetch(`${PTERODACTYL_URL}/api/application/servers`, {
            headers: {
                'Authorization': `Bearer ${APPLICATION_API_KEY}`,
                'Accept': 'Application/vnd.pterodactyl.v1+json',
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log(`✅ Successfully fetched ${data.data?.length || 0} servers`);
        
        // Debug: Log server structure to understand UUID/ID differences
        if (data.data && data.data.length > 0) {
            console.log('🔍 Sample server structure:', JSON.stringify(data.data[0], null, 2));
        }
        
        res.json(data);
    } catch (error) {
        console.error('❌ Error fetching servers:', error.message);
        res.status(500).json({ 
            error: 'Failed to fetch servers', 
            details: error.message 
        });
    }
});

// Endpoint to set client API key
app.post('/api/pterodactyl/client-key', (req, res) => {
    try {
        const { clientKey } = req.body;
        
        if (!clientKey || typeof clientKey !== 'string') {
            return res.status(400).json({ 
                error: 'Invalid client key provided' 
            });
        }
        
        CLIENT_API_KEY = clientKey;
        console.log(`🔑 Client API key updated: ${clientKey.substring(0, 10)}...`);
        
        res.json({ 
            success: true, 
            message: 'Client API key updated successfully' 
        });
    } catch (error) {
        console.error('❌ Error setting client API key:', error.message);
        res.status(500).json({ 
            error: 'Failed to set client API key', 
            details: error.message 
        });
    }
});

// Endpoint to check if client API key is set
app.get('/api/pterodactyl/client-key/status', (req, res) => {
    res.json({ 
        hasClientKey: !!CLIENT_API_KEY,
        keyPreview: CLIENT_API_KEY ? `${CLIENT_API_KEY.substring(0, 10)}...` : null
    });
});

// Proxy endpoint for server details
app.get('/api/pterodactyl/servers/:serverId', async (req, res) => {
    try {
        const { serverId } = req.params;
        console.log(`🔄 Fetching server ${serverId} details...`);
        
        const response = await fetch(`${PTERODACTYL_URL}/api/application/servers/${serverId}`, {
            headers: {
                'Authorization': `Bearer ${APPLICATION_API_KEY}`,
                'Accept': 'Application/vnd.pterodactyl.v1+json',
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log(`✅ Successfully fetched server ${serverId} details`);
        
        res.json(data);
    } catch (error) {
        console.error(`❌ Error fetching server ${serverId}:`, error.message);
        res.status(500).json({ 
            error: 'Failed to fetch server details', 
            details: error.message 
        });
    }
});

// Proxy endpoint for detailed server information with startup variables
app.get('/api/pterodactyl/servers/:serverId/details', async (req, res) => {
    const { serverId } = req.params;
    
    try {
        console.log(`🔄 Fetching detailed server ${serverId} information...`);
        
        // Try different approaches to get server data
        let serverData = null;
        let serverResponse = null;
        
        // Try 1: Using the provided serverId (could be UUID or ID)
        console.log(`🔍 Trying serverId: ${serverId}`);
        serverResponse = await fetch(`${PTERODACTYL_URL}/api/application/servers/${serverId}`, {
            headers: {
                'Authorization': `Bearer ${APPLICATION_API_KEY}`,
                'Accept': 'Application/vnd.pterodactyl.v1+json',
                'Content-Type': 'application/json'
            }
        });

        if (serverResponse.ok) {
            serverData = await serverResponse.json();
            console.log(`✅ Successfully fetched server data using serverId: ${serverId}`);
        } else {
            console.log(`⚠️ Failed to fetch with serverId ${serverId}: ${serverResponse.status}`);
            
            // Try 2: If UUID failed, maybe we need to use internal ID
            // First get all servers to find the correct ID
            const allServersResponse = await fetch(`${PTERODACTYL_URL}/api/application/servers`, {
                headers: {
                    'Authorization': `Bearer ${APPLICATION_API_KEY}`,
                    'Accept': 'Application/vnd.pterodactyl.v1+json',
                    'Content-Type': 'application/json'
                }
            });
            
            if (allServersResponse.ok) {
                const allServers = await allServersResponse.json();
                const targetServer = allServers.data?.find(server => 
                    server.attributes.uuid === serverId || 
                    server.attributes.id === serverId ||
                    server.attributes.identifier === serverId
                );
                
                if (targetServer) {
                    console.log(`🔍 Found target server, trying with ID: ${targetServer.attributes.id}`);
                    
                    // Try with the internal ID
                    const serverByIdResponse = await fetch(`${PTERODACTYL_URL}/api/application/servers/${targetServer.attributes.id}`, {
                        headers: {
                            'Authorization': `Bearer ${APPLICATION_API_KEY}`,
                            'Accept': 'Application/vnd.pterodactyl.v1+json',
                            'Content-Type': 'application/json'
                        }
                    });
                    
                    if (serverByIdResponse.ok) {
                        serverData = await serverByIdResponse.json();
                        console.log(`✅ Successfully fetched server data using ID: ${targetServer.attributes.id}`);
                    }
                }
            }
        }

        if (!serverData) {
            throw new Error(`Could not fetch server data for ${serverId} using any method`);
        }
        
        // Now try to get startup variables
        console.log(`🔧 Trying to fetch startup variables for server...`);
        
        let startupData = null;
        
        // The variables are actually in the container.environment object!
        const containerEnv = serverData.attributes?.container?.environment;
        if (containerEnv) {
            startupData = { data: { variables: containerEnv } };
            console.log(`📋 Found variables in container environment:`, containerEnv);
        } else {
            console.log(`⚠️ No container environment found in server data`);
        }
        
        console.log(`✅ Successfully fetched detailed server ${serverId} information`);
        
        // Extract only the essential information for better UX
        const serverInfo = serverData.attributes;
        const limits = serverInfo.limits || {};
        
        // Combine the data with clean, simplified structure
        const detailedServer = {
            id: serverInfo.id,
            uuid: serverInfo.uuid,
            identifier: serverInfo.identifier,
            name: serverInfo.name,
            description: serverInfo.description,
            status: serverInfo.status || 'unknown',
            // Resource limits - only what users care about
            resources: {
                memory: limits.memory ? `${limits.memory} MB` : 'Unlimited',
                disk: limits.disk ? `${(limits.disk / 1024).toFixed(1)} GB` : 'Unlimited',
                cpu: limits.cpu ? `${limits.cpu}%` : 'Unlimited'
            },
            // Startup variables for mod loader detection
            startup: startupData,
            // Original data if needed for other operations
            original: serverData
        };
        
        res.json(detailedServer);
    } catch (error) {
        console.error(`❌ Error fetching detailed server ${serverId}:`, error.message);
        res.status(500).json({ 
            error: 'Failed to fetch detailed server information', 
            details: error.message 
        });
    }
});

// Get installed mods for a server
app.get('/api/pterodactyl/servers/:serverId/installed-mods', async (req, res) => {
    try {
        const { serverId } = req.params;
        console.log(`🔄 Fetching installed mods for server ${serverId}...`);
        
        // Check if client API key is set
        if (!CLIENT_API_KEY) {
            return res.status(401).json({ 
                error: 'Client API key required',
                details: 'Accessing server files requires a Client API key. Please configure it first.',
                requiresClientKey: true
            });
        }
        
        // Try to list files in /mods directory
        const modsListResponse = await fetch(`${PTERODACTYL_URL}/api/client/servers/${serverId}/files/list?directory=%2Fmods`, {
            headers: {
                'Authorization': `Bearer ${CLIENT_API_KEY}`,
                'Accept': 'Application/vnd.pterodactyl.v1+json',
                'Content-Type': 'application/json'
            }
        });
        
        let installedMods = [];
        
        if (modsListResponse.ok) {
            const modsData = await modsListResponse.json();
            const modFiles = modsData.data || [];
            
            // Filter for .jar files and extract mod information
            installedMods = modFiles
                .filter(file => 
                    file.attributes.is_file && 
                    file.attributes.name.toLowerCase().endsWith('.jar')
                )
                .map(file => {
                    const fileName = file.attributes.name;
                    const modName = fileName.replace(/\.jar$/i, '');
                    
                    // Try to extract mod slug/ID from filename
                    // Common patterns: modname-version.jar, modname_version.jar
                    const slugMatch = modName.match(/^([a-zA-Z0-9\-_]+?)[-_]?\d/);
                    const potentialSlug = slugMatch ? slugMatch[1].toLowerCase() : modName.toLowerCase();
                    
                    return {
                        fileName: fileName,
                        modName: modName,
                        potentialSlug: potentialSlug,
                        size: file.attributes.size,
                        modified: file.attributes.modified_at
                    };
                });
            
            console.log(`✅ Found ${installedMods.length} installed mods in /mods directory`);
        } else if (modsListResponse.status === 404) {
            console.log('📁 /mods directory not found - server has no mods installed');
            installedMods = [];
        } else {
            console.warn(`⚠️ Could not access /mods directory: ${modsListResponse.status}`);
            installedMods = [];
        }
        
        res.json({ 
            success: true,
            installedMods: installedMods,
            count: installedMods.length
        });
        
    } catch (error) {
        console.error(`❌ Error fetching installed mods for server ${req.params.serverId}:`, error.message);
        res.status(500).json({ 
            error: 'Failed to fetch installed mods', 
            details: error.message 
        });
    }
});

// Proxy endpoint for file operations - Download and upload mod to server
app.post('/api/pterodactyl/servers/:serverId/upload-mod', async (req, res) => {
    try {
        const { serverId } = req.params;
        const { modUrl, fileName } = req.body;
        
        // Check if client API key is set
        if (!CLIENT_API_KEY) {
            return res.status(401).json({ 
                error: 'Client API key required',
                details: 'File upload requires a Client API key. Please configure it first.',
                requiresClientKey: true
            });
        }
        
        console.log(`🔄 Starting mod upload to server ${serverId}: ${fileName}`);
        
        // Step 1: Download the mod file from Modrinth
        console.log(`📥 Downloading mod from: ${modUrl}`);
        const modResponse = await fetch(modUrl);
        if (!modResponse.ok) {
            throw new Error(`Failed to download mod: ${modResponse.status} ${modResponse.statusText}`);
        }
        
        const modBuffer = await modResponse.buffer();
        console.log(`✅ Downloaded mod file: ${modBuffer.length} bytes`);

        // Step 2: First, ensure mods directory exists
        console.log(`📁 Checking if mods directory exists on server ${serverId}...`);
        try {
            const filesResponse = await fetch(`${PTERODACTYL_URL}/api/client/servers/${serverId}/files/list?directory=/mods`, {
                headers: {
                    'Authorization': `Bearer ${CLIENT_API_KEY}`,
                    'Accept': 'application/json'
                }
            });
            
            if (!filesResponse.ok) {
                console.log(`📁 Mods directory doesn't exist, creating it...`);
                const createDirResponse = await fetch(`${PTERODACTYL_URL}/api/client/servers/${serverId}/files/create-folder`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${CLIENT_API_KEY}`,
                        'Accept': 'application/json',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        name: 'mods',
                        path: '/'
                    })
                });
                
                if (!createDirResponse.ok) {
                    console.warn('⚠️ Could not create mods directory');
                }
            }
        } catch (dirError) {
            console.log(`📁 Directory check failed, proceeding anyway: ${dirError.message}`);
        }

        // Step 3: Get file upload URL targeting mods directory directly
        console.log(`🔗 Getting upload URL for mods directory on server ${serverId}...`);
        
        // Try multiple directory parameter formats for better targeting
        let uploadUrlResponse;
        let uploadTargetedToMods = false;
        
        // Try 1: URL encoded mods directory path
        console.log(`🔗 Attempting upload to /mods directory (URL encoded)...`);
        uploadUrlResponse = await fetch(`${PTERODACTYL_URL}/api/client/servers/${serverId}/files/upload?directory=%2Fmods`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${CLIENT_API_KEY}`,
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        });

        if (uploadUrlResponse.ok) {
            uploadTargetedToMods = true;
            console.log(`✅ Got upload URL for mods directory (URL encoded)`);
        } else {
            console.log(`⚠️ URL encoded attempt failed (${uploadUrlResponse.status}), trying plain path...`);
            
            // Try 2: Plain mods directory path
            uploadUrlResponse = await fetch(`${PTERODACTYL_URL}/api/client/servers/${serverId}/files/upload?directory=/mods`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${CLIENT_API_KEY}`,
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            });
            
            if (uploadUrlResponse.ok) {
                uploadTargetedToMods = true;
                console.log(`✅ Got upload URL for mods directory (plain path)`);
            } else {
                console.log(`⚠️ Plain path attempt failed (${uploadUrlResponse.status}), trying just 'mods'...`);
                
                // Try 3: Just 'mods' as directory name
                uploadUrlResponse = await fetch(`${PTERODACTYL_URL}/api/client/servers/${serverId}/files/upload?directory=mods`, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${CLIENT_API_KEY}`,
                        'Accept': 'application/json',
                        'Content-Type': 'application/json'
                    }
                });
                
                if (uploadUrlResponse.ok) {
                    uploadTargetedToMods = true;
                    console.log(`✅ Got upload URL for mods directory (name only)`);
                } else {
                    console.log(`⚠️ All mods directory attempts failed, falling back to root...`);
                    
                    // Try 4: Fallback to root directory
                    uploadUrlResponse = await fetch(`${PTERODACTYL_URL}/api/client/servers/${serverId}/files/upload`, {
                        method: 'GET',
                        headers: {
                            'Authorization': `Bearer ${CLIENT_API_KEY}`,
                            'Accept': 'application/json',
                            'Content-Type': 'application/json'
                        }
                    });
                    
                    if (!uploadUrlResponse.ok) {
                        const errorText = await uploadUrlResponse.text();
                        throw new Error(`Failed to get any upload URL: ${uploadUrlResponse.status} - ${errorText}`);
                    }
                    
                    console.log(`⚠️ Using root directory upload (will need to move file)`);
                }
            }
        }

        const uploadData = await uploadUrlResponse.json();
        const uploadUrl = uploadData.attributes?.url;
        
        if (!uploadUrl) {
            throw new Error('No upload URL received from Pterodactyl');
        }
        
        console.log(`📤 Upload URL received: ${uploadUrl}`);
        console.log(`📤 Upload targeted to mods: ${uploadTargetedToMods ? '✅ Yes' : '⚠️ No (will verify/move after upload)'}`);

        // Step 4: Upload file
        const formData = new FormData();
        formData.append('files', modBuffer, fileName);
        
        const uploadResponse = await fetch(uploadUrl, {
            method: 'POST',
            body: formData
        });

        if (!uploadResponse.ok) {
            const errorText = await uploadResponse.text();
            throw new Error(`File upload failed: ${uploadResponse.status} - ${errorText}`);
        }

        console.log(`✅ File uploaded successfully using URL: ${uploadUrl}`);
        
        // Step 5: Verify the file is in the correct location and move if necessary
        console.log(`🔍 Verifying file location...`);
        try {
            // First check if it's in the mods directory
            const modsListResponse = await fetch(`${PTERODACTYL_URL}/api/client/servers/${serverId}/files/list?directory=%2Fmods`, {
                headers: {
                    'Authorization': `Bearer ${CLIENT_API_KEY}`,
                    'Accept': 'application/json'
                }
            });
            
            let fileInModsDirectory = false;
            if (modsListResponse.ok) {
                const modsFiles = await modsListResponse.json();
                fileInModsDirectory = modsFiles.data?.some(file => file.attributes?.name === fileName);
            }
            
            if (fileInModsDirectory) {
                console.log(`✅ ${fileName} is correctly in mods directory`);
            } else {
                console.log(`📁 ${fileName} not in mods directory, checking root...`);
                
                // Check if it's in the root directory
                const rootListResponse = await fetch(`${PTERODACTYL_URL}/api/client/servers/${serverId}/files/list?directory=%2F`, {
                    headers: {
                        'Authorization': `Bearer ${CLIENT_API_KEY}`,
                        'Accept': 'application/json'
                    }
                });
                
                if (rootListResponse.ok) {
                    const rootFiles = await rootListResponse.json();
                    const fileInRoot = rootFiles.data?.some(file => file.attributes?.name === fileName);
                    
                    if (fileInRoot) {
                        console.log(`📁 Moving ${fileName} from root to mods directory...`);
                        
                        // Use the rename endpoint to move the file
                        const moveResponse = await fetch(`${PTERODACTYL_URL}/api/client/servers/${serverId}/files/rename`, {
                            method: 'PUT',
                            headers: {
                                'Authorization': `Bearer ${CLIENT_API_KEY}`,
                                'Accept': 'application/json',
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                root: '/',
                                files: [
                                    {
                                        from: fileName,
                                        to: `mods/${fileName}`
                                    }
                                ]
                            })
                        });
                        
                        if (moveResponse.ok) {
                            console.log(`✅ Successfully moved ${fileName} to mods directory`);
                        } else {
                            const moveError = await moveResponse.text();
                            console.warn(`⚠️ Could not move ${fileName} to mods directory: ${moveResponse.status} - ${moveError}`);
                        }
                    } else {
                        console.warn(`⚠️ ${fileName} not found in root directory either`);
                    }
                }
            }
        } catch (verifyError) {
            console.warn(`⚠️ Could not verify/move file location: ${verifyError.message}`);
        }
        
        // Step 6: Final confirmation
        console.log(`✅ Mod ${fileName} upload process completed`);

        res.json({ 
            success: true, 
            message: `Successfully uploaded ${fileName} to server`,
            fileName: fileName,
            size: modBuffer.length
        });

    } catch (error) {
        console.error(`❌ Error uploading mod to server ${req.params.serverId}:`, error.message);
        res.status(500).json({ 
            error: 'Failed to upload mod to server', 
            details: error.message 
        });
    }
});

// Alternative file upload using Application API (fallback method)
app.post('/api/pterodactyl/servers/:serverId/upload-mod-alt', async (req, res) => {
    try {
        const { serverId } = req.params;
        const { modUrl, fileName } = req.body;
        
        console.log(`🔄 Starting alternative mod upload to server ${serverId}: ${fileName}`);
        
        // Step 1: Download the mod file from Modrinth
        console.log(`📥 Downloading mod from: ${modUrl}`);
        const modResponse = await fetch(modUrl);
        if (!modResponse.ok) {
            throw new Error(`Failed to download mod: ${modResponse.status} ${modResponse.statusText}`);
        }
        
        const modBuffer = await modResponse.buffer();
        console.log(`✅ Downloaded mod file: ${modBuffer.length} bytes`);
        
        // Step 2: Try to upload directly to mods directory via server command
        console.log(`📤 Attempting to write file directly to mods directory via server command...`);
        
        // Create the file directly in mods directory via server command
        const writeFileCommand = `echo '${modBuffer.toString('base64')}' | base64 -d > /home/container/mods/${fileName}`;
        
        const commandResponse = await fetch(`${PTERODACTYL_URL}/api/client/servers/${serverId}/command`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${APPLICATION_API_KEY}`,
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                command: writeFileCommand
            })
        });
        
        if (!commandResponse.ok) {
            // If command approach fails, try the client API approach
            console.log(`⚠️ Server command approach failed, trying client API with Application key...`);
            
            // Try using Application API key with client endpoints
            const uploadUrlResponse = await fetch(`${PTERODACTYL_URL}/api/client/servers/${serverId}/files/upload?directory=mods`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${APPLICATION_API_KEY}`,
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            });
            
            if (!uploadUrlResponse.ok) {
                const errorText = await uploadUrlResponse.text();
                throw new Error(`Upload method not available with current API key. You need a Client API key (ptlc_...) for file uploads. Error: ${errorText}`);
            }
            
            const uploadData = await uploadUrlResponse.json();
            const uploadUrl = uploadData.attributes?.url;
            
            if (!uploadUrl) {
                throw new Error('No upload URL received from Pterodactyl');
            }
            
            console.log(`📤 Upload URL received for mods directory: ${uploadUrl}`);
            
            // Create form data for file upload
            const formData = new FormData();
            formData.append('files', modBuffer, fileName);
            
            // Upload the file to Pterodactyl
            const uploadResponse = await fetch(uploadUrl, {
                method: 'POST',
                body: formData
            });
            
            if (!uploadResponse.ok) {
                const errorText = await uploadResponse.text();
                throw new Error(`File upload failed: ${uploadResponse.status} - ${errorText}`);
            }
            
            console.log(`✅ File uploaded successfully to mods directory on server ${serverId} via client API`);
        } else {
            console.log(`✅ File uploaded successfully to mods directory via server command`);
        }
        
        res.json({ 
            success: true, 
            message: `Successfully uploaded ${fileName} to server (alternative method)`,
            fileName: fileName,
            size: modBuffer.length
        });
        
    } catch (error) {
        console.error(`❌ Error uploading mod to server ${req.params.serverId}:`, error.message);
        res.status(500).json({ 
            error: 'Failed to upload mod to server', 
            details: error.message 
        });
    }
});

// Proxy endpoint for server power actions
app.post('/api/pterodactyl/servers/:serverId/power', async (req, res) => {
    try {
        const { serverId } = req.params;
        const { signal } = req.body;
        
        console.log(`🔄 Sending power signal "${signal}" to server ${serverId}...`);
        
        const response = await fetch(`${PTERODACTYL_URL}/api/client/servers/${serverId}/power`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${CLIENT_API_KEY || APPLICATION_API_KEY}`,
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ signal })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
        }

        console.log(`✅ Power signal "${signal}" sent successfully to server ${serverId}`);
        
        res.json({ success: true, action: signal });
    } catch (error) {
        console.error(`❌ Error sending power signal to server ${serverId}:`, error.message);
        res.status(500).json({ 
            error: 'Failed to send power signal', 
            details: error.message 
        });
    }
});

// ===== PYTHON MOD MANAGER ENDPOINTS =====

// Queue a mod for installation
app.post('/api/python-mod-manager/servers/:serverId/queue-mod', async (req, res) => {
    try {
        const { serverId } = req.params;
        const { modSlug, modData } = req.body;
        
        console.log(`📋 Queuing mod ${modSlug} for server ${serverId}`);
        
        const queue = await pythonModManager.queueMod(serverId, modSlug, modData);
        
        res.json({
            success: true,
            message: `Mod ${modData.title} queued for installation`,
            queue: queue
        });
    } catch (error) {
        console.error('❌ Error queuing mod:', error);
        res.status(500).json({
            error: 'Failed to queue mod',
            details: error.message
        });
    }
});

// Remove a mod from queue
app.delete('/api/python-mod-manager/servers/:serverId/queue-mod/:modSlug', async (req, res) => {
    try {
        const { serverId, modSlug } = req.params;
        
        console.log(`🗑️ Removing mod ${modSlug} from queue for server ${serverId}`);
        
        const queue = await pythonModManager.removeMod(serverId, modSlug);
        
        res.json({
            success: true,
            message: `Mod ${modSlug} removed from queue`,
            queue: queue
        });
    } catch (error) {
        console.error('❌ Error removing mod from queue:', error);
        res.status(500).json({
            error: 'Failed to remove mod from queue',
            details: error.message
        });
    }
});

// Get mod queue for a server
app.get('/api/python-mod-manager/servers/:serverId/queue', async (req, res) => {
    try {
        const { serverId } = req.params;
        const queue = pythonModManager.getModQueue(serverId);
        
        res.json({
            success: true,
            serverId: serverId,
            queue: queue,
            count: queue.length
        });
    } catch (error) {
        console.error('❌ Error getting mod queue:', error);
        res.status(500).json({
            error: 'Failed to get mod queue',
            details: error.message
        });
    }
});

// Install all queued mods using Python installer
app.post('/api/python-mod-manager/servers/:serverId/install-mods', async (req, res) => {
    try {
        const { serverId } = req.params;
        const { serverData } = req.body;
        
        console.log(`🚀 Installing queued mods for server ${serverId} using Python installer`);
        
        const result = await pythonModManager.installQueuedMods(serverId, serverData);
        
        res.json({
            success: true,
            message: 'Mods installed successfully using Python installer',
            ...result
        });
    } catch (error) {
        console.error('❌ Error installing mods:', error);
        res.status(500).json({
            error: 'Failed to install mods',
            details: error.message,
            queue: pythonModManager.getModQueue(req.params.serverId)
        });
    }
});

// Upload downloaded mods to Pterodactyl server
app.post('/api/python-mod-manager/servers/:serverId/upload-mods', async (req, res) => {
    try {
        const { serverId } = req.params;
        
        // Check if client API key is set
        if (!CLIENT_API_KEY) {
            return res.status(401).json({ 
                error: 'Client API key required',
                details: 'File upload requires a Client API key. Please configure it first.',
                requiresClientKey: true
            });
        }

        console.log(`📤 Uploading mods to Pterodactyl server ${serverId}`);
        
        // Get the download results from the Python mod manager
        const downloadResults = pythonModManager.getLastDownloadResults(serverId);
        
        if (!downloadResults || downloadResults.downloadedFiles.length === 0) {
            return res.status(400).json({
                error: 'No mods to upload',
                details: 'No mod files were downloaded. Please install mods first.'
            });
        }
        
        // First ensure mods directory exists
        console.log(`📁 Ensuring mods directory exists on server ${serverId}...`);
        try {
            const filesResponse = await fetch(`${PTERODACTYL_URL}/api/client/servers/${serverId}/files/list?directory=%2F`, {
                headers: {
                    'Authorization': `Bearer ${CLIENT_API_KEY}`,
                    'Accept': 'application/json'
                }
            });
            
            if (filesResponse.ok) {
                const files = await filesResponse.json();
                const modsExists = files.data.some(file => file.attributes.name === 'mods' && file.attributes.is_file === false);
                
                if (!modsExists) {
                    console.log(`📁 Creating mods directory...`);
                    const createDirResponse = await fetch(`${PTERODACTYL_URL}/api/client/servers/${serverId}/files/create-folder`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${CLIENT_API_KEY}`,
                            'Accept': 'application/json',
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            name: 'mods',
                            path: '/'
                        })
                    });
                    
                    if (createDirResponse.ok) {
                        console.log(`✅ Created mods directory`);
                    } else {
                        console.warn(`⚠️ Could not create mods directory: ${createDirResponse.status}`);
                    }
                }
            }
        } catch (dirError) {
            console.warn(`⚠️ Directory check failed: ${dirError.message}`);
        }

        // Check for and remove duplicate mods before uploading new ones
        console.log(`🔍 Checking for duplicate mods on server ${serverId}...`);
        try {
            const modsListResponse = await fetch(`${PTERODACTYL_URL}/api/client/servers/${serverId}/files/list?directory=%2Fmods`, {
                headers: {
                    'Authorization': `Bearer ${CLIENT_API_KEY}`,
                    'Accept': 'application/json'
                }
            });
            
            if (modsListResponse.ok) {
                const existingMods = await modsListResponse.json();
                const existingModNames = existingMods.data
                    .filter(file => file.attributes.is_file && file.attributes.name.endsWith('.jar'))
                    .map(file => file.attributes.name);
                
                console.log(`📂 Found ${existingModNames.length} existing mods on server`);
                
                // Check which new mods would be duplicates
                const newModNames = downloadResults.downloadedFiles.map(mod => mod.name);
                const duplicates = [];
                
                for (const newMod of newModNames) {
                    // Check for exact name matches or similar mod files
                    for (const existingMod of existingModNames) {
                        if (existingMod === newMod) {
                            duplicates.push(existingMod);
                        } else {
                            // Check for same mod with different versions (e.g., sodium-fabric-mc1.16.5-0.2.0+build.4.jar)
                            const newModBase = newMod.split(/[-_](?=mc\d|\d+\.\d)/)[0];
                            const existingModBase = existingMod.split(/[-_](?=mc\d|\d+\.\d)/)[0];
                            
                            if (newModBase && existingModBase && newModBase.toLowerCase() === existingModBase.toLowerCase()) {
                                duplicates.push(existingMod);
                            }
                        }
                    }
                }
                
                // Remove duplicates
                if (duplicates.length > 0) {
                    console.log(`🗑️ Removing ${duplicates.length} duplicate mods: ${duplicates.join(', ')}`);
                    
                    for (const duplicate of duplicates) {
                        try {
                            const deleteResponse = await fetch(`${PTERODACTYL_URL}/api/client/servers/${serverId}/files/delete`, {
                                method: 'POST',
                                headers: {
                                    'Authorization': `Bearer ${CLIENT_API_KEY}`,
                                    'Accept': 'application/json',
                                    'Content-Type': 'application/json'
                                },
                                body: JSON.stringify({
                                    root: '/mods',
                                    files: [duplicate]
                                })
                            });
                            
                            if (deleteResponse.ok) {
                                console.log(`✅ Deleted duplicate mod: ${duplicate}`);
                            } else {
                                console.warn(`⚠️ Failed to delete ${duplicate}: ${deleteResponse.status}`);
                            }
                        } catch (deleteError) {
                            console.warn(`⚠️ Error deleting ${duplicate}: ${deleteError.message}`);
                        }
                    }
                } else {
                    console.log(`✅ No duplicate mods found`);
                }
            }
        } catch (dupError) {
            console.warn(`⚠️ Duplicate check failed: ${dupError.message}`);
        }

        // Upload each mod file to Pterodactyl
        const uploadResults = [];
        
        for (const mod of downloadResults.downloadedFiles) {
            try {
                console.log(`📤 Uploading ${mod.name} to server ${serverId} mods directory...`);
                
                // Use the file data already in memory (mod.data)
                const modBuffer = mod.data;
                
                // Try multiple directory parameter formats for better compatibility
                let uploadUrlResponse;
                let uploadUrl;
                let uploadTargetedToMods = false;
                
                // Try 1: URL encoded mods path
                console.log(`🔗 Getting upload URL for /mods directory (URL encoded)...`);
                uploadUrlResponse = await fetch(`${PTERODACTYL_URL}/api/client/servers/${serverId}/files/upload?directory=%2Fmods`, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${CLIENT_API_KEY}`,
                        'Accept': 'application/json'
                    }
                });
                
                if (uploadUrlResponse.ok) {
                    uploadTargetedToMods = true;
                    console.log(`✅ Got upload URL for mods directory (URL encoded)`);
                } else {
                    console.log(`⚠️ URL encoded attempt failed (${uploadUrlResponse.status}), trying plain path...`);
                    
                    // Try 2: Plain mods path
                    uploadUrlResponse = await fetch(`${PTERODACTYL_URL}/api/client/servers/${serverId}/files/upload?directory=/mods`, {
                        method: 'GET',
                        headers: {
                            'Authorization': `Bearer ${CLIENT_API_KEY}`,
                            'Accept': 'application/json'
                        }
                    });
                    
                    if (uploadUrlResponse.ok) {
                        uploadTargetedToMods = true;
                        console.log(`✅ Got upload URL for mods directory (plain path)`);
                    } else {
                        console.log(`⚠️ Plain path attempt failed (${uploadUrlResponse.status}), trying name only...`);
                        
                        // Try 3: Just 'mods' as directory name
                        uploadUrlResponse = await fetch(`${PTERODACTYL_URL}/api/client/servers/${serverId}/files/upload?directory=mods`, {
                            method: 'GET',
                            headers: {
                                'Authorization': `Bearer ${CLIENT_API_KEY}`,
                                'Accept': 'application/json'
                            }
                        });
                        
                        if (uploadUrlResponse.ok) {
                            uploadTargetedToMods = true;
                            console.log(`✅ Got upload URL for mods directory (name only)`);
                        } else {
                            console.log(`⚠️ All mods directory attempts failed, falling back to root...`);
                            
                            // Try 4: Upload to root then move (fallback)
                            uploadUrlResponse = await fetch(`${PTERODACTYL_URL}/api/client/servers/${serverId}/files/upload`, {
                                method: 'GET',
                                headers: {
                                    'Authorization': `Bearer ${CLIENT_API_KEY}`,
                                    'Accept': 'application/json'
                                }
                            });
                            
                            if (!uploadUrlResponse.ok) {
                                throw new Error(`Failed to get any upload URL: ${uploadUrlResponse.status}`);
                            }
                            
                            console.log(`⚠️ Using root directory upload (will verify/move after upload)`);
                        }
                    }
                }
                
                const uploadData = await uploadUrlResponse.json();
                uploadUrl = uploadData.attributes.url;
                
                console.log(`✅ Got upload URL for ${mod.name}`);
                console.log(`📤 Upload targeted to mods: ${uploadTargetedToMods ? '✅ Yes' : '⚠️ No (will verify/move after upload)'}`);
                
                // Upload the file
                const formData = new FormData();
                formData.append('files', modBuffer, mod.name);
                
                const uploadResponse = await fetch(uploadUrl, {
                    method: 'POST',
                    body: formData
                });
                
                if (!uploadResponse.ok) {
                    throw new Error(`Upload failed: ${uploadResponse.status}`);
                }
                
                // Verify the file was uploaded to the correct location
                console.log(`🔍 Verifying ${mod.name} upload location...`);
                
                try {
                    // First check if it's in the mods directory
                    const modsListResponse = await fetch(`${PTERODACTYL_URL}/api/client/servers/${serverId}/files/list?directory=%2Fmods`, {
                        headers: {
                            'Authorization': `Bearer ${CLIENT_API_KEY}`,
                            'Accept': 'application/json'
                        }
                    });
                    
                    let fileInModsDirectory = false;
                    if (modsListResponse.ok) {
                        const modsFiles = await modsListResponse.json();
                        fileInModsDirectory = modsFiles.data.some(file => file.attributes.name === mod.name);
                    }
                    
                    if (fileInModsDirectory) {
                        console.log(`✅ ${mod.name} is correctly in mods directory`);
                    } else {
                        console.log(`📁 ${mod.name} not in mods directory, checking root...`);
                        
                        // Check if it's in the root directory
                        const rootListResponse = await fetch(`${PTERODACTYL_URL}/api/client/servers/${serverId}/files/list?directory=%2F`, {
                            headers: {
                                'Authorization': `Bearer ${CLIENT_API_KEY}`,
                                'Accept': 'application/json'
                            }
                        });
                        
                        if (rootListResponse.ok) {
                            const rootFiles = await rootListResponse.json();
                            const fileInRoot = rootFiles.data.some(file => file.attributes.name === mod.name);
                            
                            if (fileInRoot) {
                                console.log(`📁 Moving ${mod.name} from root to mods directory...`);
                                
                                // Use the rename endpoint to move the file
                                const moveResponse = await fetch(`${PTERODACTYL_URL}/api/client/servers/${serverId}/files/rename`, {
                                    method: 'PUT',
                                    headers: {
                                        'Authorization': `Bearer ${CLIENT_API_KEY}`,
                                        'Accept': 'application/json',
                                        'Content-Type': 'application/json'
                                    },
                                    body: JSON.stringify({
                                        root: '/',
                                        files: [
                                            {
                                                from: mod.name,
                                                to: `mods/${mod.name}`
                                            }
                                        ]
                                    })
                                });
                                
                                if (moveResponse.ok) {
                                    console.log(`✅ Successfully moved ${mod.name} to mods directory`);
                                } else {
                                    const moveError = await moveResponse.text();
                                    console.warn(`⚠️ Could not move ${mod.name} to mods directory: ${moveResponse.status} - ${moveError}`);
                                }
                            } else {
                                console.warn(`⚠️ ${mod.name} not found in root directory either`);
                            }
                        }
                    }
                } catch (verifyError) {
                    console.warn(`⚠️ Failed to verify/move ${mod.name}:`, verifyError.message);
                }
                
                uploadResults.push({
                    file: mod.name,
                    status: 'success',
                    size: mod.size,
                    location: !uploadTargetedToMods ? 'moved to mods/' : 'uploaded to mods/'
                });
                
                console.log(`✅ Successfully uploaded ${mod.name} to mods directory`);
                
            } catch (error) {
                console.error(`❌ Failed to upload ${mod.name}:`, error);
                uploadResults.push({
                    file: mod.name,
                    status: 'error',
                    error: error.message
                });
            }
        }
        
        const successCount = uploadResults.filter(r => r.status === 'success').length;
        const errorCount = uploadResults.filter(r => r.status === 'error').length;
        
        // Clear download results after upload
        pythonModManager.clearDownloadResults(serverId);
        console.log(`🧹 Cleared download results for server ${serverId}`);
        
        res.json({
            success: errorCount === 0,
            message: `Uploaded ${successCount}/${downloadResults.downloadedFiles.length} mods to server`,
            results: uploadResults,
            summary: {
                total: downloadResults.downloadedFiles.length,
                successful: successCount,
                failed: errorCount,
                newFiles: successCount // All uploaded files are new since we don't store locally
            }
        });
        
    } catch (error) {
        console.error('❌ Error uploading mods:', error);
        res.status(500).json({
            error: 'Failed to upload mods',
            details: error.message
        });
    }
});

// Clear mod queue for a server
app.delete('/api/python-mod-manager/servers/:serverId/queue', async (req, res) => {
    try {
        const { serverId } = req.params;
        
        pythonModManager.clearQueue(serverId);
        
        res.json({
            success: true,
            message: `Cleared mod queue for server ${serverId}`
        });
    } catch (error) {
        console.error('❌ Error clearing queue:', error);
        res.status(500).json({
            error: 'Failed to clear queue',
            details: error.message
        });
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        pterodactyl_url: PTERODACTYL_URL
    });
});

// Start server
app.listen(PORT, () => {
    console.log('🚀 Pterodactyl Proxy Server Started!');
    console.log(`📍 Server running at: http://localhost:${PORT}`);
    console.log(`🔗 Pterodactyl panel: ${PTERODACTYL_URL}`);
    console.log(`🔑 Application API key: ${APPLICATION_API_KEY.substring(0, 10)}...`);
    console.log(`🔐 Client API key: ${CLIENT_API_KEY ? CLIENT_API_KEY.substring(0, 10) + '...' : 'Not set (required for file uploads)'}`);
    console.log('');
    console.log(`✅ Open your browser and go to: http://localhost:${PORT}`);
});
