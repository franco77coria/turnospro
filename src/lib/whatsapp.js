const WHATSAPP_API_URL = 'https://graph.facebook.com/v21.0'

export async function sendWhatsAppMessage({ to, templateName, templateParams, phoneNumberId }) {
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
  const token = process.env.WHATSAPP_ACCESS_TOKEN
  if (!token || !phoneNumberId) return null

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
      type: 'text',
      text: { body: text },
    }),
  })

  return response.json()
}
