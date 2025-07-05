// ===== PTERODACTYL MOD MANAGER =====
// Global variables
let selectedServer = null;
let currentPage = 0;
let totalPages = 0;
let totalModsCount = 0;
let modsPerPage = 20;
let currentQuery = '';
let isLoading = false;
let allMods = [];

// Installed mods tracking
let installedMods = [];
let installedModSlugs = new Set();

// Performance optimization variables - Updated 2025-07-05 v3 - Improved Refresh UI
let animationQueue = [];
let isAnimating = false;
let lastScrollTime = 0;
let scrollThrottle = false;

// Dynamic refresh variables
let refreshIntervals = {
    servers: null,
    mods: null,
    queue: null
};
let lastServerCount = 0;
let lastModsQuery = '';
let isAutoRefreshEnabled = true;

// Utility functions
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Pterodactyl Mod Manager starting...');
    
    // Start with server selection page
    loadServersForSelection();
    
    // Set up event listeners
    setupEventListeners();
});

// Set up event listeners
function setupEventListeners() {
    // Search functionality
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        let searchTimeout;
        searchInput.addEventListener('input', function() {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                currentQuery = this.value;
                currentPage = 0; // Reset to first page on search
                loadModsForServer();
            }, 300);
        });
        
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                currentPage = 0; // Reset to first page on search
                loadModsForServer(); // Use the correct function name
            }
        });
    }
    
    // Filter functionality
    const categoryFilter = document.getElementById('categoryFilter');
    const sortFilter = document.getElementById('sortFilter');
    
    if (categoryFilter) {
        categoryFilter.addEventListener('change', () => {
            currentPage = 0; // Reset to first page on filter change
            loadModsForServer();
        });
    }
    
    if (sortFilter) {
        sortFilter.addEventListener('change', () => {
            currentPage = 0; // Reset to first page on sort change
            loadModsForServer();
        });
    }
    
    // Add ripple effect to buttons with proper error handling
    document.addEventListener('click', (e) => {
        if (e.target.matches('button, .btn')) {
            try {
                addRippleEffect(e);
            } catch (error) {
                // Silently ignore ripple effect errors
                console.debug('Ripple effect error (non-critical):', error);
            }
        }
        
        // Handle mod queue button clicks
        if (e.target.matches('.queue-mod-btn') || e.target.closest('.queue-mod-btn')) {
            const button = e.target.matches('.queue-mod-btn') ? e.target : e.target.closest('.queue-mod-btn');
            const projectId = button.dataset.projectId;
            const modTitle = button.dataset.modTitle;
            const modSlug = button.dataset.modSlug;
            const action = button.dataset.action || 'add';
            
            if (projectId && modTitle) {
                if (action === 'remove') {
                    removeFromQueue(projectId);
                } else {
                    queueMod(projectId, modTitle, { slug: modSlug });
                }
            }
        }
    });
    
    // Add smooth scroll behavior to page with performance optimization
    document.documentElement.style.scrollBehavior = 'smooth';
    
    // Add page transition classes
    document.body.classList.add('page-transition', 'active');
    
    // Optimize scroll performance
    optimizeScrollPerformance();
    
    // Start dynamic refresh system
    startDynamicRefresh();
}

// ===== REFRESH UI SYSTEM =====

// ===== DYNAMIC REFRESH SYSTEM =====

// ===== DYNAMIC REFRESH SYSTEM =====

function startDynamicRefresh() {
    console.log('🔄 Starting dynamic refresh system...');
    
    // Auto-refresh servers every 30 seconds when on server selection page
    refreshIntervals.servers = setInterval(() => {
        if (isAutoRefreshEnabled && document.querySelector('.servers-selection-container')) {
            console.log('🔄 Auto-refreshing servers...');
            loadServersForSelection(true); // silent refresh
        }
    }, 30000);
    
    // Auto-refresh mods every 60 seconds when viewing mods
    refreshIntervals.mods = setInterval(() => {
        if (isAutoRefreshEnabled && selectedServer && document.querySelector('.mods-container')) {
            console.log('🔄 Auto-refreshing mods and installed mods...');
            // Refresh both installed mods and available mods
            Promise.all([
                fetchInstalledMods(selectedServer.id, true),
                loadModsForServer(true)
            ]).then(() => {
                console.log('🔄 Mods and installed mods refreshed');
            });
        }
    }, 60000);
    
    // Auto-refresh queue every 10 seconds when server is selected
    refreshIntervals.queue = setInterval(() => {
        if (isAutoRefreshEnabled && selectedServer) {
            refreshModQueue();
        }
    }, 10000);
    
    // Add visibility change handler to pause/resume refresh when tab is hidden
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            pauseDynamicRefresh();
        } else {
            resumeDynamicRefresh();
        }
    });
}

function pauseDynamicRefresh() {
    console.log('⏸️ Pausing dynamic refresh (tab hidden)');
    isAutoRefreshEnabled = false;
}

function resumeDynamicRefresh() {
    console.log('▶️ Resuming dynamic refresh (tab visible)');
    isAutoRefreshEnabled = true;
    
    // Immediately refresh current view
    if (document.querySelector('.servers-selection-container')) {
        loadServersForSelection(true);
    } else if (selectedServer && document.querySelector('.mods-container')) {
        // Refresh both installed mods and available mods
        Promise.all([
            fetchInstalledMods(selectedServer.id, true),
            loadModsForServer(true)
        ]);
        refreshModQueue();
    }
}

function stopDynamicRefresh() {
    console.log('🛑 Stopping dynamic refresh system');
    Object.values(refreshIntervals).forEach(interval => {
        if (interval) clearInterval(interval);
    });
    refreshIntervals = { servers: null, mods: null, queue: null };
}

// Refresh mod queue silently
async function refreshModQueue() {
    if (!selectedServer) return;
    
    try {
        const response = await fetch(`/api/python-mod-manager/servers/${selectedServer.id}/queue`);
        if (response.ok) {
            const result = await response.json();
            const newQueue = result.queue || [];
            
            // Only update if queue actually changed
            if (JSON.stringify(newQueue) !== JSON.stringify(modQueue)) {
                modQueue = newQueue;
                updateQueueDisplay();
                updateModButtons();
                console.log(`🔄 Queue updated: ${modQueue.length} mods`);
            }
        }
        
    } catch (error) {
        console.debug('Queue refresh failed (non-critical):', error.message);
    }
}

function stopDynamicRefresh() {
    console.log('🛑 Stopping dynamic refresh system');
    Object.values(refreshIntervals).forEach(interval => {
        if (interval) clearInterval(interval);
    });
    refreshIntervals = { servers: null, mods: null, queue: null };
}

// Performance optimization functions
function optimizeScrollPerformance() {
    // Throttle scroll events to prevent performance issues
    let scrollTimeout;
    window.addEventListener('scroll', () => {
        if (!scrollThrottle) {
            scrollThrottle = true;
            requestAnimationFrame(() => {
                scrollThrottle = false;
            });
        }
    }, { passive: true });
    
    // Use Intersection Observer for better performance
    setupIntersectionObserver();
}

function setupIntersectionObserver() {
    const observerOptions = {
        root: null,
        rootMargin: '50px',
        threshold: 0.1
    };
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting && !entry.target.classList.contains('observed')) {
                entry.target.classList.add('observed');
                requestAnimationFrame(() => {
                    entry.target.style.opacity = '1';
                    entry.target.style.transform = 'translateY(0) translateZ(0)';
                });
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);
    
    return observer;
}

