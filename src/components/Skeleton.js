'use client'

/**
 * Skeleton loader components for perceived performance
 * Uses the .skeleton class from globals.css (shimmer animation)
 */

export function SkeletonCard({ height = 120 }) {
    return (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="skeleton" style={{ height, width: '100%' }} />
            <div style={{ padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                <div className="skeleton" style={{ height: 16, width: '60%', borderRadius: 'var(--radius-sm)' }} />
                <div className="skeleton" style={{ height: 12, width: '40%', borderRadius: 'var(--radius-sm)' }} />
            </div>
        </div>
    )
}

export function SkeletonRow({ lines = 3 }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {Array.from({ length: lines }).map((_, i) => (
                <div key={i} className="skeleton" style={{
                    height: 14,
                    width: `${80 - i * 15}%`,
                    borderRadius: 'var(--radius-sm)',
                }} />
            ))}
        </div>
    )
}

export function SkeletonTable({ rows = 5, cols = 4 }) {
    return (
        <div className="table-container">
            <table className="table">
                <thead>
                    <tr>
                        {Array.from({ length: cols }).map((_, i) => (
                            <th key={i}>
                                <div className="skeleton" style={{ height: 12, width: 60, borderRadius: 'var(--radius-sm)' }} />
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {Array.from({ length: rows }).map((_, r) => (
                        <tr key={r}>
                            {Array.from({ length: cols }).map((_, c) => (
                                <td key={c}>
                                    <div className="skeleton" style={{
                                        height: 14,
                                        width: `${60 + Math.random() * 40}%`,
                                        borderRadius: 'var(--radius-sm)',
                                    }} />
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}

export function SkeletonServiceList({ count = 4 }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {Array.from({ length: count }).map((_, i) => (
                <div key={i} className="card" style={{
                    padding: 'var(--space-4)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', flex: 1 }}>
                        <div className="skeleton" style={{ height: 16, width: '50%', borderRadius: 'var(--radius-sm)' }} />
                        <div className="skeleton" style={{ height: 12, width: '30%', borderRadius: 'var(--radius-sm)' }} />
                    </div>
                    <div className="skeleton" style={{ height: 20, width: 60, borderRadius: 'var(--radius-sm)' }} />
                </div>
            ))}
        </div>
    )
}

export function SkeletonStat() {
    return (
        <div className="card stat-card">
            <div className="skeleton" style={{ height: 12, width: 80, borderRadius: 'var(--radius-sm)' }} />
            <div className="skeleton" style={{ height: 28, width: 60, borderRadius: 'var(--radius-sm)', marginTop: 'var(--space-2)' }} />
        </div>
    )
}

export function SkeletonStats({ count = 4 }) {
    return (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(count, 4)}, 1fr)`, gap: 'var(--space-4)' }}>
            {Array.from({ length: count }).map((_, i) => (
                <SkeletonStat key={i} />
            ))}
        </div>
    )
}

export function SkeletonAvatar({ size = 36 }) {
    return <div className="skeleton" style={{ width: size, height: size, borderRadius: '50%', flexShrink: 0 }} />
}
