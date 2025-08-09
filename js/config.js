// Configuration for API integration
const CONFIG = {
    // API Base URL - Change this if your Go admin panel runs on a different port
    API_BASE_URL: 'http://localhost:8080/api',
    
    // Fallback settings
    ENABLE_FALLBACK: true, // Whether to fallback to static JSON if API fails
    
    // Timeout settings (in milliseconds)
    REQUEST_TIMEOUT: 10000, // 10 seconds
    
    // Debug mode
    DEBUG: true // Set to false in production
};

// Export for use in other scripts
window.CONFIG = CONFIG; 