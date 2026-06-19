# Module 7: Map Libraries — MapLibre GL JS & Leaflet

Est. study time: 2h
Language: en

## Learning Objectives
- Design map abstraction supporting vector tile (MapLibre) and raster tile (Leaflet) engines
- Implement layer system (markers, polygons, heatmaps) decoupled from map library
- Manage map lifecycle (initialization, resize, cleanup) with React integration
- Handle large GeoJSON datasets with clustering and viewport filtering

---

## Core Content

### Map Library Comparison

| Feature | MapLibre GL JS | Leaflet | Google Maps |
|---------|---------------|---------|-------------|
| Rendering | WebGL (hardware-accelerated) | SVG/CSS | Canvas/WebGL |
| Tile format | Vector tiles (style-spec) | Raster tiles | Hybrid |
| Performance (10k+ points) | Excellent (WebGL) | Poor (SVG DOM) | Good |
| Custom styling | Full GL style spec | Limited via CSS | Limited via API |
| Bundle | ~150KB (unminified) | ~40KB | Dynamic load |
| License | BSD-3 (open source) | BSD-2 (open source) | Proprietary |
| Offline tiles | Yes | Yes | Limited |
| 3D / Terrain | Yes (native) | Plugin (Leaflet.Terrain) | Yes |

**MapLibre**: Modern, performant, vector tiles. Preferred for data-heavy maps, custom styles, 3D terrain.

**Leaflet**: Lightweight, simpler, raster tiles. Preferred for simple marker maps, legacy projects, minimal bundle.

### Map Lifecycle

Maps have imperative lifecycle: create, update style, add/remove layers, resize, destroy.

React integration pattern:

```typescript
function useMapLifecycle(containerRef: RefObject<HTMLDivElement>, config: MapConfig) {
  const mapRef = useRef<MapInstance | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const map = createMapInstance(config, containerRef.current!)
    map.on('load', () => setReady(true))
    mapRef.current = map
    return () => { map.remove(); mapRef.current = null }
  }, [config.style, config.center, config.zoom])

  return { mapRef, ready }
}
```

Abstraction: `createMapInstance` returns either MapLibre or Leaflet instance behind `MapInstance` interface:

```typescript
interface MapInstance {
  setCenter(center: [number, number]): void
  setZoom(zoom: number): void
  setStyle(style: string | object): void
  on(event: string, handler: Function): void
  off(event: string, handler: Function): void
  addLayer(layer: MapLayerConfig): void
  removeLayer(id: string): void
  getBounds(): BBox
  fitBounds(bounds: BBox, padding?: number): void
  resize(): void
  remove(): void
}
```

> **Think**: MapLibre and Leaflet APIs differ significantly. MapInstance interface forces lowest common denominator. How to access library-specific features?
>
> *Answer: `MapInstance.getNative()` returns underlying library instance. Document as escape hatch. Use sparingly — each escape hatch usage is a migration liability.*

### Layer System

Maps display data as layers. Layer abstraction:

```typescript
type MapLayerConfig = 
  | { type: 'marker'; id: string; position: [number, number]; popup?: string; icon?: MarkerIcon }
  | { type: 'geojson'; id: string; data: GeoJSON.FeatureCollection; style: GeoJSONStyle }
  | { type: 'heatmap'; id: string; data: GeoJSON.FeatureCollection; radius: number; blur: number }
  | { type: 'polygon'; id: string; coordinates: [number, number][]; fill: string; stroke: string }
  | { type: 'cluster'; id: string; data: GeoJSON.FeatureCollection; clusterRadius: number }

interface MapLayerManager {
  addLayer(config: MapLayerConfig): void
  updateLayer(id: string, config: Partial<MapLayerConfig>): void
  removeLayer(id: string): void
  clearLayers(): void
  getLayer(id: string): MapLayerConfig | null
}
```

MapLibre impl: GeoJSON source + layer with `type: 'circle' | 'fill' | 'heatmap'`.
Leaflet impl: `L.marker()`, `L.geoJSON()`, `L.heatLayer()` (plugin).

> **Think**: Heatmap requires MapLibre native or Leaflet plugin. Should abstraction include plugin installation concern?
>
> *Answer: Include plugin init in map factory. `createMapInstance(config)` checks config.plugins and loads Leaflet heatmap plugin or MapLibre heatmap layer. Consumer declares `heatmap: true` in config.*

### Large Datasets & Clustering

10k+ points choke Leaflet (SVG DOM). MapLibre handles via WebGL.

Clustering abstraction:

```typescript
interface ClusterStrategy {
  type: 'supercluster' | 'leaflet-markercluster' | 'maplibre-cluster'
  radius: number
  maxZoom: number
  minPoints?: number
  onClusterClick?: (cluster: ClusterData) => void
}

// MapLibre: built-in clustering via GeoJSON source cluster props
// Leaflet: MarkerCluster plugin
// Abstract: same config, different implementations
```

Viewport filtering (only load points in viewport) for large datasets:

```typescript
function useViewportFilter(map: MapInstance, data: Feature[], onFiltered: (visible: Feature[]) => void) {
  useEffect(() => {
    const handler = () => {
      const bounds = map.getBounds()
      const visible = data.filter(f => isWithinBounds(f, bounds))
      onFiltered(visible)
    }
    map.on('moveend', handler)
    handler() // initial
    return () => map.off('moveend', handler)
  }, [map, data])
}
```

> **Think**: Viewport filtering and clustering serve same goal (performance). When to use which?
>
> *Answer: Clustering: aggregate nearby points into cluster markers. Good for 1k-100k points. Viewport filtering: only load/render points in current viewport. Good for 100k+ points with server-side data. Combine: cluster within viewport for 10k+ visible points.*

