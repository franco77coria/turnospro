'use client'

/**
 * Aplica el color de marca elegido.
 *
 * Fuente de verdad, en orden:
 *   1. El negocio, si el usuario es dueño o parte del equipo (su identidad).
 *   2. La preferencia personal del perfil.
 *   3. El tema por defecto, que es el rosa actual de la app.
 *
 * La copia en localStorage no es la fuente de verdad: existe para poder pintar
 * el color correcto ANTES del primer render. Sin eso, cada carga arranca en
 * rosa y salta al color elegido cuando responde la sesión — el mismo destello
 * que ya se había resuelto para el modo oscuro.
 *
 * Lo que se guarda son los TOKENS YA CALCULADOS, no el color base. Así el
 * script de arranque no necesita repetir la derivación (mezclas, corrección
 * de contraste, acotado) — que es justo el tipo de regla duplicada que
 * después se desincroniza de la original.
 */

import { useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import { aplicarTema, derivarPaleta, resolverTema, CLAVE_TEMA_LOCAL } from '@/lib/theme'

export default function ThemeApplier() {
    const { business, profile } = useAuth()
    const elegido = business?.settings?.theme ?? profile?.preferences?.theme ?? null

    useEffect(() => {
        const tema = aplicarTema(elegido)
        if (!tema) return

        try {
            const { claro, oscuro } = derivarPaleta(tema.primario, tema.secundario)
            localStorage.setItem(CLAVE_TEMA_LOCAL, JSON.stringify({ claro, oscuro }))
        } catch {
            // Modo incógnito o storage bloqueado: el tema igual quedó aplicado.
        }
    }, [elegido])

    // El modo oscuro se conmuta desde otro componente agregando .dark en <html>.
    // Los tokens de oscuro son distintos, así que hay que recalcularlos cuando
    // esa clase cambia; si no, el tinte y el "ink" quedan con los de claro.
    useEffect(() => {
        if (typeof MutationObserver === 'undefined') return
        const raiz = document.documentElement
        const observador = new MutationObserver(() => aplicarTema(elegido))
        observador.observe(raiz, { attributes: true, attributeFilter: ['class'] })
        return () => observador.disconnect()
    }, [elegido])

    return null
}

/**
 * Script que corre antes del primer pintado: lee los tokens guardados y los
 * escribe sobre <html>. Sin matemática de color y sin dependencias — cualquier
 * error acá dejaría la página sin estilos, así que va entero dentro de un try.
 */
export const SCRIPT_TEMA_INICIAL = `
(function(){
  try{
    var g=localStorage.getItem('${CLAVE_TEMA_LOCAL}');
    if(!g)return;
    var t=JSON.parse(g);
    if(!t||!t.claro)return;
    var r=document.documentElement,k;
    for(k in t.claro)r.style.setProperty(k,t.claro[k]);
    if(r.classList.contains('dark')&&t.oscuro)for(k in t.oscuro)r.style.setProperty(k,t.oscuro[k]);
  }catch(e){}
})();
`.trim()
