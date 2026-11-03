/** A cluster with at most this many resources is listed on mouseover; a larger one asks the user to zoom in (MapClustering.MAX_LISTED_FILES of the backends) */
export const MAP_MAX_LISTED_FILES = 50;

/** How long the map waits after the last pan or zoom before it asks the backend for the clusters of the new viewport */
export const MAP_FETCH_DEBOUNCE_MS = 250;

/** How many zoom levels a click on a cluster zooms in */
export const MAP_CLUSTER_ZOOM_STEP = 3;

/** The English texts of the map; hosts translate the keys in their locale files */
export const MAP_VIEW_TRANSLATION_DEFAULTS = {
    "MapView.filters.fileType": "File type",
    "MapView.filters.allFileTypes": "All file types",
    "MapView.filters.dateRange": "Taken between",
    "MapView.filters.tags": "Tags",
    "MapView.filters.tagsPlaceholder": "Any of these tags",
    "MapView.filters.search": "File name contains",
    "MapView.filters.apply": "Apply",
    "MapView.filters.reset": "Reset",
    "MapView.status.loading": "Loading the map",
    "MapView.status.points": "{{count}} resources in view",
    "MapView.status.truncated": "Only the largest clusters are shown, zoom in to see the rest",
    "MapView.status.error": "Could not load the map",
    "MapView.cluster.tooMany": "Too many files to display, please zoom in to see the individual files",
    "MapView.cluster.loading": "Loading the files",
    "MapView.cluster.files": "{{count}} files",
    "MapView.cluster.zoomIn": "Zoom in",
    "MapView.cluster.loadError": "Could not load the files of this cluster",
    "MapView.details.title": "Resource details",
    "MapView.details.close": "Close"
} as const;

export type MapViewTranslationKey = keyof typeof MAP_VIEW_TRANSLATION_DEFAULTS;
