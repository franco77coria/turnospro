import { NextResponse } from 'next/server'

export async function GET() {
    return NextResponse.json({ error: 'El canal WhatsApp no está disponible' }, { status: 410 })
}

export async function POST() {
    return NextResponse.json({ error: 'El canal WhatsApp no está disponible' }, { status: 410 })
}
