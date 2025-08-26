// Supabase configuration and client
class SupabaseClient {
  constructor() {
    this.supabaseUrl = import.meta.env.VITE_SUPABASE_URL
    this.supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
    this.webhookUrl = import.meta.env.VITE_WEBHOOK_URL
    this.webhookUser = import.meta.env.VITE_WEBHOOK_USER
    this.webhookPassword = import.meta.env.VITE_WEBHOOK_PASSWORD
    this.storageBucket = import.meta.env.VITE_STORAGE_BUCKET
    
    if (!this.supabaseUrl || !this.supabaseAnonKey) {
      console.error('Supabase configuration is missing. Please check your environment variables.')
    }
  }

  // Create authorization headers
  getHeaders() {
    return {
      'apikey': this.supabaseAnonKey,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    }
  }

  // Generate UUID v4
  generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0
      const v = c == 'x' ? r : (r & 0x3 | 0x8)
      return v.toString(16)
    })
  }

  // Create refund record in Supabase
  async createRefund(refundData) {
    const url = `${this.supabaseUrl}/rest/v1/refunds`
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(refundData)
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`HTTP ${response.status}: ${errorText}`)
      }

      const result = await response.json()
      return result[0] // Supabase returns an array
    } catch (error) {
      console.error('Error creating refund:', error)
      throw error
    }
  }

  // Upload file to Supabase Storage
  async uploadFile(refundId, file, fileName) {
    const filePath = `${refundId}/${fileName}`
    const url = `${this.supabaseUrl}/storage/v1/object/${this.storageBucket}/${filePath}`

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'apikey': this.supabaseAnonKey,
        },
        body: file
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`File upload failed: HTTP ${response.status}: ${errorText}`)
      }

      const result = await response.json()
      return {
        path: filePath,
        fullPath: result.Key,
        url: `${this.supabaseUrl}/storage/v1/object/public/${this.storageBucket}/${filePath}`
      }
    } catch (error) {
      console.error('Error uploading file:', error)
      throw error
    }
  }

  // Upload multiple files
  async uploadFiles(refundId, files) {
    const uploadPromises = files.map((file, index) => {
      const fileName = `attachment${index + 1}.${file.name.split('.').pop()}`
      return this.uploadFile(refundId, file, fileName)
    })

    try {
      const results = await Promise.all(uploadPromises)
      return results
    } catch (error) {
      console.error('Error uploading multiple files:', error)
      throw error
    }
  }

  // Send webhook to Railway
  async sendWebhook(data) {
    try {
      // Create basic auth header
      const credentials = btoa(`${this.webhookUser}:${this.webhookPassword}`)
      
      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${credentials}`
        },
        body: JSON.stringify(data)
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Webhook failed: HTTP ${response.status}: ${errorText}`)
      }

      const result = await response.text()
      return result
    } catch (error) {
      console.error('Error sending webhook:', error)
      throw error
    }
  }

  // Format refund data for Supabase
  formatRefundData(formData, refundId) {
    const refundMethod = formData.get('refundMethod')
    let paymentMethodData = {}

    if (refundMethod === 'breb') {
      paymentMethodData = {
        type: 'breb',
        account: formData.get('brebAccount')
      }
    } else if (refundMethod === 'bank') {
      paymentMethodData = {
        type: 'bank_account',
        account_number: formData.get('accountNumber'),
        account_type: formData.get('accountType'),
        bank_name: formData.get('bankName'),
        document_number: formData.get('documentNumber'),
        account_holder_name: formData.get('accountHolderName')
      }
    }

    return {
      id: refundId,
      name: formData.get('fullName'),
      email: formData.get('email'),
      order_id: formData.get('orderNumber'),
      description: formData.get('reason'),
      payment_method: paymentMethodData,
      status: 'pending',
      created_at: new Date().toISOString()
    }
  }
}

// Export singleton instance
export const supabase = new SupabaseClient()