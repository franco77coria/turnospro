import { NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { cookies } from 'next/headers'

export async function POST(request) {
    try {
        // Verify authenticated user
        const cookieStore = await cookies()
        const authClient = createSupabaseServerClient(cookieStore)
        const { data: { user } } = await authClient.auth.getUser()
        if (!user) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        const formData = await request.formData()
        const file = formData.get('file')
        const businessId = formData.get('business_id')

        if (!file || !businessId) {
            return NextResponse.json({ error: 'Archivo y business_id requeridos' }, { status: 400 })
        }

        // Validate file type
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
        if (!allowedTypes.includes(file.type)) {
            return NextResponse.json({ error: 'Solo se permiten imágenes JPG, PNG o WebP' }, { status: 400 })
        }

        // Max 5MB
        if (file.size > 5 * 1024 * 1024) {
            return NextResponse.json({ error: 'La imagen no puede superar 5MB' }, { status: 400 })
        }

        const supabase = createSupabaseAdmin()

        // Verify ownership
        const { data: biz } = await supabase
            .from('businesses')
            .select('owner_id')
            .eq('id', businessId)
            .single()

        if (!biz || biz.owner_id !== user.id) {
            return NextResponse.json({ error: 'No tenés permisos para este negocio' }, { status: 403 })
        }

        // Upload to Supabase Storage
        const ext = file.name.split('.').pop()
        const fileName = `${businessId}/cover.${ext}`
        const arrayBuffer = await file.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)

        const { error: uploadError } = await supabase.storage
            .from('business-images')
            .upload(fileName, buffer, {
                contentType: file.type,
                upsert: true,
            })

        if (uploadError) {
            console.error('Upload error:', uploadError)
            return NextResponse.json({ error: 'Error al subir la imagen' }, { status: 500 })
        }

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
            .from('business-images')
            .getPublicUrl(fileName)

        // Update business record
        await supabase
            .from('businesses')
            .update({ cover_image_url: publicUrl })
            .eq('id', businessId)

        return NextResponse.json({ success: true, url: publicUrl })
    } catch (err) {
        console.error('Image upload error:', err)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
