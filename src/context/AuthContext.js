'use client'
import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'

const AuthContext = createContext({})

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null)
    const [profile, setProfile] = useState(null)
    const [business, setBusiness] = useState(null)
    const [loading, setLoading] = useState(true)

    const fetchProfile = useCallback(async (userId) => {
        if (!supabase) return
        try {
            const { data: profileData, error: profileError } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .single()

            if (profileError && profileError.code === 'PGRST116') {
                // Profile doesn't exist — create it
                const { data: { user: currentUser } } = await supabase.auth.getUser()
                if (currentUser) {
                    const { data: newProfile } = await supabase
                        .from('profiles')
                        .insert([{
                            id: currentUser.id,
                            email: currentUser.email,
                            full_name: currentUser.user_metadata?.full_name || currentUser.email?.split('@')[0] || 'Usuario',
                            avatar_url: currentUser.user_metadata?.avatar_url || null,
                            role: 'Dueño',
                        }])
                        .select()
                        .single()
                    setProfile(newProfile)
                }
                return
            }

            if (profileData) {
                setProfile(profileData)

                if (profileData.business_id) {
                    const { data: businessData } = await supabase
                        .from('businesses')
                        .select('*')
                        .eq('id', profileData.business_id)
                        .single()

                    if (businessData) {
                        setBusiness(businessData)
                    } else {
                        // business_id set but business not found — try finding by owner
                        const { data: ownedBiz } = await supabase
                            .from('businesses')
                            .select('*')
                            .eq('owner_id', userId)
                            .limit(1)
                            .maybeSingle()

                        if (ownedBiz) {
                            // Fix the profile link
                            await supabase.from('profiles').update({ business_id: ownedBiz.id }).eq('id', userId)
                            setBusiness(ownedBiz)
                            setProfile(prev => ({ ...prev, business_id: ownedBiz.id }))
                        }
                    }
                } else {
                    // No business_id on profile — check if user owns a business
                    const { data: ownedBiz } = await supabase
                        .from('businesses')
                        .select('*')
                        .eq('owner_id', userId)
                        .limit(1)
                        .maybeSingle()

                    if (ownedBiz) {
                        // Link it
                        await supabase.from('profiles').update({ business_id: ownedBiz.id }).eq('id', userId)
                        setBusiness(ownedBiz)
                        setProfile(prev => ({ ...prev, business_id: ownedBiz.id }))
                    }
                }
            }
        } catch (err) {
            console.error('Error fetching profile:', err)
        }
    }, [])

    useEffect(() => {
        if (!supabase) {
            setLoading(false)
            return
        }

        const getSession = async () => {
            try {
                const { data: { user: currentUser }, error } = await supabase.auth.getUser()
                if (error) {
                    console.warn('Session validation error:', error.message)
                    setUser(null)
                } else {
                    setUser(currentUser || null)
                    if (currentUser) {
                        await fetchProfile(currentUser.id)
                    }
                }
            } catch (err) {
                console.error('Session error:', err)
            }
            setLoading(false)
        }

        getSession()

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            const sessionUser = session?.user || null
            setUser(sessionUser)
            if (sessionUser) {
                await fetchProfile(sessionUser.id)
            } else {
                setProfile(null)
                setBusiness(null)
            }
            setLoading(false)
        })

        return () => subscription.unsubscribe()
    }, [fetchProfile])

    const signInWithGoogle = async () => {
        if (!supabase) throw new Error('Supabase no configurado')
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: typeof window !== 'undefined'
                    ? `${window.location.origin}/auth/callback`
                    : undefined,
            }
        })
        if (error) throw error
    }

    const signOut = async () => {
        if (!supabase) return
        await supabase.auth.signOut()
        setUser(null)
        setProfile(null)
        setBusiness(null)
    }

    const createBusiness = async (businessData) => {
        if (!supabase || !user) return null

        // Check if business already exists for this user
        const { data: existing } = await supabase
            .from('businesses')
            .select('*')
            .eq('owner_id', user.id)
            .limit(1)
            .maybeSingle()

        if (existing) {
            // Already have a business, just link and use it
            await supabase.from('profiles').update({ business_id: existing.id }).eq('id', user.id)
            setBusiness(existing)
            setProfile(prev => ({ ...prev, business_id: existing.id }))
            return existing
        }

        const { data, error } = await supabase
            .from('businesses')
            .insert([{
                ...businessData,
                owner_id: user.id
            }])
            .select()
            .single()

        if (error) throw error

        await supabase
            .from('profiles')
            .update({
                business_id: data.id,
                role: 'Dueño'
            })
            .eq('id', user.id)

        setBusiness(data)
        setProfile(prev => ({ ...prev, business_id: data.id, role: 'Dueño' }))
        return data
    }

    const updateBusiness = async (updates) => {
        if (!supabase || !business) {
            console.error('updateBusiness: no supabase or business')
            return null
        }
        const { data, error } = await supabase
            .from('businesses')
            .update(updates)
            .eq('id', business.id)
            .select()
            .single()

        if (error) {
            console.error('updateBusiness error:', error)
            throw error
        }
        setBusiness(data)
        return data
    }

    const value = {
        user,
        profile,
        business,
        loading,
        isConfigured: isSupabaseConfigured,
        signInWithGoogle,
        signOut,
        createBusiness,
        updateBusiness,
        refreshProfile: () => user && fetchProfile(user.id),
    }

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    )
}

export const useAuth = () => useContext(AuthContext)
