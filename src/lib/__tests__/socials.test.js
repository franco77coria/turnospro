import { describe, it, expect } from 'vitest'
import { normalizeSocial, resolveSocialLinks, serializeSocials } from '../socials.js'

describe('socials', () => {
    describe('normalizeSocial', () => {
        it('acepta el usuario con y sin arroba', () => {
            expect(normalizeSocial('instagram', '@barone.barber').url).toBe('https://instagram.com/barone.barber')
            expect(normalizeSocial('instagram', 'barone.barber').url).toBe('https://instagram.com/barone.barber')
        })

        it('acepta el link completo del perfil, con o sin protocolo', () => {
            expect(normalizeSocial('instagram', 'https://www.instagram.com/barone.barber/').url)
                .toBe('https://instagram.com/barone.barber')
            expect(normalizeSocial('instagram', 'instagram.com/barone.barber').url)
                .toBe('https://instagram.com/barone.barber')
        })

        it('descarta los parámetros de tracking que trae el link al compartir', () => {
            expect(normalizeSocial('instagram', 'https://instagram.com/barone.barber?igshid=abc123').handle)
                .toBe('barone.barber')
        })

        it('TikTok lleva la arroba dentro de la ruta', () => {
            expect(normalizeSocial('tiktok', '@barone').url).toBe('https://tiktok.com/@barone')
            expect(normalizeSocial('tiktok', 'https://www.tiktok.com/@barone').url).toBe('https://tiktok.com/@barone')
        })

        it('rechaza un link de otra red pegado en el campo equivocado', () => {
            expect(normalizeSocial('instagram', 'https://facebook.com/barone')).toBeNull()
            expect(normalizeSocial('tiktok', 'https://instagram.com/barone')).toBeNull()
        })

        it('rechaza vacío, espacios y caracteres inválidos', () => {
            expect(normalizeSocial('instagram', '')).toBeNull()
            expect(normalizeSocial('instagram', '   ')).toBeNull()
            expect(normalizeSocial('instagram', 'con espacio')).toBeNull()
            expect(normalizeSocial('instagram', 'javascript:alert(1)')).toBeNull()
        })

        it('rechaza una red desconocida', () => {
            expect(normalizeSocial('twitter', 'barone')).toBeNull()
        })
    })

    describe('resolveSocialLinks', () => {
        it('devuelve solo las cargadas, en orden fijo', () => {
            const links = resolveSocialLinks({ socials: { facebook: 'barone', instagram: '@barone' } })
            expect(links.map(l => l.id)).toEqual(['instagram', 'facebook'])
        })

        it('un negocio sin redes no rompe', () => {
            expect(resolveSocialLinks({})).toEqual([])
            expect(resolveSocialLinks(null)).toEqual([])
        })
    })

    describe('serializeSocials', () => {
        it('guarda el usuario limpio, no lo que se pegó', () => {
            const { socials, invalid } = serializeSocials({
                instagram: 'https://www.instagram.com/barone.barber/?hl=es',
            })
            expect(socials).toEqual({ instagram: 'barone.barber' })
            expect(invalid).toEqual([])
        })

        it('reporta lo que no se entiende en vez de guardar basura', () => {
            const { socials, invalid } = serializeSocials({ instagram: 'no es un usuario', tiktok: '@ok' })
            expect(socials).toEqual({ tiktok: 'ok' })
            expect(invalid).toEqual(['Instagram'])
        })

        it('un campo vacío no se guarda ni se reporta como error', () => {
            const { socials, invalid } = serializeSocials({ instagram: '', facebook: '   ' })
            expect(socials).toEqual({})
            expect(invalid).toEqual([])
        })
    })
})
