/**
 * Redis Client Module
 * Handles Redis connection and common operations for the refund form
 */

class RedisClient {
  constructor() {
    this.client = null
    this.isConnected = false
    this.analyticsBatcher = null
    
    // Safe environment variable access for client-side
    const getEnvVar = (envName, fallback = '') => {
      if (typeof import.meta !== 'undefined' && import.meta.env) {
        return import.meta.env[envName] || fallback
      }
      return fallback
    }
    
    this.config = {
      url: getEnvVar('REDIS_URL'),
      host: getEnvVar('REDISHOST', 'localhost'),
      port: parseInt(getEnvVar('REDISPORT', '6379')),
      username: getEnvVar('REDISUSER'),
      password: getEnvVar('REDISPASSWORD'),
      rateLimitMax: parseInt(getEnvVar('REDIS_RATE_LIMIT_MAX', '10')),
      rateLimitWindow: parseInt(getEnvVar('REDIS_RATE_LIMIT_WINDOW', '60')),
      formCacheTTL: parseInt(getEnvVar('REDIS_FORM_CACHE_TTL', '60')),
      analyticsTTL: parseInt(getEnvVar('REDIS_ANALYTICS_TTL', '300')),
      queueName: getEnvVar('REDIS_QUEUE_NAME', 'refund_forms')
    }
  }

  /**
   * Initialize Redis connection
   * For client-side, this will simulate Redis functionality using localStorage
   */
  async init() {
    try {
      // In browser environment, we'll use localStorage as a fallback
      if (typeof window !== 'undefined') {
        this.client = new LocalStorageRedis()
        this.isConnected = true
        this.analyticsBatcher = new AnalyticsBatcher(this)
        console.info('Redis Client: Using localStorage fallback for client-side')
        return true
      }

      // Server-side Redis connection would go here
      // This is placeholder for when you implement server-side processing
      console.info('Redis Client: Server-side connection not implemented yet')
      return false
    } catch (error) {
      console.error('Redis Client: Failed to initialize', error)
      return false
    }
  }

  /**
   * Check if we should use Redis based on active users (cost optimization)
   * @returns {Promise<boolean>}
   */
  async shouldUseRedis() {
    if (!this.isConnected) return false
    
    try {
      const activeSessionsKey = 'active_sessions_count'
      const currentCount = await this.client.get(activeSessionsKey)
      const count = currentCount ? parseInt(currentCount) : 0
      
      // Increment current session
      await this.client.set(activeSessionsKey, (count + 1).toString(), 300) // 5 min TTL
      
      // Only use Redis if we have 3+ active users (cost optimization)
      return count >= 2
    } catch (error) {
      console.warn('Redis shouldUseRedis check failed:', error)
      return false
    }
  }

  /**
   * Rate limiting check
   * @param {string} identifier - User identifier (IP, session, etc.)
   * @returns {Promise<{allowed: boolean, remaining: number, resetTime: number}>}
   */
  async checkRateLimit(identifier) {
    // Cost optimization: only use Redis rate limiting with multiple users
    if (!this.isConnected || !(await this.shouldUseRedis())) {
      return { allowed: true, remaining: this.config.rateLimitMax, resetTime: 0 }
    }

    try {
      const key = `rate_limit:${identifier}`
      const now = Date.now()
      const windowStart = now - (this.config.rateLimitWindow * 1000)

      // Get current count
      const current = await this.client.get(key)
      const count = current ? JSON.parse(current) : { requests: [], window: now }

      // Filter requests within current window
      count.requests = count.requests.filter(timestamp => timestamp > windowStart)

      // Check if limit exceeded
      if (count.requests.length >= this.config.rateLimitMax) {
        const oldestRequest = Math.min(...count.requests)
        const resetTime = oldestRequest + (this.config.rateLimitWindow * 1000)
        
        return {
          allowed: false,
          remaining: 0,
          resetTime: resetTime
        }
      }

      // Add current request
      count.requests.push(now)
      count.window = now

      // Save updated count
      await this.client.set(key, JSON.stringify(count), this.config.rateLimitWindow)

      return {
        allowed: true,
        remaining: this.config.rateLimitMax - count.requests.length,
        resetTime: now + (this.config.rateLimitWindow * 1000)
      }
    } catch (error) {
      console.error('Redis Client: Rate limit check failed', error)
      // Fallback to allowing request if Redis fails
      return { allowed: true, remaining: this.config.rateLimitMax, resetTime: 0 }
    }
  }

  /**
   * Add form submission to queue
   * @param {Object} formData - Form data to queue
   * @returns {Promise<string>} - Queue ID
   */
  async queueFormSubmission(formData) {
    if (!this.isConnected) {
      console.warn('Redis Client: Queue unavailable, processing immediately')
      return null
    }

    try {
      const queueItem = {
        id: this.generateId(),
        timestamp: Date.now(),
        data: formData,
        status: 'pending'
      }

      await this.client.lpush(this.config.queueName, JSON.stringify(queueItem))
      
      // Track analytics
      await this.trackAnalytics('form_queued', { queueId: queueItem.id })
      
      return queueItem.id
    } catch (error) {
      console.error('Redis Client: Failed to queue form submission', error)
      return null
    }
  }

  /**
   * Track analytics event (optimized with batching)
   * @param {string} event - Event name
   * @param {Object} data - Event data
   */
  async trackAnalytics(event, data = {}) {
    if (!this.isConnected) return

    try {
      // Use batching for cost optimization
      if (this.analyticsBatcher) {
        await this.analyticsBatcher.add(event, data)
      } else {
        // Fallback to direct tracking
        const analyticsKey = `analytics:${event}:${new Date().toISOString().split('T')[0]}`
        const eventData = {
          timestamp: Date.now(),
          event,
          data,
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown'
        }

        await this.client.lpush(analyticsKey, JSON.stringify(eventData))
        await this.client.expire(analyticsKey, this.config.analyticsTTL)
      }
    } catch (error) {
      console.error('Redis Client: Analytics tracking failed', error)
    }
  }

