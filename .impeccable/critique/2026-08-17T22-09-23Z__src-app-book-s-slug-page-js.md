---
target: ficha pública del negocio
total_score: 13
max_score: 36
na_heuristics: 9
p0_count: 2
p1_count: 2
timestamp: 2026-08-17T22-09-23Z
slug: src-app-book-s-slug-page-js
---
Method: dual-agent (A: revisión de diseño · B: detector + evidencia medida)

## Design Health Score

| # | Heurística | Puntaje | Problema clave |
|---|-----------|-------|-----------|
| 1 | Visibilidad del estado | 1 | No dice si está abierto ahora, ni el próximo turno libre, ni que "Reservar" abre un formulario de 4 pasos |
| 2 | Correspondencia con el mundo real | 3 | Buen es-AR, pero "20:45" es un artefacto de la grilla de slots impreso como hora de cierre |
| 3 | Control y libertad | 2 | El wizard no tiene vuelta a la ficha: `ServiceStep` no recibe `onBack` y no hay ninguna referencia a `/book/s/` |
| 4 | Consistencia | 2 | Dos lenguajes visuales en un flujo; h1 cae de 32px a 20px al cruzar. Precio: `12.000` en la ficha, `12,000` en el wizard |
| 5 | Prevención de errores | 1 | Un negocio sin horarios configurados publica un horario **inventado** (09:00–20:00, lun–sáb) al lado del botón de reservar |
| 6 | Reconocer en vez de recordar | 1 | El servicio elegido se descarta al cruzar al wizard; hay que volver a elegirlo |
| 7 | Flexibilidad y eficiencia | 1 | Sin compartir, sin WhatsApp, sin cómo llegar, sin filtro de servicios |
| 8 | Estética y minimalismo | 1 | 27% del alto es una tabla que repite un string seis veces; 21–27% del primer viewport es un degradado sin contenido |
| 9 | Recuperación de errores | n/a | Superficie estática de persuasión, con una sola rama (`notFound()`). No hay input ni estados de falla |
| 10 | Ayuda y documentación | 1 | Sin política de cancelación, sin seña, sin medios de pago, sin "cómo funciona" |
| **Total** | | **13/36 (36%)** | **Pobre** |

## Design Specificity Verdict

**Evaluación de diseño:** es una plantilla genérica de directorio con una variable de acento rosa. Cambiando `--pink` por `--blue` y "Reservar turno" por "Book now", la misma página sirve para un consultorio odontológico o un plomero. Nada de la composición está autorizado para peluquería/barbería, y nada para Argentina.

Las decisiones que leen como default de plantilla:
- El hero es un degradado decorativo, no contenido. `.coverFallback` pinta el hueco en vez de rediseñar alrededor de la ausencia.
- Tres elementos distintos (`.avatar`, `.teamAvatar`, `.coverFallback`) resuelven al mismo `linear-gradient(135deg, var(--pink), var(--violet))`. Ese degradado hace todo el trabajo de identidad, y es el default más usado en UI generada por IA.
- La arquitectura de información es la de un directorio (Yelp/Google Business), no la de un salón. Una página de grooming persuade con **trabajo** — el corte, las uñas, el color — y eso no tiene lugar privilegiado acá.
- Una sola superficie: `.serviceList`, `.hoursList`, `.teamCard`, `.reviewCard` comparten idéntico fondo, borde y radio. Cero contraste editorial. `--pink-tint`, `--violet-tint` y `--cream-2` están definidos y se usan cero veces.
- Cero movimiento. Las únicas transiciones son color de hover y `translateY(-2px)`. `--ease-spring`, `--t-slow` y `--shadow-violet` están definidos y sin usar. El wizard de reserva sí tiene animación de entrada; la ficha, que es la superficie de persuasión, no. "Sin vida" es literalmente cierto a nivel CSS.
- Ningún signo argentino: sin `wa.me`, sin Instagram, sin compartir. Solo un `tel:`, que nadie usa para reservar un corte.

**Escaneo determinístico:** el detector devolvió 0 hallazgos, exit 0, en los tres `.js` y en los tres `.module.css` (corrida corregida — la primera pasada fue vacua porque los `.js` no contienen CSS). Es un limpio real pero angosto: significa que no hay fuentes sobreusadas, glow oscuro ni gradientes de plantilla detectables por regla. No mide composición, jerarquía ni vacío. El detector además se auto-reporta DEGRADED sobre HTML por módulos de parseo ausentes.

