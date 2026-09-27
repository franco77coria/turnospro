import { mezclar } from './theme'

export const FORMATOS = {
    feed: { id: 'feed', nombre: 'Publicación', ancho: 1080, alto: 1350 },
    historia: { id: 'historia', nombre: 'Historia', ancho: 1080, alto: 1920 },
}

export function calcularGrilla(cantidad, anchoDisponible, altoDisponible, separacion = 22) {
    if (cantidad <= 0) return { columnas: 0, filas: 0, anchoChip: 0, altoChip: 0 }
    const columnas = cantidad <= 4 ? cantidad : cantidad <= 12 ? 3 : 4
    const filas = Math.ceil(cantidad / columnas)
    return {
        columnas, filas,
        anchoChip: (anchoDisponible - separacion * (columnas - 1)) / columnas,
        altoChip: Math.max(1, Math.min((altoDisponible - separacion * (filas - 1)) / filas, 132)),
    }
}

function round(ctx, x, y, w, h, r) {
    ctx.beginPath()
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, r)
    else {
        ctx.moveTo(x + r, y)
        ctx.arcTo(x + w, y, x + w, y + h, r)
        ctx.arcTo(x + w, y + h, x, y + h, r)
        ctx.arcTo(x, y + h, x, y, r)
        ctx.arcTo(x, y, x + w, y, r)
        ctx.closePath()
    }
}

function lines(ctx, value, maxWidth, maxLines) {
    const words = String(value).split(/\s+/)
    const out = []
    let line = ''
    for (const word of words) {
        const next = line ? `${line} ${word}` : word
        if (line && ctx.measureText(next).width > maxWidth) {
            out.push(line)
            line = word
            if (out.length === maxLines - 1) break
        } else line = next
    }
    if (out.length < maxLines) {
        const rest = words.slice(out.join(' ').split(/\s+/).filter(Boolean).length).join(' ')
        let last = rest || line
        while (ctx.measureText(last).width > maxWidth && last.length > 1) last = `${last.slice(0, -2)}…`
        out.push(last)
    }
    return out
}

/** A phone silhouette adds energy to the header without showing fake bookings. */
function phone(ctx, W, color) {
    ctx.save()
    ctx.translate(W * .88, 310)
    ctx.rotate(.25)
    ctx.shadowColor = '#1a0d21aa'
    ctx.shadowBlur = 42
    ctx.shadowOffsetY = 20
    ctx.fillStyle = '#1c1123'
    round(ctx, -184, -300, 368, 620, 51)
    ctx.fill()
    ctx.shadowColor = 'transparent'
    ctx.fillStyle = '#fff7fb'
    round(ctx, -170, -286, 340, 592, 42)
    ctx.fill()
    ctx.fillStyle = '#1c1123'
    round(ctx, -44, -276, 88, 15, 8)
    ctx.fill()
    ctx.fillStyle = color
    ctx.font = '800 28px sans-serif'
    ctx.fillText('GLOWUP', -130, -210)
    ctx.fillStyle = '#322038'
    ctx.font = '800 31px sans-serif'
    ctx.fillText('Tu agenda', -130, -146)
    for (let i = 0; i < 4; i++) {
        ctx.fillStyle = i === 0 ? '#ffe2ef' : '#f4edf3'
        round(ctx, -132, -105 + i * 94, 265, 72, 20)
        ctx.fill()
        ctx.fillStyle = i === 0 ? color : '#ccb9ca'
        round(ctx, -112, -88 + i * 94, 38, 38, 12)
        ctx.fill()
        ctx.fillStyle = '#b7a5b7'
        round(ctx, -60, -84 + i * 94, 118, 9, 5)
        ctx.fill()
        round(ctx, -60, -63 + i * 94, 83, 7, 4)
        ctx.fill()
    }
    ctx.restore()
}

