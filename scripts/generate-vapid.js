// SCRIPT UTILITARIO PARA GENERAR LLAVES VAPID PARA NOTIFICACIONES WEB PUSH
// Ejecutar con: node scripts/generate-vapid.js

const webpush = require('web-push');

console.log('Generating VAPID keys for GLOWUP Web Push Notifications...\n');

try {
    const vapidKeys = webpush.generateVAPIDKeys();

    console.log('========================================================================');
    console.log('🔑 LLAVES VAPID GENERADAS CON ÉXITO');
    console.log('========================================================================\n');
    console.log('Copia e inserta estas variables en tu archivo .env.local de desarrollo');
    console.log('y en las variables de entorno de producción de Vercel:\n');
    console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY="${vapidKeys.publicKey}"`);
    console.log(`VAPID_PRIVATE_KEY="${vapidKeys.privateKey}"`);
    console.log('VAPID_SUBJECT="mailto:soporte@glowup.com"\n');
    console.log('========================================================================');
    console.log('⚠️ IMPORTANTE: No compartas tu VAPID_PRIVATE_KEY públicamente.');
    console.log('========================================================================');
} catch (error) {
    console.error('Error generating VAPID keys:', error);
}