// Fetch installed mods for the selected server
async function fetchInstalledMods(serverId, silent = false) {
    try {
        if (!silent) {
            console.log(`🔄 Fetching installed mods for server: ${serverId}`);
        }
        
        const response = await fetch(`/api/pterodactyl/servers/${serverId}/installed-mods`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        installedMods = data.installedMods || [];
        
        // Create a Set of potential slugs for quick lookup
        installedModSlugs = new Set();
        installedMods.forEach(installedMod => {
            // Add the potential slug (basic approach)
            installedModSlugs.add(installedMod.potentialSlug);
            
            // Add the full mod name in lowercase
            installedModSlugs.add(installedMod.modName.toLowerCase());
            
            // Add filename without .jar
            const baseFileName = installedMod.fileName.replace(/\.jar$/i, '').toLowerCase();
            installedModSlugs.add(baseFileName);
            
            // Add more sophisticated slug generation
            // Remove version numbers and common suffixes
            const cleanName = baseFileName
                .replace(/-\d+[\.\d]*[\w\-]*$/g, '') // Remove version patterns like -1.2.3-forge
                .replace(/-forge$/g, '') // Remove -forge
                .replace(/-fabric$/g, '') // Remove -fabric
                .replace(/-neoforge$/g, '') // Remove -neoforge
                .replace(/[^a-z0-9]/g, ''); // Remove special characters
            
            installedModSlugs.add(cleanName);
            
            // Also add the original name with just special chars removed
            const simpleClean = installedMod.modName.toLowerCase().replace(/[^a-z0-9]/g, '');
            installedModSlugs.add(simpleClean);
        });
        
        if (!silent) {
            console.log(`✅ Found ${installedMods.length} installed mods`);
            if (installedMods.length > 0) {
                console.log(`📦 Installed mods: ${installedMods.map(m => m.fileName).join(', ')}`);
                console.log(`🔍 Generated slugs for matching:`, Array.from(installedModSlugs));
            }
        }
        
        return installedMods;
        
    } catch (error) {
        console.error('❌ Error fetching installed mods:', error);
        installedMods = [];
        installedModSlugs = new Set();
        return [];
    }
}

// Check if a mod is already installed
function isModInstalled(mod) {
    if (installedModSlugs.size === 0) return false;
    
    // Generate different variants of the mod identifier
    const modSlug = mod.slug.toLowerCase();
    const modTitle = mod.title.toLowerCase();
    const modTitleClean = modTitle.replace(/[^a-z0-9]/g, '');
    
    // Debug logging for REI specifically
    const isREI = modTitle.includes('roughly enough items');
    if (isREI) {
        console.log(`🔍 Checking REI mod: "${mod.title}" (slug: "${modSlug}")`);
        console.log(`🔍 Available installed slugs:`, Array.from(installedModSlugs));
        console.log(`🔍 Cleaned title: "${modTitleClean}"`);
    }
    
    // Check against mod slug (primary identifier)
    if (installedModSlugs.has(modSlug)) {
        if (isREI) console.log(`✅ REI matched by slug: ${modSlug}`);
        return true;
    }
    
    // Check against cleaned mod title
    if (installedModSlugs.has(modTitleClean)) {
        if (isREI) console.log(`✅ REI matched by cleaned title: ${modTitleClean}`);
        return true;
    }
    
    // Check for fuzzy matches
    for (const installedSlug of installedModSlugs) {
        // Direct substring matches
        if (installedSlug.includes(modSlug) || modSlug.includes(installedSlug)) {
            // Additional check to avoid false positives on very short matches
            if (modSlug.length > 3 && installedSlug.length > 3) {
                if (isREI) console.log(`✅ REI matched by substring: ${installedSlug} <-> ${modSlug}`);
                return true;
            }
        }
        
        // Check title-based matches
        if (installedSlug.includes(modTitleClean) || modTitleClean.includes(installedSlug)) {
            if (modTitleClean.length > 3 && installedSlug.length > 3) {
                if (isREI) console.log(`✅ REI matched by title substring: ${installedSlug} <-> ${modTitleClean}`);
                return true;
            }
        }
        
        // Check for common abbreviations (like REI for Roughly Enough Items)
        if (modTitle.includes('roughly enough items') && installedSlug.includes('roughlyenoughitems')) {
            if (isREI) console.log(`✅ REI matched by specific check: ${installedSlug}`);
            return true;
        }
    }
    
    if (isREI) console.log(`❌ REI not matched by any method`);
    return false;
}

// Load servers for selection (landing page)
async function loadServersForSelection(silent = false) {
    if (!silent) {
        console.log('🔄 Loading servers for selection...');
    }
    
    const serverLoading = document.getElementById('serverLoading');
    const serverError = document.getElementById('serverError');
    const serversGrid = document.getElementById('serversSelectionGrid');
    const setupBanner = document.getElementById('setupBanner');
    
    // Show loading state only for non-silent refresh
    if (!silent) {
        serverLoading.style.display = 'block';
        serverError.style.display = 'none';
        serversGrid.innerHTML = '';
    }
    
    try {
        // Check if proxy is running
        const response = await fetch('/api/pterodactyl/servers');
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        const servers = data.data || [];
        
        if (!silent) {
            console.log(`✅ Loaded ${servers.length} servers for selection`);
        }
        
        // Check if server count changed (for auto-refresh notifications)
        if (silent && lastServerCount > 0 && servers.length !== lastServerCount) {
            console.log(`🔄 Server count changed: ${lastServerCount} → ${servers.length}`);
            showNotification(`🔄 Server list updated! Found ${servers.length} servers.`, 'info');
        }
        lastServerCount = servers.length;
        
        // Hide loading and setup banner only for non-silent refresh
        if (!silent) {
            serverLoading.style.display = 'none';
            setupBanner.style.display = 'none';
        }
        
        // Render server selection cards
        renderServerSelectionCards(servers);
        
    } catch (error) {
        console.error('❌ Error loading servers:', error);
        
        // Only show error UI for non-silent refresh
        if (!silent) {
            // Hide loading, show error and setup banner
            serverLoading.style.display = 'none';
            serverError.style.display = 'block';
            setupBanner.style.display = 'block';
            
            const errorMessage = document.getElementById('serverErrorMessage');
            if (errorMessage) {
                errorMessage.textContent = error.message.includes('Failed to fetch') 
                    ? 'Cannot connect to proxy server. Please make sure the proxy is running.'
                    : error.message;
            }
        }
    }
}

// Render server selection cards
function renderServerSelectionCards(servers) {
    const serversGrid = document.getElementById('serversSelectionGrid');
    
    if (servers.length === 0) {
        serversGrid.innerHTML = `
            <div class="no-servers">
                <i class="fas fa-server"></i>
                <h3>No servers found</h3>
                <p>No servers are available in your Pterodactyl panel.</p>
            </div>
        `;
        return;
    }
    
    serversGrid.innerHTML = servers.map(server => {
        const serverName = server.attributes.name;
        const serverStatus = getServerStatusDisplay(server.attributes.status);
        const serverNode = server.attributes.node;
        
        return `
            <div class="server-selection-card" onclick="selectServer('${server.attributes.uuid}', '${serverName}')">
                <div class="server-card-header">
                    <h3 class="server-name">${serverName}</h3>
                    ${serverStatus.text ? `<span class="server-status ${serverStatus.class}">${serverStatus.text}</span>` : ''}
                </div>
                <div class="server-details">
                    <div class="server-detail-item">
                        <i class="fas fa-memory"></i>
                        <span>RAM: ${server.attributes.limits.memory ? server.attributes.limits.memory + ' MB' : 'Unlimited'}</span>
                    </div>
                    <div class="server-detail-item">
                        <i class="fas fa-hdd"></i>
                        <span>Storage: ${server.attributes.limits.disk ? Math.round(server.attributes.limits.disk / 1024 * 100) / 100 + ' GB' : 'Unlimited'}</span>
                    </div>
                </div>
                <div class="server-compatibility">
                    <div class="compatibility-title">🎯 Server Configuration</div>
                    <div class="compatibility-specs" id="compat-${server.attributes.uuid}">
                        <div class="compatibility-spec loading">
                            <i class="fas fa-spinner fa-spin"></i>
                            <span>Detecting mod loader & version...</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    // Load server details for each server to show compatibility
    servers.forEach(server => {
        loadServerCompatibility(server.attributes.uuid);
    });
}

// Load server compatibility info
async function loadServerCompatibility(serverId) {
    try {
        const response = await fetch(`/api/pterodactyl/servers/${serverId}/details`);
        const data = await response.json();
        
        const compatElement = document.getElementById(`compat-${serverId}`);
        if (!compatElement) return;
        
        const { modLoader, version } = extractServerSpecs(data);
        
        let specsHTML = '';
        
        // Only show loader if we have one
        if (modLoader) {
            specsHTML += `
                <div class="compatibility-spec ready">
                    <i class="fas fa-cube"></i>
                    <span>${modLoader}</span>
                </div>
            `;
        }
        
        // Only show version if we have one
        if (version) {
            specsHTML += `
                <div class="compatibility-spec ready">
                    <i class="fas fa-tag"></i>
                    <span>MC ${version}</span>
                </div>
            `;
        }
        
        // If no specs available, show a fallback message
        if (!specsHTML) {
            specsHTML = `
                <div class="compatibility-spec">
                    <i class="fas fa-server"></i>
                    <span>Vanilla Server</span>
                </div>
            `;
        }
        
        compatElement.innerHTML = specsHTML;
    } catch (error) {
        console.warn(`⚠️ Could not load compatibility for server ${serverId}:`, error);
        const compatElement = document.getElementById(`compat-${serverId}`);
        if (compatElement) {
            compatElement.innerHTML = `
                <div class="compatibility-spec error">
                    <i class="fas fa-exclamation-triangle"></i>
                    <span>Detection failed</span>
                </div>
            `;
        }
    }
}

// Select a server and move to mods page
async function selectServer(serverId, serverName) {
    console.log(`🎯 Selected server: ${serverName} (${serverId})`);
    
    try {
        // Show loading state
        const serverSelectionPage = document.getElementById('serverSelectionPage');
        const modsPage = document.getElementById('modsPage');
        
        serverSelectionPage.style.display = 'none';
        modsPage.style.display = 'block';
        
        // Update breadcrumb and header
        document.getElementById('breadcrumb').style.display = 'flex';
        document.getElementById('currentServerName').textContent = serverName;
        document.getElementById('headerSubtitle').textContent = `Browse mods for ${serverName}`;
        
        // Load detailed server info
        const response = await fetch(`/api/pterodactyl/servers/${serverId}/details`);
        const serverData = await response.json();
        
        // Extract server specs
        const { modLoader, version } = extractServerSpecs(serverData);
        
        // Set selected server
        selectedServer = {
            id: serverId,
            name: serverName,
            data: serverData,
            modLoader: modLoader,
            version: version
        };
        
        // Update server info bar
        document.getElementById('selectedServerName').textContent = serverName;
        document.getElementById('selectedServerLoader').textContent = modLoader || '';
        document.getElementById('selectedServerVersion').textContent = version ? `MC ${version}` : '';
        
        // Update resource information
        if (serverData.resources) {
            document.getElementById('selectedServerRAM').textContent = serverData.resources.memory || '';
            document.getElementById('selectedServerStorage').textContent = serverData.resources.disk || '';
        } else {
            // Fallback to original data structure
            const limits = serverData.original?.attributes?.limits || {};
            document.getElementById('selectedServerRAM').textContent = limits.memory ? `${limits.memory} MB` : '';
            document.getElementById('selectedServerStorage').textContent = limits.disk ? `${Math.round(limits.disk / 1024 * 100) / 100} GB` : '';
        }
        
        // Hide empty spec items
        hideEmptySpecItems();
        
        console.log(`✅ Server configured: ${modLoader} ${version}`);
        
        // Fetch installed mods for this server
        await fetchInstalledMods(serverId);
        
        // Load mod queue for this server
        await loadModQueueForServer();
        
        // Load compatible mods
        loadModsForServer();
        
    } catch (error) {
        console.error('❌ Error selecting server:', error);
        alert('Failed to select server. Please try again.');
        goToServerSelection();
    }
}

// Hide empty spec items
function hideEmptySpecItems() {
    const specItems = document.querySelectorAll('.spec-item');
    specItems.forEach(item => {
        const textSpan = item.querySelector('span');
        if (textSpan && (!textSpan.textContent || textSpan.textContent.trim() === '')) {
            item.style.display = 'none';
        } else {
            item.style.display = 'flex';
        }
    });
}

// Go back to server selection
function goToServerSelection() {
    console.log('🔙 Returning to server selection...');
    
    selectedServer = null;
    currentPage = 0;
    currentQuery = '';
    allMods = [];
    
    document.getElementById('serverSelectionPage').style.display = 'block';
    document.getElementById('modsPage').style.display = 'none';
    document.getElementById('breadcrumb').style.display = 'none';
    document.getElementById('headerSubtitle').textContent = 'Select your server and browse compatible mods automatically';
    
    // Clear search input
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.value = '';
    }
    
    // Reset filters
    const categoryFilter = document.getElementById('categoryFilter');
    const sortFilter = document.getElementById('sortFilter');
    if (categoryFilter) categoryFilter.value = '';
    if (sortFilter) sortFilter.value = 'relevance';
    
    // Reload servers
    loadServersForSelection();
}

// Load mods for the selected server
async function loadModsForServer(silent = false) {
    if (!selectedServer) {
        console.error('❌ No server selected');
        return;
    }
    
    if (isLoading && !silent) return;
    isLoading = true;
    
    if (!silent) {
        console.log(`🔄 Loading mods for server: ${selectedServer.name} (${selectedServer.modLoader} ${selectedServer.version})`);
    }
    
    const loading = document.getElementById('loading');
    const error = document.getElementById('error');
    
    // Use enhanced loading state only for non-silent refresh
    if (currentPage === 0 && !silent) {
        setLoadingState(true);
    }
    
    if (!silent) {
        loading.style.display = 'block';
        error.style.display = 'none';
    }
    
    try {
        // Build query parameters for Modrinth API
        const params = new URLSearchParams({
            limit: '20',
            offset: currentPage * 20,
            index: getSortOrder(),
            facets: buildFacets()
        });
        
        if (currentQuery) {
            params.append('query', currentQuery);
        }
        
        const response = await fetch(`https://api.modrinth.com/v2/search?${params}`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        const mods = data.hits || [];
        
        if (!silent) {
            console.log(`✅ Loaded ${mods.length} mods (compatible with ${selectedServer.modLoader} ${selectedServer.version})`);
        }
        
        // Check if mod results changed (for auto-refresh notifications)
        const currentQueryKey = `${currentQuery}-${currentPage}`;
        if (silent && lastModsQuery && currentQueryKey !== lastModsQuery && mods.length > 0) {
            console.log(`🔄 Mod results updated`);
            showNotification('🔄 Mod catalog updated with latest results!', 'info');
        }
        lastModsQuery = currentQueryKey;
        
        if (!silent) {
            loading.style.display = 'none';
            setLoadingState(false);
        }
        
        // Process mods for page-based navigation (replace content each time)
        allMods = mods;
        renderMods(mods);
        
        // Calculate pagination based on available data
        // If we got a full page (20 mods), assume there are more pages
        if (mods.length === modsPerPage) {
            // We have at least currentPage + 1 pages, but likely more
            totalPages = Math.max(currentPage + 2, 10); // Minimum 10 pages for full results
        } else {
            // This is the last page
            totalPages = currentPage + 1;
        }
        
        // Update total mods count estimate
        totalModsCount = totalPages * modsPerPage;
        
        // Update pagination display
        updatePagination(mods.length);
        
        // Show pagination container
        const paginationContainer = document.getElementById('paginationContainer');
        if (paginationContainer) {
            // Only show pagination if we have more than one page
            paginationContainer.style.display = (totalPages > 1) ? 'block' : 'none';
        }
        
    } catch (error) {
        console.error('❌ Error loading mods:', error);
        
        if (!silent) {
            loading.style.display = 'none';
            const errorElement = document.getElementById('error');
            if (errorElement) {
                errorElement.style.display = 'block';
            }
            
            const errorMessage = document.getElementById('errorMessage');
            if (errorMessage) {
                errorMessage.textContent = error.message;
            }
        }
    }
    
    isLoading = false;
}

// Build facets for Modrinth API based on selected server
function buildFacets() {
    const facets = [];
    
    // Project type (mod)
    facets.push(['project_type:mod']);
    
    // Mod loader filter (auto-detected from server)
    if (selectedServer.modLoader) {
        const loaderName = selectedServer.modLoader.toLowerCase();
        facets.push([`categories:${loaderName}`]);
    }
    
    // Version filter (auto-detected from server)
    if (selectedServer.version) {
        facets.push([`versions:${selectedServer.version}`]);
    }
    
    // Category filter (user selected)
    const categoryFilter = document.getElementById('categoryFilter');
    if (categoryFilter && categoryFilter.value) {
        facets.push([`categories:${categoryFilter.value}`]);
    }
    
    return JSON.stringify(facets);
}

// Get sort order
function getSortOrder() {
    const sortFilter = document.getElementById('sortFilter');
    if (!sortFilter) return 'relevance';
    
    return sortFilter.value;
}

// Extract server specs from server data
function extractServerSpecs(serverData) {
    const variables = serverData.startup?.data?.variables || {};
    
    console.log('🔍 Extracting server specs from variables:', variables);
    
    let modLoader = '';
    let version = '';
    
    // Extract Minecraft version
    const versionKeys = ['MC_VERSION', 'MINECRAFT_VERSION', 'VERSION', 'GAME_VERSION'];
    for (const key of versionKeys) {
        if (variables[key]) {
            version = variables[key];
            break;
        }
    }
    
    // Extract mod loader - check for presence of loader-specific variables (priority order)
    // This matches the logic in python-mod-manager.js
    if (variables.FABRIC_VERSION !== undefined) {
        modLoader = 'Fabric';
        console.log(`🎯 Found Fabric loader via FABRIC_VERSION: ${variables.FABRIC_VERSION}`);
    } else if (variables.QUILT_VERSION !== undefined) {
        modLoader = 'Quilt';
        console.log(`🎯 Found Quilt loader via QUILT_VERSION: ${variables.QUILT_VERSION}`);
    } else if (variables.NEOFORGE_VERSION !== undefined) {
        modLoader = 'NeoForge';
        console.log(`🎯 Found NeoForge loader via NEOFORGE_VERSION: ${variables.NEOFORGE_VERSION}`);
    } else if (variables.FORGE_VERSION !== undefined || 
              (variables.BUILD_TYPE && variables.BUILD_TYPE.includes('recommended'))) {
        modLoader = 'Forge';
        console.log(`🎯 Found Forge loader via FORGE_VERSION or BUILD_TYPE`);
    } else if (variables.TYPE) {
        // Fallback to TYPE field if no specific version variables found
        const type = variables.TYPE.toLowerCase();
        if (type.includes('fabric')) {
            modLoader = 'Fabric';
            console.log(`🎯 Found Fabric loader via TYPE: ${variables.TYPE}`);
        } else if (type.includes('quilt')) {
            modLoader = 'Quilt';
            console.log(`🎯 Found Quilt loader via TYPE: ${variables.TYPE}`);
        } else if (type.includes('neoforge')) {
            modLoader = 'NeoForge';
            console.log(`🎯 Found NeoForge loader via TYPE: ${variables.TYPE}`);
        } else if (type.includes('forge')) {
            modLoader = 'Forge';
            console.log(`🎯 Found Forge loader via TYPE: ${variables.TYPE}`);
        }
    }
    
    console.log(`📋 Detected: ${modLoader} ${version}`);
    
    return { modLoader, version };
}

// Render mods grid with optimized animations
function renderMods(mods, isUpdate = false) {
    const modsGrid = document.getElementById('modsGrid');
    
    if (mods.length === 0) {
        modsGrid.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-search"></i>
                <h3>No compatible mods found</h3>
                <p>Try adjusting your search terms or check back later for new mods compatible with ${selectedServer.modLoader} ${selectedServer.version}.</p>
            </div>
        `;
        return;
    }
    
    // If this is an update (after installation), smoothly update existing cards
    if (isUpdate && modsGrid.children.length > 0) {
        console.log('🔄 Smoothly updating existing mod cards...');
        
        // Add a subtle loading overlay
        modsGrid.style.position = 'relative';
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(34, 40, 49, 0.3);
            backdrop-filter: blur(2px);
            z-index: 10;
            opacity: 0;
            transition: opacity 0.3s ease;
            border-radius: 15px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #DFD0B8;
            font-size: 1.1rem;
        `;
        overlay.innerHTML = '<i class="fas fa-sync fa-spin" style="margin-right: 10px;"></i>Updating installed status...';
        modsGrid.appendChild(overlay);
        
        // Fade in overlay
        requestAnimationFrame(() => {
            overlay.style.opacity = '1';
        });
        
        // After a short delay, update the content
        setTimeout(() => {
            // Clear and re-render
            modsGrid.innerHTML = '';
            
            // Create fragment for better performance
            const fragment = document.createDocumentFragment();
            
            mods.forEach((mod, index) => {
                const cardElement = document.createElement('div');
                cardElement.innerHTML = createModCard(mod);
                const card = cardElement.firstElementChild;
                
                // Set initial state for smooth animation
                card.style.opacity = '0';
                card.style.transform = 'translateY(10px) translateZ(0)';
                card.style.transition = 'all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
                
                fragment.appendChild(card);
            });
            
            // Add all cards at once
            modsGrid.appendChild(fragment);
            
            // Animate cards in efficiently
            const cards = modsGrid.querySelectorAll('.mod-card');
            cards.forEach((card, index) => {
                requestAnimationFrame(() => {
                    setTimeout(() => {
                        card.style.opacity = '1';
                        card.style.transform = 'translateY(0) translateZ(0)';
                    }, index * 30); // Faster stagger for updates
                });
            });
            
        }, 500);
        
        return;
    }
    
    // Clear the grid for fresh render
    modsGrid.innerHTML = '';
    
    // Create fragment for better performance
    const fragment = document.createDocumentFragment();
    
    mods.forEach((mod, index) => {
        const cardElement = document.createElement('div');
        cardElement.innerHTML = createModCard(mod);
        const card = cardElement.firstElementChild;
        
        // Set initial state for smooth animation
        card.style.opacity = '0';
        card.style.transform = 'translateY(20px) translateZ(0)';
        card.style.transition = 'all 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
        
        fragment.appendChild(card);
    });
    
    // Add all cards at once
    modsGrid.appendChild(fragment);
    
    // Animate cards in efficiently
    const cards = modsGrid.querySelectorAll('.mod-card');
    cards.forEach((card, index) => {
        requestAnimationFrame(() => {
            setTimeout(() => {
                card.style.opacity = '1';
                card.style.transform = 'translateY(0) translateZ(0)';
            }, index * 50); // Reduced stagger time for faster loading
        });
    });
    
    console.log(`✅ Rendered ${mods.length} mods${isUpdate ? ' (updated)' : ''}`);
    
    // Update mod button states to reflect queue status
    setTimeout(() => {
        updateModButtons();
    }, 200); // Small delay to ensure DOM is updated
}

// Append mods to existing grid
function appendMods(mods) {
    const modsGrid = document.getElementById('modsGrid');
    const startIndex = modsGrid.children.length;
    
    mods.forEach((mod, index) => {
        setTimeout(() => {
            const cardElement = document.createElement('div');
            cardElement.innerHTML = createModCard(mod);
            const card = cardElement.firstElementChild;
            
            // Add entrance animation
            card.style.opacity = '0';
            card.style.transform = 'translateY(20px) scale(0.95)';
            
            modsGrid.appendChild(card);
            
            // Trigger animation
            requestAnimationFrame(() => {
                card.style.transition = 'all 0.6s cubic-bezier(0.4, 0, 0.2, 1)';
                card.style.opacity = '1';
                card.style.transform = 'translateY(0) scale(1)';
            });
        }, index * 100); // Stagger the animations
    });
}

// Create mod card HTML
function createModCard(mod) {
    // Create a proper fallback icon using a data URI
    const fallbackIcon = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHZpZXdCb3g9IjAgMCA2NCA2NCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0IiByeD0iOCIgZmlsbD0iIzM5M0U0NiIvPgo8cGF0aCBkPSJNMjAgMjBIMjhWMjhIMjBWMjBaIiBmaWxsPSIjREZEMEI4Ii8+CjxwYXRoIGQ9Ik0zNiAyMEg0NFYyOEgzNlYyMFoiIGZpbGw9IiNERkQwQjgiLz4KPHBhdGggZD0iTTIwIDM2SDI4VjQ0SDIwVjM2WiIgZmlsbD0iI0RGRDBCOCIvPgo8cGF0aCBkPSJNMzYgMzZINDRWNDRIMzZWMzZaIiBmaWxsPSIjREZEMEI4Ii8+CjwvcGN+PC9zdmc+';
    
    const iconUrl = mod.icon_url || mod.gallery?.find(img => img.featured)?.url || fallbackIcon;
    const description = mod.description || 'No description available';
    const downloads = formatNumber(mod.downloads);
    const follows = formatNumber(mod.follows);
    const updateDate = new Date(mod.date_modified).toLocaleDateString();
    
    // Check if mod is already installed
    const isInstalled = isModInstalled(mod);
    
    // Check if mod is currently queued
    const isQueued = modQueue.some(queuedMod => queuedMod.slug === mod.project_id || queuedMod.slug === mod.slug);
    
    // Escape HTML to prevent injection and onclick issues
    const safeTitle = mod.title.replace(/'/g, '&#39;').replace(/"/g, '&quot;');
    const safeDescription = description.replace(/'/g, '&#39;').replace(/"/g, '&quot;');
    const safeFallbackIcon = fallbackIcon; // Make fallback accessible in template
    
    // Generate badges for different states
    const installedBadge = isInstalled ? '<div class="installed-badge"><i class="fas fa-check-circle"></i> Installed</div>' : '';
    const queuedBadge = (!isInstalled && isQueued) ? '<div class="queued-badge"><i class="fas fa-list"></i> Queued</div>' : '';
    
    // Determine button state and text
    let buttonClass, buttonText, buttonDisabled, actionData;
    
    if (isInstalled) {
        buttonClass = 'install-btn already-installed';
        buttonText = '<i class="fas fa-check"></i> Already Installed';
        buttonDisabled = 'disabled';
        actionData = '';
    } else if (isQueued) {
        buttonClass = 'install-btn queue-mod-btn queued';
        buttonText = '<i class="fas fa-list"></i> Queued - Click to Remove';
        buttonDisabled = '';
        actionData = 'data-action="remove"';
    } else {
        buttonClass = 'install-btn queue-mod-btn';
        buttonText = '<i class="fas fa-plus"></i> Add to Queue';
        buttonDisabled = '';
        actionData = 'data-action="add"';
    }
    
    return `
        <div class="mod-card ${isInstalled ? 'mod-installed' : ''} ${isQueued ? 'mod-queued' : ''}">
            ${installedBadge}
            ${queuedBadge}
            <div class="mod-header">
                <div class="mod-title">
                    <img src="${iconUrl}" alt="${safeTitle}" class="mod-icon" onerror="this.src='${safeFallbackIcon}'; this.onerror=null;">
                    <h3 class="mod-name">${safeTitle}</h3>
                </div>
                <p class="mod-author">by ${mod.author}</p>
            </div>
            
            <div class="mod-content">
                <p class="mod-description">${safeDescription}</p>
                
                <div class="mod-stats">
                    <div class="stat">
                        <i class="fas fa-download"></i>
                        <span>${downloads}</span>
                    </div>
                    <div class="stat">
                        <i class="fas fa-heart"></i>
                        <span>${follows}</span>
                    </div>
                    <div class="stat">
                        <i class="fas fa-clock"></i>
                        <span>${updateDate}</span>
                    </div>
                </div>
                
                <div class="mod-categories">
                    ${mod.categories.slice(0, 3).map(cat => `<span class="category-tag">${cat}</span>`).join('')}
                </div>
                
                <div class="mod-actions">
                    <a href="https://modrinth.com/mod/${mod.slug}" target="_blank" class="view-btn">
                        <i class="fas fa-external-link-alt"></i> View Details
                    </a>
                    <button class="${buttonClass}" 
                            data-project-id="${mod.project_id}" 
                            data-mod-title="${mod.title}" 
                            data-mod-slug="${mod.slug}"
                            ${actionData}
                            ${buttonDisabled}>
                        ${buttonText}
                    </button>
                </div>
            </div>
            
            <div class="mod-footer">
                <span class="mod-version">Latest</span>
                <span class="mod-updated">Updated ${updateDate}</span>
            </div>
        </div>
    `;
}

// Install mod to server
async function installMod(projectId, modTitle) {
    console.log(`🔄 Installing mod: ${modTitle} to server: ${selectedServer.name}`);
    
    // Find the button that triggered this installation
    const installButtons = document.querySelectorAll(`button[onclick*="${projectId}"]`);
    const button = installButtons[0];
    
    if (button) {
        setButtonLoading(button, true);
        button.addEventListener('click', addRippleEffect);
    }
    
    try {
        showNotification(`Downloading ${modTitle}...`, 'info');
        
        // Get mod versions compatible with our server
        const versionsResponse = await fetch(`https://api.modrinth.com/v2/project/${projectId}/version?loaders=["${selectedServer.modLoader.toLowerCase()}"]&game_versions=["${selectedServer.version}"]`);
        const versions = await versionsResponse.json();
        
        if (versions.length === 0) {
            throw new Error(`No compatible versions found for ${selectedServer.modLoader} ${selectedServer.version}`);
        }
        
        // Get the latest compatible version
        const latestVersion = versions[0];
        const primaryFile = latestVersion.files.find(f => f.primary) || latestVersion.files[0];
        
        if (!primaryFile) {
            throw new Error('No download file found for this mod version');
        }
        
        console.log(`📥 Installing ${modTitle} v${latestVersion.version_number} (${primaryFile.filename})`);
        
        showNotification(`Uploading ${modTitle} to ${selectedServer.name}...`, 'info');
        
        // Upload to server
        const uploadResponse = await fetch(`/api/pterodactyl/servers/${selectedServer.id}/upload-mod`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                modUrl: primaryFile.url,
                fileName: primaryFile.filename
            })
        });
        
        if (!uploadResponse.ok) {
            const error = await uploadResponse.json();
            throw new Error(error.details || 'Upload failed');
        }
        
        const result = await uploadResponse.json();
        console.log(`✅ Successfully installed ${modTitle}!`);
        
        // Show success notification with enhanced details
        showNotification(`✅ ${modTitle} v${latestVersion.version_number} installed successfully!`, 'success');
        
        // Update button state with success feedback
        if (button) {
            button.innerHTML = `<i class="fas fa-check"></i> Installed`;
            button.classList.add('installed');
            button.disabled = true;
            
            // Reset button after 3 seconds
            setTimeout(() => {
                button.innerHTML = `<i class="fas fa-download"></i> Install`;
                button.classList.remove('installed');
                button.disabled = false;
            }, 3000);
        }
        if (button) {
            button.innerHTML = '<i class="fas fa-check"></i> Installed';
            button.style.background = 'linear-gradient(135deg, #48bb78 0%, #38a169 100%)';
            button.disabled = true;
            setTimeout(() => {
                if (button) {
                    setButtonLoading(button, false);
                }
            }, 2000);
        }
        
    } catch (error) {
        console.error(`❌ Error installing mod ${modTitle}:`, error);
        showNotification(`❌ Failed to install ${modTitle}: ${error.message}`, 'error');
        
        // Reset button state
        if (button) {
            setButtonLoading(button, false);
        }
    }
}

// Notification system
function showNotification(message, type = 'info', duration = 3000) {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px;">
            <i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'}"></i>
            <span>${message}</span>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideInRight 0.5s ease-out reverse';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 500);
    }, duration);
}

