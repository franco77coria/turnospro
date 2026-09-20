/**
 * Flyer de turnos libres del día, para publicar en Instagram o mandar por
 * WhatsApp.
 *
 * Se dibuja en un <canvas> del lado del cliente: no hay render en el servidor
 * ni dependencias de imagen, y el dueño descarga el PNG al instante.
 *
 * Los horarios NO se calculan acá. Salen de generateAvailableSlots, el mismo
 * generador que usa la pantalla de reserva — si el flyer tuviera su propia
 * copia de la regla, tarde o temprano publicaría horarios que la app no
 * ofrece (o al revés).
 */

// La mezcla de colores ya está resuelta y testeada en theme.js: el flyer usa
// esa, no una copia propia.
import { mezclar } from './theme'

// 4:5 es el formato que más ocupa en el feed de Instagram sin recortarse.
// 9:16 es la historia. Se guardan las dos porque se usan distinto.
export const FORMATOS = {
    feed: { id: 'feed', nombre: 'Publicación', ancho: 1080, alto: 1350 },
    historia: { id: 'historia', nombre: 'Historia', ancho: 1080, alto: 1920 },
}

/**
 * Acomoda los horarios en una grilla que llena el ancho disponible.
 *
 * La cantidad de columnas depende de cuántos turnos haya: con 6 horarios, una
 * grilla de 4 columnas deja una fila coja y se ve descuidado. Se busca el
 * reparto más parejo dentro de un rango sensato.
 *
 * @returns {{columnas:number, filas:number, anchoChip:number, altoChip:number}}
 */
export function calcularGrilla(cantidad, anchoDisponible, altoDisponible, separacion = 22) {
    if (cantidad <= 0) {
        return { columnas: 0, filas: 0, anchoChip: 0, altoChip: 0 }
    }

    // Regla simple y predecible. La primera versión elegía las columnas
    // minimizando los huecos de la última fila, y con 14 horarios eso daba
    // 2 columnas por 7 filas: una grilla alta y angosta que se desbordaba
    // sobre el pie del flyer. Lo que importa no es que la última fila quede
    // llena, sino que la grilla entre y los chips tengan forma de pastilla.
    const columnas =
        cantidad <= 4 ? cantidad :
        cantidad <= 12 ? 3 :
        4

    const filas = Math.ceil(cantidad / columnas)
    const anchoChip = (anchoDisponible - separacion * (columnas - 1)) / columnas

    // El alto sale del espacio que realmente hay. El tope evita que con pocos
    // turnos los chips queden enormes; NO hay un piso que se imponga al
    // espacio disponible, porque desbordar es peor que un chip más bajo.
    const altoNatural = (altoDisponible - separacion * (filas - 1)) / filas
    const altoChip = Math.max(1, Math.min(altoNatural, 132))

    return { columnas, filas, anchoChip, altoChip }
}

/** Rectángulo redondeado, con respaldo si el navegador no trae roundRect. */
function rectRedondeado(ctx, x, y, ancho, alto, radio) {
    if (typeof ctx.roundRect === 'function') {
        ctx.beginPath()
        ctx.roundRect(x, y, ancho, alto, radio)
        return
    }
    const r = Math.min(radio, ancho / 2, alto / 2)
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.arcTo(x + ancho, y, x + ancho, y + alto, r)
    ctx.arcTo(x + ancho, y + alto, x, y + alto, r)
    ctx.arcTo(x, y + alto, x, y, r)
    ctx.arcTo(x, y, x + ancho, y, r)
    ctx.closePath()
}

/**
 * Achica el texto hasta que entre en el ancho dado.
 * Un nombre de negocio largo no puede desbordar el flyer.
 */
function ajustarTexto(ctx, texto, anchoMax, tamInicial, familia, peso = 700) {
    let tam = tamInicial
    ctx.font = `${peso} ${tam}px ${familia}`
    while (ctx.measureText(texto).width > anchoMax && tam > 24) {
        tam -= 2
        ctx.font = `${peso} ${tam}px ${familia}`
    }
    return tam
}


// ─── Piezas gráficas ────────────────────────────────────────────────────

/** Mancha difusa, como los blobs del hero de la landing. */
function blob(ctx, x, y, radio, color, opacidad) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, radio)
    g.addColorStop(0, `${color}${opacidad}`)
    g.addColorStop(0.62, `${color}${Math.max(0, parseInt(opacidad, 16) - 6).toString(16).padStart(2, '0')}`)
    g.addColorStop(1, `${color}00`)
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(x, y, radio, 0, Math.PI * 2)
    ctx.fill()
}