  /**
   * Generate unique ID
   * @returns {string}
   */
  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2)
  }

  /**
   * Get connection status
   * @returns {boolean}
   */
  isReady() {
    return this.isConnected
  }

  /**
   * Cleanup old data for cost optimization
   */
  async cleanup() {
    if (!this.isConnected) return

    try {
      // Get all rate limit keys
      const rateLimitKeys = await this.getAllKeys('rate_limit:*')
      
      for (const key of rateLimitKeys) {
        try {
          const data = await this.client.get(key)
          if (data) {
            const parsed = JSON.parse(data)
            // Remove rate limits older than 5 minutes
            if (Date.now() - parsed.window > 300000) {
              await this.client.del ? await this.client.del(key) : localStorage.removeItem(`redis:${key}`)
            }
          }
        } catch (e) {
          // Skip invalid data
        }
      }
      
      // Force flush analytics batch
      if (this.analyticsBatcher) {
        await this.analyticsBatcher.flush()
      }
      
      console.info('Redis cleanup completed')
    } catch (error) {
      console.warn('Redis cleanup error:', error)
    }
  }

  /**
   * Get all keys matching pattern (localStorage simulation)
   */
  async getAllKeys(pattern) {
    if (typeof localStorage !== 'undefined') {
      const redisKeys = Object.keys(localStorage)
        .filter(key => key.startsWith('redis:'))
        .map(key => key.replace('redis:', ''))
        .filter(key => {
          const simplePattern = pattern.replace('*', '.*')
          return new RegExp(simplePattern).test(key)
        })
      return redisKeys
    }
    return []
  }

  /**
   * Disconnect
   */
  async disconnect() {
    // Flush pending analytics before disconnect
    if (this.analyticsBatcher) {
      await this.analyticsBatcher.flush()
    }
    
    if (this.client && typeof this.client.disconnect === 'function') {
      await this.client.disconnect()
    }
    this.isConnected = false
  }
}

/**
 * Analytics Batcher for cost optimization
 * Groups analytics events to reduce Redis operations
 */
class AnalyticsBatcher {
  constructor(redisClient) {
    this.redisClient = redisClient
    this.batch = []
    this.maxBatchSize = 5
    this.maxWaitTime = 30000  // 30 seconds
    this.lastFlush = Date.now()
  }

  async add(event, data) {
    const eventData = {
      timestamp: Date.now(),
      event,
      data,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown'
    }

    this.batch.push(eventData)
    
    // Flush if batch is full or enough time has passed
    if (this.batch.length >= this.maxBatchSize || 
        Date.now() - this.lastFlush > this.maxWaitTime) {
      await this.flush()
    }
  }

  async flush() {
    if (this.batch.length === 0) return

    try {
      // Group all events in a single key by day for efficiency
      const today = new Date().toISOString().split('T')[0]
      const batchKey = `analytics_batch:${today}`
      
      // Single Redis operation instead of multiple
      await this.redisClient.client.lpush(batchKey, JSON.stringify({
        batchId: Date.now(),
        events: this.batch
      }))
      
      await this.redisClient.client.expire(batchKey, this.redisClient.config.analyticsTTL)
      
      console.info(`Analytics batch flushed: ${this.batch.length} events`)
      
      this.batch = []
      this.lastFlush = Date.now()
    } catch (error) {
      console.error('Analytics batch flush failed:', error)
      // Don't lose the data, keep it for next flush
    }
  }
}

/**
 * LocalStorage-based Redis simulation for client-side
 */
class LocalStorageRedis {
  async get(key) {
    try {
      const item = localStorage.getItem(`redis:${key}`)
      if (!item) return null
      
      const parsed = JSON.parse(item)
      
      // Check expiration
      if (parsed.expires && Date.now() > parsed.expires) {
        localStorage.removeItem(`redis:${key}`)
        return null
      }
      
      return parsed.value
    } catch (error) {
      console.error('LocalStorageRedis: Get failed', error)
      return null
    }
  }

  async set(key, value, ttlSeconds = null) {
    try {
      const item = {
        value,
        expires: ttlSeconds ? Date.now() + (ttlSeconds * 1000) : null
      }
      localStorage.setItem(`redis:${key}`, JSON.stringify(item))
      return true
    } catch (error) {
      console.error('LocalStorageRedis: Set failed', error)
      return false
    }
  }

  async lpush(key, value) {
    try {
      const current = await this.get(key)
      const list = current ? JSON.parse(current) : []
      list.unshift(value)
      await this.set(key, JSON.stringify(list))
      return list.length
    } catch (error) {
      console.error('LocalStorageRedis: Lpush failed', error)
      return 0
    }
  }

  async expire(key, seconds) {
    try {
      const item = localStorage.getItem(`redis:${key}`)
      if (!item) return false
      
      const parsed = JSON.parse(item)
      parsed.expires = Date.now() + (seconds * 1000)
      localStorage.setItem(`redis:${key}`, JSON.stringify(parsed))
      return true
    } catch (error) {
      console.error('LocalStorageRedis: Expire failed', error)
      return false
    }
  }

  async del(key) {
    try {
      localStorage.removeItem(`redis:${key}`)
      return true
    } catch (error) {
      console.error('LocalStorageRedis: Delete failed', error)
      return false
    }
  }
}

// Export singleton instance
export const redisClient = new RedisClient()

// Auto-initialize
redisClient.init().catch(console.error)