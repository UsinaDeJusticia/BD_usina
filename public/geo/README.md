# Límites de provincias (`provincias-ar.geojson`)

Polígonos de las 23 provincias y CABA, para el mapa coroplético del dashboard.

- **Fuente:** `@trase/trase-atlas@1.1.1`, archivo `files/argentina.json`, nivel 2 (TopoJSON).
  Ese paquete distribuye datos del IGN (Capas SIG, 2019).
- **Licencia:** ISC para el paquete. Los términos de los datos del IGN no están verificados.
  Antes de publicar el mapa, confirmar la licencia de los datos originales.
- **Transformación:** `scripts/geo/convert-trase.mjs` convierte el TopoJSON a GeoJSON,
  normaliza los nombres a la ortografía de Georef (la misma que guarda el formulario de casos)
  y agrega el código INDEC de dos dígitos. Coordenadas redondeadas a 5 decimales.
- **Propiedades:** `provincia` (nombre Georef, clave de unión con la base), `indec`, `source_name`.
- **Limitación conocida:** la fuente sólo tiene la Isla Grande de Tierra del Fuego. No incluye el
  sector antártico ni las islas del Atlántico Sur. El mapa lo indica en pie de figura.

Para regenerarlo: `npm i -g topojson-client` (o instalarlo en un directorio temporal) y
`node scripts/geo/convert-trase.mjs <argentina.json> public/geo/provincias-ar.geojson`.