**Overlays visuales:** no hay. La captura falló con `the Browser pane is not displayed, so the page is not compositing frames`. La inyección de JS **sí** funcionó, así que toda la geometría y todos los colores computados de abajo salen de `getBoundingClientRect()` y `getComputedStyle()` sobre el DOM vivo, no de una imagen.

## Overall Impression

La página no está mal diseñada: está **vacía por arquitectura**. Se compuso alrededor de una foto de portada que la mayoría de los dueños nunca va a subir, y de secciones (galería, equipo, reseñas) que un negocio nuevo no tiene. Con los datos reales de Barone, la mitad del diseño desaparece en silencio y queda un degradado, un nombre y una tabla.

El número que resume la queja: **la tabla de horarios ocupa 362px, el 27% del alto de la página, y repite `10:00 – 20:45` seis veces.** Es el bloque más grande. Los servicios, que son la decisión, ocupan 260px.

La oportunidad más grande es que el producto genera gratis la prueba que a la página le falta: **disponibilidad en vivo**. "3 turnos libres hoy · el próximo a las 15:30" es más persuasivo que cuatro estrellas de desconocidos, ya está calculado en `lib/scheduling.js`, y nunca está vacío.

## What's Working

1. **`groupByCategory` es criterio de producto real.** El guard `worthGrouping` codifica que los dueños argentinos escriben `CORTE` y `CORTE,BARBA` como etiquetas, no como taxonomía, y se niega a renderizar dos encabezados que repiten el único servicio debajo. Casi cualquier código renderiza los dos grupos inútiles.
2. **La base de SEO y compartibilidad es arquitectónicamente correcta.** Server-rendered, `generateMetadata` con OG image, subtipo `BarberShop` tipado, y un `JsonLd` cuyo `safeStringify` escapa `<`, `>`, `&` y U+2028/29 para que un nombre con `</script>` no rompa. Para un link cuya vida entera es pegarse en WhatsApp e Instagram, es la decisión correcta.
3. **`.stickyCta` muestra el nivel de cuidado que le falta al resto.** `padding-bottom: calc(12px + env(safe-area-inset-bottom))` respeta el home indicator del iPhone, y `.page { padding-bottom: 96px }` reserva el espacio. Verificado en vivo: barra en y=744, footer en y=1319, sin superposición. Alguien pensó mucho un componente; el problema es que fue uno solo.
4. **Las tres variantes de `PhotoGallery`** (`single` 16:7 / `double` / `mosaic`) prueban que el equipo sabe diseñar para datos escasos. Aplicaron ese instinto a nivel componente y no a nivel página.

## Priority Issues

### [P0] El hero son 280px de degradado sin contenido, y es lo primero que ve el 100% de los visitantes

**Qué.** `.hero` mide 280px en escritorio y 200px en mobile. Sin `cover_image_url` renderiza `.coverFallback`, un degradado plano rosa→violeta. Medido: 21% del alto total en escritorio, **27% del primer viewport en mobile**. Cero caracteres de información.

**Por qué importa.** Es la única oportunidad de primera impresión, es la queja del cliente en su forma más pura, y es el estado **normal** de todo cliente nuevo. El layout está armado alrededor de una foto que la mayoría nunca va a subir, así que degrada a un placeholder en vez de degradar a otro diseño.

**Fix.** Dejar de tratar la foto ausente como un hueco que tapar, y hacer que el hero sin foto sea el diseño **primario**. Llenar esos 280px con lo que todo negocio siempre tiene, en tipografía de display real: rubro + zona, el nombre en `clamp(44px, 9vw, 72px)`, **las palabras del propio dueño promovidas fuera de `.about`**, y una línea de estado (`desde $12.000 · 45 min · Abierto hasta las 20:45`). Sobre un campo `--cream-2` / `--pink-tint`, no un degradado a saturación plena. Cuando la foto exista, pasa a ser la mitad derecha de un hero a dos columnas, no el marco detrás de todo.

**Comando sugerido:** `$impeccable bolder`

### [P0] No renderiza ninguna prueba, y ningún CTA tiene una palabra de tranquilidad

**Qué.** Para Barone, galería, equipo y reseñas están las tres ausentes. Confirmado en el DOM vivo: la página tiene **dos `h2`**. Desaparece cerca de la mitad del diseño. Y ninguno de los seis CTA dice si es gratis, si pide tarjeta, si se puede cancelar.

**Por qué importa.** Una superficie de persuasión sin prueba no persuade. Se le pide a un desconocido que entregue nombre, teléfono y un sábado a la tarde a un negocio del que no vio ninguna evidencia.

