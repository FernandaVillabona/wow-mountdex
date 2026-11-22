# Diseño visual — "dispositivo de colección"

La app se presenta como un aparato físico, no como un dashboard.

| Elemento | Implementación |
|---|---|
| Carcasa | Rojo `--shell` con bisel claro arriba y sombra oscura abajo; bordes marcados, radios pequeños. |
| Lente y LEDs | Lente azul (parpadea mientras carga/sincroniza). LEDs: rojo = error, amarillo = guardado local, verde = nube. |
| Botonera | Navegación como botones físicos con bisel y desplazamiento de 2 px al pulsar; el activo se ilumina en dorado. En móvil pasa a una botonera inferior desplazable (nada escondido en menús). |
| Pantalla | Fondo LCD verdoso `--screen` con scanlines muy suaves dentro de un marco negro con la esquina inferior izquierda redondeada (guiño a la Pokédex). |
| Paneles | Cabecera negra con texto en mayúsculas pixel; cuerpo en pantalla. |
| Contadores | Celdas LCD verde oscuro con fuente *Press Start 2P*. |
| Barras | Segmentadas tipo "barra de PS"; rojo < 20 %, amarillo < 50 %, verde ≥ 50 %. |
| Sprites | Icono oficial si existe; si no, sprite generado (iniciales sobre el color de la expansión). Pendiente = escala de grises. |
| WoW | Dorado `--gold` para estados activos y hitos; colores de acento por expansión (datos, no código). |

## Tipografía

- *Press Start 2P*: solo logo, números de registro y cifras (tamaños pequeños).
- *Pixelify Sans*: títulos, botones, etiquetas.
- *Atkinson Hyperlegible*: todo el texto de lectura (máxima legibilidad).

## Movimiento

Transiciones cortas con `steps()` para sensación retro (entrada de ficha, barras, avisos). Todo se desactiva
con `prefers-reduced-motion`.

## Accesibilidad

Enlace "saltar al contenido", foco visible amarillo, `aria-pressed` en interruptores, `role=progressbar`,
`aria-live` en contadores y avisos, textos alternativos en sprites, navegación completa con teclado
(← → entre fichas), contraste AA en texto sobre pantalla y botones.