// Enhanced loading state
function setLoadingState(isLoading) {
    const modsGrid = document.getElementById('modsGrid');
    const loading = document.getElementById('loading');
    
    if (isLoading) {
        if (loading) loading.style.display = 'block';
        if (modsGrid) modsGrid.innerHTML = '';
        
        // Create skeleton cards
        for (let i = 0; i < 6; i++) {
            const skeletonCard = document.createElement('div');
            skeletonCard.className = 'mod-card loading';
            skeletonCard.innerHTML = `
                <div class="mod-header">
                    <div class="mod-title">
                        <div class="mod-icon loading-skeleton"></div>
                        <div class="mod-name loading-skeleton" style="height: 20px; width: 150px;"></div>
                    </div>
                    <div class="mod-author loading-skeleton" style="height: 14px; width: 100px; margin-left: 74px;"></div>
                </div>
                <div class="mod-content">
                    <div class="mod-description loading-skeleton" style="height: 60px; margin-bottom: 20px;"></div>
                    <div class="mod-stats">
                        <div class="stat loading-skeleton" style="height: 30px; width: 80px;"></div>
                        <div class="stat loading-skeleton" style="height: 30px; width: 80px;"></div>
                        <div class="stat loading-skeleton" style="height: 30px; width: 80px;"></div>
                    </div>
                </div>
            `;
            if (modsGrid) modsGrid.appendChild(skeletonCard);
        }
    } else {
        if (loading) loading.style.display = 'none';
    }
}

