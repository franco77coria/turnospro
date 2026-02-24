// Sample data for each business type (rubro) for demo preview mode

export const RUBRO_DEMOS = {
    barberia: {
        name: 'Barbería El Patrón',
        type: 'barberia',
        services: [
            { name: 'Corte Clásico', price: 3500, duration: 30 },
            { name: 'Corte + Barba', price: 5000, duration: 45 },
            { name: 'Barba', price: 2000, duration: 20 },
            { name: 'Corte Niño', price: 2500, duration: 25 },
            { name: 'Fade Premium', price: 4500, duration: 40 },
        ],
        team: [
            { name: 'Martín López', role: 'Barbero Senior', active: true },
            { name: 'Lucas Gómez', role: 'Barbero', active: true },
            { name: 'Diego Fernández', role: 'Aprendiz', active: true },
        ],
        clients: [
            { name: 'Juan Pérez', email: 'juan@email.com', phone: '+54 11 5555-0001', visits: 12 },
            { name: 'Carlos Rodríguez', email: 'carlos@email.com', phone: '+54 11 5555-0002', visits: 8 },
            { name: 'Andrés Martínez', email: 'andres@email.com', phone: '+54 11 5555-0003', visits: 5 },
        ],
        appointments: [
            { client: 'Juan Pérez', service: 'Corte + Barba', time: '10:00', professional: 'Martín López', status: 'confirmed' },
            { client: 'Carlos Rodríguez', service: 'Fade Premium', time: '11:00', professional: 'Lucas Gómez', status: 'confirmed' },
            { client: 'Andrés Martínez', service: 'Barba', time: '14:30', professional: 'Martín López', status: 'pending' },
        ],
        stats: { turnos: 28, ingresos: 145000, clientes: 42 },
    },

    peluqueria: {
        name: 'Peluquería Belle',
        type: 'peluqueria',
        services: [
            { name: 'Corte de Pelo', price: 5000, duration: 45 },
            { name: 'Brushing', price: 3500, duration: 30 },
            { name: 'Color Completo', price: 12000, duration: 120 },
            { name: 'Mechas / Balayage', price: 15000, duration: 150 },
            { name: 'Tratamiento Keratina', price: 18000, duration: 90 },
        ],
        team: [
            { name: 'Valentina Ruiz', role: 'Estilista Senior', active: true },
            { name: 'Camila Torres', role: 'Colorista', active: true },
            { name: 'Sofía Díaz', role: 'Estilista', active: true },
        ],
        clients: [
            { name: 'María García', email: 'maria@email.com', phone: '+54 11 5555-1001', visits: 15 },
            { name: 'Laura Sánchez', email: 'laura@email.com', phone: '+54 11 5555-1002', visits: 9 },
        ],
        appointments: [
            { client: 'María García', service: 'Color Completo', time: '09:00', professional: 'Camila Torres', status: 'confirmed' },
            { client: 'Laura Sánchez', service: 'Corte + Brushing', time: '11:30', professional: 'Valentina Ruiz', status: 'confirmed' },
        ],
        stats: { turnos: 35, ingresos: 320000, clientes: 68 },
    },

    unas: {
        name: 'Nail Studio Pink',
        type: 'unas',
        services: [
            { name: 'Manicura Semipermanente', price: 6000, duration: 60 },
            { name: 'Uñas Esculpidas', price: 10000, duration: 90 },
            { name: 'Pedicura Spa', price: 5000, duration: 45 },
            { name: 'Nail Art', price: 3000, duration: 30 },
            { name: 'Retiro + Esmaltado', price: 4000, duration: 40 },
        ],
        team: [
            { name: 'Ana Belén', role: 'Nail Artist', active: true },
            { name: 'Florencia Paz', role: 'Manicurista', active: true },
        ],
        clients: [
            { name: 'Carolina López', email: 'caro@email.com', phone: '+54 11 5555-2001', visits: 20 },
        ],
        appointments: [
            { client: 'Carolina López', service: 'Uñas Esculpidas', time: '10:00', professional: 'Ana Belén', status: 'confirmed' },
        ],
        stats: { turnos: 22, ingresos: 180000, clientes: 38 },
    },

    spa: {
        name: 'Spa Serenity',
        type: 'spa',
        services: [
            { name: 'Masaje Relajante', price: 8000, duration: 60 },
            { name: 'Limpieza Facial Profunda', price: 7000, duration: 75 },
            { name: 'Depilación Completa', price: 12000, duration: 90 },
            { name: 'Circuito Spa', price: 15000, duration: 120 },
            { name: 'Tratamiento Antiage', price: 10000, duration: 60 },
        ],
        team: [
            { name: 'Milagros Vega', role: 'Cosmetóloga', active: true },
            { name: 'Rocío Herrera', role: 'Masajista', active: true },
        ],
        clients: [
            { name: 'Patricia Morales', email: 'pato@email.com', phone: '+54 11 5555-3001', visits: 6 },
        ],
        appointments: [
            { client: 'Patricia Morales', service: 'Circuito Spa', time: '15:00', professional: 'Rocío Herrera', status: 'confirmed' },
        ],
        stats: { turnos: 18, ingresos: 250000, clientes: 55 },
    },

    consultorio: {
        name: 'Consultorio Dr. Méndez',
        type: 'consultorio',
        services: [
            { name: 'Consulta General', price: 8000, duration: 30 },
            { name: 'Control de Rutina', price: 5000, duration: 20 },
            { name: 'Electrocardiograma', price: 6000, duration: 15 },
            { name: 'Consulta Especializada', price: 12000, duration: 45 },
        ],
        team: [
            { name: 'Dr. Ricardo Méndez', role: 'Médico', active: true },
            { name: 'Lic. Ana Suárez', role: 'Enfermera', active: true },
        ],
        clients: [
            { name: 'Roberto Silva', email: 'roberto@email.com', phone: '+54 11 5555-4001', visits: 4 },
        ],
        appointments: [
            { client: 'Roberto Silva', service: 'Consulta General', time: '09:30', professional: 'Dr. Ricardo Méndez', status: 'confirmed' },
        ],
        stats: { turnos: 40, ingresos: 450000, clientes: 120 },
    },

    veterinaria: {
        name: 'Veterinaria Huellitas',
        type: 'veterinaria',
        services: [
            { name: 'Consulta General', price: 5000, duration: 30 },
            { name: 'Vacunación', price: 4000, duration: 15 },
            { name: 'Castración', price: 15000, duration: 120 },
            { name: 'Baño y Peluquería', price: 6000, duration: 60 },
        ],
        team: [
            { name: 'Dra. Marina Paz', role: 'Veterinaria', active: true },
            { name: 'Tomás Ruiz', role: 'Asistente', active: true },
        ],
        clients: [
            { name: 'Elena Castro (Luna)', email: 'elena@email.com', phone: '+54 11 5555-5001', visits: 7 },
        ],
        appointments: [
            { client: 'Elena Castro (Luna)', service: 'Vacunación', time: '16:00', professional: 'Dra. Marina Paz', status: 'confirmed' },
        ],
        stats: { turnos: 25, ingresos: 200000, clientes: 85 },
    },

    lash: {
        name: 'Lash & Brow Studio',
        type: 'lash',
        services: [
            { name: 'Extensiones Clásicas', price: 8000, duration: 90 },
            { name: 'Extensiones Volumen', price: 12000, duration: 120 },
            { name: 'Laminado de Cejas', price: 5000, duration: 45 },
            { name: 'Lifting de Pestañas', price: 6000, duration: 60 },
        ],
        team: [
            { name: 'Julieta Moreno', role: 'Lash Artist', active: true },
        ],
        clients: [
            { name: 'Daniela Ortiz', email: 'dani@email.com', phone: '+54 11 5555-6001', visits: 10 },
        ],
        appointments: [
            { client: 'Daniela Ortiz', service: 'Extensiones Volumen', time: '11:00', professional: 'Julieta Moreno', status: 'confirmed' },
        ],
        stats: { turnos: 15, ingresos: 160000, clientes: 30 },
    },
}

export const RUBRO_LIST = [
    { key: 'barberia', label: 'Barbería' },
    { key: 'peluqueria', label: 'Peluquería' },
    { key: 'unas', label: 'Uñas' },
    { key: 'lash', label: 'Lash & Cejas' },
    { key: 'spa', label: 'Spa & Estética' },
    { key: 'consultorio', label: 'Consultorio' },
    { key: 'veterinaria', label: 'Veterinaria' },
]
