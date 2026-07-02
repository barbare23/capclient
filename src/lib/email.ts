export const FROM_EMAIL = import.meta.env.VITE_DEFAULT_FROM_EMAIL || 'noreply@capclient.fr'
export const FROM_NAME = import.meta.env.VITE_DEFAULT_FROM_NAME || 'CapClient'
export const DEFAULT_FROM = `${FROM_NAME} <${FROM_EMAIL}>`
