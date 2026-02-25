'use client'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { useState, useEffect } from 'react'
import { Plus, Mail, Phone, X } from 'lucide-react'
import styles from './team.module.css'

export default function TeamPage() {
    const { business } = useAuth()
    const [members, setMembers] = useState([])
    const [showModal, setShowModal] = useState(false)
    const [editMember, setEditMember] = useState(null)
    const [form, setForm] = useState({ name: '', email: '', phone: '', role: '' })

    useEffect(() => {
        if (business?.id) loadTeam()
    }, [business?.id])

    async function loadTeam() {
        if (!supabase) return
        const { data } = await supabase
            .from('team_members')
            .select('*')
            .eq('business_id', business.id)
            .order('created_at')
        setMembers(data || [])
    }

    async function handleSave(e) {
        e.preventDefault()
        if (!supabase) return
        try {
            if (editMember) {
                await supabase.from('team_members').update(form).eq('id', editMember.id)
            } else {
                await supabase.from('team_members').insert([{ ...form, business_id: business.id, active: true }])
            }
            setShowModal(false)
            setEditMember(null)
            setForm({ name: '', email: '', phone: '', role: '' })
            loadTeam()
        } catch (err) {
            console.error('Error saving team member:', err)
        }
    }

    async function toggleActive(member) {
        if (!supabase) return
        await supabase.from('team_members').update({ active: !member.active }).eq('id', member.id)
        loadTeam()
    }

    function openEdit(member) {
        setEditMember(member)
        setForm({ name: member.name, email: member.email || '', phone: member.phone || '', role: member.role })
        setShowModal(true)
    }

    const roles = business?.roles || ['Dueño', 'Admin', 'Profesional', 'Recepcionista']

    const roleBadgeColor = (role) => {
        const colors = { 'Dueño': 'accent', 'Admin': 'info', 'Recepcionista': 'neutral' }
        return colors[role] || 'accent'
    }

    return (
        <div className={styles.team}>
            <div className={styles.header}>
                <div>
                    <h1>Equipo</h1>
                    <p className={styles.subtitle}>{members.length} miembros</p>
                </div>
                <button className="btn btn-primary" onClick={() => {
                    setEditMember(null)
                    setForm({ name: '', email: '', phone: '', role: roles[2] || 'Profesional' })
                    setShowModal(true)
                }}>
                    <Plus size={16} /> Agregar miembro
                </button>
            </div>

            <div className={styles.memberGrid}>
                {members.map(member => (
                    <div key={member.id} className={`card ${styles.memberCard}`}>
                        <div className={styles.memberTop}>
                            <div className={`avatar avatar-lg ${styles.memberAvatar}`}>
                                {member.name?.[0]?.toUpperCase()}
                            </div>
                            <div className={styles.memberInfo}>
                                <h3>{member.name}</h3>
                                <span className={`badge badge-${roleBadgeColor(member.role)}`}>{member.role}</span>
                            </div>
                            <button
                                className={styles.statusToggle}
                                onClick={() => toggleActive(member)}
                                title={member.active ? 'Activo' : 'Inactivo'}
                            >
                                <div className={`toggle ${member.active ? 'active' : ''}`} />
                            </button>
                        </div>
                        {member.email && <p className={styles.memberDetail}><Mail size={12} /> {member.email}</p>}
                        {member.phone && <p className={styles.memberDetail}><Phone size={12} /> {member.phone}</p>}
                        <div className={styles.memberActions}>
                            <button className="btn btn-ghost btn-sm" onClick={() => openEdit(member)}>Editar</button>
                        </div>
                    </div>
                ))}

                {members.length === 0 && (
                    <div className={`card ${styles.emptyCard}`}>
                        <div style={{ textAlign: 'center', padding: 'var(--space-10) var(--space-6)' }}>
                            <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 600, marginBottom: 'var(--space-2)' }}>Sin miembros del equipo</h3>
                            <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-4)' }}>Agregá a tu equipo para asignarles turnos</p>
                            <button className="btn btn-primary" onClick={() => {
                                setForm({ name: '', email: '', phone: '', role: roles[2] || 'Profesional' })
                                setShowModal(true)
                            }}><Plus size={14} /> Agregar miembro</button>
                        </div>
                    </div>
                )}
            </div>

            {/* Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
                    <div className="modal">
                        <div className="modal-header">
                            <h3>{editMember ? 'Editar miembro' : 'Nuevo miembro'}</h3>
                            <button className="btn btn-ghost btn-icon" onClick={() => setShowModal(false)}><X size={16} /></button>
                        </div>
                        <form onSubmit={handleSave}>
                            <div className="modal-body">
                                <div className="form-group">
                                    <label className="label">Nombre *</label>
                                    <input className="input" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required />
                                </div>
                                <div className="form-group">
                                    <label className="label">Rol</label>
                                    <select className="input select" value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))}>
                                        {roles.map(r => <option key={r} value={r}>{r}</option>)}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="label">Email</label>
                                    <input className="input" type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
                                </div>
                                <div className="form-group">
                                    <label className="label">Teléfono</label>
                                    <input className="input" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} />
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
                                <button type="submit" className="btn btn-primary">Guardar</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
