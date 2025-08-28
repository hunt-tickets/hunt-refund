import './style.css'
import { translations } from './translations.js'
import { supabase as webhookClient } from './webhook.js'

class RefundForm {
  constructor() {
    this.form = document.getElementById('refund-form')
    this.submitBtn = document.getElementById('submit-btn')
    this.successMessage = document.getElementById('success-message')
    this.progressLoader = document.getElementById('progress-loader')
    this.currentLang = this.getInitialLanguage() // Auto-detect language
    this.lastSubmissionTime = 0
    this.submissionAttempts = 0
    this.maxAttemptsPerMinute = 5
    
    this.init()
  }

  init() {
    // Check access restrictions first
    if (!this.validateAccess()) {
      return // Stop initialization if access is denied
    }
    
    this.setupEventListeners()
    this.setupLanguageToggle()
    this.applyInitialLanguage() // Apply detected/URL language
    this.preloadDataFromUrl()
    this.applyUIConfig()
  }

  // Función para leer parámetros de la URL
  getUrlParams() {
    const urlParams = new URLSearchParams(window.location.search)
    const params = {}
    
    for (const [key, value] of urlParams.entries()) {
      params[key] = value
    }
    
    return params
  }

  // Mapeo limitado de parámetros URL a campos específicos
  getFieldMapping() {
    return {
      // Solo campos permitidos: correo, número de orden y nombre completo
      'fullName': 'fullName',
      'email': 'email', 
      'orderNumber': 'orderNumber',
      
      // Aliases comunes
      'name': 'fullName',
      'correo': 'email',
      'orden': 'orderNumber',
      'order': 'orderNumber'
    }
  }

  // Configuración de UI basada en parámetros URL
  getUIConfig() {
    const urlParams = this.getUrlParams()
    
    // Validar parámetro de logo de forma segura
    let showLogo = true // Default
    const logoParam = (urlParams.showLogo || urlParams.logo || '').toLowerCase().trim()
    
    if (logoParam === 'false' || logoParam === '0' || logoParam === 'no') {
      showLogo = false
    }
    
    // Validar parámetro de estado para testing
    let state = null // Default (normal form)
    const stateParam = (urlParams.state || '').toLowerCase().trim()
    
    if (stateParam === 'success' || stateParam === 'loading' || stateParam === 'error') {
      state = stateParam
    }
    
    // Parámetro para número de caso (solo para testing de estado success)
    const caseNumber = urlParams.caseNumber || 'TEST-12345'
    
    // Validar event_id UUID
    let eventId = null
    if (urlParams.event_id || urlParams.eventId) {
      const id = urlParams.event_id || urlParams.eventId
      // Validar formato UUID básico
      if (this.isValidUUID(id)) {
        eventId = id
      } else {
        console.warn('Invalid event_id format:', id)
      }
    }
    
    // Validar parámetro de tema
    let theme = null // Default (no change)
    const themeParam = (urlParams.theme || '').toLowerCase().trim()
    
    if (themeParam === 'black' || themeParam === 'dark') {
      theme = 'dark'
    } else if (themeParam === 'white' || themeParam === 'light') {
      theme = 'light'
    } else if (themeParam === 'system' || themeParam === 'auto') {
      theme = 'system'
    }
    
    // Validar parámetro de strip colorido
    let showStrip = true // Default
    const stripParam = (urlParams.showStrip || urlParams.strip || '').toLowerCase().trim()
    
    if (stripParam === 'false' || stripParam === '0' || stripParam === 'no') {
      showStrip = false
    }
    
    // Validar parámetro de color sólido para el strip
    let stripColor = null // Default (gradient animation)
    if (urlParams.stripColor || urlParams.strip_color) {
      const colorParam = (urlParams.stripColor || urlParams.strip_color).trim()
      // Validar formato hex (#rrggbb o #rgb)
      if (/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(colorParam)) {
        stripColor = colorParam
      } else {
        console.warn('Invalid strip color format:', colorParam)
      }
    }
    
    // Validar parámetro de idioma
    let language = null // Default (will be auto-detected)
    const langParam = (urlParams.lang || urlParams.language || '').toLowerCase().trim()
    
    if (langParam === 'es' || langParam === 'spanish' || langParam === 'español') {
      language = 'es'
    } else if (langParam === 'en' || langParam === 'english') {
      language = 'en'
    }
    
    // Validar parámetro de expiración (timestamp o minutos)
    let expiration = null
    if (urlParams.expires || urlParams.expiration) {
      const expiresParam = urlParams.expires || urlParams.expiration
      
      // Si es un número, tratarlo como timestamp
      if (!isNaN(expiresParam)) {
        const timestamp = parseInt(expiresParam)
        // Si es menor a 946684800 (año 2000), tratarlo como minutos desde ahora
        if (timestamp < 946684800) {
          expiration = Date.now() + (timestamp * 60 * 1000)
        } else {
          // Si es mayor, tratarlo como timestamp Unix (segundos)
          expiration = timestamp * 1000
        }
      }
    }
    
    // Validar parámetro de máximo de accesos
    let maxAccess = null
    if (urlParams.maxAccess || urlParams.max_access) {
      const maxParam = parseInt(urlParams.maxAccess || urlParams.max_access)
      if (!isNaN(maxParam) && maxParam > 0) {
        maxAccess = maxParam
      }
    }
    
    // Validar parámetro de botón de contacto
    let showContact = true // Default
    const contactParam = (urlParams.showContact || urlParams.contact || '').toLowerCase().trim()
    
    if (contactParam === 'false' || contactParam === '0' || contactParam === 'no') {
      showContact = false
    }
    
    // Validar parámetro de botón de política
    let showPolicy = true // Default
    const policyParam = (urlParams.showPolicy || urlParams.policy || '').toLowerCase().trim()
    
    if (policyParam === 'false' || policyParam === '0' || policyParam === 'no') {
      showPolicy = false
    }
    
    return {
      showLogo: showLogo,
      state: state,
      caseNumber: caseNumber,
      eventId: eventId,
      theme: theme,
      showStrip: showStrip,
      stripColor: stripColor,
      language: language,
      expiration: expiration,
      maxAccess: maxAccess,
      showContact: showContact,
      showPolicy: showPolicy
    }
  }
  