// Enhanced search with debouncing
let searchTimeout;
// Add loading state to buttons
function setButtonLoading(button, isLoading) {
    if (isLoading) {
        button.disabled = true;
        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Installing...';
        button.style.opacity = '0.7';
    } else {
        button.disabled = false;
        button.innerHTML = '<i class="fas fa-download"></i> Install';
        button.style.opacity = '1';
    }
}

// Add ripple effect to buttons
function addRippleEffect(event) {
    try {
        const button = event.currentTarget || event.target;
        if (!button || typeof button.getBoundingClientRect !== 'function') {
            return; // Skip if button is invalid
        }
        
        const rect = button.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height);
        const x = event.clientX - rect.left - size / 2;
        const y = event.clientY - rect.top - size / 2;
        
        const ripple = document.createElement('span');
        ripple.style.cssText = `
            position: absolute;
            width: ${size}px;
            height: ${size}px;
            left: ${x}px;
            top: ${y}px;
            background: rgba(255, 255, 255, 0.3);
            border-radius: 50%;
            transform: scale(0);
            animation: ripple 0.6s linear;
            pointer-events: none;
        `;
        
        button.style.position = 'relative';
        button.style.overflow = 'hidden';
        button.appendChild(ripple);
        
        setTimeout(() => {
            if (ripple.parentNode) {
                ripple.remove();
            }
        }, 600);
    } catch (error) {
        // Silently ignore ripple errors
        console.debug('Ripple effect error:', error);
    }
}

