# Rendimiento en dispositivos reales

El contenedor de desarrollo no tiene GPU: allí el WebGL va por software y un
frame tarda segundos, así que solo vale para contar (shaders compilados,
frames dibujados en reposo, contextos, fugas) y para comparar capturas. La
fluidez se comprueba aquí, en máquinas de verdad, sobre el preview de Vercel
de la rama (`/es` y `/en`).

## Qué leer

Cada `<canvas>` (el del héroe y el de la ciudad) lleva dos atributos, que
se ven en DevTools → Elements:

- `data-quality`: el nivel de calidad, de 0 (el aspecto de siempre) a 6.
  Solo baja, nunca sube, y baja solo si hace falta.
- `data-pace`: `1`, el 3D a la tasa de la pantalla; `2`, a la mitad exacta
  (72 fps en 144 Hz), solo en pantallas de 118 Hz o más cuando la GPU no
  llega.

Con una ventana de DevTools → Performance grabando, recorre el héroe con la
rueda o con W y baja a la ciudad hasta la última parada. Mira la fila
Frames (frames en rojo o amarillo) y Long animation frames.

## Equipos

1. **Portátil con gráfica Intel integrada (UHD o Iris), pantalla 1080p al 125 %.**
   - Arranca en `data-quality` 2 (Iris) o 4 (UHD); puede bajar uno o dos
     escalones en los primeros segundos y luego se queda.
   - Fluido en el héroe y en la ciudad, sin frames de más de 100 ms en los
     cortes de cámara ni al llegar a cada parada.
   - El menú de inicio responde a las teclas y al ratón mientras carga.
2. **Monitor de 144 o 165 Hz.**
   - Con una GPU potente: `data-pace` 1, el 3D a 144.
   - Con una GPU justa: `data-pace` 2, un 72 regular (sin el tartamudeo de
     alternar uno y dos refrescos). El scroll y los textos siguen a 144.
3. **PC potente o Mac con pantalla HiDPI.**
   - `data-quality` 0 todo el rato y el mismo aspecto que antes: aberración
     cromática, desenfoque de profundidad, nubes con todo su detalle.
4. **Móvil, desde el navegador interno de LinkedIn, con 4G.**
   - El menú de inicio aparece pronto y responde; los modelos llegan.
   - El recorrido se nota fluido; la ciudad no se congela al llegar a ella
     ni al pasar de una parada a otra.

## Con la GPU de tu máquina

Las dos herramientas de navegador aceptan `--gpu`: abren un Chromium visible
sobre tu GPU en lugar del rasterizador por software.

```sh
pnpm build && pnpm start -p 3100
node tools/capture/perf.mjs --gpu --url http://localhost:3100/en --device desktop --only boot,cuts,city,pace
pnpm dev   # en otra terminal
node tools/capture/scrollux.mjs --gpu --only cityloop --device desktop --lang es
```

`perf.mjs` cuenta los shaders compilados dentro de un frame (debe ser 0 al
entrar y en cada parada de la ciudad) y los frames largos; `cityloop` da el
tiempo de frame de la ciudad frente al del héroe.

En desarrollo la calidad no baja sola: `window.__vaQuality(4)` fuerza un
nivel y `window.__vaPace(2)` la mitad de tasa, para ver cómo se ven.
