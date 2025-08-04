// Portfolio and Blog functionality

// Portfolio Functions
function displayProjects() {
    const container = document.getElementById('projectsContainer');
    if (!container) return;

    if (!window.filteredProjects || window.filteredProjects.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #666;">No projects found.</p>';
        return;
    }

    container.innerHTML = window.filteredProjects.map(project => `
        <div class="project-card" onclick="showProjectDetails(${project.id})">
            ${project.featured ? '<span class="featured-badge">Featured</span>' : ''}
            <img src="${project.image}" alt="${project.title}" class="project-image">
            <div class="project-content">
                <h4 class="project-title">${project.title}</h4>
                <p class="project-description">${project.description}</p>
                <div class="project-tech">
                    ${project.technologies.map(tech => `<span class="tech-tag">${tech}</span>`).join('')}
                </div>
                <div class="project-stats">
                    <span class="stat-item">⭐ ${project.stars || 0}</span>
                    <span class="stat-item">🔄 ${project.forks || 0}</span>
                    <span class="stat-item">📅 ${new Date(project.date).toLocaleDateString()}</span>
                </div>
            </div>
        </div>
    `).join('');
}

function showProjectDetails(projectId) {
    const project = window.allProjects.find(p => p.id === projectId);
    if (!project) return;

    const modal = document.getElementById('projectModal');
    const content = document.getElementById('modalContent');

    content.innerHTML = `
        <h2>${project.title}</h2>
        <img src="${project.image}" alt="${project.title}" style="width: 100%; max-height: 300px; object-fit: cover; border-radius: 8px; margin: 15px 0;">
        <p><strong>Description:</strong> ${project.description}</p>
        <p><strong>Technologies:</strong> ${project.technologies.join(', ')}</p>
        ${project.features ? `<p><strong>Key Features:</strong></p><ul>${project.features.map(f => `<li>${f}</li>`).join('')}</ul>` : ''}
        ${project.challenges ? `<p><strong>Technical Challenges:</strong> ${project.challenges}</p>` : ''}
        ${project.learnings ? `<p><strong>Key Learnings:</strong> ${project.learnings}</p>` : ''}
        <div class="project-links">
            ${project.github ? `<a href="${project.github}" target="_blank" class="project-link btn-primary">View on GitHub</a>` : ''}
            ${project.live ? `<a href="${project.live}" target="_blank" class="project-link btn-secondary">Live Demo</a>` : ''}
        </div>
    `;

    modal.style.display = 'block';
}

function filterProjects(filter) {
    window.currentFilter = filter;
    const searchTerm = document.getElementById('projectSearch').value.toLowerCase();
    
    window.filteredProjects = window.allProjects.filter(project => {
        const matchesFilter = filter === 'all' || 
            project.technologies.some(tech => tech.toLowerCase().includes(filter)) ||
            project.categories.some(cat => cat.toLowerCase().includes(filter));
        
        const matchesSearch = project.title.toLowerCase().includes(searchTerm) ||
            project.description.toLowerCase().includes(searchTerm) ||
            project.technologies.some(tech => tech.toLowerCase().includes(searchTerm));
        
        return matchesFilter && matchesSearch;
    });

    displayProjects();
}

function setupPortfolioEventListeners() {
    // Filter buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            filterProjects(this.dataset.filter);
        });
    });

    // Search input
    const searchInput = document.getElementById('projectSearch');
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            filterProjects(window.currentFilter);
        });
    }

    // Modal close
    const closeBtn = document.querySelector('#projectModal .close');
    if (closeBtn) {
        closeBtn.addEventListener('click', function() {
            document.getElementById('projectModal').style.display = 'none';
        });
    }

    // Modal background click
    window.addEventListener('click', function(event) {
        const modal = document.getElementById('projectModal');
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    });
}

