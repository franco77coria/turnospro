'use client'

import { useAuth } from '@/context/AuthContext'
import { useState, useEffect } from 'react'
import { PLANS } from '@/lib/mercadopago'
import { Check, Zap, Building, Sparkles, AlertCircle, Clock, ExternalLink, ShieldCheck } from 'lucide-react'
import { useSearchParams } from 'next/navigation'
import { useToast } from '@/components/Toast'

export default function SubscriptionPage() {
    const { business, user, loading: authLoading } = useAuth()
    const searchParams = useSearchParams()
    const toast = useToast()
    const [submittingPlan, setSubmittingPlan] = useState(null)
    const [notification, setNotification] = useState('')

    useEffect(() => {
        const status = searchParams.get('status')
        const plan = searchParams.get('plan')

        if (status === 'success' || status === 'demo_success') {
            toast.success('¡Pago procesado exitosamente! Tu plan ha sido actualizado.')
            setNotification(`¡Gracias por suscribirte! Tu negocio cuenta con las ventajas del ${PLANS[plan]?.name || 'plan elegido'}.`)
        } else if (status === 'failure') {
            toast.error('No se pudo completar el pago. Podés intentar nuevamente con otro medio de pago.')
        } else if (status === 'pending') {
            toast.info('Tu pago está pendiente de aprobación. Te notificaremos apenas se acredite.')
        }
    }, [searchParams, toast])

    if (authLoading || !business) {
        return (
            <div style={{ display: 'grid', placeItems: 'center', minHeight: '60vh' }}>
                <div className="loading-spinner" style={{ width: '40px', height: '40px', border: '3px solid var(--line)', borderTopColor: 'var(--pink)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            </div>
        )
    }

    const currentPlanId = business.plan_id || 'trial'
    const planStatus = business.plan_status || 'trialing'
    const expiresAt = business.plan_expires_at ? new Date(business.plan_expires_at) : null
    const daysLeft = expiresAt ? Math.max(0, Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : 0

    const handleSubscribe = async (planKey) => {
        if (planKey === 'custom') {
            window.open(`https://wa.me/5491112345678?text=${encodeURIComponent(`Hola! Tengo más de 3 sucursales y me interesa un plan personalizado para mi negocio: ${business.name}`)}`, '_blank')
            return
        }

        setSubmittingPlan(planKey)
        try {
            const res = await fetch('/api/mercadopago/subscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    planId: planKey,
                    businessId: business.id,
                })
            })

            const data = await res.json()

            if (!res.ok || !data.checkoutUrl) {
                throw new Error(data.error || 'Error al generar checkout de Mercado Pago')
            }

            // Redirigir a Mercado Pago
            window.location.href = data.checkoutUrl
        } catch (err) {
            console.error('Error al suscribir:', err)
            toast.error(err.message || 'Error al conectar con Mercado Pago')
        } finally {
            setSubmittingPlan(null)
        }
    }

    return (
        <div style={{ maxWidth: 1100, margin: '0 auto', paddingBottom: 'var(--space-12)' }}>
            
            {/* ENCABEZADO Y ESTADO DE SUSCRIPCIÓN */}
            <div style={{ background: 'var(--card-bg, #fff)', borderRadius: 'var(--radius-xl, 16px)', border: '1px solid var(--line, #E5E7EB)', padding: 'var(--space-6, 24px)', marginBottom: 'var(--space-8, 32px)', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-4, 16px)' }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                            <h1 style={{ fontSize: '24px', fontWeight: 800, margin: 0 }}>Mi Suscripción</h1>
                            <span style={{
                                padding: '4px 12px',
                                borderRadius: '20px',
                                fontSize: '12px',
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                background: planStatus === 'active' ? '#ECFDF5' : '#FFFBEB',
                                color: planStatus === 'active' ? '#047857' : '#B45309',
                                border: `1px solid ${planStatus === 'active' ? '#A7F3D0' : '#FDE68A'}`
                            }}>
                                {planStatus === 'active' ? 'Suscripción Activa' : planStatus === 'trialing' ? 'Período de Prueba' : 'Plan Vencido'}
                            </span>
                        </div>
                        <p style={{ color: 'var(--text-secondary, #6B7280)', margin: 0, fontSize: '14px' }}>
                            Gestioná tu plan de TurnosPro y los métodos de pago de tu negocio.
                        </p>
                    </div>

                    <div style={{ background: 'var(--bg-secondary, #F9FAFB)', padding: '12px 18px', borderRadius: '12px', border: '1px solid var(--border-light, #F3F4F6)', textAlign: 'right' }}>
                        <div style={{ fontSize: '12px', color: 'var(--text-tertiary, #9CA3AF)', fontWeight: 500 }}>Plan actual</div>
                        <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary, #111827)' }}>
                            {PLANS[currentPlanId]?.name || 'Plan Gratuito'}
                        </div>
                        {expiresAt && (
                            <div style={{ fontSize: '12px', color: daysLeft <= 3 ? '#DC2626' : '#059669', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'flex-end', marginTop: '2px' }}>
                                <Clock size={12} />
                                {planStatus === 'trialing' ? `${daysLeft} días de prueba restantes` : `Vence el ${expiresAt.toLocaleDateString('es-AR')}`}
                            </div>
                        )}
                    </div>
                </div>

                {notification && (
                    <div style={{ marginTop: '16px', padding: '12px 16px', background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: '8px', color: '#047857', fontSize: '14px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Check size={16} />
                        {notification}
                    </div>
                )}
            </div>

            {/* SECCIÓN DE PLANES */}
            <div style={{ textAlign: 'center', marginBottom: 'var(--space-8, 32px)' }}>
                <h2 style={{ fontSize: '22px', fontWeight: 800, marginBottom: '6px' }}>Planes diseñados para hacer crecer tu negocio</h2>
                <p style={{ color: 'var(--text-secondary, #6B7280)', fontSize: '15px' }}>Elegí el plan perfecto y pagá mensualmente de forma 100% segura con Mercado Pago.</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', alignItems: 'stretch' }}>
                
                {/* PLAN BASE */}
                <div style={{
                    background: '#fff',
                    borderRadius: '16px',
                    border: currentPlanId === 'base' ? '2px solid #3B82F6' : '1px solid #E5E7EB',
                    padding: '24px',
                    display: 'flex',
                    flexDirection: 'column',
                    justify: 'space-between',
                    position: 'relative',
                    boxShadow: currentPlanId === 'base' ? '0 8px 30px rgba(59, 130, 246, 0.12)' : 'none'
                }}>
                    {currentPlanId === 'base' && (
                        <span style={{ position: 'absolute', top: '-12px', right: '20px', background: '#3B82F6', color: '#fff', fontSize: '11px', fontWeight: 700, padding: '2px 10px', borderRadius: '12px' }}>
                            Tu plan actual
                        </span>
                    )}
                    <div>
                        <h3 style={{ fontSize: '18px', fontWeight: 800, margin: '0 0 6px' }}>Plan Base</h3>
                        <p style={{ fontSize: '13px', color: '#6B7280', minHeight: '36px' }}>{PLANS.base.description}</p>
                        <div style={{ margin: '16px 0', borderBottom: '1px solid #F3F4F6', paddingBottom: '16px' }}>
                            <span style={{ fontSize: '32px', fontWeight: 900, color: '#111827' }}>$15.000</span>
                            <span style={{ color: '#6B7280', fontSize: '14px' }}> / mes</span>
                        </div>
                        <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {PLANS.base.features.map((f, i) => (
                                <li key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#374151' }}>
                                    <Check size={16} color="#10B981" />
                                    {f}
                                </li>
                            ))}
                        </ul>
                    </div>
                    <button
                        className="btn btn-primary"
                        onClick={() => handleSubscribe('base')}
                        disabled={submittingPlan === 'base'}
                        style={{ width: '100%', background: '#111827', borderColor: '#111827' }}
                    >
                        {submittingPlan === 'base' ? 'Conectando Mercado Pago...' : 'Suscribirme por $15.000/mes'}
                    </button>
                </div>

                {/* PLAN PRO */}
                <div style={{
                    background: '#fff',
                    borderRadius: '16px',
                    border: currentPlanId === 'pro' ? '2px solid #8B5CF6' : '1px solid #C4B5FD',
                    padding: '24px',
                    display: 'flex',
                    flexDirection: 'column',
                    justify: 'space-between',
                    position: 'relative',
                    boxShadow: '0 8px 30px rgba(139, 92, 246, 0.12)'
                }}>
                    <span style={{ position: 'absolute', top: '-12px', left: '20px', background: '#8B5CF6', color: '#fff', fontSize: '11px', fontWeight: 800, padding: '2px 10px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Sparkles size={12} /> Más Recomendado
                    </span>
                    {currentPlanId === 'pro' && (
                        <span style={{ position: 'absolute', top: '-12px', right: '20px', background: '#8B5CF6', color: '#fff', fontSize: '11px', fontWeight: 700, padding: '2px 10px', borderRadius: '12px' }}>
                            Tu plan actual
                        </span>
                    )}
                    <div>
                        <h3 style={{ fontSize: '18px', fontWeight: 800, margin: '10px 0 6px', color: '#6D28D9' }}>Plan Pro</h3>
                        <p style={{ fontSize: '13px', color: '#6B7280', minHeight: '36px' }}>{PLANS.pro.description}</p>
                        <div style={{ margin: '16px 0', borderBottom: '1px solid #F3F4F6', paddingBottom: '16px' }}>
                            <span style={{ fontSize: '32px', fontWeight: 900, color: '#6D28D9' }}>$20.000</span>
                            <span style={{ color: '#6B7280', fontSize: '14px' }}> / mes</span>
                        </div>
                        <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {PLANS.pro.features.map((f, i) => (
                                <li key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#374151' }}>
                                    <Check size={16} color="#8B5CF6" />
                                    <span style={{ fontWeight: i >= 2 ? 600 : 400 }}>{f}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                    <button
                        className="btn btn-primary"
                        onClick={() => handleSubscribe('pro')}
                        disabled={submittingPlan === 'pro'}
                        style={{ width: '100%', background: '#8B5CF6', borderColor: '#8B5CF6' }}
                    >
                        {submittingPlan === 'pro' ? 'Conectando Mercado Pago...' : 'Suscribirme por $20.000/mes'}
                    </button>
                </div>

                {/* PLAN MULTI-SUCURSALES */}
                <div style={{
                    background: '#fff',
                    borderRadius: '16px',
                    border: currentPlanId === 'multi' ? '2px solid #EC4899' : '1px solid #E5E7EB',
                    padding: '24px',
                    display: 'flex',
                    flexDirection: 'column',
                    justify: 'space-between',
                    position: 'relative',
                    boxShadow: currentPlanId === 'multi' ? '0 8px 30px rgba(236, 72, 153, 0.12)' : 'none'
                }}>
                    {currentPlanId === 'multi' && (
                        <span style={{ position: 'absolute', top: '-12px', right: '20px', background: '#EC4899', color: '#fff', fontSize: '11px', fontWeight: 700, padding: '2px 10px', borderRadius: '12px' }}>
                            Tu plan actual
                        </span>
                    )}
                    <div>
                        <h3 style={{ fontSize: '18px', fontWeight: 800, margin: '0 0 6px' }}>Múltiples Sucursales</h3>
                        <p style={{ fontSize: '13px', color: '#6B7280', minHeight: '36px' }}>{PLANS.multi.description}</p>
                        <div style={{ margin: '16px 0', borderBottom: '1px solid #F3F4F6', paddingBottom: '16px' }}>
                            <span style={{ fontSize: '32px', fontWeight: 900, color: '#111827' }}>$30.000</span>
                            <span style={{ color: '#6B7280', fontSize: '14px' }}> / mes</span>
                        </div>
                        <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {PLANS.multi.features.map((f, i) => (
                                <li key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#374151' }}>
                                    <Check size={16} color="#EC4899" />
                                    <span style={{ fontWeight: i === 0 ? 700 : 400 }}>{f}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                    <button
                        className="btn btn-primary"
                        onClick={() => handleSubscribe('multi')}
                        disabled={submittingPlan === 'multi'}
                        style={{ width: '100%', background: '#111827', borderColor: '#111827' }}
                    >
                        {submittingPlan === 'multi' ? 'Conectando Mercado Pago...' : 'Suscribirme por $30.000/mes'}
                    </button>
                </div>

                {/* PLAN PERSONALIZADO (>3 SUCURSALES) */}
                <div style={{
                    background: '#F9FAFB',
                    borderRadius: '16px',
                    border: '1px dashed #D1D5DB',
                    padding: '24px',
                    display: 'flex',
                    flexDirection: 'column',
                    justify: 'space-between',
                }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#4B5563', marginBottom: '4px' }}>
                            <Building size={18} />
                            <h3 style={{ fontSize: '18px', fontWeight: 800, margin: 0 }}>+3 Sucursales</h3>
                        </div>
                        <p style={{ fontSize: '13px', color: '#6B7280', minHeight: '36px' }}>{PLANS.custom.description}</p>
                        <div style={{ margin: '16px 0', borderBottom: '1px dashed #E5E7EB', paddingBottom: '16px' }}>
                            <span style={{ fontSize: '26px', fontWeight: 800, color: '#374151' }}>A medida</span>
                        </div>
                        <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {PLANS.custom.features.map((f, i) => (
                                <li key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#4B5563' }}>
                                    <Check size={16} color="#6B7280" />
                                    {f}
                                </li>
                            ))}
                        </ul>
                    </div>
                    <button
                        className="btn btn-secondary"
                        onClick={() => handleSubscribe('custom')}
                        style={{ width: '100%' }}
                    >
                        Contactar Asesor
                    </button>
                </div>

            </div>

            {/* GARANTÍA DE SEGURIDAD MERCADO PAGO */}
            <div style={{ marginTop: '40px', padding: '16px 24px', background: '#F0F9FF', borderRadius: '12px', border: '1px solid #BAE6FD', display: 'flex', alignItems: 'center', gap: '12px', color: '#0369A1', fontSize: '14px' }}>
                <ShieldCheck size={24} style={{ flexShrink: 0 }} />
                <div>
                    <b>Pagos 100% protegidos por Mercado Pago.</b> Todos los planes aceptan tarjetas de crédito, débito y saldo en cuenta de Mercado Pago. Podés cancelar o modificar tu plan en cualquier momento.
                </div>
            </div>

        </div>
    )
}
