const WHATSAPP_API_URL = 'https://graph.facebook.com/v21.0'

// Get current active provider: 'meta' (default) or 'evolution'
const WHATSAPP_PROVIDER = process.env.WHATSAPP_PROVIDER || 'meta'

export async function sendWhatsAppMessage({ to, templateName, templateParams, phoneNumberId }) {
  if (WHATSAPP_PROVIDER === 'evolution') {
    // Evolution API doesn't require pre-approved Meta templates, we format as plain text
    const text = `Notificación: ${templateName}\nParámetros: ${templateParams?.join(', ')}`
    return sendWhatsAppText({ to, text, phoneNumberId })
  }

  const token = process.env.WHATSAPP_ACCESS_TOKEN
  if (!token || !phoneNumberId) {
    console.warn('WhatsApp not configured, skipping message')
    return null
  }

  // Format phone: ensure it starts with country code, no +
  const formattedPhone = to.replace(/[^0-9]/g, '')

  const response = await fetch(`${WHATSAPP_API_URL}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: formattedPhone,
      type: 'template',
      template: {
        name: templateName,
        language: { code: 'es_AR' },
        components: templateParams ? [{
          type: 'body',
          parameters: templateParams.map(p => ({ type: 'text', text: String(p) }))
        }] : undefined,
      },
    }),
  })

  const data = await response.json()
  if (!response.ok) {
    console.error('WhatsApp send error:', data)
    throw new Error(data.error?.message || 'WhatsApp send failed')
  }
  return data
}

// Helper for simple text messages (non-template)
export async function sendWhatsAppText({ to, text, phoneNumberId }) {
  const formattedPhone = to.replace(/[^0-9]/g, '')

  if (WHATSAPP_PROVIDER === 'evolution') {
    const apiUrl = process.env.EVOLUTION_API_URL
    const apiKey = process.env.EVOLUTION_API_KEY
    const instanceName = process.env.EVOLUTION_INSTANCE_NAME

    if (!apiUrl || !apiKey || !instanceName) {
      console.warn('Evolution API variables are not fully configured in .env, skipping message')
      return null
    }

    const response = await fetch(`${apiUrl}/message/sendText/${instanceName}`, {
      method: 'POST',
      headers: {
        'apikey': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        number: formattedPhone,
        text: text,
        options: {
          delay: 1200,
          presence: 'composing'
        }
      }),
    })

    const data = await response.json()
    if (!response.ok) {
      console.error('Evolution API WhatsApp send error:', data)
      throw new Error(data.message || 'Evolution API send failed')
    }
    return {
      messages: [{ id: data.key?.id || data.messageId || 'evolution_msg' }]
    }
  }

  const token = process.env.WHATSAPP_ACCESS_TOKEN
  if (!token || !phoneNumberId) return null

  const response = await fetch(`${WHATSAPP_API_URL}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: formattedPhone,
      type: 'text',
      text: { body: text },
    }),
  })

  return response.json()
}