// Add CSS for ripple animation
const rippleCSS = `
    @keyframes ripple {
        to {
            transform: scale(4);
            opacity: 0;
        }
    }
`;
const styleSheet = document.createElement('style');
styleSheet.textContent = rippleCSS;
document.head.appendChild(styleSheet);

// Utility functions
function formatNumber(num) {
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
}

function getServerStatusDisplay(status) {
    switch (status) {
        case 'running':
            return { class: 'status-running', text: 'Running' };
        case 'stopped':
            return { class: 'status-stopped', text: 'Stopped' };
        case 'starting':
            return { class: 'status-starting', text: 'Starting' };
        case 'stopping':
            return { class: 'status-stopping', text: 'Stopping' };
        default:
            return { class: 'status-hidden', text: '' };
    }
}

// Check proxy status
async function checkProxyStatus() {
    try {
        const response = await fetch('/api/health');
        if (response.ok) {
            window.location.reload();
        } else {
            throw new Error('Proxy not responding');
        }
    } catch (error) {
        alert('Proxy server is still not running. Please check the setup instructions.');
    }
}

// Add intersection observer for lazy loading
const observeCards = () => {
    const cards = document.querySelectorAll('.mod-card');
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.animation = 'cardAppear 0.6s ease-out both';
                observer.unobserve(entry.target);
            }
        });
    }, {
        threshold: 0.1,
        rootMargin: '50px'
    });
    
    cards.forEach(card => observer.observe(card));
};

