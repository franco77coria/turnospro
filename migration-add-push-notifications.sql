-- MIGRACIÓN PARA AGREGAR NOTIFICACIONES WEB PUSH DE PWA
-- Ejecuta este script en el Editor SQL de Supabase para crear el almacenamiento de suscripciones.

-- 1. Crear la tabla de suscripciones push
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL UNIQUE,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Habilitar Row Level Security (RLS)
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- 3. Crear políticas de seguridad
-- Permitir a los usuarios leer sus propias suscripciones
CREATE POLICY "Users can view their own push subscriptions" 
    ON public.push_subscriptions 
    FOR SELECT 
    USING (auth.uid() = user_id);

-- Permitir a los usuarios insertar sus propias suscripciones
CREATE POLICY "Users can create their own push subscriptions" 
    ON public.push_subscriptions 
    FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

-- Permitir a los usuarios borrar sus propias suscripciones
CREATE POLICY "Users can delete their own push subscriptions" 
    ON public.push_subscriptions 
    FOR DELETE 
    USING (auth.uid() = user_id);

-- 4. Crear índice para optimizar la búsqueda por usuario
CREATE INDEX IF NOT EXISTS idx_push_subs_user_id ON public.push_subscriptions(user_id);
