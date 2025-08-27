// Webhook client for form submission
class WebhookClient {
  constructor() {
    this.webhookUrl = import.meta.env.VITE_WEBHOOK_URL
    
    if (!this.webhookUrl) {
      console.error('Webhook URL is missing. Please check your environment variables.')
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
      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Webhook failed: HTTP ${response.status}: ${errorText}`)
      }

      // The webhook returns the case number as plain text
      const caseNumber = await response.text()
      console.log('Case number received from webhook:', caseNumber)
      return caseNumber.trim() // Return the case number, removing any whitespace
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