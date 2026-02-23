'use client'
import { createContext, useContext, useState, useEffect, useCallback } from 'react'
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
            const { data: profileData } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .single()

            if (profileData) {
                setProfile(profileData)

                if (profileData.business_id) {
                    const { data: businessData } = await supabase
                        .from('businesses')
                        .select('*')
                        .eq('id', profileData.business_id)
                        .single()

                    setBusiness(businessData)
                }
            } else {
                // Profile doesn't exist yet - create it
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
            }
        } catch (err) {
            console.error('Error fetching profile:', err)
            // If profile doesn't exist (406 error), create it
            if (err?.code === 'PGRST116') {
                try {
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
                } catch (insertErr) {
                    console.error('Error creating profile:', insertErr)
                }
            }
        }
    }, [])

    useEffect(() => {
        if (!supabase) {
            setLoading(false)
            return
        }

        // Check active session
        const getSession = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession()
                setUser(session?.user || null)
                if (session?.user) {
                    await fetchProfile(session.user.id)
                }
            } catch (err) {
                console.error('Session error:', err)
            }
            setLoading(false)
        }

        getSession()

        // Listen for auth changes (this handles OAuth redirects with hash fragments)
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            console.log('Auth event:', event)
            setUser(session?.user || null)
            if (session?.user) {
                await fetchProfile(session.user.id)
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
                queryParams: {
                    access_type: 'offline',
                    prompt: 'consent',
                }
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
        if (!supabase) return
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
        if (!supabase || !business) return
        const { data, error } = await supabase
            .from('businesses')
            .update(updates)
            .eq('id', business.id)
            .select()
            .single()

        if (error) throw error
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
