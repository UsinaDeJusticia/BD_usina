// Converts the Trase Atlas (IGN 2019) level2 TopoJSON to a GeoJSON FeatureCollection
// with Georef/INDEC province names and two-digit INDEC ids.
import { readFileSync, writeFileSync } from "node:fs";
import { feature } from "topojson-client";

const [, , srcPath, outPath] = process.argv;

// Canonical names and INDEC ids (same ids as Georef). Names follow the Georef spelling.
const GEOREF = [
  ["02", "Ciudad Autónoma de Buenos Aires"],
  ["06", "Buenos Aires"],
  ["10", "Catamarca"],
  ["14", "Córdoba"],
  ["18", "Corrientes"],
  ["22", "Chaco"],
  ["26", "Chubut"],
  ["30", "Entre Ríos"],
  ["34", "Formosa"],
  ["38", "Jujuy"],
  ["42", "La Pampa"],
  ["46", "La Rioja"],
  ["50", "Mendoza"],
  ["54", "Misiones"],
  ["58", "Neuquén"],
  ["62", "Río Negro"],
  ["66", "Salta"],
  ["70", "San Juan"],
  ["74", "San Luis"],
  ["78", "Santa Cruz"],
  ["82", "Santa Fe"],
  ["86", "Santiago del Estero"],
  ["90", "Tucumán"],
  ["94", "Tierra del Fuego, Antártida e Islas del Atlántico Sur"],
];

const norm = (s) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

const byNorm = new Map(GEOREF.map(([id, name]) => [norm(name), { id, name }]));

const topo = JSON.parse(readFileSync(srcPath, "utf8"));
const fc = feature(topo, topo.objects.level2);

const round = (n) => Math.round(n * 1e5) / 1e5;
const roundCoords = (c) => (typeof c[0] === "number" ? [round(c[0]), round(c[1])] : c.map(roundCoords));

const unmatched = [];
const features = fc.features.map((f) => {
  const src = f.properties.name;
  const hit = byNorm.get(norm(src));
  if (!hit) unmatched.push(src);
  return {
    type: "Feature",
    properties: {
      provincia: hit ? hit.name : src,
      indec: hit ? hit.id : null,
      source_name: src,
    },
    geometry: { type: f.geometry.type, coordinates: roundCoords(f.geometry.coordinates) },
  };
});

features.sort((a, b) => (a.properties.indec ?? "").localeCompare(b.properties.indec ?? ""));

const out = {
  type: "FeatureCollection",
  name: "provincias-ar",
  metadata: {
    source: "Trase Atlas TopoJSON (@trase/trase-atlas@1.1.1, files/argentina.json, level2), upstream: IGN 2019 Capas SIG",
    crs: "WGS84 lon/lat (EPSG:4326 coordinates)",
    names: "normalized to Georef/INDEC spelling; indec = two-digit INDEC/Georef province id",
    coordinate_precision: 5,
  },
  features,
};

writeFileSync(outPath, JSON.stringify(out));
console.log("features:", features.length, "unmatched:", unmatched.length, unmatched);
const ids = new Set(features.map((f) => f.properties.indec));
console.log("distinct indec:", ids.size, "missing ids:", GEOREF.filter(([id]) => !ids.has(id)).map(([id, n]) => `${id} ${n}`));