// Blog Functions
function displayBlogArticles() {
    const container = document.getElementById('blogContainer');
    if (!container) return;

    if (!window.filteredArticles || window.filteredArticles.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #666;">No articles found.</p>';
        return;
    }

    container.innerHTML = window.filteredArticles.map(article => `
        <div class="blog-card" onclick="showArticleDetails(${article.id})">
            ${article.featured ? '<span class="featured-badge">Featured</span>' : ''}
            <img src="${article.cover}" alt="${article.title}" class="blog-image">
            <div class="blog-content">
                <h4 class="blog-title">${article.title}</h4>
                <p class="blog-excerpt">${article.excerpt}</p>
                <div class="blog-meta">
                    <span class="meta-item">📅 ${new Date(article.date).toLocaleDateString()}</span>
                    <span class="meta-item">⏱️ ${article.readTime} min read</span>
                    <span class="meta-item">👁️ ${article.views} views</span>
                </div>
                <div class="blog-tags">
                    ${article.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}
                </div>
            </div>
        </div>
    `).join('');
}

async function showArticleDetails(articleId) {
    const article = window.allArticles.find(a => a.id === articleId);
    if (!article) return;

    const modal = document.getElementById('articleModal');
    const content = document.getElementById('articleContent');

    // Show loading
    content.innerHTML = '<div style="text-align: center; padding: 40px;">Loading article...</div>';
    modal.style.display = 'block';

    try {
        // Load markdown content
        const response = await fetch(`data/blog/${article.contentFile}`);
        const markdownContent = await response.text();

        // Load marked.js if not already loaded
        if (typeof marked === 'undefined') {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/marked/marked.min.js';
            document.head.appendChild(script);
            
            await new Promise((resolve) => {
                script.onload = resolve;
            });
        }

        // Render markdown
        const htmlContent = marked.parse(markdownContent);

        content.innerHTML = `
            <article>
                <header style="margin-bottom: 30px;">
                    <h1 style="color: #2c3e50; margin-bottom: 10px;">${article.title}</h1>
                    <div style="display: flex; gap: 20px; color: #666; font-size: 14px; margin-bottom: 20px;">
                        <span>📅 ${new Date(article.date).toLocaleDateString()}</span>
                        <span>⏱️ ${article.readTime} min read</span>
                        <span>👁️ ${article.views} views</span>
                        <span>💬 ${article.comments} comments</span>
                    </div>
                    <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                        ${article.tags.map(tag => `<span style="background: #e8f4fd; color: #3498db; padding: 4px 8px; border-radius: 12px; font-size: 12px;">${tag}</span>`).join('')}
                    </div>
                </header>
                <div style="line-height: 1.8; color: #333;">
                    ${htmlContent}
                </div>
            </article>
        `;
    } catch (error) {
        console.error('Error loading article:', error);
        content.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #666;">
                <h3>Error loading article</h3>
                <p>Unable to load the article content. Please try again later.</p>
                <p>Error: ${error.message}</p>
            </div>
        `;
    }
}

function filterArticles(category) {
    window.currentCategory = category;
    const searchTerm = document.getElementById('blogSearch').value.toLowerCase();
    
    window.filteredArticles = window.allArticles.filter(article => {
        const matchesCategory = category === 'all' || 
            article.category.toLowerCase().includes(category) ||
            article.tags.some(tag => tag.toLowerCase().includes(category));
        
        const matchesSearch = article.title.toLowerCase().includes(searchTerm) ||
            article.excerpt.toLowerCase().includes(searchTerm) ||
            article.tags.some(tag => tag.toLowerCase().includes(searchTerm));
        
        return matchesCategory && matchesSearch;
    });

    displayBlogArticles();
}

function setupBlogEventListeners() {
    // Category filter buttons
    document.querySelectorAll('.category-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            filterArticles(this.dataset.category);
        });
    });

    // Search input
    const searchInput = document.getElementById('blogSearch');
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            filterArticles(window.currentCategory);
        });
    }

    // Modal close
    const closeBtn = document.querySelector('#articleModal .close');
    if (closeBtn) {
        closeBtn.addEventListener('click', function() {
            document.getElementById('articleModal').style.display = 'none';
        });
    }

    // Modal background click
    window.addEventListener('click', function(event) {
        const modal = document.getElementById('articleModal');
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    });
} 