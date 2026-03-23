'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search } from 'lucide-react'

export default function SearchBar({ className = '' }) {
    const router = useRouter()
    const [searchQuery, setSearchQuery] = useState('')

    function handleSearch(e) {
        e.preventDefault()
        router.push(`/explore${searchQuery ? `?q=${encodeURIComponent(searchQuery)}` : ''}`)
    }

    return (
        <form onSubmit={handleSearch} className={className} style={{
            display: 'flex',
            alignItems: 'center',
            background: 'var(--bg-primary)',
            borderRadius: 'var(--radius-xl)',
            padding: '6px 6px 6px var(--space-4)',
            boxShadow: 'var(--shadow-lg)',
            width: '100%',
            maxWidth: 520,
            border: '1px solid var(--border)',
        }}>
            <Search size={18} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
            <input
                type="text"
                placeholder="Buscar negocio o servicio..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{
                    flex: 1,
                    border: 'none',
                    outline: 'none',
                    padding: '0 var(--space-3)',
                    fontSize: 'var(--font-size-base)',
                    background: 'transparent',
                    color: 'var(--text-primary)',
                    fontFamily: 'inherit',
                }}
            />
            <button type="submit" className="btn btn-primary">Buscar</button>
        </form>
    )
}
