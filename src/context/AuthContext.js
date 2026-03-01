'use client'
import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'

const AuthContext = createContext({})

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null)
    const [profile, setProfile] = useState(null)
    const [business, setBusiness] = useState(null)
    const [loading, setLoading] = useState(true)
    const fetchingRef = useRef(false)

    // Load profile + business in parallel (single fetch cycle)
    const loadUserData = useCallback(async (userId, userEmail, userMeta) => {
        if (!supabase || fetchingRef.current) return
        fetchingRef.current = true

        try {
            // 1) Fetch profile
            const { data: profileData, error: profileError } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .single()

            let currentProfile = profileData

            // Profile doesn't exist — create it
            if (profileError && profileError.code === 'PGRST116') {
                const { data: newProfile } = await supabase
                    .from('profiles')
                    .insert([{
                        id: userId,
                        email: userEmail,
                        full_name: userMeta?.full_name || userEmail?.split('@')[0] || 'Usuario',
                        avatar_url: userMeta?.avatar_url || null,
                        role: 'Dueño',
                    }])
                    .select()
                    .single()
                currentProfile = newProfile
            }

            if (!currentProfile) {
                setProfile(null)
                setBusiness(null)
                return
            }

            setProfile(currentProfile)

            // 2) Fetch business — try by business_id first, then by owner_id
            let currentBusiness = null

            if (currentProfile.business_id) {
                const { data: bizData } = await supabase
                    .from('businesses')
                    .select('*')
                    .eq('id', currentProfile.business_id)
                    .single()
                currentBusiness = bizData
            }

            // Fallback: find business by owner_id
            if (!currentBusiness) {
                const { data: ownedBiz } = await supabase
                    .from('businesses')
                    .select('*')
                    .eq('owner_id', userId)
                    .limit(1)
                    .maybeSingle()

                if (ownedBiz) {
                    currentBusiness = ownedBiz
                    // Fix the profile link silently
                    if (currentProfile.business_id !== ownedBiz.id) {
                        await supabase.from('profiles')
                            .update({ business_id: ownedBiz.id })
                            .eq('id', userId)
                        currentProfile = { ...currentProfile, business_id: ownedBiz.id }
                        setProfile(currentProfile)
                    }
                }
            }

            setBusiness(currentBusiness)
        } catch (err) {
            console.error('Error loading user data:', err)
        } finally {
            fetchingRef.current = false
        }
    }, [])

    // Initialize auth state
    useEffect(() => {
        if (!supabase) {
            setLoading(false)
            return
        }

        let isMounted = true

        const initAuth = async () => {
            try {
                const { data: { user: currentUser }, error } = await supabase.auth.getUser()

                if (!isMounted) return

                if (error || !currentUser) {
                    setUser(null)
                    setProfile(null)
                    setBusiness(null)
                } else {
                    setUser(currentUser)
                    await loadUserData(currentUser.id, currentUser.email, currentUser.user_metadata)
                }
            } catch (err) {
                console.error('Auth init error:', err)
            }

            if (isMounted) setLoading(false)
        }

        initAuth()

        // Listen for auth changes (login/logout after initial load)
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (!isMounted) return

            const sessionUser = session?.user || null
            setUser(sessionUser)

            if (event === 'SIGNED_IN' && sessionUser) {
                await loadUserData(sessionUser.id, sessionUser.email, sessionUser.user_metadata)
            } else if (event === 'SIGNED_OUT') {
                setProfile(null)
                setBusiness(null)
            }

            setLoading(false)
        })

        return () => {
            isMounted = false
            subscription.unsubscribe()
        }
    }, [loadUserData])

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
            if (!profile?.business_id || profile.business_id !== existing.id) {
                await supabase.from('profiles').update({ business_id: existing.id }).eq('id', user.id)
                setProfile(prev => ({ ...prev, business_id: existing.id }))
            }
            setBusiness(existing)
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

        // Read-then-write: fetch fresh data to avoid overwriting
        const { data: freshBiz } = await supabase
            .from('businesses')
            .select('*')
            .eq('id', business.id)
            .single()

        if (!freshBiz) {
            console.error('updateBusiness: business not found in DB')
            return null
        }

        // Merge: for JSONB fields like services, use the update value;
        // for other fields, use what the caller passed
        const mergedUpdates = { ...updates }

        // Safety: don't allow overwriting services with empty array if DB has data
        if (Array.isArray(updates.services) && updates.services.length === 0
            && Array.isArray(freshBiz.services) && freshBiz.services.length > 0) {
            console.warn('updateBusiness: blocking empty services overwrite')
            delete mergedUpdates.services
        }

        const { data, error } = await supabase
            .from('businesses')
            .update(mergedUpdates)
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

    const refreshProfile = useCallback(async () => {
        if (user) {
            await loadUserData(user.id, user.email, user.user_metadata)
        }
    }, [user, loadUserData])

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
        refreshProfile,
    }

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    )
}

export const useAuth = () => useContext(AuthContext)
