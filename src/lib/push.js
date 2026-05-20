import webpush from 'web-push'
import { createSupabaseAdmin } from './supabase-admin'

// Inicializar web-push con variables de entorno
const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
const privateKey = process.env.VAPID_PRIVATE_KEY
const subject = process.env.VAPID_SUBJECT || 'mailto:soporte@glowup.com'

if (publicKey && privateKey) {
    webpush.setVapidDetails(subject, publicKey, privateKey)
} else {
    console.warn('⚠️ Web Push warning: VAPID keys not configured in environment variables.')
}

/**
 * Envía una notificación Web Push a todas las suscripciones registradas de un usuario.
 * @param {string} userId ID del usuario (UUID de perfil)
 * @param {object} payload Datos de la notificación ({ title, body, url, tag })
 */
export async function sendPushNotification(userId, payload) {
    if (!publicKey || !privateKey) {
        console.error('❌ Cannot send push: VAPID keys are missing.')
        return { success: false, error: 'VAPID keys missing' }
    }

    const supabase = createSupabaseAdmin()

    // 1. Obtener todas las suscripciones del usuario
    const { data: subscriptions, error } = await supabase
        .from('push_subscriptions')
        .select('*')
        .eq('user_id', userId)

    if (error) {
        console.error('❌ Error fetching push subscriptions:', error)
        return { success: false, error }
    }

    if (!subscriptions || subscriptions.length === 0) {
        return { success: true, sent: 0 }
    }

    console.log(`Sending push notification to user ${userId} (${subscriptions.length} devices)...`)

    const sendPromises = subscriptions.map(async (sub) => {
        // Re-construir el objeto de suscripción que espera web-push
        const pushSubscription = {
            endpoint: sub.endpoint,
            keys: {
                p256dh: sub.p256dh,
                auth: sub.auth
            }
        }

        try {
            await webpush.sendNotification(pushSubscription, JSON.stringify(payload))
            return { success: true, endpoint: sub.endpoint }
        } catch (err) {
            // Si la suscripción expiró o fue eliminada por el cliente (410 Gone o 404 Not Found),
            // la removemos de la base de datos automáticamente
            if (err.statusCode === 410 || err.statusCode === 404) {
                console.warn(`Removing expired/invalid push subscription for user ${userId}:`, sub.endpoint)
                await supabase
                    .from('push_subscriptions')
                    .delete()
                    .eq('id', sub.id)
            } else {
                console.error(`Error sending push notification to endpoint ${sub.endpoint}:`, err)
            }
            return { success: false, endpoint: sub.endpoint, error: err }
        }
    })

    const results = await Promise.all(sendPromises)
    const successful = results.filter(r => r.success).length

    return { success: true, total: subscriptions.length, sent: successful }
}
