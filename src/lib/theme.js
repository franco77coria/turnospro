/**
 * Color de marca configurable.
 *
 * El diseño está construido sobre un par de colores (el rosa y el violeta que
 * forman los degradados) y cuatro derivados de cada uno: la versión oscura
 * para el hover, un tono suave para bordes y badges, un tinte muy claro para
 * fondos, y una versión "ink" con contraste suficiente para usar como texto.
 *
 * En vez de renombrar las ~2500 líneas de globals.css, acá se RECALCULAN los
 * valores de esos mismos tokens (--pink, --violet y sus derivados) a partir
 * del color elegido. El CSS no se entera: sigue pidiendo var(--pink).
 *
 * La versión "ink" no se elige a ojo: se oscurece (o aclara, en modo oscuro)
 * hasta cruzar 4.5:1 de contraste. Un color de marca lindo pero ilegible es
 * el modo más común de romper una app con un selector de color.
 */

// ─── Conversión y contraste (WCAG 2.1) ──────────────────────────────────

export function hexARgb(hex) {
    if (typeof hex !== 'string') return null
    let h = hex.trim().replace(/^#/, '')
    if (h.length === 3) h = h.split('').map((c) => c + c).join('')
    if (!/^[0-9a-f]{6}$/i.test(h)) return null
    return {
        r: parseInt(h.slice(0, 2), 16),
        g: parseInt(h.slice(2, 4), 16),
        b: parseInt(h.slice(4, 6), 16),
    }
}

export function rgbAHex({ r, g, b }) {
    const c = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')
    return `#${c(r)}${c(g)}${c(b)}`.toUpperCase()
}

/** Luminancia relativa según WCAG: el canal se linealiza antes de pesarlo. */
export function luminancia(hex) {
    const rgb = hexARgb(hex)
    if (!rgb) return 0
    const canal = (v) => {
        const s = v / 255
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
    }
    return 0.2126 * canal(rgb.r) + 0.7152 * canal(rgb.g) + 0.0722 * canal(rgb.b)
}

/** Razón de contraste entre dos colores. Es simétrica: contraste(a,b)===contraste(b,a). */
export function contraste(hexA, hexB) {
    const a = luminancia(hexA)
    const b = luminancia(hexB)
    const [claro, oscuro] = a > b ? [a, b] : [b, a]
    return (claro + 0.05) / (oscuro + 0.05)
}

/** Mezcla lineal en sRGB. Simple y predecible; alcanza para tintes y sombras. */
export function mezclar(hexA, hexB, t) {
    const a = hexARgb(hexA)
    const b = hexARgb(hexB)
    if (!a || !b) return hexA
    const k = Math.max(0, Math.min(1, t))
    return rgbAHex({
        r: a.r + (b.r - a.r) * k,
        g: a.g + (b.g - a.g) * k,
        b: a.b + (b.b - a.b) * k,
    })
}

const BLANCO = '#FFFFFF'
const NEGRO = '#000000'

/**
 * Busca la variante legible del color contra un fondo dado.
 * Oscurece sobre fondo claro y aclara sobre fondo oscuro, de a pasos chicos,
 * hasta cruzar el mínimo. Devuelve el color más cercano al original que sirve.
 */
export function variantelegible(base, fondo = BLANCO, minimo = 4.5) {
    if (!hexARgb(base)) return base
    if (contraste(base, fondo) >= minimo) return base

    const fondoEsClaro = luminancia(fondo) > 0.35
    const destino = fondoEsClaro ? NEGRO : BLANCO

    let mejor = base
    for (let paso = 1; paso <= 40; paso++) {
        const candidato = mezclar(base, destino, paso / 40)
        mejor = candidato
        if (contraste(candidato, fondo) >= minimo) return candidato
    }
    return mejor
}

/** `#FF2E8E` → `255, 46, 142`, para meterlo en un rgba() de sombra. */
function canalesRgb(hex) {
    const rgb = hexARgb(hex) || { r: 0, g: 0, b: 0 }
    return `${rgb.r}, ${rgb.g}, ${rgb.b}`
}

// ─── Derivación de la paleta ────────────────────────────────────────────

// Fondos reales del diseño, para medir el contraste contra ellos y no contra
// un blanco/negro teórico.
const PAPEL_CLARO = '#FFFFFF'
const PAPEL_OSCURO = '#1A0F22'

/**
 * Mínimo de contraste contra blanco que tiene que tener el color de marca.
 *
 * Los botones principales son texto blanco sobre el color (13 reglas del CSS
 * lo hacen así). 3:1 es el umbral de AA para texto grande/negrita, que es el
 * caso de esos botones. El rosa actual da 3.48:1, así que ningún preset se
 * mueve; lo que esto impide es que alguien elija un amarillo y el botón quede
 * con texto blanco invisible.
 */
const MIN_CONTRA_BLANCO = 3.0

/**
 * Deriva los tokens que el CSS ya usa, a partir del par de colores elegido.
 *
 * @param {string} primario   reemplaza a --pink
 * @param {string} secundario reemplaza a --violet
 * @returns {{claro: Record<string,string>, oscuro: Record<string,string>}}
 */
export function derivarPaleta(primario, secundario) {
    const pElegido = hexARgb(primario) ? primario.toUpperCase() : TEMAS[0].primario
    const sElegido = hexARgb(secundario) ? secundario.toUpperCase() : TEMAS[0].secundario

    // Se oscurece solo si hace falta: variantelegible devuelve el color intacto
    // cuando ya cumple.
    const p = variantelegible(pElegido, BLANCO, MIN_CONTRA_BLANCO)
    const s = variantelegible(sElegido, BLANCO, MIN_CONTRA_BLANCO)

    return {
        claro: {
            '--pink': p,
            '--pink-deep': mezclar(p, NEGRO, 0.16),
            '--pink-soft': mezclar(p, BLANCO, 0.76),
            '--pink-tint': mezclar(p, BLANCO, 0.9),
            '--pink-ink': variantelegible(p, PAPEL_CLARO),

            '--violet': s,
            '--violet-deep': mezclar(s, NEGRO, 0.2),
            '--violet-soft': mezclar(s, BLANCO, 0.76),
            '--violet-tint': mezclar(s, BLANCO, 0.9),

            '--shadow-pink': `0 12px 30px rgba(${canalesRgb(p)}, 0.28)`,
            '--shadow-violet': `0 12px 30px rgba(${canalesRgb(s)}, 0.28)`,
        },
        // En oscuro los tintes son versiones apagadas sobre el fondo, no
        // lavados con blanco, y el "ink" tiene que ACLARARSE para contrastar.
        oscuro: {
            '--pink-tint': mezclar(p, PAPEL_OSCURO, 0.86),
            '--violet-tint': mezclar(s, PAPEL_OSCURO, 0.88),
            '--pink-soft': mezclar(p, PAPEL_OSCURO, 0.66),
            '--violet-soft': mezclar(s, PAPEL_OSCURO, 0.66),
            '--pink-ink': variantelegible(p, PAPEL_OSCURO),
        },
    }
}

// ─── Temas ──────────────────────────────────────────────────────────────

/**
 * Pares curados. El secundario no es decorativo: forma los degradados de los
 * botones y los blobs del hero, así que tiene que armonizar con el primario.
 */
// Todos pasan 3:1 contra blanco, en primario Y secundario: los botones son
// texto blanco sobre el degradado que forman los dos. El cian #06B6D4 que
// tenía "Azul" daba 2.43 y el acotado lo corregía en silencio; mejor que el
// catálogo diga la verdad de lo que se va a ver.
export const TEMAS = [
    { id: 'rosa', nombre: 'Rosa', primario: '#FF2E8E', secundario: '#6E2BFF' },
    { id: 'violeta', nombre: 'Violeta', primario: '#7C3AED', secundario: '#DB2777' },
    { id: 'azul', nombre: 'Azul', primario: '#2563EB', secundario: '#0891B2' },
    { id: 'turquesa', nombre: 'Turquesa', primario: '#0D9488', secundario: '#2563EB' },
    { id: 'verde', nombre: 'Verde', primario: '#059669', secundario: '#65A30D' },
    { id: 'naranja', nombre: 'Naranja', primario: '#EA580C', secundario: '#DB2777' },
    { id: 'rojo', nombre: 'Rojo', primario: '#DC2626', secundario: '#EA580C' },
    { id: 'grafito', nombre: 'Grafito', primario: '#475569', secundario: '#0F172A' },
]

export const TEMA_POR_DEFECTO = TEMAS[0]

export function buscarTema(id) {
    return TEMAS.find((t) => t.id === id) || null
}

/**
 * Normaliza lo que haya guardado: un id de preset, o un par de hex propio.
 * Siempre devuelve algo usable, porque un valor corrupto en la base no puede
 * dejar la app sin colores.
 */
export function resolverTema(valor) {
    if (!valor) return TEMA_POR_DEFECTO

    if (typeof valor === 'string') {
        return buscarTema(valor) || TEMA_POR_DEFECTO
    }

    if (typeof valor === 'object') {
        if (valor.id && valor.id !== 'custom') {
            const preset = buscarTema(valor.id)
            if (preset) return preset
        }
        if (hexARgb(valor.primario)) {
            return {
                id: 'custom',
                nombre: 'Personalizado',
                primario: valor.primario.toUpperCase(),
                // Sin secundario elegido, se usa el primario: el degradado
                // queda monocromo pero coherente, nunca roto.
                secundario: hexARgb(valor.secundario)
                    ? valor.secundario.toUpperCase()
                    : mezclar(valor.primario, NEGRO, 0.3),
            }
        }
    }

    return TEMA_POR_DEFECTO
}

/**
 * Aplica el tema al documento escribiendo las custom properties.
 * Se llama en el cliente; en el servidor no hace nada.
 */
export function aplicarTema(valor, doc = typeof document !== 'undefined' ? document : null) {
    if (!doc) return null
    const tema = resolverTema(valor)
    const { claro, oscuro } = derivarPaleta(tema.primario, tema.secundario)
    const raiz = doc.documentElement

    for (const [prop, val] of Object.entries(claro)) {
        raiz.style.setProperty(prop, val)
    }

    // El modo oscuro se activa con la clase .dark en <html>. Como las custom
    // properties inline ganan sobre cualquier regla de la hoja, los overrides
    // de .dark hay que reescribirlos acá cuando corresponde.
    const esOscuro = raiz.classList.contains('dark')
    if (esOscuro) {
        for (const [prop, val] of Object.entries(oscuro)) {
            raiz.style.setProperty(prop, val)
        }
    }

    return tema
}

export const CLAVE_TEMA_LOCAL = 'glowup-color'
