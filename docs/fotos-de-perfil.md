# Fotos de perfil de las víctimas

## Qué hay

- **Listados** (`/`, `/casos`): cada ficha muestra la foto de la víctima, que se
  desvanece hacia el fondo, con el nombre apoyado sobre ella. Sin foto, se ven
  las iniciales sobre un tono fijo para cada persona.
- **Vista animada:** avatar redondo junto al nombre.
- **Detalle del caso:** la foto grande en el encabezado (tocarla la amplía) y las
  otras víctimas del hecho, cada una con su foto o sus iniciales.
- **Formulario de la víctima:** "Subir foto", "Elegir de los recursos" (las
  imágenes ya cargadas de esa víctima) y "Quitar foto". En todos los casos se
  encuadra en un recorte y se guarda una versión cuadrada de 640 px en JPEG.

## Privacidad y datos

- Las fotos van al bucket privado `archivos-casos`, bajo `fotos-perfil/`. Solo se
  ven con sesión iniciada y estando en la whitelist (policies de `010`), mediante
  links firmados que duran 1 hora.
- La PWA no las cachea: no quedan guardadas en los dispositivos.
- Elegir una foto de los recursos crea una **copia recortada**: la original queda
  intacta.
- Cambiar o quitar la foto no borra ningún archivo del bucket.
- Una versión de la app que no conozca la foto nunca la borra: `foto_path` solo
  se escribe cuando el formulario la cambió.

## Despliegue

1. Aplicar `scripts/017_victim_photo.sql`. Es aditivo y la versión actual de la
   app lo ignora.
2. Mergear y desplegar.

Si el código llega antes que el SQL, la app sigue funcionando: el listado cae a
la consulta anterior y el selector de foto se oculta hasta que exista la columna.

## Código

- `components/victims/victim-photo.tsx`: foto o iniciales (tarjeta, encabezado, avatar).
- `components/victims/victim-photo-picker.tsx` y `photo-cropper-dialog.tsx`: carga y recorte.
- `components/cases/case-photo-card.tsx`: ficha del listado.
- `lib/photos/`: utilidades puras (testeadas), Storage y links firmados por lote.