/** Exportación editorial centrada en la marca del negocio y turnos reservables. */
export function dibujarFlyer(ctx, datos, formato, fuentes) {
    const { ancho: W, alto: H } = formato
    const {
        nombreNegocio = 'Mi negocio', fechaTexto = '', horarios = [], enlace = '',
        esHoy = true, actualizado = '', qrCanvas, coverImage,
        colorPrimario = '#FF2E8E', colorSecundario = '#6E2BFF',
    } = datos
    const libre = horarios.filter(h => h.available).slice(0, 12)
    const display = fuentes?.display || 'sans-serif'
    const cuerpo = fuentes?.cuerpo || 'sans-serif'
    const margin = 82
    const ink = '#221426'

    ctx.clearRect(0, 0, W, H)
    const bg = ctx.createLinearGradient(0, 0, W, H)
    bg.addColorStop(0, mezclar(colorPrimario, '#1A1022', 0.16))
    bg.addColorStop(1, mezclar(colorSecundario, '#1A1022', 0.52))
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, W, H)
    if (coverImage) {
        const scale = Math.max(W / coverImage.width, H / coverImage.height)
        const sourceWidth = W / scale
        const sourceHeight = H / scale
        ctx.save()
        ctx.globalAlpha = 0.23
        ctx.filter = 'blur(32px)'
        ctx.drawImage(
            coverImage,
            (coverImage.width - sourceWidth) / 2,
            (coverImage.height - sourceHeight) / 2,
            sourceWidth,
            sourceHeight,
            -35, -35, W + 70, H + 70,
        )
        ctx.restore()
    }
    ctx.fillStyle = 'rgba(255,255,255,.08)'
    ctx.beginPath()
    ctx.arc(W * .93, H * .08, 360, 0, Math.PI * 2)
    ctx.fill()
    phone(ctx, W, colorPrimario)

    let y = 132
    ctx.fillStyle = '#fff'
    ctx.font = `800 32px ${cuerpo}`
    ctx.fillText(esHoy ? 'HOY HAY TURNOS' : 'TURNOS DISPONIBLES', margin, y)
    y += 116
    ctx.font = `800 88px ${display}`
    const nameLines = lines(ctx, nombreNegocio, W * .62, 2)
    nameLines.forEach((line, i) => ctx.fillText(line, margin, y + i * 90))
    y += nameLines.length * 90 + 24
    ctx.font = `600 44px ${cuerpo}`
    ctx.fillStyle = 'rgba(255,255,255,.88)'
    ctx.fillText(fechaTexto.charAt(0).toUpperCase() + fechaTexto.slice(1), margin, y)

    const cardY = Math.max(y + 48, formato.id === 'historia' ? 650 : 505)
    const columns = libre.length <= 4 ? Math.max(1, libre.length) : 3
    const rows = Math.ceil(Math.max(1, libre.length) / columns)
    const cardBottom = formato.id === 'historia'
        ? Math.min(H - 330, cardY + 228 + rows * 132 + (rows - 1) * 18 + 100)
        : H - 235
    ctx.fillStyle = '#fff'
    round(ctx, margin, cardY, W - 2 * margin, cardBottom - cardY, 46)
    ctx.fill()

    let inside = cardY + 84
    ctx.fillStyle = colorPrimario
    ctx.font = `800 27px ${cuerpo}`
    ctx.fillText(`${libre.length} ${libre.length === 1 ? 'LUGAR LIBRE' : 'LUGARES LIBRES'}`, margin + 58, inside)
    inside += 63
    ctx.fillStyle = ink
    ctx.font = `800 59px ${display}`
    ctx.fillText('Horarios libres', margin + 58, inside)
    inside += 81

    if (!libre.length) {
        ctx.fillStyle = '#675A6B'
        ctx.font = `600 38px ${cuerpo}`
        ctx.fillText('Sin horarios libres para esta selección.', margin + 58, inside + 20)
    } else {
        const availableHeight = Math.max(80, cardBottom - inside - 85)
        const grid = calcularGrilla(libre.length, W - 2 * margin - 116, availableHeight, 18)
        libre.forEach((slot, index) => {
            const x = margin + 58 + (index % grid.columnas) * (grid.anchoChip + 18)
            const yy = inside + Math.floor(index / grid.columnas) * (grid.altoChip + 18)
            ctx.fillStyle = mezclar(colorPrimario, '#FFFFFF', .89)
            round(ctx, x, yy, grid.anchoChip, grid.altoChip, 24)
            ctx.fill()
            ctx.fillStyle = ink
            ctx.font = `800 ${Math.min(43, grid.altoChip * .42)}px ${cuerpo}`
            ctx.textAlign = 'center'
            ctx.textBaseline = 'middle'
            ctx.fillText(slot.time.slice(0, 5), x + grid.anchoChip / 2, yy + grid.altoChip / 2)
            ctx.textAlign = 'left'
            ctx.textBaseline = 'alphabetic'
        })
    }

    if (actualizado) {
        ctx.fillStyle = '#827888'
        ctx.font = `500 25px ${cuerpo}`
        ctx.fillText(`Actualizado ${actualizado} · Sujeto a disponibilidad`, margin + 58, cardBottom - 45)
    }
    const footerY = H - (formato.id === 'historia' ? 200 : 160)
    ctx.fillStyle = '#fff'
    ctx.font = `800 41px ${display}`
    ctx.fillText('Reservá tu turno  ↗', margin, footerY)
    ctx.font = `600 26px ${cuerpo}`
    const short = enlace.replace(/^https?:\/\//, '')
    ctx.fillText(short.length > 44 ? short.slice(0, 41) + '…' : short, margin, footerY + 46)
    if (qrCanvas) {
        ctx.fillStyle = '#fff'
        round(ctx, W - margin - 154, footerY - 75, 154, 154, 16)
        ctx.fill()
        ctx.drawImage(qrCanvas, W - margin - 144, footerY - 65, 134, 134)
    }
    ctx.fillStyle = 'rgba(255,255,255,.72)'
    ctx.font = `600 23px ${cuerpo}`
    ctx.fillText('GLOWUP', margin, H - 54)
}
