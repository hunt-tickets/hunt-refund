// Webhook client for form submission
class WebhookClient {
  constructor() {
    this.webhookUrl = import.meta.env.VITE_WEBHOOK_URL
    this.webhookUser = import.meta.env.VITE_WEBHOOK_USER
    this.webhookPassword = import.meta.env.VITE_WEBHOOK_PASSWORD
    
    if (!this.webhookUrl || !this.webhookUser || !this.webhookPassword) {
      console.error('Webhook configuration is missing. Please check your environment variables.')
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



  // Send webhook with form data
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

  // Format refund data for webhook
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
export const supabase = new WebhookClient()