export function distanceKm(aLat, aLng, bLat, bLng) {
    const r = Math.PI / 180
    const dLat = (bLat - aLat) * r
    const dLng = (bLng - aLng) * r
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * r) * Math.cos(bLat * r) * Math.sin(dLng / 2) ** 2
    return Math.round(6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)) * 10) / 10
}

export function rankMatches(matches, zone = '') {
    const normalized = zone.trim().toLocaleLowerCase('es-AR')
    return [...matches].sort((a, b) => {
        const aZone = normalized && a.address.toLocaleLowerCase('es-AR').includes(normalized) ? 0 : 1
        const bZone = normalized && b.address.toLocaleLowerCase('es-AR').includes(normalized) ? 0 : 1
        return aZone - bZone || a.dayOffset - b.dayOffset ||
            (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity) || a.time.localeCompare(b.time)
    })
}
