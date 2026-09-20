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

/**
 * Dibuja el flyer completo.
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

    const margen = Math.round(W * 0.085)
    const anchoUtil = W - margen * 2

    // ── Fondo ──
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(0, 0, W, H)

    // Un halo del color de marca arriba a la derecha, como los blobs del hero
    // de la app. Da identidad sin caer en el degradado de esquina a esquina
    // que tiene todo flyer generado automáticamente.
    const halo = ctx.createRadialGradient(W * 0.86, H * 0.06, 0, W * 0.86, H * 0.06, W * 0.72)
    halo.addColorStop(0, `${colorPrimario}2E`)
    halo.addColorStop(0.55, `${colorSecundario}12`)
    halo.addColorStop(1, '#FFFFFF00')
    ctx.fillStyle = halo
    ctx.fillRect(0, 0, W, H)

    // ── Encabezado ──
    let y = margen + Math.round(H * 0.035)

    // Barrita de color: ancla la marca arriba a la izquierda.
    ctx.fillStyle = colorPrimario
    rectRedondeado(ctx, margen, y, 74, 9, 5)
    ctx.fill()
    y += 46

    ctx.fillStyle = '#6B5E76'
    ctx.font = `700 ${Math.round(W * 0.026)}px ${cuerpo}`
    ctx.letterSpacing = '3px'
    ctx.fillText('TURNOS LIBRES', margen, y)
    ctx.letterSpacing = '0px'
    y += Math.round(W * 0.075)

    const tamNombre = ajustarTexto(ctx, nombreNegocio, anchoUtil, Math.round(W * 0.098), display, 800)
    ctx.fillStyle = '#1A0E1F'
    ctx.font = `800 ${tamNombre}px ${display}`
    ctx.fillText(nombreNegocio, margen, y)
    y += Math.round(tamNombre * 0.52) + 26

    if (fechaTexto) {
        ctx.fillStyle = colorPrimario
        ctx.font = `600 ${Math.round(W * 0.042)}px ${cuerpo}`
        const fecha = fechaTexto.charAt(0).toUpperCase() + fechaTexto.slice(1)
        ctx.fillText(fecha, margen, y)
        y += Math.round(W * 0.055)
    }

    // ── Grilla de horarios ──
    const altoPie = Math.round(H * 0.155)
    const yGrilla = y + Math.round(H * 0.025)
    const altoGrilla = H - yGrilla - altoPie - margen

    if (horarios.length === 0) {
        ctx.fillStyle = '#6B5E76'
        ctx.font = `600 ${Math.round(W * 0.042)}px ${cuerpo}`
        ctx.textAlign = 'center'
        ctx.fillText('No quedan turnos libres', W / 2, yGrilla + altoGrilla / 2)
        ctx.textAlign = 'left'
    } else {
        const sep = Math.round(W * 0.022)
        const { columnas, filas, anchoChip, altoChip } = calcularGrilla(
            horarios.length, anchoUtil, altoGrilla, sep
        )

        // El alto del chip tiene tope, así que con pocas filas sobra espacio.
        // Centrar la grilla evita el hueco muerto que quedaba entre los
        // horarios y el pie, sobre todo en el formato historia.
        const altoUsado = filas * altoChip + sep * (filas - 1)
        const yInicio = yGrilla + Math.max(0, (altoGrilla - altoUsado) / 2)

        horarios.forEach((h, i) => {
            const col = i % columnas
            const fila = Math.floor(i / columnas)
            const x = margen + col * (anchoChip + sep)
            const yc = yInicio + fila * (altoChip + sep)
            dibujarChip(ctx, h, x, yc, anchoChip, altoChip, colorPrimario, cuerpo, W)
        })
    }

    // ── Pie ──
    //
    // El enlace y la firma estaban en la MISMA línea base, así que con un
    // slug largo el texto de "hecho con GLOWUP" le pasaba por encima. Ahora
    // van en renglones distintos y el enlace se achica si hace falta.
    const yFirma = H - margen + Math.round(H * 0.012)
    const yEnlace = yFirma - Math.round(W * 0.052)

    // Línea fina que separa la grilla del pie.
    ctx.fillStyle = '#EDE7EF'
    ctx.fillRect(margen, yEnlace - Math.round(W * 0.092), anchoUtil, 2)

    if (enlace) {
        ctx.fillStyle = '#1A0E1F'
        ctx.font = `700 ${Math.round(W * 0.032)}px ${cuerpo}`
        ctx.fillText('Reservá en', margen, yEnlace - Math.round(W * 0.046))

        ctx.fillStyle = colorPrimario
        const tamEnlace = ajustarTexto(ctx, enlace, anchoUtil, Math.round(W * 0.042), cuerpo, 700)
        ctx.font = `700 ${tamEnlace}px ${cuerpo}`
        ctx.fillText(enlace, margen, yEnlace)
    }

    // Firma discreta, en su propio renglón. Es la marca del producto, no la
    // del negocio: acompaña, no compite.
    ctx.textAlign = 'right'
    ctx.fillStyle = '#AAA0B5'
    ctx.font = `600 ${Math.round(W * 0.026)}px ${cuerpo}`
    ctx.fillText('hecho con GLOWUP', W - margen, yFirma)
    ctx.textAlign = 'left'
}

/** Un horario: libre en color de marca, ocupado gris y tachado. */
function dibujarChip(ctx, horario, x, y, ancho, alto, colorPrimario, cuerpo, W) {
    const radio = Math.round(alto * 0.28)
    const libre = horario.available

    if (libre) {
        ctx.fillStyle = colorPrimario
        rectRedondeado(ctx, x, y, ancho, alto, radio)
        ctx.fill()
        ctx.fillStyle = '#FFFFFF'
    } else {
        // Ocupado: el mismo tratamiento que en la app — visible pero apagado,
        // para que se lea "queda poco" y no "no hay nada".
        // El primer gris era tan claro que en la miniatura de Instagram los
        // ocupados directamente desaparecían y el flyer parecía vacío.
        ctx.fillStyle = '#E8E2EB'
        rectRedondeado(ctx, x, y, ancho, alto, radio)
        ctx.fill()
        ctx.strokeStyle = '#D3CAD7'
        ctx.lineWidth = 2
        ctx.stroke()
        ctx.fillStyle = '#7E7285'
    }

    const tam = Math.min(Math.round(alto * 0.4), Math.round(ancho * 0.3))
    ctx.font = `${libre ? 800 : 600} ${tam}px ${cuerpo}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(horario.time.slice(0, 5), x + ancho / 2, y + alto / 2)
    ctx.textAlign = 'left'
    ctx.textBaseline = 'alphabetic'

    if (!libre) {
        // Tachado en diagonal: se entiende de un vistazo, incluso en la
        // miniatura de Instagram donde el texto casi no se lee.
        ctx.save()
        ctx.strokeStyle = '#9A8FA1'
        ctx.lineWidth = Math.max(4, Math.round(W * 0.0055))
        ctx.lineCap = 'round'
        const p = alto * 0.3
        ctx.beginPath()
        ctx.moveTo(x + p, y + p)
        ctx.lineTo(x + ancho - p, y + alto - p)
        ctx.stroke()
        ctx.restore()
    }
}
