'use client'
import { createContext, useContext, useState, useCallback } from 'react'
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react'

const ToastContext = createContext(null)

export function ToastProvider({ children }) {
    const [toasts, setToasts] = useState([])

    const addToast = useCallback((message, type = 'info', duration = 4000) => {
        const id = Date.now() + Math.random()
        setToasts(prev => [...prev, { id, message, type }])
        if (duration > 0) {
            setTimeout(() => {
                setToasts(prev => prev.filter(t => t.id !== id))
            }, duration)
        }
    }, [])

    const removeToast = useCallback((id) => {
        setToasts(prev => prev.filter(t => t.id !== id))
    }, [])

    const toast = {
        success: (msg) => addToast(msg, 'success'),
        error: (msg) => addToast(msg, 'error', 6000),
        info: (msg) => addToast(msg, 'info'),
    }

    return (
        <ToastContext.Provider value={toast}>
            {children}
            <div style={{
                position: 'fixed',
                top: '1rem',
                right: '1rem',
                zIndex: 9999,
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
                maxWidth: '400px',
                width: '100%',
                pointerEvents: 'none',
            }}>
                {toasts.map(t => (
                    <div key={t.id} style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        padding: '0.75rem 1rem',
                        borderRadius: '0.75rem',
                        background: t.type === 'error' ? '#FEF2F2' : t.type === 'success' ? '#F0FDF4' : '#EFF6FF',
                        border: `1px solid ${t.type === 'error' ? '#FECACA' : t.type === 'success' ? '#BBF7D0' : '#BFDBFE'}`,
                        color: t.type === 'error' ? '#991B1B' : t.type === 'success' ? '#166534' : '#1E40AF',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                        pointerEvents: 'auto',
                        animation: 'toastSlideIn 0.3s ease-out',
                        fontSize: '0.875rem',
                    }}>
                        {t.type === 'success' && <CheckCircle size={18} />}
                        {t.type === 'error' && <AlertCircle size={18} />}
                        {t.type === 'info' && <Info size={18} />}
                        <span style={{ flex: 1 }}>{t.message}</span>
                        <button onClick={() => removeToast(t.id)} style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            color: 'inherit', padding: '2px', opacity: 0.6,
                        }}>
                            <X size={14} />
                        </button>
                    </div>
                ))}
            </div>
            <style>{`
                @keyframes toastSlideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
            `}</style>
        </ToastContext.Provider>
    )
}

export function useToast() {
    const ctx = useContext(ToastContext)
    if (!ctx) {
        // Fallback if used outside provider
        return {
            success: (msg) => console.log('[Toast]', msg),
            error: (msg) => console.error('[Toast]', msg),
            info: (msg) => console.log('[Toast]', msg),
        }
    }
    return ctx
}
