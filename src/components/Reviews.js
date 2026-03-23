'use client'
import { useState, useEffect } from 'react'
import { Star, Send } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import styles from './Reviews.module.css'

export default function Reviews({ businessId }) {
    const { user } = useAuth()
    const [reviews, setReviews] = useState([])
    const [average, setAverage] = useState(0)
    const [count, setCount] = useState(0)
    const [loading, setLoading] = useState(true)
    const [showForm, setShowForm] = useState(false)
    const [form, setForm] = useState({ rating: 5, comment: '' })
    const [submitting, setSubmitting] = useState(false)

    async function fetchReviews() {
        try {
            const res = await fetch(`/api/reviews?business_id=${businessId}`)
            const data = await res.json()
            setReviews(data.reviews || [])
            setAverage(data.average || 0)
            setCount(data.count || 0)
        } catch (err) {
            console.error(err)
        }
        setLoading(false)
    }

    useEffect(() => {
        if (businessId) fetchReviews()
    }, [businessId])

    async function handleSubmit(e) {
        e.preventDefault()
        if (!user) return
        setSubmitting(true)

        try {
            const res = await fetch('/api/reviews', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    business_id: businessId,
                    user_id: user.id,
                    rating: form.rating,
                    comment: form.comment,
                }),
            })
            if (res.ok) {
                await fetchReviews()
                setShowForm(false)
                setForm({ rating: 5, comment: '' })
            }
        } catch (err) {
            console.error(err)
        }
        setSubmitting(false)
    }

    const renderStars = (rating, interactive = false, onRate = null) => {
        return (
            <div className={styles.stars}>
                {[1, 2, 3, 4, 5].map(star => (
                    <button
                        key={star}
                        type="button"
                        className={`${styles.star} ${star <= rating ? styles.filled : ''}`}
                        onClick={() => interactive && onRate?.(star)}
                        disabled={!interactive}
                        tabIndex={interactive ? 0 : -1}
                    >
                        <Star size={interactive ? 24 : 14} fill={star <= rating ? 'currentColor' : 'none'} />
                    </button>
                ))}
            </div>
        )
    }

    return (
        <div className={styles.reviewsSection}>
            {/* Summary */}
            <div className={styles.summary}>
                <div className={styles.avgBlock}>
                    <span className={styles.avgNumber}>{average}</span>
                    {renderStars(Math.round(average))}
                    <span className={styles.reviewCount}>{count} reseña{count !== 1 ? 's' : ''}</span>
                </div>
                {user && (
                    <button
                        className={styles.writeBtn}
                        onClick={() => setShowForm(!showForm)}
                    >
                        <Star size={14} />
                        {showForm ? 'Cancelar' : 'Dejar reseña'}
                    </button>
                )}
            </div>

            {/* Write form */}
            {showForm && (
                <form onSubmit={handleSubmit} className={styles.reviewForm}>
                    <div className={styles.ratingPicker}>
                        <span className={styles.ratingLabel}>Tu calificación:</span>
                        {renderStars(form.rating, true, (star) => setForm(p => ({ ...p, rating: star })))}
                    </div>
                    <textarea
                        className={styles.commentInput}
                        placeholder="Contá tu experiencia (opcional)..."
                        value={form.comment}
                        onChange={e => setForm(p => ({ ...p, comment: e.target.value }))}
                        rows={3}
                    />
                    <button type="submit" className={styles.submitBtn} disabled={submitting}>
                        {submitting ? <div className="loading-spinner" /> : <><Send size={14} /> Enviar reseña</>}
                    </button>
                </form>
            )}

            {/* Reviews list */}
            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-4)' }}>
                    <div className="loading-spinner" />
                </div>
            ) : reviews.length === 0 ? (
                <div className={styles.noReviews}>
                    <p>Aún no hay reseñas. ¡Sé el primero!</p>
                </div>
            ) : (
                <div className={styles.reviewsList}>
                    {reviews.map(review => (
                        <div key={review.id} className={styles.reviewCard}>
                            <div className={styles.reviewHeader}>
                                <div className={styles.reviewerInfo}>
                                    <div className={styles.reviewerAvatar}>
                                        {review.profiles?.avatar_url ? (
                                            <img src={review.profiles.avatar_url} alt="" />
                                        ) : (
                                            (review.profiles?.full_name || '?')[0].toUpperCase()
                                        )}
                                    </div>
                                    <div>
                                        <span className={styles.reviewerName}>
                                            {review.profiles?.full_name || 'Usuario'}
                                        </span>
                                        <span className={styles.reviewDate}>
                                            {new Date(review.created_at).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })}
                                        </span>
                                    </div>
                                </div>
                                {renderStars(review.rating)}
                            </div>
                            {review.comment && (
                                <p className={styles.reviewComment}>{review.comment}</p>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
