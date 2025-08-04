// Scripts for loading sections and handling dynamic content
document.addEventListener('DOMContentLoaded', function() {
    console.log('Scripts loaded successfully');
    
    // Function to load sections
    function loadSection(sectionId, filePath) {
        console.log('Loading section:', sectionId, 'from:', filePath);
        fetch(filePath)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.text();
            })
            .then(data => {
                document.getElementById(sectionId).innerHTML = data;
                console.log('Section loaded successfully:', sectionId);
                
                // Trigger any section-specific initialization
                if (sectionId === 'portfolio') {
                    console.log('Portfolio section loaded, initializing...');
                    // Portfolio initialization will be handled by the section's own script
                }
                if (sectionId === 'blog') {
                    console.log('Blog section loaded, initializing...');
                    // Blog initialization will be handled by the section's own script
                }
            })
            .catch(error => {
                console.error('Error loading section:', sectionId, error);
                document.getElementById(sectionId).innerHTML = `
                    <div style="text-align: center; padding: 50px; color: #666;">
                        <h3>Error loading content</h3>
                        <p>Unable to load ${sectionId} section. Please check the console for details.</p>
                        <p>Error: ${error.message}</p>
                    </div>
                `;
            });
    }

    // Load all sections
    loadSection('about', 'sections/about.html');
    loadSection('contact', 'sections/contact.html');
    loadSection('portfolio', 'sections/portfolio.html');
    loadSection('blog', 'sections/blog.html');
    loadSection('resume', 'sections/resume.html');
}); 