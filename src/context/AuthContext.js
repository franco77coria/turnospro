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
    const currentUserRef = useRef(null)

    useEffect(() => {
        currentUserRef.current = user
    }, [user])

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
                // Check user metadata for account type
                const isBiz = userMeta?.account_type === 'business'
                const role = isBiz ? 'pending_business' : 'user'
                const account_type = isBiz ? 'business' : 'user'

                const { data: newProfile } = await supabase
                    .from('profiles')
                    .upsert([{
                        id: userId,
                        email: userEmail,
                        full_name: userMeta?.full_name || userEmail?.split('@')[0] || 'Usuario',
                        avatar_url: userMeta?.avatar_url || null,
                        role,
                        account_type,
                    }], { onConflict: 'id', ignoreDuplicates: true })
                    .select()
                    .single()
                currentProfile = newProfile
            }

            // Auto-correct client roles that got desynced during signup (role default value was 'Dueño' in DB)
            const isUserAccount = currentProfile?.account_type === 'user' || userMeta?.account_type === 'user'
            if (currentProfile && isUserAccount && currentProfile.role !== 'user' && !currentProfile.business_id) {
                currentProfile.role = 'user'
                currentProfile.account_type = 'user'
                await supabase.from('profiles').update({ role: 'user', account_type: 'user' }).eq('id', userId)
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
        let initialLoadDone = false

        const initAuth = async () => {
            try {
                // Use getSession() — reads from cookies instantly, no network call.
                // The middleware already validates the token server-side with getUser().
                const { data: { session }, error } = await supabase.auth.getSession()

                if (!isMounted) return

                const currentUser = session?.user || null

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

            if (isMounted) {
                setLoading(false)
                initialLoadDone = true
            }
        }

        initAuth()

        // Listen for auth changes (login/logout AFTER initial load)
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (!isMounted) return

            if (event === 'PASSWORD_RECOVERY') {
                if (typeof window !== 'undefined' && window.location.pathname !== '/auth/reset-password') {
                    window.location.href = '/auth/reset-password'
                }
                setLoading(false)
                return
            }

            // Skip events that don't represent actual user changes
            if (event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') return

            const sessionUser = session?.user || null

            if (event === 'SIGNED_IN' && sessionUser && initialLoadDone) {
                // Avoid redundant loader and query loops on tab focus refresh
                if (currentUserRef.current?.id !== sessionUser.id) {
                    setLoading(true)
                    setUser(sessionUser)
                    await loadUserData(sessionUser.id, sessionUser.email, sessionUser.user_metadata)
                    setLoading(false)
                }
            } else if (event === 'SIGNED_OUT') {
                setUser(null)
                setProfile(null)
                setBusiness(null)
                setLoading(false)
            } else if (!sessionUser) {
                setUser(null)
                setLoading(false)
            } else {
                setLoading(false)
            }
        })

        return () => {
            isMounted = false
            subscription.unsubscribe()
        }
    }, [loadUserData])

    const signInWithGoogle = async (accountType) => {
        if (!supabase) throw new Error('Supabase no configurado')
        // Save account type to localStorage as fallback
        // (in case Supabase strips custom query params from redirectTo)
        if (typeof window !== 'undefined' && accountType) {
            localStorage.setItem('pending_account_type', accountType)
        }
        // Build redirectTo URL — include account_type so the callback route
        // can read it and create the profile with the correct role
        let callbackUrl = typeof window !== 'undefined'
            ? `${window.location.origin}/auth/callback`
            : undefined
        if (callbackUrl && accountType) {
            callbackUrl += `?account_type=${accountType}`
        }
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: { redirectTo: callbackUrl },
        })
        if (error) throw error
    }

    const signOut = async () => {
        if (!supabase) return
        await supabase.auth.signOut()
        setUser(null)
        setProfile(null)
        setBusiness(null)
        // Full page redirect to clear all client state
        if (typeof window !== 'undefined') {
            window.location.href = '/login'
        }
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
                await supabase.from('profiles').update({ business_id: existing.id, role: 'Dueño', approved: true }).eq('id', user.id)
                setProfile(prev => ({ ...prev, business_id: existing.id, role: 'Dueño', approved: true }))
            }
            setBusiness(existing)
            return existing
        }

        const trialExpires = new Date()
        trialExpires.setDate(trialExpires.getDate() + 7)

        const { data, error } = await supabase
            .from('businesses')
            .insert([{
                ...businessData,
                owner_id: user.id,
                plan_id: 'trial',
                plan_status: 'trialing',
                plan_expires_at: trialExpires.toISOString(),
                max_locations: 1,
            }])
            .select()
            .single()

        if (error) throw error

        // Auto-crear la primera sucursal principal en la tabla locations
        try {
            await supabase.from('locations').insert([{
                business_id: data.id,
                name: businessData.name || 'Sede Principal',
                address: businessData.address || '',
                phone: businessData.phone || '',
                is_primary: true,
                active: true,
            }])
        } catch (locErr) {
            console.error('Error al auto-crear sucursal inicial:', locErr)
        }

        // Auto-aprobar y actualizar perfil del dueño
        await supabase
            .from('profiles')
            .update({
                business_id: data.id,
                role: 'Dueño',
                account_type: 'business',
                approved: true,
            })
            .eq('id', user.id)

        setBusiness(data)
        setProfile(prev => ({ ...prev, business_id: data.id, role: 'Dueño', account_type: 'business', approved: true }))
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