**Fix.** Dos movimientos. Primero, sustituir la prueba con lo que el producto ya posee: una franja de tres datos siempre poblada — **disponibilidad en vivo** ("3 turnos libres hoy · el próximo a las 15:30", ya calculado en `lib/scheduling.js`), antigüedad ("Reservando online desde enero 2026", de `created_at`) y volumen cuando sea real. Segundo, bajo cada CTA principal: `Gratis · sin tarjeta · cancelás cuando quieras`. Y sumar un CTA secundario a WhatsApp, que es como se reserva en este mercado.

**Comando sugerido:** `$impeccable onboard`

### [P1] El "Reservar" por servicio tira la selección, y el wizard es una puerta de una sola dirección

**Qué.** Verificado en el código: los dos CTA por servicio apuntan a `/book/{id}` sin parámetro de servicio. El usuario toca "Reservar" en la fila de `CORTE Y BARBA / $15.000` y aterriza en un paso que le pide elegir el servicio de nuevo. `ServiceStep` no recibe `onBack`, y no existe ninguna referencia a `/book/s/` en todo el wizard: no hay vuelta.

**Por qué importa.** Es la costura entre las dos superficies y el momento de mayor intención del embudo. El usuario ya decidió y el producto descarta la decisión, y después lo encierra. Es la razón concreta de que las dos pantallas se sientan productos distintos.

**Fix.** Pasar `?service={id}` y que `useBookingFlow` lo lea y salte el paso. Agregar link de vuelta a la ficha en el header del wizard y pasar `onBack` a `ServiceStep`. Unificar el separador de precio: la ficha usa `toLocaleString('es-AR')` → `12.000`, el wizard usa `toLocaleString()` sin locale → `12,000` en un navegador en inglés.

**Comando sugerido:** `$impeccable harden`

### [P1] La tabla de horarios es el bloque más grande, dice una cosa seis veces, y fabrica datos cuando no están configurados

**Qué.** Renderiza los siete días siempre. Medido: **362px, 27% del alto**, más grande que la sección de servicios (260px), con `10:00 – 20:45` repetido seis veces. Y un negocio sin horarios configurados publica `09:00–20:00, lunes a sábado` como si fuera un hecho. Además `scheduling.js` solo soporta un horario global: no hay horarios por día ni corte de mediodía, que muchas barberías tienen.

**Por qué importa.** Tres fallas a la vez. Visualmente es el peso muerto al que el cliente reacciona. Estructuralmente no puede expresar la verdad de un negocio con sábado distinto. Y éticamente, un negocio nuevo publica un horario inventado arriba de un botón de reservar: el cliente va y encuentra cerrado.

**Fix.** Colapsar días idénticos (`Lunes a Sábado · 10:00 – 20:45` / `Domingo · Cerrado`) y recuperar ~270px. Reemplazar la prominencia de la tabla por una píldora de estado en el hero (`● Abierto · cierra 20:45`), y mandar la tabla completa a un `<details>`. Nunca fabricar: sin horarios configurados, mostrar "Consultá disponibilidad". Y agregar `openingHoursSpecification` al schema.

**Comando sugerido:** `$impeccable distill`

### [P2] Contraste medido por debajo de AA en los elementos que más importan

**Qué.** Ratios WCAG calculados sobre los hex reales de `globals.css`:

| Par | Ratio | AA |
|---|---|---|
| blanco sobre `--pink` — `.ctaMain` y `.stickyBtn` | **3.48:1** | **falla** en ambos temas |
| `--pink` sobre blanco — etiqueta de rubro, `.ctaSmall`, footer | **3.48:1** | falla (claro) |
| `--ink-faint` — el estado "Cerrado" | **2.50:1** claro / **3.07:1** oscuro | falla en ambos |
| `--yellow` — estrellas del rating | **1.39:1** | falla |

El fallo del CTA principal es invariante al tema: el CSS escribe el literal `#fff` y `.dark` **nunca redefine `--pink`**. Es 3.48:1 siempre. Ninguno de estos textos califica como "grande", así que aplica el umbral de 4.5:1.

Además: 5 de 8 elementos interactivos miden menos de 44px de alto — el link de teléfono mide **19,5px**, y es justo el que más se toca en un celular. Y `PhotoGallery .nav` se achica de 48px a 40px en ≤720px, o sea baja del umbral exactamente en touch.

**Por qué importa.** El botón que existe para ser tocado es el que menos contraste tiene y, en varios casos, el más chico.

**Comando sugerido:** `$impeccable audit`

## Persona Red Flags

