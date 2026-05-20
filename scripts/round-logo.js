// SCRIPT PARA REDONDEAR LAS IMÁGENES DEL LOGO Y EL ICONO A UN CÍRCULO PERFECTO CON ESQUINAS TRANSPARENTES
// Ejecutar con: node scripts/round-logo.js

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function roundImage(srcName, destName) {
    const srcPath = path.join(__dirname, '..', srcName);
    const destPath = path.join(__dirname, '..', destName);

    console.log(`Processing ${srcName} -> ${destName}...`);

    try {
        // Leer a un Buffer para evitar bloqueo de lectura del descriptor de archivo
        const inputBuffer = fs.readFileSync(srcPath);
        
        const image = sharp(inputBuffer);
        const metadata = await image.metadata();
        const { width, height } = metadata;

        const size = Math.min(width, height);
        const r = size / 2;

        // Crear una máscara circular SVG del mismo tamaño que la imagen
        const circleSvg = Buffer.from(
            `<svg width="${width}" height="${height}">
                <circle cx="${width / 2}" cy="${height / 2}" r="${r}" fill="black" />
             </svg>`
        );

        // Recortar la imagen usando la máscara circular con blend mode 'dest-in'
        const outputBuffer = await sharp(inputBuffer)
            .composite([{
                input: circleSvg,
                blend: 'dest-in'
            }])
            .png()
            .toBuffer();

        // Escribir directamente sobre el destino
        fs.writeFileSync(destPath, outputBuffer);
        console.log(`✅ Success: ${destName} is now rounded with transparent corners.`);
    } catch (err) {
        console.error(`❌ Error processing ${srcName}:`, err);
    }
}

async function run() {
    await roundImage('src/app/icon.png', 'src/app/icon.png');
    await roundImage('public/logo.png', 'public/logo.png');
    console.log('\nAll logos processed successfully!');
}

run();