### Map Interaction

Common interactions: click, hover, popup, drag, zoom, draw.

Abstraction:

```typescript
interface MapInteractionConfig {
  onClick?: (feature: GeoJSON.Feature, lngLat: [number, number]) => void
  onHover?: (feature: GeoJSON.Feature | null, lngLat: [number, number]) => void
  onBoundsChange?: (bounds: BBox, zoom: number) => void
  popup?: { enabled: boolean; template: (feature: GeoJSON.Feature) => string }
  draw?: { enabled: boolean; onDraw: (geometry: GeoJSON.Geometry) => void }
}
```

MapLibre: `map.on('click', 'layer-id', handler)`. Leaflet: `marker.on('click', handler)`. Wrapper normalizes.

### React 19: Imperative Map API & Concurrent Rendering

Map libraries expose imperative APIs (map.flyTo, map.setCenter, map.setStyle). React 19 ref as prop eliminates `forwardRef` boilerplate — pass map instance ref directly:

```typescript
function MapView({ mapRef, config }: { mapRef: RefObject<MapInstance | null>; config: MapConfig }) {
  const containerRef = useRef<HTMLDivElement>(null)

  useMapLifecycle(containerRef, config)  // assigns map to mapRef.current

  return <div ref={containerRef} style={{ width: '100%', height: 600 }} />
}
```

Map libs are DOM-dependent — mark with `"use client"` boundary. Lazy-load map tiles via Suspense for initial render speed. Wrap map animation state updates (zoom, center, pitch) in `useTransition` to avoid jank. React Compiler handles interop callbacks passed to map.on — reduces manual `useCallback`.

---

### Why This Matters

Map libraries are among the hardest to migrate. MapLibre and Leaflet have completely different APIs, rendering engines, and tile ecosystems. Map abstraction saves months of migration work. It also enables progressive enhancement: start with Leaflet (lightweight), upgrade to MapLibre (performance, 3D) when needed.

---

### Common Questions

**Q: Should I use MapLibre or Leaflet for a simple store locator with 100 markers?**
A: Leaflet. 100 markers is well within Leaflet's performance. MapLibre's WebGL overhead is unnecessary. Abstraction lets you start with Leaflet and upgrade to MapLibre if you add 10k+ points or 3D terrain.

**Q: How to handle different tile providers (OpenStreetMap, Mapbox, Stadia)?**
A: Abstract tile provider in MapConfig.style. MapLibre uses GL style JSON. Leaflet uses tile URL template. Both expose in config. Provider change = config change, not code change.

**Q: How does React 19 change map library integration?**
A: Ref as prop simplifies imperative map API access — no forwardRef needed. "use client" boundary required for all map libs (DOM-dependent). Suspense boundaries can defer map tile loading until viewport enters. useTransition keeps map animation state updates smooth. React Compiler memoizes event handlers passed to map.on — reduces boilerplate.

**Q: Should map libs be lazy-loaded?**
A: Yes. Dynamic import + Suspense boundary. MapLibre (~150KB) and Leaflet (~40KB) are significant bundles. Defer load until map viewport is visible. `const MapLibreMap = lazy(() => import('./MapLibreMap'))`. Wrap in Suspense with skeleton placeholder.

---

## Examples

### Example 1: Property Map with Clustering

**Problem**: 15k property listings on map. Click marker shows property popup. Zoom in: clusters expand.

**Solution**: MapLibre (WebGL handles 15k points). Cluster config: radius=50, maxZoom=14. Popup template from listing data. Click handler zooms to cluster or opens property popup.

### Example 2: Migration from Leaflet to MapLibre

**Problem**: App outgrows Leaflet. 50k data points crash SVG rendering. 3D terrain needed.

**Solution**: MapLibre backend with same MapInstance interface. Layer configs convert. Cluster config identical. Data pipeline unchanged. MapLibre terrain enabled via MapConfig.terrain = { source: 'terrain-source', exaggeration: 1.5 }. Migration = one file.

---

## Key Takeaways
- MapLibre (WebGL, vector tiles, 3D) vs Leaflet (SVG/CSS, raster tiles, lightweight)
- Map lifecycle: imperative create/update/destroy — wrap in React useEffect with cleanup
- Layer abstraction: union type for marker, geojson, heatmap, polygon, cluster
- MapInstance interface as lowest-common-denominator; getNative() escape hatch
- Clustering: MapLibre built-in vs Leaflet plugin — same config, different implementation
- Viewport filtering for 100k+ datasets; clustering for 1k-100k

## Common Misconception

**"Leaflet is always lighter than MapLibre."**

Leaflet bundle is smaller (~40KB vs ~150KB). But Leaflet renders markers as DOM elements — 10k markers create 10k DOM nodes, consuming memory and causing scroll jank. MapLibre renders via WebGL — 100k points at same memory cost. For large datasets, MapLibre is lighter in practice despite larger bundle.

---

## Feynman Explain
(Explain the difference between vector tiles (MapLibre) and raster tiles (Leaflet) to a non-technical stakeholder. Use photo vs painting analogy.)

---

## Reframe
(Pause. Maps are expensive to build and maintain. When does a map visualization add more complexity than value? Should some map use cases be satisfied by static map images with clickable regions?)

---

## Drill
Take the quiz. MCQs test library selection, lifecycle management, layer abstraction, clustering, and performance optimization.

Run: `learn.sh quiz external-lib-patterns 07-map-libraries`