**Casey (mobile distraída, navegador de Instagram, un pulgar, ~4 segundos):** el 27% de su primera pantalla es un degradado; el nombre del negocio está a 22px, más chico que un párrafo en la mayoría de los sitios; la dirección es un link gris de 13px con **20px de alto táctil**, imposible de tocar caminando; no hay `wa.me`, así que su instinto real ("le escribo por WhatsApp") no tiene dónde ir; y si toca la barra fija, el wizard le pide elegir el servicio otra vez. Ahí cierra la pestaña.

**Jordan (primera vez, nunca reservó online):** nada le dice qué cuesta o a qué lo compromete "Reservar" — ¿es gratis?, ¿pide tarjeta?, ¿es una seña? Cero palabras en toda la página. Hay cuatro controles visualmente distintos que dicen lo mismo, así que duda de todos. Entra al wizard y no tiene salida. Y "Horarios de atención" se lee como una condición que él debe cumplir, no como disponibilidad que se le ofrece.

**Riley (prueba los bordes):** creando un negocio con **solo un nombre**, la página queda en: degradado, una letra en un cuadro, el nombre, y una tabla de horarios **fabricada**. Una sola sección. Además, hallazgos vivos hoy: con `cheapest === null` la barra fija de mobile muestra la palabra "Barbería" sola junto a "Reservar"; el nombre de Barone es `"Barone "` con espacio final y eso fluye sin limpiar al `<title>`, al `<h1>`, al `aria-label` y al CTA ("Reservar turno en Barone  →"); con `avg_rating` cargado y `total_reviews = 0` el rating muestra "(0)" mientras la sección de reseñas queda oculta; y el badge `+N` de la galería promete expandir la grilla pero abre un visor **sin trampa de foco ni restauración de foco** al cerrar.

## Minor Observations

- Sin elemento `<main>`, sin skip link, y las tres `<section>` no tienen nombre accesible. El primer landmark de un lector de pantalla son 280px de nada.
- Sin estilos de foco propios en ninguna de las dos hojas de la ficha. La buena noticia: las cuatro reglas `outline: none` globales apuntan solo a `input`/`textarea`, así que el anillo del navegador sobrevive en links y botones.
- `prefers-reduced-motion` no se respeta en ninguna de las cuatro animaciones de la ficha.
- El escritorio desperdicia todo el costado: contenedor de 900px en 1280px, todo en una columna. El panel de reserva fijo a la derecha (lo que hace Fresha) usaría ese espacio y eliminaría tres de los seis CTA.
- `.stickyCta` tiene la sombra hardcodeada (`rgba(26,14,31,0.08)`), invisible sobre el fondo oscuro: la barra pierde su separación en modo oscuro. Es la única sombra del archivo que no usa token.
- Los dos "Reservar" por servicio tienen nombre accesible idéntico: un lector de pantalla escucha N links "Reservar" sin saber cuál es cuál.
- `priceRange: '$$'` se emite fijo para todo negocio, ignorando que los precios reales se conocen. Y `address` emite solo `streetAddress`, sin localidad ni país, así que Google no lo toma como `PostalAddress` válido.
- Todas las imágenes son `<img>` crudas con `eslint-disable`, sin `srcset` ni prioridad LCP. El día que existan portadas reales, esto se vuelve un problema medible.
- `revalidate = 300`: el dueño cambia un precio y no lo ve por cinco minutos. Lo va a reportar como bug.

## Questions to Consider

1. Si la mayoría de los dueños nunca va a subir una foto de portada, **¿por qué la página está compuesta alrededor de una?** ¿Y si el estado sin foto fuera el diseño canónico, y la foto —cuando exista— fuera una sección más y no el marco detrás de todo?
2. Fresha persuade con evidencia de terceros. Barone no tiene ninguna y el día uno nunca la va a tener: **¿cuál es el sustituto?** El producto genera gratis y continuamente una prueba que ningún perfil estático tiene: la disponibilidad en vivo.
3. **¿Por qué la ficha y el wizard son dos superficies distintas?** Si el paso 1 se renderizara ahí mismo —fechas reales, horarios libres, tocables, debajo de los servicios— la página deja de ser folleto y pasa a ser el producto. El vacío lo llenaría lo único que nunca está vacío: el calendario.
4. El que se queja de que la página está vacía es el dueño: **¿por qué la página no se lo dice a él?** Un bloque visible solo para el dueño autenticado ("Tu ficha está al 40% — subí 3 fotos") convierte el estado vacío en una superficie de activación.
5. En este mercado la conversación de reserva pasa por WhatsApp. **¿"Reservar" es siquiera la acción principal?**