// Update the search input to prevent autofill more aggressively
document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        // More aggressive anti-autofill measures
        searchInput.setAttribute('autocomplete', 'new-password');
        searchInput.setAttribute('data-form-type', 'other');
        searchInput.setAttribute('data-lpignore', 'true');
        searchInput.setAttribute('data-1p-ignore', 'true');
    }
});

console.log('✅ Pterodactyl Mod Manager script loaded!');

// Enhanced Pagination Functions
function updatePagination(modsCount) {
    console.log(`🔄 Updating pagination: modsCount=${modsCount}, currentPage=${currentPage}, totalPages=${totalPages}`);
    renderPaginationNumbers();
    updatePaginationButtons(modsCount);
}

function renderPaginationNumbers() {
    const paginationNumbers = document.getElementById('paginationNumbers');
    if (!paginationNumbers) {
        console.log('❌ Pagination numbers container not found');
        return;
    }
    
    console.log(`🔢 Rendering pagination: currentPage=${currentPage}, totalPages=${totalPages}`);
    
    if (totalPages <= 1) {
        paginationNumbers.innerHTML = '';
        return;
    }
    
    const maxVisiblePages = window.innerWidth <= 576 ? 5 : 7; // Responsive page count
    const currentPageNum = currentPage + 1;
    let startPage = Math.max(1, currentPageNum - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
    
    // Adjust start page if we're near the end
    if (endPage - startPage < maxVisiblePages - 1) {
        startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }
    
    let numbersHTML = '';
    
    // First page + ellipsis
    if (startPage > 1) {
        numbersHTML += `<div class="page-number ${currentPageNum === 1 ? 'active' : ''}" onclick="goToPage(0)" title="Go to first page">1</div>`;
        if (startPage > 2) {
            numbersHTML += `<div class="page-ellipsis" title="More pages">⋯</div>`;
        }
    }
    
    // Page numbers
    for (let i = startPage; i <= endPage; i++) {
        const isActive = i === currentPageNum;
        numbersHTML += `<div class="page-number ${isActive ? 'active' : ''}" onclick="goToPage(${i - 1})" title="Go to page ${i}">${i}</div>`;
    }
    
    // Last page + ellipsis
    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            numbersHTML += `<div class="page-ellipsis" title="More pages">⋯</div>`;
        }
        numbersHTML += `<div class="page-number ${currentPageNum === totalPages ? 'active' : ''}" onclick="goToPage(${totalPages - 1})" title="Go to last page">${totalPages}</div>`;
    }
    
    // Optimized smooth transition
    requestAnimationFrame(() => {
        paginationNumbers.style.transition = 'opacity 0.2s ease';
        paginationNumbers.style.opacity = '0';
        
        setTimeout(() => {
            paginationNumbers.innerHTML = numbersHTML;
            paginationNumbers.style.opacity = '1';
        }, 100);
    });
    
    console.log(`✅ Rendered pagination numbers with ${endPage - startPage + 1} visible pages`);
}

