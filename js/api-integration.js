// API Integration with Go Admin Panel
// Configuration
const API_BASE_URL = window.CONFIG ? window.CONFIG.API_BASE_URL : 'http://localhost:8080/api';

// API Functions
class API {
    static async fetchProjects() {
        try {
            const response = await fetch(`${API_BASE_URL}/projects`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error('Error fetching projects:', error);
            throw error;
        }
    }

    static async fetchProject(id) {
        try {
            const response = await fetch(`${API_BASE_URL}/projects/${id}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error('Error fetching project:', error);
            throw error;
        }
    }

    static async fetchArticles() {
        try {
            const response = await fetch(`${API_BASE_URL}/blog`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error('Error fetching articles:', error);
            throw error;
        }
    }

    static async fetchArticle(id) {
        try {
            const response = await fetch(`${API_BASE_URL}/blog/${id}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error('Error fetching article:', error);
            throw error;
        }
    }
}

// Portfolio API Integration
async function loadProjectsFromAPI() {
    try {
        console.log('Loading projects from API...');
        const projects = await API.fetchProjects();
        
        // Store projects globally
        window.allProjects = projects;
        window.filteredProjects = projects;
        
        console.log('Projects loaded successfully:', projects.length);
        
        // Display projects if portfolio section is loaded
        if (document.getElementById('projectsContainer')) {
            displayProjects();
            setupPortfolioEventListeners();
        }
        
        return projects;
    } catch (error) {
        console.error('Failed to load projects from API:', error);
        
        // Fallback to static JSON if API fails
        try {
            console.log('Falling back to static JSON...');
            const response = await fetch('data/projects.json');
            const projects = await response.json();
            
            window.allProjects = projects;
            window.filteredProjects = projects;
            
            if (document.getElementById('projectsContainer')) {
                displayProjects();
                setupPortfolioEventListeners();
            }
            
            return projects;
        } catch (fallbackError) {
            console.error('Both API and fallback failed:', fallbackError);
            throw fallbackError;
        }
    }
}

// Blog API Integration
async function loadArticlesFromAPI() {
    try {
        console.log('Loading articles from API...');
        const articles = await API.fetchArticles();
        
        // Store articles globally
        window.allArticles = articles;
        window.filteredArticles = articles;
        
        console.log('Articles loaded successfully:', articles.length);
        
        // Display articles if blog section is loaded
        if (document.getElementById('blogContainer')) {
            displayBlogArticles();
            setupBlogEventListeners();
        }
        
        return articles;
    } catch (error) {
        console.error('Failed to load articles from API:', error);
        
        // Fallback to static JSON if API fails
        try {
            console.log('Falling back to static JSON...');
            const response = await fetch('data/blog-articles.json');
            const articles = await response.json();
            
            window.allArticles = articles;
            window.filteredArticles = articles;
            
            if (document.getElementById('blogContainer')) {
                displayBlogArticles();
                setupBlogEventListeners();
            }
            
            return articles;
        } catch (fallbackError) {
            console.error('Both API and fallback failed:', fallbackError);
            throw fallbackError;
        }
    }
}

// Enhanced project details with API
async function showProjectDetailsAPI(projectId) {
    try {
        const project = await API.fetchProject(projectId);
        
        const modal = document.getElementById('projectModal');
        const content = document.getElementById('modalContent');

        content.innerHTML = `
            <h2>${project.title}</h2>
            <img src="${project.image}" alt="${project.title}" style="width: 100%; max-height: 300px; object-fit: cover; border-radius: 8px; margin: 15px 0;">
            <p><strong>Description:</strong> ${project.description}</p>
            <p><strong>Technologies:</strong> ${project.technologies.join(', ')}</p>
            ${project.features && project.features.length > 0 ? `<p><strong>Key Features:</strong></p><ul>${project.features.map(f => `<li>${f}</li>`).join('')}</ul>` : ''}
            ${project.challenges ? `<p><strong>Technical Challenges:</strong> ${project.challenges}</p>` : ''}
            ${project.learnings ? `<p><strong>Key Learnings:</strong> ${project.learnings}</p>` : ''}
            <div class="project-links">
                ${project.github ? `<a href="${project.github}" target="_blank" class="project-link btn-primary">View on GitHub</a>` : ''}
                ${project.live ? `<a href="${project.live}" target="_blank" class="project-link btn-secondary">Live Demo</a>` : ''}
            </div>
        `;

        modal.style.display = 'block';
    } catch (error) {
        console.error('Error loading project details:', error);
        
        // Fallback to local data
        const project = window.allProjects.find(p => p.id === projectId);
        if (project) {
            showProjectDetails(projectId);
        } else {
            alert('Error loading project details. Please try again.');
        }
    }
}

// Enhanced article details with API
async function showArticleDetailsAPI(articleId) {
    try {
        const article = await API.fetchArticle(articleId);
        
        const modal = document.getElementById('articleModal');
        const content = document.getElementById('articleContent');

        // Show loading
        content.innerHTML = '<div style="text-align: center; padding: 40px;">Loading article...</div>';
        modal.style.display = 'block';

        // Load markdown content if available
        let htmlContent = '';
        if (article.content) {
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
            htmlContent = marked.parse(article.content);
        } else if (article.contentFile) {
            // Fallback to file-based content
            try {
                const response = await fetch(`data/blog/${article.contentFile}`);
                const markdownContent = await response.text();
                
                if (typeof marked === 'undefined') {
                    const script = document.createElement('script');
                    script.src = 'https://cdn.jsdelivr.net/npm/marked/marked.min.js';
                    document.head.appendChild(script);
                    
                    await new Promise((resolve) => {
                        script.onload = resolve;
                    });
                }
                
                htmlContent = marked.parse(markdownContent);
            } catch (fileError) {
                console.error('Error loading article file:', fileError);
                htmlContent = '<p>Content not available.</p>';
            }
        } else {
            htmlContent = '<p>Content not available.</p>';
        }

        content.innerHTML = `
            <article>
                <header style="margin-bottom: 30px;">
                    <h1 style="color: #2c3e50; margin-bottom: 10px;">${article.title}</h1>
                    <div style="display: flex; gap: 20px; color: #666; font-size: 14px; margin-bottom: 20px;">
                        <span>📅 ${new Date(article.date).toLocaleDateString()}</span>
                        <span>⏱️ ${article.readTime} min read</span>
                        <span>👁️ ${article.views} views</span>
                        <span>💬 ${article.comments} comments</span>
                        <span style="background: #e74c3c; color: white; padding: 4px 8px; border-radius: 12px; font-size: 12px;">${article.category}</span>
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
        console.error('Error loading article details:', error);
        
        // Fallback to local data
        const article = window.allArticles.find(a => a.id === articleId);
        if (article) {
            showArticleDetails(articleId);
        } else {
            const content = document.getElementById('articleContent');
            content.innerHTML = `
                <div style="text-align: center; padding: 40px; color: #666;">
                    <h3>Error loading article</h3>
                    <p>Unable to load the article content. Please try again later.</p>
                    <p>Error: ${error.message}</p>
                </div>
            `;
        }
    }
}

// Initialize API integration
document.addEventListener('DOMContentLoaded', function() {
    console.log('API Integration initialized');
    
    // Load data when sections are ready
    const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            if (mutation.type === 'childList') {
                // Check if portfolio section is loaded
                if (document.getElementById('projectsContainer') && !window.projectsLoaded) {
                    window.projectsLoaded = true;
                    loadProjectsFromAPI();
                }
                
                // Check if blog section is loaded
                if (document.getElementById('blogContainer') && !window.articlesLoaded) {
                    window.articlesLoaded = true;
                    loadArticlesFromAPI();
                }
            }
        });
    });
    
    // Observe the tab data container for changes
    const tabDataWrap = document.getElementById('tab-data-wrap');
    if (tabDataWrap) {
        observer.observe(tabDataWrap, { childList: true, subtree: true });
    }
});

// Export functions for global use
window.API = API;
window.loadProjectsFromAPI = loadProjectsFromAPI;
window.loadArticlesFromAPI = loadArticlesFromAPI;
window.showProjectDetailsAPI = showProjectDetailsAPI;
window.showArticleDetailsAPI = showArticleDetailsAPI; 