  // Validar formato UUID básico
  isValidUUID(uuid) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    return uuidRegex.test(uuid)
  }
  
  // Detectar idioma del navegador
  detectBrowserLanguage() {
    // Obtener idiomas preferidos del navegador
    const browserLangs = navigator.languages || [navigator.language || navigator.userLanguage || 'en']
    
    for (const lang of browserLangs) {
      const langCode = lang.split('-')[0].toLowerCase() // Extraer código de idioma base
      
      // Verificar si es español
      if (langCode === 'es') {
        return 'es'
      }
      // Verificar si es inglés
      if (langCode === 'en') {
        return 'en'
      }
    }
    
    // Fallback a inglés si no es español ni inglés
    return 'en'
  }
  
  // Obtener idioma inicial (URL > navegador)
  getInitialLanguage() {
    const config = this.getUIConfig()
    
    // Si hay idioma en URL, usarlo
    if (config.language) {
      console.info('Idioma configurado desde URL:', config.language)
      return config.language
    }
    
    // Si no, detectar del navegador
    const browserLang = this.detectBrowserLanguage()
    console.info('Idioma detectado del navegador:', browserLang)
    return browserLang
  }
  
  // Validar acceso basado en expiración y límites
  validateAccess() {
    const config = this.getUIConfig()
    
    // Validar expiración
    if (config.expiration) {
      if (Date.now() > config.expiration) {
        this.showAccessDenied('expired')
        return false
      }
    }
    
    // Validar límite de accesos
    if (config.maxAccess) {
      const accessCount = this.getAccessCount()
      if (accessCount >= config.maxAccess) {
        this.showAccessDenied('max-access-reached')
        return false
      }
      
      // Incrementar contador de accesos
      this.incrementAccessCount()
    }
    
    return true
  }
  
  // Obtener contador de accesos del localStorage
  getAccessCount() {
    const urlHash = this.getUrlHash()
    const storageKey = `access_count_${urlHash}`
    return parseInt(localStorage.getItem(storageKey) || '0')
  }
  
  // Incrementar contador de accesos
  incrementAccessCount() {
    const urlHash = this.getUrlHash()
    const storageKey = `access_count_${urlHash}`
    const currentCount = this.getAccessCount()
    localStorage.setItem(storageKey, (currentCount + 1).toString())
  }
  
  // Generar hash único de la URL para tracking
  getUrlHash() {
    const url = window.location.href
    let hash = 0
    for (let i = 0; i < url.length; i++) {
      const char = url.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36)
  }
  
  // Mostrar mensaje de acceso denegado
  showAccessDenied(reason) {
    // Ocultar todos los elementos normales
    const form = document.getElementById('refund-form')
    const intro = document.querySelector('.intro-section')
    const header = document.querySelector('.form-header')
    const controls = document.querySelector('.page-controls')
    
    if (form) form.style.display = 'none'
    if (intro) intro.style.display = 'none'
    if (header) header.style.display = 'none'
    if (controls) controls.style.display = 'none'
    
    // Crear mensaje de acceso denegado
    const deniedContainer = document.createElement('div')
    deniedContainer.className = 'access-denied-container'
    deniedContainer.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      z-index: 1000;
      background: rgba(21, 21, 21, 0.1);
      backdrop-filter: blur(25px);
      -webkit-backdrop-filter: blur(25px);
      border: 1px solid rgba(239, 68, 68, 0.3);
      border-radius: 16px;
      padding: 3rem 2.5rem;
      color: var(--text-primary);
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3), 0 8px 16px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(255, 255, 255, 0.05);
      width: 90%;
      max-width: 400px;
      text-align: center;
    `
    
    let title, message
    if (reason === 'expired') {
      title = { es: 'Enlace Expirado', en: 'Link Expired' }
      message = { 
        es: 'Este enlace ha expirado y ya no está disponible. Por favor, solicite un nuevo enlace.',
        en: 'This link has expired and is no longer available. Please request a new link.'
      }
    } else if (reason === 'max-access-reached') {
      title = { es: 'Acceso Limitado', en: 'Access Limited' }
      message = { 
        es: 'Este enlace ha alcanzado el número máximo de accesos permitidos.',
        en: 'This link has reached the maximum number of allowed accesses.'
      }
    }
    
    const currentLang = this.detectBrowserLanguage()
    
    deniedContainer.innerHTML = `
      <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" style="margin-bottom: 1.5rem; padding: 16px; background: rgba(239, 68, 68, 0.1); border-radius: 50%; border: 2px solid rgba(239, 68, 68, 0.2);">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="15" y1="9" x2="9" y2="15"></line>
        <line x1="9" y1="9" x2="15" y2="15"></line>
      </svg>
      <h3 style="margin: 0 0 1rem 0; font-size: 1.5rem; font-weight: 600; color: var(--text-primary);">${title[currentLang]}</h3>
      <p style="margin: 0; color: var(--text-secondary); line-height: 1.6; font-size: 1rem;">${message[currentLang]}</p>
    `
    
    document.querySelector('.container').appendChild(deniedContainer)
    console.warn(`Access denied: ${reason}`)
  }
  
  // Aplicar idioma inicial y actualizar toggle
  applyInitialLanguage() {
    // Aplicar traducciones
    this.switchLanguage(this.currentLang)
    
    // Actualizar el toggle visual para reflejar el idioma actual
    this.updateLanguageToggle(this.currentLang)
  }
  
  // Actualizar el toggle de idioma visual
  updateLanguageToggle(lang) {
    const toggle = document.querySelector('.language-toggle')
    const buttons = document.querySelectorAll('.lang-btn')
    
    // Remover clase activa de todos los botones
    buttons.forEach(btn => btn.classList.remove('active'))
    
    // Agregar clase activa al botón correcto
    const activeBtn = document.querySelector(`[data-lang="${lang}"]`)
    if (activeBtn) {
      activeBtn.classList.add('active')
    }
    
    // Actualizar posición del toggle
    if (toggle) {
      if (lang === 'en') {
        toggle.classList.add('en')
      } else {
        toggle.classList.remove('en')
      }
    }
  }

  // Función para precargar datos desde la URL
  preloadDataFromUrl() {
    const urlParams = this.getUrlParams()
    const fieldMapping = this.getFieldMapping()
    
    // Verificar si hay parámetros para precargar
    if (Object.keys(urlParams).length === 0) {
      return
    }
    
    console.info('Precargando datos desde URL:', urlParams)
    
    for (const [urlParam, value] of Object.entries(urlParams)) {
      // Obtener el nombre real del campo usando el mapeo
      const fieldName = fieldMapping[urlParam]
      
      if (fieldName) {
        this.setFieldValue(fieldName, value)
      }
    }
  }

  // Función para establecer el valor de un campo
  setFieldValue(fieldName, value) {
    const field = document.getElementById(fieldName)
    
    if (!field) {
      console.warn(`Campo no encontrado: ${fieldName}`)
      return
    }
    
    // Sanitizar el valor antes de establecerlo
    const sanitizedValue = this.sanitizeInput(value.toString())
    
    // Validar que el valor sea seguro y válido
    if (!this.isValidInput(sanitizedValue, fieldName)) {
      console.warn(`Valor inválido para ${fieldName}: ${value}`)
      return
    }
    
    // Establecer el valor
    field.value = sanitizedValue
    
    console.info(`Campo precargado: ${fieldName} = ${sanitizedValue}`)
  }

  // Función para aplicar configuración de UI basada en parámetros URL
  applyUIConfig() {
    const config = this.getUIConfig()
    
    // Controlar visibilidad del logo
    const logo = document.querySelector('.form-logo')
    if (logo) {
      if (config.showLogo) {
        logo.style.display = 'block'
      } else {
        logo.style.display = 'none'
      }
    }
    
    // Controlar visibilidad del strip colorido
    const strip = document.querySelector('.stripe-section')
    if (strip) {
      if (config.showStrip) {
        strip.style.display = 'block'
        
        // Aplicar color sólido si se especifica
        if (config.stripColor) {
          // Crear una clase CSS dinámica para sobreescribir los estilos
          const styleId = 'dynamic-strip-style'
          let styleElement = document.getElementById(styleId)
          
          if (!styleElement) {
            styleElement = document.createElement('style')
            styleElement.id = styleId
            document.head.appendChild(styleElement)
          }
          
          styleElement.textContent = `
            .stripe-section {
              background: ${config.stripColor} !important;
              animation: none !important;
            }
          `
          console.info(`Strip color aplicado: ${config.stripColor}`)
        } else {
          // Remover estilo dinámico si existe
          const styleElement = document.getElementById('dynamic-strip-style')
          if (styleElement) {
            styleElement.remove()
          }
        }
      } else {
        strip.style.display = 'none'
      }
    }
    
    // Controlar visibilidad del botón de contacto
    const contactBtn = document.getElementById('contact-btn')
    if (contactBtn) {
      if (config.showContact) {
        contactBtn.style.display = 'flex'
      } else {
        contactBtn.style.display = 'none'
      }
    }
    
    // Controlar visibilidad del botón de política
    const policyBtn = document.getElementById('policy-btn')
    if (policyBtn) {
      if (config.showPolicy) {
        policyBtn.style.display = 'flex'
      } else {
        policyBtn.style.display = 'none'
      }
    }
    
    // Aplicar tema si se especifica
    if (config.theme) {
      this.applyTheme(config.theme)
    }
    
    // Aplicar estado para testing/debugging
    if (config.state) {
      setTimeout(() => {
        this.applyTestState(config.state, config.caseNumber)
      }, 500) // Pequeño delay para que se cargue la página
    }
    
    console.info('UI Config aplicada:', config)
  }
  
  // Aplicar tema basado en parámetro URL
  applyTheme(theme) {
    const documentElement = document.documentElement
    
    switch (theme) {
      case 'dark':
        documentElement.setAttribute('data-theme', 'dark')
        localStorage.setItem('theme', 'dark')
        break
      case 'light':
        documentElement.setAttribute('data-theme', 'light')
        localStorage.setItem('theme', 'light')
        break
      case 'system':
        // Detectar preferencia del sistema
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
        const systemTheme = prefersDark ? 'dark' : 'light'
        documentElement.setAttribute('data-theme', systemTheme)
        localStorage.setItem('theme', systemTheme)
        
        // Escuchar cambios en la preferencia del sistema
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
        mediaQuery.addListener((e) => {
          const newTheme = e.matches ? 'dark' : 'light'
          documentElement.setAttribute('data-theme', newTheme)
          localStorage.setItem('theme', newTheme)
        })
        break
    }
    
    console.info(`Tema aplicado desde URL: ${theme}`)
  }
  
  // Función para aplicar estados de testing
  applyTestState(state, caseNumber) {
    switch (state) {
      case 'loading':
        this.showProgressLoader()
        break
      case 'success':
        // Mostrar mensaje de éxito con número de caso
        const caseNumberDisplay = document.getElementById('case-number-display')
        if (caseNumberDisplay) {
          caseNumberDisplay.textContent = caseNumber
        }
        this.showSuccess()
        break
      case 'error':
        // Mostrar mensaje de error más visible para testing
        this.showTestError('Error de prueba: Este es un mensaje de error para testing')
        break
    }
    
    console.info(`Estado de testing aplicado: ${state}`)
  }
  
  // Función para mostrar error de testing más visible
  showTestError(message) {
    const config = this.getUIConfig()
    
    // Mostrar/ocultar header elements basado en configuración
    const header = document.querySelector('.form-header')
    const controls = document.querySelector('.page-controls')
    
    if (header) {
      header.style.display = 'block'
    }
    if (controls) {
      controls.style.display = 'flex'
    }
    
    // Ocultar elementos del formulario
    const form = document.getElementById('refund-form')
    const intro = document.querySelector('.intro-section')
    
    if (form) form.style.display = 'none'
    if (intro) intro.style.display = 'none'
    
    // Crear un elemento de error mejorado
    const errorContainer = document.createElement('div')
    errorContainer.id = 'test-error-message'
    errorContainer.className = 'error-message-container'
    errorContainer.style.cssText = `
      background: rgba(21, 21, 21, 0.1);
      backdrop-filter: blur(25px);
      -webkit-backdrop-filter: blur(25px);
      border: 1px solid rgba(239, 68, 68, 0.3);
      border-radius: 16px;
      padding: 3rem 2.5rem;
      color: var(--text-primary);
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3), 0 8px 16px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(255, 255, 255, 0.05);
      text-align: center;
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      z-index: 1000;
      width: 90%;
      max-width: 400px;
    `
    
    errorContainer.innerHTML = `
      <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" style="margin-bottom: 1.5rem; padding: 16px; background: rgba(239, 68, 68, 0.1); border-radius: 50%; border: 2px solid rgba(239, 68, 68, 0.2);">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="15" y1="9" x2="9" y2="15"></line>
        <line x1="9" y1="9" x2="15" y2="15"></line>
      </svg>
      <div>
        <h3 style="margin: 0 0 1rem 0; font-size: 1.5rem; font-weight: 600; color: var(--text-primary); font-family: 'Source Sans 3', sans-serif;" data-es="Error al Procesar" data-en="Processing Error">Error al Procesar</h3>
        <p style="margin: 0 0 2rem 0; color: var(--text-secondary); line-height: 1.6; font-size: 1rem; max-width: 400px; margin-left: auto; margin-right: auto; font-family: 'Source Sans 3', sans-serif;" data-es="Ha ocurrido un error al procesar su solicitud de reembolso. Por favor, verifique su información e inténtelo nuevamente. Si el problema persiste, contacte a nuestro equipo de soporte." data-en="An error occurred while processing your refund request. Please check your information and try again. If the problem persists, contact our support team.">Ha ocurrido un error al procesar su solicitud de reembolso. Por favor, verifique su información e inténtelo nuevamente. Si el problema persiste, contacte a nuestro equipo de soporte.</p>
        <button type="button" id="restart-form-btn" style="
          background: #ffffff;
          color: var(--bg-primary);
          border: none;
          border-radius: 8px;
          padding: 0.875rem 2rem;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          min-height: 48px;
          font-family: 'Source Sans 3', sans-serif;
          box-shadow: 0 4px 16px rgba(255, 255, 255, 0.1);
        " 
        onmouseover="this.style.background='#f0f0f0'; this.style.transform='translateY(-2px)'; this.style.boxShadow='0 8px 24px rgba(255, 255, 255, 0.15)'"
        onmouseout="this.style.background='#ffffff'; this.style.transform='translateY(0px)'; this.style.boxShadow='0 4px 16px rgba(255, 255, 255, 0.1)'"
        data-es="Intentar de Nuevo" data-en="Try Again">Intentar de Nuevo</button>
      </div>
    `
    
    // Agregar event listener al botón
    const restartBtn = errorContainer.querySelector('#restart-form-btn')
    if (restartBtn) {
      restartBtn.addEventListener('click', () => {
        // Remover el mensaje de error
        errorContainer.remove()
        
        // Mostrar elementos del formulario nuevamente
        if (form) form.style.display = 'block'
        if (intro) intro.style.display = 'block'
        
        // Limpiar formulario
        this.resetForm()
      })
    }
    
    // Agregar al DOM
    document.querySelector('.container').appendChild(errorContainer)
    
    // Aplicar traducciones si es necesario
    if (this.currentLang === 'en') {
      this.updateErrorTranslations(errorContainer)
    }
  }
  
  // Helper para actualizar traducciones del error
  updateErrorTranslations(container) {
    container.querySelectorAll('[data-es][data-en]').forEach(element => {
      const text = element.getAttribute('data-en')
      if (text) {
        element.textContent = text
      }
    })
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

  // Simple rate limiting for form submissions
  async checkRateLimit() {
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

  // Generate user identifier for rate limiting
  getUserIdentifier() {
    // Try to get existing session ID
    let sessionId = sessionStorage.getItem('refund_form_session')
    
    if (!sessionId) {
      // Generate new session ID
      sessionId = 'session_' + Date.now().toString(36) + Math.random().toString(36).substr(2)
      sessionStorage.setItem('refund_form_session', sessionId)
    }
    
    return sessionId
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
    
    // Check rate limit
    if (!(await this.checkRateLimit())) {
      return
    }
    
    // Update submission tracking (keep for fallback)
    this.submissionAttempts++
    this.lastSubmissionTime = Date.now()
    
    if (!this.validateForm()) {
      return
    }
    
    this.setLoading(true)
    
    // Show progress loader immediately after validation
    this.showProgressLoader()
    
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
      
      
      // Log submission attempt
      console.info('Form submission attempt', {
        timestamp: new Date().toISOString(),
        fields: Array.from(formData.keys())
      })
      
      // Submit to Webhook
      const result = await this.submitToWebhook(formData)
      
      // Hide progress loader and show success (keep form hidden)
      this.hideProgressLoader()
      
      // Display case number in success message
      const caseNumberDisplay = document.getElementById('case-number-display')
      if (caseNumberDisplay && result.caseNumber) {
        caseNumberDisplay.textContent = result.caseNumber
      }
      
      this.showSuccess()
      this.resetForm()
      
    } catch (error) {
      console.error('Error submitting form:', error)
      
      // Hide progress loader and show error
      this.hideProgressLoader()
      this.form.style.display = 'block'
      
      // Show intro-section, title, subtitle and controls again on error
      const introSection = document.querySelector('.intro-section')
      const headerTitle = document.querySelector('.form-header h1')
      const headerSubtitle = document.querySelector('.form-header p')
      const pageControls = document.querySelector('.page-controls')
      
      if (introSection) {
        introSection.style.display = 'block'
      }
      if (headerTitle) {
        headerTitle.style.display = 'block'
      }
      if (headerSubtitle) {
        headerSubtitle.style.display = 'block'
      }
      if (pageControls) {
        pageControls.style.display = 'flex'
      }
      
      this.showError('form', this.t('form-error'))
    } finally {
      this.setLoading(false)
    }
  }

  async submitToWebhook(formData) {
    try {
      // Generate UUID for this refund
      const refundId = webhookClient.generateUUID()
      
      // Format data for webhook
      const refundData = webhookClient.formatRefundData(formData, refundId)
      console.log('Preparing refund data:', refundData)
      
      
      // Get event_id from URL if available
      const config = this.getUIConfig()
      
      // Prepare webhook data with all information
      const webhookData = {
        refund: refundData,
        timestamp: new Date().toISOString(),
        source: 'refund-form'
      }
      
      // Add event_id if provided in URL
      if (config.eventId) {
        webhookData.event_id = config.eventId
        console.log('Including event_id in webhook:', config.eventId)
      }
      
      // Send everything to webhook at once
      console.log('Sending all data to webhook...')
      const caseNumber = await webhookClient.sendWebhook(webhookData)
      console.log('Data sent successfully to webhook, case number:', caseNumber)
      
      return {
        refund: refundData,
        caseNumber: caseNumber
      }
      
    } catch (error) {
      console.error('Error in form submission:', error)
      throw error
    }
  }



  // Simple loader methods
  showProgressLoader() {
    const introSection = document.querySelector('.intro-section')
    this.form.style.display = 'none'
    if (introSection) {
      introSection.style.display = 'none'
    }
    this.progressLoader.style.display = 'block'
    this.progressLoader.scrollIntoView({ behavior: 'smooth' })
  }

  hideProgressLoader() {
    this.progressLoader.style.display = 'none'
  }

  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
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
    const introSection = document.querySelector('.intro-section')
    const headerTitle = document.querySelector('.form-header h1')
    const headerSubtitle = document.querySelector('.form-header p')
    const pageControls = document.querySelector('.page-controls')
    const form = document.getElementById('refund-form')
    
    // Hide form and intro section
    if (introSection) {
      introSection.style.display = 'none'
    }
    if (form) {
      form.style.display = 'none'
    }
    
    // Keep header title and subtitle visible
    if (headerTitle) {
      headerTitle.style.display = 'block'
    }
    if (headerSubtitle) {
      headerSubtitle.style.display = 'block'
    }
    if (pageControls) {
      pageControls.style.display = 'flex'
    }
    
    this.successMessage.style.display = 'flex'
    this.successMessage.scrollIntoView({ behavior: 'smooth' })
  }

  resetForm() {
    this.form.reset()
    
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
    
    // Setup contact button
    const contactBtn = document.getElementById('contact-btn')
    if (contactBtn) {
      contactBtn.addEventListener('click', () => {
        this.handleContactClick()
      })
    }
    
    // Setup policy button
    const policyBtn = document.getElementById('policy-btn')
    if (policyBtn) {
      policyBtn.addEventListener('click', () => {
        this.handlePolicyClick()
      })
    }
    
    // Setup contact modal
    this.setupContactModal()
  }
  
  // Handle contact button click
  handleContactClick() {
    this.showContactModal()
  }
  
  // Handle policy button click
  handlePolicyClick() {
    // You can customize this URL or add URL parameter support
    const policyUrl = 'https://www.hunt-tickets.com/resources/refund-policy'
    window.open(policyUrl, '_blank', 'noopener,noreferrer')
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
    
  }

  t(key) {
    return translations[this.currentLang][key] || key
  }

  // Setup contact modal functionality
  setupContactModal() {
    const modal = document.getElementById('contact-modal')
    const closeBtn = document.getElementById('contact-modal-close')
    const overlay = document.getElementById('contact-modal-overlay')
    const whatsappBtn = document.getElementById('whatsapp-contact')
    const emailBtn = document.getElementById('email-contact')
    
    if (!modal) return
    
    // Close modal handlers
    const closeModal = () => {
      modal.classList.remove('show')
      setTimeout(() => {
        modal.style.display = 'none'
      }, 300)
    }
    
    if (closeBtn) {
      closeBtn.addEventListener('click', closeModal)
    }
    
    if (overlay) {
      overlay.addEventListener('click', closeModal)
    }
    
    // ESC key to close
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal.classList.contains('show')) {
        closeModal()
      }
    })
    
    // WhatsApp contact
    if (whatsappBtn) {
      whatsappBtn.addEventListener('click', () => {
        const message = this.currentLang === 'es' 
          ? 'Hola, necesito ayuda con mi solicitud de reembolso.'
          : 'Hello, I need help with my refund request.'
        
        const whatsappUrl = `https://wa.me/+573138479816?text=${encodeURIComponent(message)}`
        window.open(whatsappUrl, '_blank', 'noopener,noreferrer')
        closeModal()
      })
    }
    
    // Email contact
    if (emailBtn) {
      emailBtn.addEventListener('click', () => {
        const subject = this.currentLang === 'es' 
          ? 'Solicitud de Ayuda - Reembolso'
          : 'Help Request - Refund'
        
        const body = this.currentLang === 'es'
          ? 'Hola,%0A%0ANecesito ayuda con mi solicitud de reembolso.%0A%0AGracias.'
          : 'Hello,%0A%0AI need help with my refund request.%0A%0AThank you.'
        
        const emailUrl = `mailto:support@hunt-tickets.com?subject=${encodeURIComponent(subject)}&body=${body}`
        window.location.href = emailUrl
        closeModal()
      })
    }
  }
  
  // Show contact modal
  showContactModal() {
    const modal = document.getElementById('contact-modal')
    if (modal) {
      modal.style.display = 'flex'
      // Small delay to trigger animation
      setTimeout(() => {
        modal.classList.add('show')
      }, 10)
    }
  }

}

document.addEventListener('DOMContentLoaded', () => {
  // Initialize form
  const refundForm = new RefundForm()
  
  // Theme toggle functionality
  const themeToggle = document.getElementById('theme-toggle')
  
  // Check for saved theme preference or default to dark mode
  const savedTheme = localStorage.getItem('theme') || 'dark'
  document.documentElement.setAttribute('data-theme', savedTheme)
  
  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      const currentTheme = document.documentElement.getAttribute('data-theme')
      const newTheme = currentTheme === 'dark' ? 'light' : 'dark'
      
      document.documentElement.setAttribute('data-theme', newTheme)
      localStorage.setItem('theme', newTheme)
    })
  }
  
})