function updatePaginationButtons(modsCount) {
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    
    if (prevBtn) {
        prevBtn.disabled = currentPage === 0;
    }
    
    if (nextBtn) {
        nextBtn.disabled = modsCount < modsPerPage;
    }
}

function goToPreviousPage() {
    if (currentPage > 0) {
        goToPage(currentPage - 1);
    }
}

function goToNextPage() {
    goToPage(currentPage + 1);
}

function goToPage(pageNum) {
    if (pageNum < 0 || pageNum === currentPage || isLoading) return;
    
    console.log(`📄 Going to page ${pageNum + 1}`);
    
    // Add loading state to pagination
    const paginationNumbers = document.getElementById('paginationNumbers');
    if (paginationNumbers) {
        paginationNumbers.style.pointerEvents = 'none';
        paginationNumbers.style.opacity = '0.7';
    }
    
    currentPage = pageNum;
    
    // Optimized smooth scroll to top of mods section
    const modsGrid = document.getElementById('modsGrid');
    if (modsGrid) {
        // Use more efficient scrolling
        const targetPosition = modsGrid.offsetTop - 20;
        window.scrollTo({
            top: targetPosition,
            behavior: 'smooth'
        });
    }
    
    // Reduced delay for faster page transitions
    setTimeout(() => {
        // Load new page (replace content, not append)
        loadModsForServer().finally(() => {
            // Re-enable pagination
            if (paginationNumbers) {
                paginationNumbers.style.pointerEvents = '';
                paginationNumbers.style.opacity = '1';
            }
        });
    }, 50);
}

// ===== PYTHON MOD MANAGER INTEGRATION FUNCTIONS =====

// Global mod queue for current server
let modQueue = [];

// Add mod to queue (new Python-based approach)
async function queueMod(projectId, modTitle, modData) {
    if (!selectedServer) {
        showNotification('Please select a server first', 'error');
        return;
    }
    
    console.log(`📋 Adding mod to queue: ${modTitle} for server: ${selectedServer.name}`);
    
    try {
        const response = await fetch(`/api/python-mod-manager/servers/${selectedServer.id}/queue-mod`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                modSlug: projectId,
                modData: {
                    title: modTitle,
                    ...modData
                }
            })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.details || 'Failed to queue mod');
        }
        
        const result = await response.json();
        modQueue = result.queue;
        
        showNotification(`✅ ${modTitle} added to mod queue!`, 'success');
        updateQueueDisplay();
        updateModButtons();
        
    } catch (error) {
        console.error('❌ Error queuing mod:', error);
        showNotification(`❌ Failed to queue ${modTitle}: ${error.message}`, 'error');
    }
}

// Remove mod from queue
async function removeFromQueue(projectId) {
    if (!selectedServer) return;
    
    try {
        const response = await fetch(`/api/python-mod-manager/servers/${selectedServer.id}/queue-mod/${projectId}`, {
            method: 'DELETE'
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.details || 'Failed to remove from queue');
        }
        
        const result = await response.json();
        modQueue = result.queue;
        
        showNotification(`Mod removed from queue`, 'info');
        updateQueueDisplay();
        updateModButtons();
        
    } catch (error) {
        console.error('❌ Error removing from queue:', error);
        showNotification(`❌ Failed to remove from queue: ${error.message}`, 'error');
    }
}

// Get current mod queue
async function getModQueue() {
    if (!selectedServer) return [];
    
    try {
        const response = await fetch(`/api/python-mod-manager/servers/${selectedServer.id}/queue`);
        
        if (!response.ok) {
            throw new Error('Failed to get queue');
        }
        
        const result = await response.json();
        modQueue = result.queue || [];
        return modQueue;
        
    } catch (error) {
        console.error('❌ Error getting queue:', error);
        return [];
    }
}

