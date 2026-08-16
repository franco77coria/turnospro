'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { ImagePlus, Trash2, Image as ImageIcon, Loader2 } from 'lucide-react'
import styles from './BusinessPhotosCard.module.css'

const MAX_PHOTOS = 12
const MAX_MB = 5

/**
 * Portada + galería del negocio, para la ficha pública.
 * La ruta /api/businesses/upload ya existía pero ninguna pantalla la usaba,
 * así que en la práctica ningún negocio tenía imagen.
 */
export default function BusinessPhotosCard({ business, onCoverChange }) {
    const [cover, setCover] = useState(business?.cover_image_url || null)
    const [photos, setPhotos] = useState([])
    const [loading, setLoading] = useState(true)
    const [uploading, setUploading] = useState(null) // 'cover' | 'gallery' | null
    const [error, setError] = useState('')
    const coverInput = useRef(null)
    const galleryInput = useRef(null)

    const loadPhotos = useCallback(async () => {
        if (!supabase || !business?.id) { setLoading(false); return }
        const { data, error: loadErr } = await supabase
            .from('business_photos')
            .select('id, url, alt, sort_order')
            .eq('business_id', business.id)
            .order('sort_order')
            .order('created_at')
        if (loadErr) {
            console.error('Error cargando fotos:', loadErr)
            setError('No se pudieron cargar las fotos.')
        }
        setPhotos(data || [])
        setLoading(false)
    }, [business?.id])

    useEffect(() => { loadPhotos() }, [loadPhotos])
    useEffect(() => { setCover(business?.cover_image_url || null) }, [business?.cover_image_url])

    function validate(file) {
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
            return 'Solo se permiten imágenes JPG, PNG o WebP.'
        }
        if (file.size > MAX_MB * 1024 * 1024) {
            return `La imagen no puede superar ${MAX_MB}MB.`
        }
        return null
    }

    async function upload(file, kind) {
        const invalid = validate(file)
        if (invalid) { setError(invalid); return null }

        const body = new FormData()
        body.append('file', file)
        body.append('business_id', business.id)
        body.append('kind', kind)

        const res = await fetch('/api/businesses/upload', { method: 'POST', body })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.error || 'Error al subir la imagen')
        return data
    }

    async function handleCover(e) {
        const file = e.target.files?.[0]
        e.target.value = '' // permite volver a elegir el mismo archivo
        if (!file) return
        setError('')
        setUploading('cover')
        try {
            const data = await upload(file, 'cover')
            if (data?.url) {
                setCover(data.url)
                onCoverChange?.(data.url)
            }
        } catch (err) {
            setError(err.message)
        }
        setUploading(null)
    }

    async function handleGallery(e) {
        const files = Array.from(e.target.files || [])
        e.target.value = ''
        if (!files.length) return
        setError('')

        const room = MAX_PHOTOS - photos.length
        if (room <= 0) {
            setError(`Llegaste al máximo de ${MAX_PHOTOS} fotos. Borrá alguna para subir otra.`)
            return
        }

        setUploading('gallery')
        // De a una: el endpoint valida el cupo en cada llamada y así un
        // archivo inválido no cancela los demás.
        for (const file of files.slice(0, room)) {
            try {
                await upload(file, 'gallery')
            } catch (err) {
                setError(err.message)
                break
            }
        }
        if (files.length > room) {
            setError(`Se subieron ${room}. El resto no entra: el máximo son ${MAX_PHOTOS} fotos.`)
        }
        await loadPhotos()
        setUploading(null)
    }

    async function handleDelete(photo) {
        if (!confirm('¿Eliminar esta foto?')) return
        setError('')
        try {
            const res = await fetch(`/api/businesses/upload?photo_id=${photo.id}`, { method: 'DELETE' })
            const data = await res.json().catch(() => ({}))
            if (!res.ok) throw new Error(data.error || 'Error al eliminar')
            setPhotos(prev => prev.filter(p => p.id !== photo.id))
        } catch (err) {
            setError(err.message)
        }
    }

    return (
        <div className="card">
            <h3 className={styles.title}>
                <ImageIcon size={18} /> Fotos del negocio
            </h3>
            <p className={styles.hint}>
                Se muestran en tu ficha pública, la página que compartís con los clientes.
            </p>

            {error && <div className={styles.error}>{error}</div>}

            {/* ── Portada ── */}
            <label className={styles.label}>Portada</label>
            <div className={styles.coverBox}>
                {cover ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={cover} alt="Portada del negocio" className={styles.coverImg} />
                ) : (
                    <div className={styles.coverEmpty}>
                        <ImagePlus size={22} />
                        <span>Sin portada</span>
                    </div>
                )}
                <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => coverInput.current?.click()}
                    disabled={uploading === 'cover'}
                >
                    {uploading === 'cover'
                        ? <><Loader2 size={14} className={styles.spin} /> Subiendo…</>
                        : cover ? 'Cambiar portada' : 'Subir portada'}
                </button>
                <input
                    ref={coverInput} type="file" accept="image/jpeg,image/png,image/webp"
                    hidden onChange={handleCover}
                />
            </div>

            {/* ── Galería ── */}
            <div className={styles.galleryHead}>
                <label className={styles.label}>Galería</label>
                <span className={styles.counter}>{photos.length} / {MAX_PHOTOS}</span>
            </div>

            {loading ? (
                <div className={styles.loading}><div className="loading-spinner" /></div>
            ) : (
                <div className={styles.grid}>
                    {photos.map(photo => (
                        <div key={photo.id} className={styles.thumb}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={photo.url} alt={photo.alt || 'Foto del negocio'} />
                            <button
                                type="button"
                                className={styles.del}
                                onClick={() => handleDelete(photo)}
                                aria-label="Eliminar foto"
                            >
                                <Trash2 size={14} />
                            </button>
                        </div>
                    ))}

                    {photos.length < MAX_PHOTOS && (
                        <button
                            type="button"
                            className={styles.addTile}
                            onClick={() => galleryInput.current?.click()}
                            disabled={uploading === 'gallery'}
                        >
                            {uploading === 'gallery'
                                ? <Loader2 size={20} className={styles.spin} />
                                : <><ImagePlus size={20} /><span>Agregar</span></>}
                        </button>
                    )}
                </div>
            )}

            <input
                ref={galleryInput} type="file" accept="image/jpeg,image/png,image/webp"
                multiple hidden onChange={handleGallery}
            />

            <p className={styles.hint}>
                JPG, PNG o WebP · hasta {MAX_MB}MB cada una · se muestran en el orden en que las subís.
            </p>
        </div>
    )
}
