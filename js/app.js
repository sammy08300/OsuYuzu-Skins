document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const skinsContainer = document.getElementById('skins-container');
    const skinModal = document.getElementById('skin-modal');
    const modalImg = document.getElementById('modal-img');
    const modalTitle = document.getElementById('modal-title');
    const downloadLink = document.getElementById('download-link');
    const forumLink = document.getElementById('forum-link');
    const closeButton = document.querySelector('.close-button');
    const backToTopBtn = document.getElementById('back-to-top');
    const header = document.querySelector('.site-header');
    
    // Variables for header control
    let lastScrollTop = 0;
    
    // Cache for already loaded images
    const imageCache = new Map();
    
    // Mapping between skin names and local image files
    const localImages = {
        "anzt11w V3 - てんてこ": "img/anzt11w V3 - てんてこ.jpeg",
        "Wintherest - v21022023 (Redo_)": "img/Wintherest - v21022023 (Redo_).png",
        "XooMoon Long Blue Trail": "img/XooMoon Long Blue Trail.png"
    };
    
    // Update available indicator
    let updateAvailable = false;
    
    /**
     * Service Worker functionality
     */
    
    // Listen for service worker messages
    if (navigator.serviceWorker) {
        navigator.serviceWorker.addEventListener('message', event => {
            console.log('Message received from service worker:', event.data);
            
            // Handle different types of service worker messages
            if (event.data === 'dataUpdated' || event.data === 'updateAvailable') {
                updateAvailable = true;
                
                // If an update is available, show notification
                showUpdateNotification();
            }
        });
    }
    
    // Check for updates with the service worker
    const checkForUpdates = () => {
        if (navigator.serviceWorker && navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({
                action: 'checkForUpdates'
            });
        }
    };
    
    // Check for updates periodically (every 5 minutes)
    const startUpdateChecker = () => {
        // Check immediately on page load
        setTimeout(checkForUpdates, 2000);
        
        // Then check every 5 minutes
        setInterval(checkForUpdates, 5 * 60 * 1000);
    };
    
    /**
     * Update notification functionality
     */
    
    // Show update notification
    const showUpdateNotification = () => {
        // Check if notification is already displayed
        if (document.querySelector('.update-notification')) {
            return;
        }
        
        const notification = document.createElement('div');
        notification.classList.add('update-notification');
        
        notification.innerHTML = `
            <p>New data is available!</p>
            <div class="update-actions">
                <button class="refresh-now">Refresh now</button>
                <button class="dismiss">Later</button>
            </div>
        `;
        
        // Add to page
        document.body.appendChild(notification);
        
        // After a short delay, show the notification
        setTimeout(() => {
            notification.classList.add('visible');
        }, 100);
        
        // Handle actions
        notification.querySelector('.refresh-now').addEventListener('click', () => {
            // Clear local cache
            localStorage.removeItem('skinsCacheInfo');
            localStorage.removeItem('cachedSkins');
            
            // Reload page to get new data
            window.location.reload();
        });
        
        notification.querySelector('.dismiss').addEventListener('click', () => {
            notification.classList.remove('visible');
            
            // Remove after transition
            setTimeout(() => {
                notification.remove();
            }, 300);
        });
    };
    
    // Add style for update notification
    const addUpdateNotificationStyle = () => {
        const style = document.createElement('style');
        style.textContent = `
            .update-notification {
                position: fixed;
                bottom: -100px;
                left: 50%;
                transform: translateX(-50%);
                background-color: #4a90e2;
                color: white;
                padding: 15px 20px;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                z-index: 1000;
                transition: bottom 0.3s ease;
                text-align: center;
                max-width: 90%;
                width: 400px;
            }
            
            .update-notification.visible {
                bottom: 20px;
            }
            
            .update-notification p {
                margin: 0 0 10px 0;
                font-weight: 500;
            }
            
            .update-actions {
                display: flex;
                justify-content: center;
                gap: 10px;
            }
            
            .update-actions button {
                background: none;
                border: none;
                padding: 8px 12px;
                border-radius: 4px;
                cursor: pointer;
                font-weight: 500;
                transition: background-color 0.2s ease;
            }
            
            .refresh-now {
                background-color: white;
                color: #4a90e2;
            }
            
            .refresh-now:hover {
                background-color: #f0f0f0;
            }
            
            .dismiss {
                color: white;
                background-color: rgba(255, 255, 255, 0.2);
            }
            
            .dismiss:hover {
                background-color: rgba(255, 255, 255, 0.3);
            }
        `;
        document.head.appendChild(style);
    };
    
    /**
     * Scroll and header functionality
     */
    
    // Handle scroll events
    const handleScroll = () => {
        const scrollTop = window.scrollY || document.documentElement.scrollTop;
        
        // Back to top button visibility
        if (scrollTop > 300) {
            backToTopBtn.classList.add('visible');
        } else {
            backToTopBtn.classList.remove('visible');
        }
        
        // Header hide/show on scroll
        if (scrollTop > 50) { // Reduced threshold for faster detection
            // Detect scroll direction
            if (scrollTop > lastScrollTop + 3) { // Reduced for better reactivity
                // Scrolling down - hide header immediately
                header.classList.add('hidden');
            } else if (lastScrollTop - scrollTop > 3) { // Threshold also reduced for upward scrolling
                // Scrolling up - show header
                header.classList.remove('hidden');
            }
            // No else here, which allows the current state to be maintained for micro-movements
        } else {
            // At the beginning of the page, always show header
            header.classList.remove('hidden');
        }
        
        lastScrollTop = scrollTop;
    };
    
    // Scroll to top function
    const scrollToTop = () => {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    };
    
    // Set up scroll listeners
    window.addEventListener('scroll', handleScroll);
    backToTopBtn.addEventListener('click', scrollToTop);
    
    /**
     * Data handling utilities
     */
    
    // Generate a unique hash based on content
    const generateHash = (data) => {
        const str = JSON.stringify(data);
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return hash.toString();
    };

    /**
     * Skin data loading and caching
     */
    
    // Load skins from JSON with improved caching
    const loadSkins = async () => {
        try {
            // Step 1: Always fetch JSON file metadata without using the full content
            // This allows checking if the file has changed without downloading all content
            const metaResponse = await fetch('data/yuzuctus_osu_skins.json', { 
                method: 'HEAD',
                cache: 'no-cache' // To get the most recent headers
            });
            
            // Get the file's last modification date
            const lastModified = metaResponse.headers.get('Last-Modified');
            const etag = metaResponse.headers.get('ETag');
            
            // Unique identifier for this file version (use ETag if available, otherwise Last-Modified)
            const fileIdentifier = etag || lastModified;
            
            // Get current cache information
            const cachedDataInfo = localStorage.getItem('skinsCacheInfo');
            let useCache = false;
            
            if (cachedDataInfo) {
                const cacheInfo = JSON.parse(cachedDataInfo);
                // Use cache only if file identifier hasn't changed
                useCache = cacheInfo.fileIdentifier === fileIdentifier;
            }
            
            if (useCache) {
                // Use cached data if valid
                const cachedData = JSON.parse(localStorage.getItem('cachedSkins') || '{}');
                if (cachedData.skins) {
                    const sortedSkins = [...cachedData.skins].sort((a, b) => a.order - b.order);
                    displaySkins(sortedSkins);
                    console.log('Using cached data (file identifier unchanged)');
                    return;
                }
            }
            
            // If cache is not valid or doesn't exist, fetch fresh data
            console.log('Fetching new data (invalid cache or modified file)');
            const response = await fetch('data/yuzuctus_osu_skins.json', {
                cache: 'no-store' // Force fetching the most recent file
            });
            
            const data = await response.json();
            
            if (data && data.skins) {
                // Sort skins by order before display
                const sortedSkins = [...data.skins].sort((a, b) => a.order - b.order);
                
                // Save to localStorage with cache information
                localStorage.setItem('cachedSkins', JSON.stringify(data));
                localStorage.setItem('skinsCacheInfo', JSON.stringify({
                    fileIdentifier: fileIdentifier,
                    timestamp: Date.now()
                }));
                
                displaySkins(sortedSkins);
            }
        } catch (error) {
            console.error('Error loading skins:', error);
            
            // In case of error, try to use cached data if available
            const cachedData = JSON.parse(localStorage.getItem('cachedSkins') || '{}');
            if (cachedData.skins) {
                console.log('Using cached data after error');
                const sortedSkins = [...cachedData.skins].sort((a, b) => a.order - b.order);
                displaySkins(sortedSkins);
            } else {
                skinsContainer.innerHTML = '<p>Unable to load skins. Please try again later.</p>';
            }
        }
    };
    
    /**
     * Skin display functionality
     */
    
    // Display skins in the container with improved performance
    const displaySkins = (skins) => {
        // Clear the container
        skinsContainer.innerHTML = '';
        
        // Create document fragment for better performance
        const fragment = document.createDocumentFragment();
        
        // Create and append skin cards
        skins.forEach(skin => {
            const skinCard = document.createElement('div');
            skinCard.classList.add('skin-card');
            
            // Determine image source (local or online)
            const imageSrc = localImages[skin.name] || skin.imageUrl;
            
            // Add cache-busting parameter for images
            const imgSrcWithCacheBust = imageSrc.includes('?') 
                ? `${imageSrc}&v=${Date.now()}` 
                : `${imageSrc}?v=${Date.now()}`;
            
            skinCard.innerHTML = `
                <div class="skin-image">
                    <img src="${imgSrcWithCacheBust}" alt="${skin.name}" loading="lazy" onerror="this.onerror=null; this.src='${skin.imageUrl}';">
                </div>
                <div class="skin-info">
                    <h2 title="${skin.name}">${skin.name}</h2>
                    <div class="skin-buttons">
                        <a href="${skin.downloadLink}" target="_blank" class="card-download-button">Download</a>
                        ${skin.forumLink ? `<a href="${skin.forumLink}" target="_blank" class="card-forum-button">Forum</a>` : ''}
                    </div>
                </div>
            `;
            
            // Add click event to open modal
            skinCard.querySelector('.skin-image').addEventListener('click', () => {
                openModal(skin, imageSrc);
            });
            
            skinCard.querySelector('h2').addEventListener('click', () => {
                openModal(skin, imageSrc);
            });
            
            // Prevent event propagation on buttons
            skinCard.querySelectorAll('.skin-buttons a').forEach(button => {
                button.addEventListener('click', (e) => e.stopPropagation());
            });
            
            fragment.appendChild(skinCard);
        });
        
        // Append fragment to container
        skinsContainer.appendChild(fragment);
    };
    
    /**
     * Modal functionality
     */
    
    // Open modal with skin details
    const openModal = (skin, imageSrc) => {
        // Preload image if needed
        if (!imageCache.has(imageSrc)) {
            const img = new Image();
            // Add cache-busting parameter for modal images
            const imgSrcWithCacheBust = imageSrc.includes('?') 
                ? `${imageSrc}&v=${Date.now()}` 
                : `${imageSrc}?v=${Date.now()}`;
            img.src = imgSrcWithCacheBust;
            imageCache.set(imageSrc, img);
        }
        
        // Add cache-busting parameter for modal image
        const modalImgSrc = imageSrc.includes('?') 
            ? `${imageSrc}&v=${Date.now()}` 
            : `${imageSrc}?v=${Date.now()}`;
        
        modalImg.src = modalImgSrc;
        modalImg.onerror = () => {
            modalImg.onerror = null;
            modalImg.src = skin.imageUrl;
        };
        
        modalTitle.textContent = skin.name;
        
        // Set download link
        downloadLink.href = skin.downloadLink;
        
        // Set forum link if available, otherwise hide it
        if (skin.forumLink) {
            forumLink.href = skin.forumLink;
            forumLink.style.display = 'inline-block';
        } else {
            forumLink.style.display = 'none';
        }
        
        // Show modal
        skinModal.style.display = 'block';
        
        // Use a slight delay to trigger the animation
        requestAnimationFrame(() => {
            skinModal.classList.add('show');
        });
        
        // Prevent scrolling on the body
        document.body.style.overflow = 'hidden';
    };
    
    // Close modal
    const closeModal = () => {
        skinModal.classList.remove('show');
        
        // Add a slight delay before hiding the modal
        setTimeout(() => {
            skinModal.style.display = 'none';
        }, 300);
        
        // Re-enable scrolling
        document.body.style.overflow = 'auto';
    };
    
    // Set up modal event listeners
    const setupModalListeners = () => {
        // Close button event
        closeButton.addEventListener('click', closeModal);
        
        // Close modal when clicking outside
        window.addEventListener('click', (event) => {
            if (event.target === skinModal) {
                closeModal();
            }
        });
        
        // Close modal with Escape key
        document.addEventListener('keydown', ({key}) => {
            if (key === 'Escape' && skinModal.style.display === 'block') {
                closeModal();
            }
        });
    };
    
    /**
     * Refresh button functionality
     */
    
    // Add manual cache refresh button
    const addRefreshButton = () => {
        const footer = document.querySelector('.footer-info');
        if (footer) {
            const refreshButton = document.createElement('button');
            refreshButton.classList.add('refresh-cache-button');
            refreshButton.textContent = '↻ Refresh';
            refreshButton.title = 'Refresh data';
            refreshButton.addEventListener('click', () => {
                // Force data update
                localStorage.removeItem('skinsCacheInfo');
                localStorage.removeItem('cachedSkins');
                loadSkins();
            });
            footer.appendChild(refreshButton);
        }
    };
    
    // Add CSS style for refresh button
    const addRefreshButtonStyle = () => {
        const style = document.createElement('style');
        style.textContent = `
            .refresh-cache-button {
                background-color: #4a90e2;
                color: white;
                border: none;
                border-radius: 4px;
                padding: 5px 10px;
                margin-top: 10px;
                cursor: pointer;
                font-size: 14px;
                display: flex;
                align-items: center;
                transition: background-color 0.3s ease;
            }
            .refresh-cache-button:hover {
                background-color: #357abD;
            }
        `;
        document.head.appendChild(style);
    };
    
    /**
     * Initialization
     */
    
    // Initialize all features
    const initialize = () => {
        // Load skins
        loadSkins();
        
        // Set up modal event listeners
        setupModalListeners();
        
        // Add refresh button and its style
        addRefreshButtonStyle();
        addRefreshButton();
        
        // Add style for update notifications
        addUpdateNotificationStyle();
        
        // Start periodic update checking
        startUpdateChecker();
    };
    
    // Start initialization
    initialize();
}); 