/**
 * Mockup de celular, el mismo de la landing: marco oscuro, esquinas muy
 * redondeadas, pantalla con degradado de marca y unas tarjetas insinuadas.
 * Va rotado y recortado por el borde: da profundidad sin robarle lugar a los
 * horarios, que son el contenido real del flyer.
 */
function dibujarCelular(ctx, x, y, ancho, alto, rotacion, colorPrimario, colorSecundario) {
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(rotacion)

    const borde = Math.round(ancho * 0.037)
    const radioMarco = Math.round(ancho * 0.15)

    // Aro exterior translúcido, como el box-shadow del .gu-phone
    ctx.fillStyle = 'rgba(26, 14, 31, 0.30)'
    rectRedondeado(ctx, -ancho / 2 - borde, -alto / 2 - borde,
        ancho + borde * 2, alto + borde * 2, radioMarco + borde)
    ctx.fill()

    // Marco
    ctx.fillStyle = '#1A0E1F'
    rectRedondeado(ctx, -ancho / 2, -alto / 2, ancho, alto, radioMarco)
    ctx.fill()

    // Pantalla
    const px = -ancho / 2 + borde
    const py = -alto / 2 + borde
    const pw = ancho - borde * 2
    const ph = alto - borde * 2
    const radioPantalla = radioMarco - borde

    ctx.save()
    rectRedondeado(ctx, px, py, pw, ph, radioPantalla)
    ctx.clip()

    const g = ctx.createLinearGradient(px, py, px, py + ph)
    g.addColorStop(0, mezclar(colorPrimario, '#FFFFFF', 0.86))
    g.addColorStop(1, mezclar(colorSecundario, '#FFFFFF', 0.88))
    ctx.fillStyle = g
    ctx.fillRect(px, py, pw, ph)

    // Isla del sensor
    ctx.fillStyle = '#1A0E1F'
    const anchoIsla = pw * 0.3
    rectRedondeado(ctx, px + (pw - anchoIsla) / 2, py + ph * 0.022, anchoIsla, ph * 0.026, ph * 0.014)
    ctx.fill()

    // Tarjetas insinuadas: no se leen, dan textura de "app real"
    const mx = pw * 0.09
    let cy = py + ph * 0.13
    const altoTarjeta = ph * 0.105
    for (let i = 0; i < 5; i++) {
        ctx.fillStyle = 'rgba(255,255,255,0.78)'
        rectRedondeado(ctx, px + mx, cy, pw - mx * 2, altoTarjeta, altoTarjeta * 0.3)
        ctx.fill()

        // Miniatura redonda
        ctx.fillStyle = i % 2 ? colorSecundario : colorPrimario
        ctx.globalAlpha = 0.85
        ctx.beginPath()
        ctx.arc(px + mx + altoTarjeta * 0.5, cy + altoTarjeta / 2, altoTarjeta * 0.28, 0, Math.PI * 2)
        ctx.fill()
        ctx.globalAlpha = 1

        // Dos renglones de texto
        ctx.fillStyle = 'rgba(26,14,31,0.22)'
        rectRedondeado(ctx, px + mx + altoTarjeta, cy + altoTarjeta * 0.28, pw * 0.34, altoTarjeta * 0.15, 4)
        ctx.fill()
        ctx.fillStyle = 'rgba(26,14,31,0.12)'
        rectRedondeado(ctx, px + mx + altoTarjeta, cy + altoTarjeta * 0.55, pw * 0.22, altoTarjeta * 0.13, 4)
        ctx.fill()

        cy += altoTarjeta + ph * 0.028
    }

    ctx.restore()
    ctx.restore()
}

/**
 * Dibuja el flyer completo.
 *
 * La primera versión era una hoja blanca con chips: correcta y olvidable.
 * Esta toma el lenguaje del hero de la landing — fondo de color saturado,
 * manchas difusas y el mockup de celular rotado — para que frene el scroll
 * en Instagram. Los horarios van sobre una tarjeta clara: son el contenido
 * y tienen que leerse sí o sí, por vistoso que sea el fondo.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} datos
 * @param {string} datos.nombreNegocio
 * @param {string} datos.fechaTexto        ya formateada ("martes 15 de octubre")
 * @param {Array<{time:string, available:boolean}>} datos.horarios
 * @param {string} [datos.enlace]          dominio + ruta de reserva
 * @param {string} datos.colorPrimario
 * @param {string} datos.colorSecundario
 * @param {object} formato                 uno de FORMATOS
 * @param {object} fuentes                 { display, cuerpo } familias css
 */
