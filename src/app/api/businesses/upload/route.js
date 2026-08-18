export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { cookies } from 'next/headers'

const BUCKET = 'business-images'
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_BYTES = 5 * 1024 * 1024
const MAX_GALLERY_PHOTOS = 12

// Se guardaba el archivo tal como lo subía el dueño: una foto de 5 MB sacada
// con el celular se le bajaba entera a cada visitante de la ficha. Se
// normaliza a WebP con un ancho tope antes de guardar.
const OUTPUT_WIDTH = { cover: 1600, gallery: 1400 }
const OUTPUT_QUALITY = 82

async function optimize(buffer, kind) {
    const sharp = (await import('sharp')).default
    return sharp(buffer)
        .rotate() // respeta la orientación EXIF antes de descartar los metadatos
        .resize({
            width: OUTPUT_WIDTH[kind],
            // Una foto más chica que el tope no se agranda
            withoutEnlargement: true,
        })
        .webp({ quality: OUTPUT_QUALITY })
        .toBuffer()
}

/** Verifica que el usuario logueado sea dueño del negocio. */
async function assertOwner(supabase, businessId, userId) {
    const { data: biz } = await supabase
        .from('businesses')
        .select('owner_id')
        .eq('id', businessId)
        .maybeSingle()
    return !!biz && biz.owner_id === userId
}

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
        // 'cover' (imagen principal) o 'gallery' (una más de la galería)
        const kind = formData.get('kind') === 'gallery' ? 'gallery' : 'cover'

        if (!file || typeof file === 'string' || !businessId) {
            return NextResponse.json({ error: 'Archivo y business_id requeridos' }, { status: 400 })
        }

        if (!ALLOWED_TYPES.includes(file.type)) {
            return NextResponse.json({ error: 'Solo se permiten imágenes JPG, PNG o WebP' }, { status: 400 })
        }

        if (file.size > MAX_BYTES) {
            return NextResponse.json({ error: 'La imagen no puede superar 5MB' }, { status: 400 })
        }

        const supabase = createSupabaseAdmin()

        if (!await assertOwner(supabase, businessId, user.id)) {
            return NextResponse.json({ error: 'No tenés permisos para este negocio' }, { status: 403 })
        }

        const original = Buffer.from(await file.arrayBuffer())
        let buffer
        try {
            buffer = await optimize(original, kind)
        } catch (err) {
            // Un archivo con extensión válida pero contenido que no es una
            // imagen llega hasta acá: se rechaza en vez de guardarlo.
            console.error('Image optimize error:', err?.message)
            return NextResponse.json({ error: 'No se pudo procesar la imagen. Probá con otra.' }, { status: 400 })
        }
        // Siempre WebP: la extensión ya no depende de lo que subió el usuario.
        const ext = 'webp'

        if (kind === 'gallery') {
            const { count } = await supabase
                .from('business_photos')
                .select('id', { count: 'exact', head: true })
                .eq('business_id', businessId)

            if ((count || 0) >= MAX_GALLERY_PHOTOS) {
                return NextResponse.json(
                    { error: `Máximo ${MAX_GALLERY_PHOTOS} fotos. Borrá alguna para subir otra.` },
                    { status: 400 }
                )
            }

            const storagePath = `${businessId}/gallery/${crypto.randomUUID()}.${ext}`

            const { error: uploadError } = await supabase.storage
                .from(BUCKET)
                .upload(storagePath, buffer, { contentType: 'image/webp', upsert: false })

            if (uploadError) {
                console.error('Gallery upload error:', uploadError)
                return NextResponse.json({ error: 'Error al subir la imagen' }, { status: 500 })
            }

            const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(storagePath)

            const { data: photo, error: insertErr } = await supabase
                .from('business_photos')
                .insert([{
                    business_id: businessId,
                    url: publicUrl,
                    storage_path: storagePath,
                    sort_order: count || 0,
                }])
                .select()
                .single()

            if (insertErr) {
                // Si no se pudo registrar, el archivo no debe quedar suelto en el bucket.
                await supabase.storage.from(BUCKET).remove([storagePath])
                console.error('Gallery insert error:', insertErr)
                return NextResponse.json({ error: 'Error al guardar la imagen' }, { status: 500 })
            }

            return NextResponse.json({ success: true, photo })
        }

        // kind === 'cover'
        const storagePath = `${businessId}/cover.${ext}`

        const { error: uploadError } = await supabase.storage
            .from(BUCKET)
            .upload(storagePath, buffer, { contentType: 'image/webp', upsert: true })

        // Portadas viejas guardadas con otra extensión quedarían huérfanas en
        // el bucket, porque ahora la ruta siempre termina en .webp.
        await supabase.storage.from(BUCKET).remove([
            `${businessId}/cover.jpg`,
            `${businessId}/cover.png`,
        ])

        if (uploadError) {
            console.error('Upload error:', uploadError)
            return NextResponse.json({ error: 'Error al subir la imagen' }, { status: 500 })
        }

        const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(storagePath)

        // Cache-buster: la ruta de la portada es fija, así que sin esto el
        // navegador y el CDN siguen mostrando la imagen anterior.
        const versionedUrl = `${publicUrl}?v=${Date.now()}`

        const { error: updateErr } = await supabase
            .from('businesses')
            .update({ cover_image_url: versionedUrl })
            .eq('id', businessId)

        if (updateErr) {
            console.error('Cover update error:', updateErr)
            return NextResponse.json({ error: 'Error al guardar la imagen' }, { status: 500 })
        }

        return NextResponse.json({ success: true, url: versionedUrl })
    } catch (err) {
        console.error('Image upload error:', err)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

/** Borra una foto de la galería: la fila y el archivo del bucket. */
export async function DELETE(request) {
    try {
        const cookieStore = await cookies()
        const authClient = createSupabaseServerClient(cookieStore)
        const { data: { user } } = await authClient.auth.getUser()
        if (!user) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        const { searchParams } = new URL(request.url)
        const photoId = searchParams.get('photo_id')
        if (!photoId || !/^[0-9a-f-]{36}$/i.test(photoId)) {
            return NextResponse.json({ error: 'photo_id requerido' }, { status: 400 })
        }

        const supabase = createSupabaseAdmin()

        const { data: photo } = await supabase
            .from('business_photos')
            .select('id, business_id, storage_path')
            .eq('id', photoId)
            .maybeSingle()

        if (!photo) {
            return NextResponse.json({ error: 'Foto no encontrada' }, { status: 404 })
        }

        if (!await assertOwner(supabase, photo.business_id, user.id)) {
            return NextResponse.json({ error: 'No tenés permisos para este negocio' }, { status: 403 })
        }

        const { error: delErr } = await supabase
            .from('business_photos')
            .delete()
            .eq('id', photoId)

        if (delErr) throw delErr

        // El archivo se borra después de la fila: si esto falla queda un
        // huérfano en el bucket, pero la ficha ya no lo muestra.
        if (photo.storage_path) {
            const { error: storageErr } = await supabase.storage.from(BUCKET).remove([photo.storage_path])
            if (storageErr) console.error('Storage remove error:', storageErr)
        }

        return NextResponse.json({ success: true })
    } catch (err) {
        console.error('Photo delete error:', err)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
