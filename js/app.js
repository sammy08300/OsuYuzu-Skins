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
    
    // Variables pour le contrôle du header
    let lastScrollTop = 0;
    
    // Cache pour les images déjà chargées
    const imageCache = new Map();
    
    // Table de correspondance entre les noms de skins et les fichiers d'images locaux
    const localImages = {
        "anzt11w V3 - てんてこ": "img/anzt11w V3 - てんてこ.jpeg",
        "Wintherest - v21022023 (Redo_)": "img/Wintherest - v21022023 (Redo_).png",
        "XooMoon Long Blue Trail": "img/XooMoon Long Blue Trail.png"
    };
    
    // Back to top button functionality
    const handleScroll = () => {
        const scrollTop = window.scrollY || document.documentElement.scrollTop;
        
        // Back to top button visibility
        if (scrollTop > 300) {
            backToTopBtn.classList.add('visible');
        } else {
            backToTopBtn.classList.remove('visible');
        }
        
        // Header hide/show on scroll
        if (scrollTop > 50) { // Seuil réduit pour une détection plus rapide
            // Détection de la direction du scroll
            if (scrollTop > lastScrollTop + 3) { // Réduit pour une meilleure réactivité
                // Scroll vers le bas - cacher le header immédiatement
                header.classList.add('hidden');
            } else if (lastScrollTop - scrollTop > 3) { // Seuil également réduit pour la remontée
                // Scroll vers le haut - montrer le header
                header.classList.remove('hidden');
            }
            // Pas d'else ici, ce qui permet de conserver l'état actuel pour les micro-mouvements
        } else {
            // Au début de la page, toujours montrer le header
            header.classList.remove('hidden');
        }
        
        lastScrollTop = scrollTop;
    };
    
    const scrollToTop = () => {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    };
    
    window.addEventListener('scroll', handleScroll);
    backToTopBtn.addEventListener('click', scrollToTop);
    
    // Load skins from JSON with optimized caching
    const loadSkins = async () => {
        try {
            // Check for cache validity - 1 hour expiration
            const cachedData = JSON.parse(localStorage.getItem('cachedSkins') || '{}');
            const cacheTimestamp = localStorage.getItem('skinsCacheTimestamp');
            const currentTime = Date.now();
            const cacheExpiration = 60 * 60 * 1000; // 1 hour in milliseconds
            
            if (
                cachedData.skins && 
                cacheTimestamp && 
                (currentTime - parseInt(cacheTimestamp) < cacheExpiration)
            ) {
                const sortedSkins = [...cachedData.skins].sort((a, b) => a.order - b.order);
                displaySkins(sortedSkins);
                return;
            }
            
            // Fetch fresh data if cache expired or doesn't exist
            const response = await fetch('data/yasunaii_osu_skins.json');
            const data = await response.json();
            
            if (data && data.skins) {
                // Sort skins by order before displaying
                const sortedSkins = [...data.skins].sort((a, b) => a.order - b.order);
                
                // Save to localStorage with timestamp
                localStorage.setItem('cachedSkins', JSON.stringify(data));
                localStorage.setItem('skinsCacheTimestamp', currentTime.toString());
                
                displaySkins(sortedSkins);
            }
        } catch (error) {
            console.error('Error loading skins:', error);
            skinsContainer.innerHTML = '<p>Impossible de charger les skins. Veuillez réessayer plus tard.</p>';
        }
    };
    
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
            
            skinCard.innerHTML = `
                <div class="skin-image">
                    <img src="${imageSrc}" alt="${skin.name}" loading="lazy" onerror="this.onerror=null; this.src='${skin.imageUrl}';">
                </div>
                <div class="skin-info">
                    <h2 title="${skin.name}">${skin.name}</h2>
                    <div class="skin-buttons">
                        <a href="${skin.downloadLink}" target="_blank" class="card-download-button">Télécharger</a>
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
    
    // Open modal with skin details
    const openModal = (skin, imageSrc) => {
        // Preload image if needed
        if (!imageCache.has(imageSrc)) {
            const img = new Image();
            img.src = imageSrc;
            imageCache.set(imageSrc, img);
        }
        
        modalImg.src = imageSrc;
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
    
    // Load skins on page load
    loadSkins();
}); 