export function dibujarFlyer(ctx, datos, formato, fuentes) {
    const { ancho: W, alto: H } = formato
    const {
        nombreNegocio = 'Mi negocio',
        fechaTexto = '',
        horarios = [],
        enlace = '',
        colorPrimario = '#FF2E8E',
        colorSecundario = '#6E2BFF',
    } = datos
    const display = fuentes?.display || 'sans-serif'
    const cuerpo = fuentes?.cuerpo || 'sans-serif'

    const margen = Math.round(W * 0.075)
    const anchoUtil = W - margen * 2

    ctx.clearRect(0, 0, W, H)

    // ── Fondo saturado ──
    const fondo = ctx.createLinearGradient(0, 0, W * 0.75, H)
    fondo.addColorStop(0, colorPrimario)
    fondo.addColorStop(1, mezclar(colorSecundario, '#1A0E1F', 0.28))
    ctx.fillStyle = fondo
    ctx.fillRect(0, 0, W, H)

    // Manchas difusas, como los blobs del hero.
    blob(ctx, W * 0.14, H * 0.10, W * 0.60, '#FFFFFF', '30')
    blob(ctx, W * 1.02, H * 0.34, W * 0.58, colorSecundario, '55')
    blob(ctx, W * 0.10, H * 0.92, W * 0.52, colorPrimario, '4d')

    // ── Celular recortado por el ángulo superior derecho ──
    // Abajo a la derecha quedaba tapado por la tarjeta y se leía como una
    // mancha blanca cualquiera. Acá asoma entero de la cintura para arriba:
    // se reconoce el marco, la isla y las tarjetas de la pantalla.
    const anchoCel = W * 0.44
    dibujarCelular(
        ctx,
        W * 0.93, H * 0.19,
        anchoCel, anchoCel * 1.95,
        0.26,
        colorPrimario, colorSecundario
    )

    // ── Encabezado ──
    let y = margen + Math.round(H * 0.045)

    // Pastilla translúcida
    ctx.font = `800 ${Math.round(W * 0.026)}px ${cuerpo}`
    ctx.letterSpacing = '3px'
    const textoPastilla = 'TURNOS LIBRES'
    const anchoTexto = ctx.measureText(textoPastilla).width
    const padPastilla = Math.round(W * 0.028)
    const altoPastilla = Math.round(W * 0.062)
    ctx.fillStyle = 'rgba(255,255,255,0.22)'
    rectRedondeado(ctx, margen, y - altoPastilla * 0.72,
        anchoTexto + padPastilla * 2, altoPastilla, altoPastilla / 2)
    ctx.fill()
    ctx.fillStyle = '#FFFFFF'
    ctx.fillText(textoPastilla, margen + padPastilla, y)
    ctx.letterSpacing = '0px'
    y += Math.round(W * 0.095)

    // El ancho se acota a la mitad izquierda: el celular ocupa la derecha del
    // encabezado y el nombre se le montaba encima.
    const tamNombre = ajustarTexto(ctx, nombreNegocio, anchoUtil * 0.68, Math.round(W * 0.098), display, 800)
    ctx.fillStyle = '#FFFFFF'
    ctx.font = `800 ${tamNombre}px ${display}`
    ctx.fillText(nombreNegocio, margen, y)
    y += Math.round(tamNombre * 0.5) + Math.round(W * 0.026)

    if (fechaTexto) {
        ctx.fillStyle = 'rgba(255,255,255,0.88)'
        ctx.font = `600 ${Math.round(W * 0.042)}px ${cuerpo}`
        const fecha = fechaTexto.charAt(0).toUpperCase() + fechaTexto.slice(1)
        ctx.fillText(fecha, margen, y)
        y += Math.round(W * 0.03)
    }

    // ── Tarjeta de horarios ──
    const altoPie = Math.round(H * 0.105)
    const yZona = y + Math.round(H * 0.028)
    const altoZona = H - yZona - altoPie - margen
    const padTarjeta = Math.round(W * 0.055)
    const sep = Math.round(W * 0.02)
    const anchoGrilla = anchoUtil - padTarjeta * 2

    // La tarjeta se mide DESPUÉS de saber cuánto ocupa la grilla. Antes se
    // estiraba a toda la zona disponible y en el formato historia quedaba un
    // panel blanco enorme con los horarios flotando en el medio.
    const grilla = calcularGrilla(horarios.length, anchoGrilla, altoZona - padTarjeta * 2, sep)
    const altoContenido = horarios.length === 0
        ? Math.round(H * 0.08)
        : grilla.filas * grilla.altoChip + sep * (grilla.filas - 1)
    const altoTarjeta = Math.min(altoZona, altoContenido + padTarjeta * 2)
    const yTarjeta = yZona + Math.max(0, (altoZona - altoTarjeta) / 2)

    ctx.save()
    ctx.shadowColor = 'rgba(26,14,31,0.30)'
    ctx.shadowBlur = Math.round(W * 0.055)
    ctx.shadowOffsetY = Math.round(W * 0.018)
    ctx.fillStyle = '#FFFFFF'
    rectRedondeado(ctx, margen, yTarjeta, anchoUtil, altoTarjeta, Math.round(W * 0.05))
    ctx.fill()
    ctx.restore()

    const xGrilla = margen + padTarjeta
    const yGrilla = yTarjeta + padTarjeta

    if (horarios.length === 0) {
        ctx.fillStyle = '#6B5E76'
        ctx.font = `600 ${Math.round(W * 0.04)}px ${cuerpo}`
        ctx.textAlign = 'center'
        ctx.fillText('No quedan turnos libres', W / 2, yTarjeta + altoTarjeta / 2)
        ctx.textAlign = 'left'
    } else {
        horarios.forEach((h, i) => {
            const col = i % grilla.columnas
            const fila = Math.floor(i / grilla.columnas)
            dibujarChip(
                ctx, h,
                xGrilla + col * (grilla.anchoChip + sep),
                yGrilla + fila * (grilla.altoChip + sep),
                grilla.anchoChip, grilla.altoChip, colorPrimario, cuerpo, W
            )
        })
    }

    // ── Pie, sobre el fondo de color ──
    // El enlace y la firma comparten línea base; el enlace se achica para
    // dejarle su lugar a la firma en vez de invadirla.
    const yPie = H - margen - Math.round(H * 0.008)
    const anchoFirma = W * 0.26

    if (enlace) {
        ctx.fillStyle = 'rgba(255,255,255,0.72)'
        ctx.font = `700 ${Math.round(W * 0.027)}px ${cuerpo}`
        ctx.letterSpacing = '2px'
        ctx.fillText('RESERVÁ EN', margen, yPie - Math.round(W * 0.05))
        ctx.letterSpacing = '0px'

        ctx.fillStyle = '#FFFFFF'
        const tamEnlace = ajustarTexto(
            ctx, enlace, anchoUtil - anchoFirma, Math.round(W * 0.04), cuerpo, 800
        )
        ctx.font = `800 ${tamEnlace}px ${cuerpo}`
        ctx.fillText(enlace, margen, yPie)
    }

    ctx.textAlign = 'right'
    ctx.fillStyle = 'rgba(255,255,255,0.58)'
    ctx.font = `600 ${Math.round(W * 0.024)}px ${cuerpo}`
    ctx.fillText('hecho con GLOWUP', W - margen, yPie)
    ctx.textAlign = 'left'
}

