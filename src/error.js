import './style.css'

class ErrorPage {
  constructor() {
    this.init()
  }

  init() {
    // Simple initialization for error page
    // Theme and language controls are handled by main.js if included
    this.checkErrorCode()
  }

  checkErrorCode() {
    // Optional: Get error details from URL params
    const urlParams = new URLSearchParams(window.location.search)
    const errorCode = urlParams.get('code')
    
    if (errorCode) {
      console.log('Error code:', errorCode)
      // Could display specific error messages based on code
    }
  }
}

// Initialize error page when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new ErrorPage()
})