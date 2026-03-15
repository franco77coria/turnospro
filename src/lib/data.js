// Business type templates with predefined roles and services
export const BUSINESS_TEMPLATES = {
    barberia: {
        name: 'Barbería',
        roles: ['Dueño', 'Admin', 'Barbero', 'Recepcionista'],
        services: [
            { name: 'Corte Clásico', price: 2500, duration: 30 },
            { name: 'Corte + Barba', price: 4000, duration: 50 },
            { name: 'Barba', price: 2000, duration: 20 },
            { name: 'Perfilado de Barba', price: 1800, duration: 15 },
            { name: 'Cejas', price: 800, duration: 10 },
            { name: 'Color', price: 5000, duration: 60 },
        ]
    },
    peluqueria: {
        name: 'Peluquería',
        roles: ['Dueño', 'Admin', 'Peluquero/a', 'Colorista', 'Recepcionista'],
        services: [
            { name: 'Corte de Pelo', price: 3000, duration: 40 },
            { name: 'Brushing', price: 2500, duration: 30 },
            { name: 'Color Completo', price: 6500, duration: 90 },
            { name: 'Mechas/Reflejos', price: 8000, duration: 120 },
            { name: 'Tratamiento Capilar', price: 3500, duration: 45 },
            { name: 'Alisado', price: 12000, duration: 180 },
        ]
    },
    unas: {
        name: 'Salón de Uñas',
        roles: ['Dueño', 'Admin', 'Manicurista', 'Pedicurista', 'Nail Artist'],
        services: [
            { name: 'Manicura Simple', price: 2000, duration: 30 },
            { name: 'Manicura Semipermanente', price: 4000, duration: 45 },
            { name: 'Esculpidas', price: 7000, duration: 90 },
            { name: 'Pedicura Simple', price: 2500, duration: 40 },
            { name: 'Pedicura Completa', price: 4500, duration: 60 },
            { name: 'Nail Art', price: 1500, duration: 20 },
        ]
    },
    lash: {
        name: 'Lash & Cejas',
        roles: ['Dueño', 'Admin', 'Lashista', 'Diseñadora de Cejas'],
        services: [
            { name: 'Lifting de Pestañas', price: 5000, duration: 60 },
            { name: 'Extensiones Pelo a Pelo', price: 8000, duration: 120 },
            { name: 'Extensiones Volumen', price: 10000, duration: 150 },
            { name: 'Diseño de Cejas', price: 2000, duration: 30 },
            { name: 'Laminado de Cejas', price: 4000, duration: 45 },
            { name: 'Tinte de Cejas', price: 1500, duration: 20 },
        ]
    },
    spa: {
        name: 'Spa & Estética',
        roles: ['Dueño', 'Admin', 'Masajista', 'Esteticista', 'Cosmetóloga', 'Recepcionista'],
        services: [
            { name: 'Masaje Relajante', price: 5000, duration: 60 },
            { name: 'Masaje Descontracturante', price: 6000, duration: 60 },
            { name: 'Limpieza Facial', price: 4000, duration: 45 },
            { name: 'Tratamiento Anti-Age', price: 7000, duration: 60 },
            { name: 'Depilación Láser', price: 3500, duration: 30 },
            { name: 'Drenaje Linfático', price: 5500, duration: 60 },
        ]
    },
    consultorio: {
        name: 'Consultorio',
        roles: ['Dueño', 'Admin', 'Profesional', 'Secretaria'],
        services: [
            { name: 'Consulta General', price: 5000, duration: 30 },
            { name: 'Control', price: 3000, duration: 20 },
            { name: 'Estudios', price: 8000, duration: 45 },
            { name: 'Tratamiento', price: 6000, duration: 40 },
        ]
    },
    veterinaria: {
        name: 'Veterinaria',
        roles: ['Dueño', 'Admin', 'Veterinario', 'Asistente', 'Peluquero Canino'],
        services: [
            { name: 'Consulta', price: 4000, duration: 30 },
            { name: 'Vacunación', price: 3000, duration: 15 },
            { name: 'Baño y Corte', price: 5000, duration: 60 },
            { name: 'Desparasitación', price: 2500, duration: 15 },
            { name: 'Cirugía Menor', price: 15000, duration: 120 },
        ]
    },
    custom: {
        name: 'Personalizado',
        roles: ['Dueño', 'Admin', 'Profesional', 'Recepcionista'],
        services: [
            { name: 'Servicio 1', price: 3000, duration: 30 },
            { name: 'Servicio 2', price: 5000, duration: 60 },
        ]
    }
}

// Role permissions
export const PERMISSIONS = {
    VIEW_APPOINTMENTS: 'view_appointments',
    CREATE_APPOINTMENTS: 'create_appointments',
    CANCEL_APPOINTMENTS: 'cancel_appointments',
    VIEW_CLIENTS: 'view_clients',
    EDIT_CLIENTS: 'edit_clients',
    VIEW_FINANCE: 'view_finance',
    MANAGE_CASH: 'manage_cash',
    VIEW_REPORTS: 'view_reports',
    MANAGE_TEAM: 'manage_team',
    EDIT_SERVICES: 'edit_services',
    EDIT_SETTINGS: 'edit_settings',
    MANAGE_MARKETING: 'manage_marketing',
    MANAGE_INVENTORY: 'manage_inventory',
}

export const ROLE_PERMISSIONS = {
    'Dueño': Object.values(PERMISSIONS),
    'Admin': Object.values(PERMISSIONS),
    'Profesional': [PERMISSIONS.VIEW_APPOINTMENTS, PERMISSIONS.CREATE_APPOINTMENTS, PERMISSIONS.VIEW_CLIENTS, PERMISSIONS.VIEW_FINANCE],
    'Recepcionista': [PERMISSIONS.VIEW_APPOINTMENTS, PERMISSIONS.CREATE_APPOINTMENTS, PERMISSIONS.CANCEL_APPOINTMENTS, PERMISSIONS.VIEW_CLIENTS, PERMISSIONS.EDIT_CLIENTS, PERMISSIONS.MANAGE_CASH],
}

export function getRolePermissions(roleName) {
    if (ROLE_PERMISSIONS[roleName]) return ROLE_PERMISSIONS[roleName]
    return ROLE_PERMISSIONS['Profesional']
}

export const PAYMENT_METHODS = [
    { id: 'cash', name: 'Efectivo' },
    { id: 'transfer', name: 'Transferencia' },
    { id: 'debit', name: 'Tarjeta Débito' },
    { id: 'credit', name: 'Tarjeta Crédito' },
    { id: 'mercadopago', name: 'MercadoPago' },
]

export const EXPENSE_CATEGORIES = [
    { id: 'products', name: 'Productos' },
    { id: 'cleaning', name: 'Limpieza' },
    { id: 'rent', name: 'Alquiler' },
    { id: 'utilities', name: 'Servicios' },
    { id: 'salary', name: 'Sueldos' },
    { id: 'other', name: 'Otros' },
]

export const APPOINTMENT_STATUS = {
    PENDING: { id: 'pending', label: 'Pendiente', color: 'warning' },
    CONFIRMED: { id: 'confirmed', label: 'Confirmado', color: 'accent' },
    COMPLETED: { id: 'completed', label: 'Completado', color: 'success' },
    CANCELLED: { id: 'cancelled', label: 'Cancelado', color: 'danger' },
    NO_SHOW: { id: 'no_show', label: 'No asistió', color: 'neutral' },
}