// Install all queued mods to server
async function installQueuedMods() {
    if (!selectedServer) {
        showNotification('Please select a server first', 'error');
        return;
    }
    
    if (modQueue.length === 0) {
        showNotification('No mods in queue to install', 'warning');
        return;
    }
    
    console.log(`🚀 Installing ${modQueue.length} queued mods to server...`);
    
    try {
        showNotification(`🚀 Installing ${modQueue.length} mods to ${selectedServer.name}...`, 'info');
        
        // Hide queue panel during installation
        const queuePanel = document.getElementById('mod-queue-panel');
        if (queuePanel) queuePanel.style.display = 'none';

        
        // Step 1: Install mods to server
        console.log('🔍 Sending server data:', selectedServer);
        const installResponse = await fetch(`/api/python-mod-manager/servers/${selectedServer.id}/install-mods`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                serverData: selectedServer
            })
        });
        
        if (!installResponse.ok) {
            const error = await installResponse.json();
            throw new Error(error.details || 'Failed to install mods');
        }
        
        const installResult = await installResponse.json();
        console.log('✅ Mod installation completed:', installResult);
        
        showNotification(`📦 Downloading mods and dependencies...`, 'info');
        
        // Step 2: Upload downloaded mods to Pterodactyl server
        const uploadResponse = await fetch(`/api/python-mod-manager/servers/${selectedServer.id}/upload-mods`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (!uploadResponse.ok) {
            const error = await uploadResponse.json();
            throw new Error(error.details || 'Failed to upload mods');
        }
        
        const uploadResult = await uploadResponse.json();
        console.log('✅ Upload completed:', uploadResult);
        
        const successCount = uploadResult.summary?.successful || 0;
        const totalCount = uploadResult.summary?.total || 0;
        
        if (uploadResult.success) {
            const newModsCount = uploadResult.summary?.newFiles || 0;
            
            // Clear the queue first (silently)
            await clearModQueue(true); // Pass true for silent clearing
            
            // Show professional success message
            showNotification(`🎉 Successfully installed and uploaded ${successCount} mods to ${selectedServer.name}!`, 'success');
            
            // Refresh installed mods and update the UI immediately
            console.log('🔄 Refreshing installed mods list...');
            await fetchInstalledMods(selectedServer.id, true); // Silent refresh
            
            // Re-render all mod cards to show updated "Installed" badges
            console.log('🔄 Updating mod cards with new installation status...');
            renderMods(allMods, true); // Pass true to indicate this is an update
            
            // Update mod buttons to reflect new installation status
            updateModButtons();
            
            // Show a follow-up notification about the UI update
            setTimeout(() => {
                const installedCount = allMods.filter(mod => isModInstalled(mod)).length;
                showNotification(`✨ UI updated! ${installedCount} mods now showing as installed.`, 'info', 2000);
            }, 1000);
        } else {
            showNotification(`⚠️ Partially completed: ${successCount}/${totalCount} mods uploaded`, 'warning');
        }
        
    } catch (error) {
        console.error('❌ Error installing mods:', error);
        showNotification(`❌ Installation failed: ${error.message}`, 'error');
        
        // Show the queue panel again in case of error
        const queuePanel = document.getElementById('mod-queue-panel');
        if (queuePanel && modQueue.length > 0) {
            queuePanel.style.display = 'block';
        }
    }
}

// Clear mod queue
async function clearModQueue(silent = false) {
    if (!selectedServer) return;
    
    try {
        const response = await fetch(`/api/python-mod-manager/servers/${selectedServer.id}/queue`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            modQueue = [];
            // Immediately hide the queue panel
            const queuePanel = document.getElementById('mod-queue-panel');
            if (queuePanel) queuePanel.style.display = 'none';
            updateModButtons();
            // Only show notification if not silent
            if (!silent) {
                showNotification('Mod queue cleared', 'info');
            }
        }
        
    } catch (error) {
        console.error('❌ Error clearing queue:', error);
    }
}

// Update queue display in UI
function updateQueueDisplay() {
    // Add/update queue panel in server info
    let queuePanel = document.getElementById('mod-queue-panel');
    
    if (!queuePanel) {
        // Create queue panel if it doesn't exist
        const serverInfoBar = document.querySelector('.server-info-bar');
        if (serverInfoBar) {
            queuePanel = document.createElement('div');
            queuePanel.id = 'mod-queue-panel';
            queuePanel.className = 'mod-queue-panel';
            serverInfoBar.insertAdjacentElement('afterend', queuePanel);
        } else {
            return; // No place to add the panel
        }
    }
    
    if (modQueue.length === 0) {
        queuePanel.style.display = 'none';
        return;
    }
    
    queuePanel.style.display = 'block';
    queuePanel.innerHTML = `
        <div class="queue-header">
            <h4><i class="fas fa-list"></i> Mod Installation Queue (${modQueue.length})</h4>
            <div class="queue-actions">
                <button onclick="installQueuedMods()" class="btn-install-queue">
                    <i class="fas fa-rocket"></i> Install All
                </button>
                <button onclick="clearModQueue()" class="btn-clear-queue">
                    <i class="fas fa-trash"></i> Clear
                </button>
            </div>
        </div>
        <div class="queue-items">
            ${modQueue.map(mod => `
                <div class="queue-item">
                    <div class="queue-item-info">
                        <span class="mod-name">${mod.title || mod.name || mod.slug}</span>
                        <span class="mod-description">${mod.description ? mod.description.substring(0, 60) + '...' : ''}</span>
                    </div>
                    <button onclick="removeFromQueue('${mod.slug}')" class="btn-remove-queue" title="Remove from queue">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            `).join('')}
        </div>
    `;
}

// Update mod card buttons based on queue status
function updateModButtons() {
    const modCards = document.querySelectorAll('.mod-card');
    
    modCards.forEach(card => {
        const installBtn = card.querySelector('.queue-mod-btn');
        if (!installBtn) return;
        
        // Get project ID from data attribute
        const projectId = installBtn.dataset.projectId;
        if (!projectId) return;
        
        // Check if mod is queued (check both slug formats for compatibility)
        const isQueued = modQueue.some(mod => mod.slug === projectId || mod.slug === installBtn.dataset.modSlug);
        
        // Check if this is an already installed mod (skip updating these)
        if (installBtn.classList.contains('already-installed')) {
            return;
        }
        
        // Update card classes
        const modCard = card;
        if (isQueued) {
            modCard.classList.add('mod-queued');
        } else {
            modCard.classList.remove('mod-queued');
        }
        
        // Update existing badges
        let queuedBadge = card.querySelector('.queued-badge');
        if (isQueued && !queuedBadge) {
            // Add queued badge if not present
            queuedBadge = document.createElement('div');
            queuedBadge.className = 'queued-badge';
            queuedBadge.innerHTML = '<i class="fas fa-list"></i> Queued';
            card.appendChild(queuedBadge);
        } else if (!isQueued && queuedBadge) {
            // Remove queued badge if present
            queuedBadge.remove();
        }
        
        // Update button state
        if (isQueued) {
            installBtn.innerHTML = '<i class="fas fa-list"></i> Queued - Click to Remove';
            installBtn.classList.add('queued');
            installBtn.dataset.action = 'remove';
        } else {
            installBtn.innerHTML = '<i class="fas fa-plus"></i> Add to Queue';
            installBtn.classList.remove('queued');
            installBtn.dataset.action = 'add';
        }
    });
}

// Load queue when server changes
async function loadModQueueForServer() {
    if (selectedServer) {
        await getModQueue();
        updateQueueDisplay();
        updateModButtons();
    }
}