/** Un horario: libre en color de marca, ocupado gris y tachado. */
function dibujarChip(ctx, horario, x, y, ancho, alto, colorPrimario, cuerpo, W) {
    const radio = Math.round(alto * 0.3)
    const libre = horario.available

    if (libre) {
        ctx.fillStyle = colorPrimario
        rectRedondeado(ctx, x, y, ancho, alto, radio)
        ctx.fill()
        ctx.fillStyle = '#FFFFFF'
    } else {
        // Visible pero apagado: tiene que leerse "queda poco", no "no hay nada".
        ctx.fillStyle = '#EDE8EF'
        rectRedondeado(ctx, x, y, ancho, alto, radio)
        ctx.fill()
        ctx.fillStyle = '#8B8091'
    }

    const tam = Math.min(Math.round(alto * 0.38), Math.round(ancho * 0.29))
    ctx.font = `${libre ? 800 : 600} ${tam}px ${cuerpo}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(horario.time.slice(0, 5), x + ancho / 2, y + alto / 2)
    ctx.textAlign = 'left'
    ctx.textBaseline = 'alphabetic'

    if (!libre) {
        // Tachado en diagonal: se entiende de un vistazo, incluso en la
        // miniatura del feed donde el texto casi no se lee.
        ctx.save()
        ctx.strokeStyle = '#A99FAF'
        ctx.lineWidth = Math.max(4, Math.round(W * 0.005))
        ctx.lineCap = 'round'
        const p = alto * 0.3
        ctx.beginPath()
        ctx.moveTo(x + p, y + p)
        ctx.lineTo(x + ancho - p, y + alto - p)
        ctx.stroke()
        ctx.restore()
    }
}
