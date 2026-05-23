import { z } from 'zod'

// ─── Primitives ───
const uuid = z.string().uuid()
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida (YYYY-MM-DD)')
const timeStr = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, 'Hora inválida (HH:MM)')
const shortText = (max = 200) => z.string().trim().min(1).max(max)
const optionalShortText = (max = 200) => z.string().trim().max(max).optional().nullable()
const emailStr = z.string().email().max(254)
const phoneStr = z.string().max(20).regex(/^\+?[0-9 \-().]+$/, 'Teléfono inválido')

// ─── Appointments ───
export const BookingSchema = z.object({
    business_id: uuid,
    client_id: uuid.nullish(),
    team_member_id: uuid.nullish(),
    service_name: shortText(200),
    date: dateStr,
    time: timeStr,
    duration: z.number().int().min(5).max(480).optional().default(30),
    price: z.number().nonnegative().max(10_000_000).optional().default(0),
    notes: optionalShortText(1000),
})

export const CancelTokenSchema = z.object({
    token: z.string().min(10).max(2000),
})

export const AvailabilityCheckSchema = z.object({
    business_id: uuid,
    date: dateStr,
    time: timeStr,
    duration: z.number().int().min(5).max(480).optional(),
    team_member_id: uuid.nullish(),
    buffer_time: z.number().int().min(0).max(240).optional(),
})

// ─── Waitlist ───
export const WaitlistEntrySchema = z.object({
    business_id: uuid,
    date: dateStr,
    client_phone: phoneStr,
    client_name: optionalShortText(200),
    client_email: emailStr.nullish(),
    team_member_id: uuid.nullish(),
    service_name: optionalShortText(200),
})

// ─── Reviews ───
export const ReviewSchema = z.object({
    business_id: uuid,
    rating: z.number().int().min(1).max(5),
    comment: optionalShortText(2000),
})

export const ReviewRequestSchema = z.object({
    client_email: emailStr,
    client_name: optionalShortText(200),
    service_name: optionalShortText(200),
    business_id: uuid,
    business_name: optionalShortText(200),
    business_type: optionalShortText(40),
    appointment_id: uuid.optional(),
})

// ─── Loyalty ───
export const LoyaltyTxSchema = z.object({
    program_id: uuid,
    client_id: uuid,
    points: z.number().int().min(1).max(1_000_000),
    type: z.enum(['earn', 'redeem', 'adjust']),
    description: optionalShortText(200),
    appointment_id: uuid.nullish(),
})

// ─── Commissions ───
export const CommissionsCalcSchema = z.object({
    business_id: uuid,
    start_date: dateStr,
    end_date: dateStr,
})

// ─── Favorites ───
export const FavoriteToggleSchema = z.object({
    business_id: uuid,
})

// ─── Push ───
export const PushSubscriptionSchema = z.object({
    subscription: z.object({
        endpoint: z.string().url().max(2000),
        keys: z.object({
            p256dh: z.string().min(10).max(500),
            auth: z.string().min(10).max(500),
        }),
    }),
})

export const PushUnsubscribeSchema = z.object({
    endpoint: z.string().url().max(2000),
})

// ─── Email ───
export const EmailTypeEnum = z.enum([
    'confirmation', 'reminder', 'welcome',
    'new_booking_notify', 'cancellation', 'cancellation_notify',
    'review_request',
])

export const EmailRequestSchema = z.object({
    type: EmailTypeEnum,
    to: emailStr,
    data: z.record(z.string(), z.any()),
})

// ─── WhatsApp send (server -> business -> client) ───
export const WhatsAppSendSchema = z.object({
    to: phoneStr,
    type: z.enum([
        'appointment_confirmation', 'appointment_reminder',
        'new_booking_notify', 'cancellation',
    ]),
    data: z.record(z.string(), z.any()),
})

// ─── Helpers ───

/**
 * Parse a request body with a Zod schema. Returns { ok: true, data } or { ok: false, error }.
 * Never leaks raw Zod errors; only field names + short messages.
 */
export function parseBody(schema, raw) {
    const result = schema.safeParse(raw)
    if (result.success) return { ok: true, data: result.data }
    const issues = result.error.issues?.slice(0, 5).map(i => ({
        path: i.path?.join('.') || '',
        message: i.message,
    }))
    return { ok: false, error: 'Datos inválidos', issues }
}
