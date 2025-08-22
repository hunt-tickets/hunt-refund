import './style.css'
import { translations } from './translations.js'

class RefundForm {
  constructor() {
    this.form = document.getElementById('refund-form')
    this.submitBtn = document.getElementById('submit-btn')
    this.fileInput = document.getElementById('attachments')
    this.fileList = document.getElementById('file-list')
    this.fileInputDisplay = document.querySelector('.file-input-display .file-text')
    this.successMessage = document.getElementById('success-message')
    this.selectedFiles = []
    this.currentLang = 'es'
    this.lastSubmissionTime = 0
    this.submissionAttempts = 0
    this.maxAttemptsPerMinute = 5
    
    this.init()
  }

  init() {
    this.setupEventListeners()
    this.setupFileUpload()
    this.setupLanguageToggle()
  }

  // Security: Sanitize input to prevent XSS attacks
  sanitizeInput(input) {
    if (typeof input !== 'string') return input
    
    const entityMap = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
      '/': '&#x2F;',
      '`': '&#x60;',
      '=': '&#x3D;'
    }
    
    return input.replace(/[&<>"'`=\/]/g, (s) => entityMap[s])
  }

  // Security: Enhanced input validation with length limits and character whitelists
  isValidInput(value, type) {
    const maxLengths = {
      fullName: 100,
      email: 254,
      orderNumber: 50,
      reason: 1000,
      brebAccount: 50,
      accountNumber: 30,
      bankName: 100,
      documentNumber: 20,
      accountHolderName: 100
    }

    const patterns = {
      fullName: /^[a-zA-ZÀ-ÿ\u00C0-\u017F\s'-]{2,100}$/,
      email: /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/,
      orderNumber: /^[A-Za-z0-9\-_]{1,50}$/,
      reason: /^[\s\S]{10,1000}$/,
      brebAccount: /^[a-zA-Z0-9._]{3,50}$/,
      accountNumber: /^\d{10,20}$/,
      bankName: /^[a-zA-ZÀ-ÿ\u00C0-\u017F\s\-\.]{2,100}$/,
      documentNumber: /^\d{6,12}$/,
      accountHolderName: /^[a-zA-ZÀ-ÿ\u00C0-\u017F\s'-]{3,100}$/
    }

    // Check length
    if (value.length > (maxLengths[type] || 500)) {
      return false
    }

    // Check pattern if exists
    if (patterns[type]) {
      return patterns[type].test(value)
    }

    return true
  }

  // Security: Log suspicious input attempts
  logSecurityEvent(field, value, reason) {
    const timestamp = new Date().toISOString()
    console.warn(`Security Alert [${timestamp}]: Suspicious input detected`, {
      field,
      reason,
      valueLength: value.length,
      userAgent: navigator.userAgent,
      url: window.location.href
    })
  }

  // Security: Rate limiting for form submissions
  checkRateLimit() {
    const now = Date.now()
    const oneMinute = 60 * 1000

    // Reset counter if more than a minute has passed
    if (now - this.lastSubmissionTime > oneMinute) {
      this.submissionAttempts = 0
    }

    // Check if too many attempts
    if (this.submissionAttempts >= this.maxAttemptsPerMinute) {
      const timeLeft = Math.ceil((oneMinute - (now - this.lastSubmissionTime)) / 1000)
      this.showError('form', `Demasiados intentos. Espere ${timeLeft} segundos.`)
      return false
    }

    return true
  }

  setupEventListeners() {
    this.form.addEventListener('submit', (e) => this.handleSubmit(e))
    
    const inputs = this.form.querySelectorAll('input[required], textarea[required]')
    inputs.forEach(input => {
      // Only clear errors on input, don't validate on blur anymore
      input.addEventListener('input', () => this.clearError(input))
    })

    // Setup refund method conditional fields
    this.setupRefundMethodFields()
  }

  setupRefundMethodFields() {
    // Wait a bit to ensure DOM is fully loaded
    setTimeout(() => {
      const refundMethods = document.querySelectorAll('input[name="refundMethod"]')
      const brebField = document.getElementById('breb-account-field')
      const bankFields = document.getElementById('bank-account-fields')
      
      if (!brebField || !bankFields || refundMethods.length === 0) {
        return
      }
      
      const bankFieldIds = ['accountNumber', 'accountType', 'bankName', 'documentNumber', 'accountHolderName']
      
      // Add event listeners to radio buttons
      refundMethods.forEach(radio => {
        radio.addEventListener('change', (e) => {
          this.handleRefundMethodChange(e.target.value, brebField, bankFields, bankFieldIds)
        })
      })
      
      // Also add click listeners to labels for better UX
      const refundLabels = document.querySelectorAll('.refund-option')
      refundLabels.forEach(label => {
        label.addEventListener('click', (e) => {
          const radioId = label.getAttribute('for')
          const radio = document.getElementById(radioId)
          if (radio && !radio.checked) {
            radio.checked = true
            this.handleRefundMethodChange(radio.value, brebField, bankFields, bankFieldIds)
          }
        })
      })
    }, 100)
  }
  
  handleRefundMethodChange(value, brebField, bankFields, bankFieldIds) {
    // Hide all conditional fields first
    if (brebField) brebField.style.display = 'none'
    if (bankFields) bankFields.style.display = 'none'
    
    // Clear all field requirements and errors
    const brebAccount = document.getElementById('brebAccount')
    if (brebAccount) {
      brebAccount.required = false
      this.clearError(brebAccount)
    }
    
    bankFieldIds.forEach(fieldId => {
      const field = document.getElementById(fieldId)
      if (field) {
        field.required = false
        this.clearError(field)
      }
    })
    
    // Show and require fields based on selection
    if (value === 'breb') {
      if (brebField) {
        brebField.style.display = 'block'
        if (brebAccount) brebAccount.required = true
      }
    } else if (value === 'bank') {
      if (bankFields) {
        bankFields.style.display = 'block'
        bankFieldIds.forEach(fieldId => {
          const field = document.getElementById(fieldId)
          if (field) field.required = true
        })
      }
    }
  }


  setupFileUpload() {
    this.fileInput.addEventListener('change', (e) => this.handleFileSelect(e))
    
    const fileInputWrapper = document.querySelector('.file-input-wrapper')
    
    fileInputWrapper.addEventListener('dragover', (e) => {
      e.preventDefault()
      fileInputWrapper.classList.add('dragover')
    })
    
    fileInputWrapper.addEventListener('dragleave', () => {
      fileInputWrapper.classList.remove('dragover')
    })
    
    fileInputWrapper.addEventListener('drop', (e) => {
      e.preventDefault()
      fileInputWrapper.classList.remove('dragover')
      this.handleFileSelect({ target: { files: e.dataTransfer.files } })
    })
  }

  handleFileSelect(e) {
    const files = Array.from(e.target.files)
    
    files.forEach(file => {
      if (this.validateFile(file)) {
        this.selectedFiles.push(file)
      }
    })
    
    this.updateFileDisplay()
    this.updateFileInputText()
  }

  validateFile(file) {
    const maxSize = 5 * 1024 * 1024 // 5MB
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.pdf', '.doc', '.docx']
    
    // Security: Sanitize filename to prevent path traversal
    const sanitizedName = this.sanitizeInput(file.name)
    const fileExtension = sanitizedName.toLowerCase().substring(sanitizedName.lastIndexOf('.'))
    
    // Security: Check for suspicious filenames
    if (file.name.includes('..') || file.name.includes('/') || file.name.includes('\\')) {
      this.logSecurityEvent('file', file.name, 'Suspicious filename with path characters')
      this.showError('attachments', `"${sanitizedName}" contiene caracteres no permitidos`)
      return false
    }
    
    // Security: Validate file size
    if (file.size > maxSize) {
      this.showError('attachments', `"${sanitizedName}" ${this.t('file-too-large')}`)
      return false
    }
    
    // Security: Double-check MIME type and extension
    if (!allowedTypes.includes(file.type) || !allowedExtensions.includes(fileExtension)) {
      this.logSecurityEvent('file', file.name, `Invalid file type: ${file.type}, extension: ${fileExtension}`)
      this.showError('attachments', `"${sanitizedName}" ${this.t('file-type-error')}`)
      return false
    }
    
    // Security: Additional checks for executable files disguised as documents
    const executableExtensions = ['.exe', '.bat', '.cmd', '.scr', '.pif', '.com', '.jar', '.js', '.vbs', '.ps1']
    if (executableExtensions.some(ext => sanitizedName.toLowerCase().includes(ext))) {
      this.logSecurityEvent('file', file.name, 'Executable file detected')
      this.showError('attachments', `"${sanitizedName}" tipo de archivo no permitido por seguridad`)
      return false
    }
    
    return true
  }

  updateFileDisplay() {
    this.fileList.innerHTML = ''
    
    this.selectedFiles.forEach((file, index) => {
      const fileItem = document.createElement('div')
      fileItem.className = 'file-item'
      
      // Security: Sanitize filename before displaying
      const sanitizedFileName = this.sanitizeInput(file.name)
      
      fileItem.innerHTML = `
        <span class="file-name">${sanitizedFileName}</span>
        <span class="file-size">${this.formatFileSize(file.size)}</span>
        <button type="button" class="file-remove" data-index="${index}">✕</button>
      `
      
      const removeBtn = fileItem.querySelector('.file-remove')
      removeBtn.addEventListener('click', () => this.removeFile(index))
      
      this.fileList.appendChild(fileItem)
    })
  }

  updateFileInputText() {
    const count = this.selectedFiles.length
    if (count === 0) {
      this.fileInputDisplay.textContent = this.t('select-files')
    } else if (count === 1) {
      this.fileInputDisplay.textContent = `1 ${this.t('file-selected')}`
    } else {
      this.fileInputDisplay.textContent = `${count} ${this.t('files-selected')}`
    }
  }

  removeFile(index) {
    this.selectedFiles.splice(index, 1)
    this.updateFileDisplay()
    this.updateFileInputText()
  }

  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }

  validateField(field) {
    const rawValue = field.value.trim()
    const fieldName = field.name
    
    this.clearError(field)
    
    // Security: Check for suspicious input patterns
    if (rawValue.includes('<script') || rawValue.includes('javascript:') || rawValue.includes('data:text/html')) {
      this.logSecurityEvent(fieldName, rawValue, 'Potential XSS attempt')
      this.showError(fieldName, this.t('invalid-input'))
      return false
    }
    
    // Security: Sanitize the input
    const value = this.sanitizeInput(rawValue)
    
    // Security: Enhanced validation with whitelist patterns
    if (!this.isValidInput(value, fieldName)) {
      this.logSecurityEvent(fieldName, rawValue, 'Invalid input format or length')
      this.showError(fieldName, this.t('invalid-format'))
      return false
    }
    
    if (!value && field.required) {
      this.showError(fieldName, this.t('required-field'))
      return false
    }
    
    // Legacy validation for backwards compatibility
    if (fieldName === 'fullName' && value.length < 2) {
      this.showError(fieldName, this.t('name-length'))
      return false
    }
    
    if (fieldName === 'email') {
      const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/
      if (!emailRegex.test(value)) {
        this.showError(fieldName, this.t('invalid-email'))
        return false
      }
    }
    
    if (fieldName === 'reason' && value.length < 10) {
      this.showError(fieldName, this.t('description-length'))
      return false
    }

    if (fieldName === 'brebAccount' && value.length < 3) {
      this.showError(fieldName, this.t('breb-account-length'))
      return false
    }

    if (fieldName === 'accountNumber' && !/^\d{10,20}$/.test(value)) {
      this.showError(fieldName, this.t('account-number-invalid'))
      return false
    }

    if (fieldName === 'bankName' && value.length < 2) {
      this.showError(fieldName, this.t('bank-name-length'))
      return false
    }

    if (fieldName === 'documentNumber' && !/^\d{6,12}$/.test(value)) {
      this.showError(fieldName, this.t('document-number-invalid'))
      return false
    }

    if (fieldName === 'accountHolderName' && value.length < 3) {
      this.showError(fieldName, this.t('account-holder-length'))
      return false
    }
    
    return true
  }

  showError(fieldName, message) {
    const errorElement = document.getElementById(`${fieldName}-error`)
    const fieldElement = document.getElementById(fieldName) || document.querySelector(`[name="${fieldName}"]`)
    
    if (errorElement) {
      errorElement.textContent = message
      errorElement.classList.add('show')
    }
    
    if (fieldElement) {
      fieldElement.classList.add('error')
    }
  }

  clearError(field) {
    const fieldName = field.name
    const errorElement = document.getElementById(`${fieldName}-error`)
    
    if (errorElement) {
      errorElement.classList.remove('show')
    }
    
    field.classList.remove('error')
  }

  validateForm() {
    const requiredFields = this.form.querySelectorAll('input[required], textarea[required]')
    let isValid = true
    
    requiredFields.forEach(field => {
      // Skip checkbox validation here, handle separately
      if (field.type !== 'checkbox' && !this.validateField(field)) {
        isValid = false
      }
    })

    // Validate refund method
    const refundMethod = document.querySelector('input[name="refundMethod"]:checked')
    if (!refundMethod) {
      this.showError('refundMethod', this.t('refund-method-error'))
      isValid = false
    }

    // Validate checkboxes
    const acceptTerms = document.getElementById('acceptTerms')

    if (!acceptTerms.checked) {
      this.showError('acceptTerms', this.t('accept-terms-error'))
      isValid = false
    }

    
    return isValid
  }

  async handleSubmit(e) {
    e.preventDefault()
    
    // Security: Rate limiting check
    if (!this.checkRateLimit()) {
      return
    }
    
    // Update submission tracking
    this.submissionAttempts++
    this.lastSubmissionTime = Date.now()
    
    if (!this.validateForm()) {
      return
    }
    
    this.setLoading(true)
    
    try {
      const formData = new FormData()
      
      // Security: Sanitize all form data before submission
      const formFields = new FormData(this.form)
      for (let [key, value] of formFields.entries()) {
        if (typeof value === 'string') {
          formData.append(key, this.sanitizeInput(value))
        } else {
          formData.append(key, value)
        }
      }
      
      // Security: Add sanitized files
      this.selectedFiles.forEach(file => {
        formData.append('attachments', file)
      })
      
      // Security: Log submission attempt
      console.info('Form submission attempt', {
        timestamp: new Date().toISOString(),
        fields: Array.from(formData.keys()),
        fileCount: this.selectedFiles.length
      })
      
      await this.simulateSubmission(formData)
      
      this.showSuccess()
      this.resetForm()
      
    } catch (error) {
      console.error('Error submitting form:', error)
      this.showError('form', this.t('form-error'))
    } finally {
      this.setLoading(false)
    }
  }

  async simulateSubmission(formData) {
    return new Promise((resolve) => {
      setTimeout(() => {
        console.log('Form submission data:')
        for (let [key, value] of formData.entries()) {
          if (value instanceof File) {
            console.log(`${key}:`, `File: ${value.name} (${value.size} bytes)`)
          } else if (key === 'orderNumber') {
            // Add prefix to order number for submission
            console.log(`${key}:`, `Orden #${value}`)
          } else {
            console.log(`${key}:`, value)
          }
        }
        resolve()
      }, 2000)
    })
  }

  setLoading(loading) {
    if (loading) {
      this.submitBtn.disabled = true
      this.submitBtn.classList.add('loading')
    } else {
      this.submitBtn.disabled = false
      this.submitBtn.classList.remove('loading')
    }
  }

  showSuccess() {
    this.successMessage.style.display = 'flex'
    this.successMessage.scrollIntoView({ behavior: 'smooth' })
  }

  resetForm() {
    this.form.reset()
    this.selectedFiles = []
    this.updateFileDisplay()
    this.updateFileInputText()
    
    
    const errorMessages = this.form.querySelectorAll('.error-message.show')
    errorMessages.forEach(error => error.classList.remove('show'))
    
    const errorFields = this.form.querySelectorAll('.error')
    errorFields.forEach(field => field.classList.remove('error'))
  }

  setupLanguageToggle() {
    const langButtons = document.querySelectorAll('.lang-btn')
    
    langButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const selectedLang = e.target.dataset.lang
        if (selectedLang !== this.currentLang) {
          this.switchLanguage(selectedLang)
        }
      })
    })
  }

  switchLanguage(lang) {
    this.currentLang = lang
    
    // Update toggle position and button states
    const toggle = document.querySelector('.language-toggle')
    document.querySelectorAll('.lang-btn').forEach(btn => {
      btn.classList.remove('active')
      if (btn.dataset.lang === lang) {
        btn.classList.add('active')
      }
    })
    
    // Update toggle class for animation
    if (lang === 'en') {
      toggle.classList.add('en')
    } else {
      toggle.classList.remove('en')
    }
    
    // Update all translatable elements
    document.querySelectorAll('[data-es][data-en]').forEach(element => {
      const text = element.getAttribute(`data-${lang}`)
      if (text) {
        element.textContent = text
      }
    })
    
    // Update placeholders
    document.querySelectorAll('[data-placeholder-es][data-placeholder-en]').forEach(element => {
      const placeholder = element.getAttribute(`data-placeholder-${lang}`)
      if (placeholder) {
        element.placeholder = placeholder
      }
    })
    
    // Update select options
    document.querySelectorAll('option[data-es][data-en]').forEach(option => {
      const text = option.getAttribute(`data-${lang}`)
      if (text) {
        option.textContent = text
      }
    })
    
    // Update file input text
    this.updateFileInputText()
  }

  t(key) {
    return translations[this.currentLang][key] || key
  }
}

document.addEventListener('DOMContentLoaded', () => {
  // Initialize form
  new RefundForm()
  
})
