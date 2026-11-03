import {Alert, Button, List, Modal, Spin, Typography} from "antd";
import {type ReactNode, useCallback, useEffect, useMemo, useRef, useState} from "react";
import {useTranslation} from "react-i18next";
import {CircleMarker, MapContainer, Popup, TileLayer, Tooltip, useMap, useMapEvents} from "react-leaflet";
import type {MapViewSource} from "./MapAPI";
import type {MapClusterItem, MapClusterResponse, MapFileResponse, MapFilterRequest} from "./models";
import {EMPTY_MAP_FILTERS, type MapFileTypeOption, MapFilters, type MapFilterValues} from "./MapFilters";
import {MAP_CLUSTER_ZOOM_STEP, MAP_FETCH_DEBOUNCE_MS, MAP_MAX_LISTED_FILES, MAP_VIEW_TRANSLATION_DEFAULTS, type MapViewTranslationKey} from "./MapViewConfig";

/** The viewport the clusters are asked for */
interface Viewport {
    south: number;
    west: number;
    north: number;
    east: number;
    zoom: number;
}

export interface MapViewProps {
    /** The backend: the `MapAPI` of the host, or anything answering clusters and the files of a cluster */
    source: MapViewSource;
    /** The file types the user may filter by (the host knows which types it keeps) */
    fileTypes: MapFileTypeOption[];
    /** The details of a resource, shown in the modal that opens when a resource is clicked */
    renderFileDetails: (file: MapFileResponse) => ReactNode;
    /** The thumbnail of a resource, shown above its details; the host decides how `thumbnail_id` becomes an image */
    renderThumbnail?: (file: MapFileResponse) => ReactNode;
    /** Tag suggestions for the tag filter */
    searchTags?: (search: string) => Promise<string[]>;
    /** Tile server of the base map and its attribution, from the host's configuration */
    tileUrl: string;
    attribution: string;
    heightPx?: number;
    initialCenter?: [number, number];
    initialZoom?: number;
}

/** Signed degrees as the key of a cluster's cell at its precision, so that the files fetched for a cell are cached per cell */
function cellKey(cluster: MapClusterItem, precision: number): string {
    return `${precision}:${cluster.cell_latitude}:${cluster.cell_longitude}`;
}

/** The request filters of the applied filter values; absent filters are left out of the request */
export function toFilterRequest(filters: MapFilterValues): MapFilterRequest {
    const request: MapFilterRequest = {};
    if (filters.fileType) {
        request.file_type = filters.fileType;
    }
    if (filters.from) {
        request.from = filters.from.startOf("day").toISOString();
    }
    if (filters.to) {
        request.to = filters.to.endOf("day").toISOString();
    }
    if (filters.tags.length > 0) {
        request.tags = filters.tags;
    }
    if (filters.search.trim() !== "") {
        request.search = filters.search.trim();
    }
    return request;
}

/** Marker radius in pixels: grows with the logarithm of the count so that a cluster of thousands stays readable */
export function clusterRadius(count: number): number {
    return count <= 1 ? 7 : Math.min(28, 10 + Math.round(Math.log10(count) * 6));
}

/** Reports the viewport after every pan or zoom (and once on mount), so that the clusters follow the map */
function ViewportTracker({onChange}: { onChange: (viewport: Viewport) => void }) {
    const map = useMap();
    const report = useCallback(() => {
        const bounds = map.getBounds();
        onChange({
            south: bounds.getSouth(),
            west: bounds.getWest(),
            north: bounds.getNorth(),
            east: bounds.getEast(),
            zoom: map.getZoom()
        });
    }, [map, onChange]);

    useMapEvents({moveend: report, zoomend: report});

    useEffect(() => {
        report();
    }, [report]);

    return null;
}

/**
 * The map of the GPS-tagged resources of a backend, shared by the file SPA (original files) and the admin SPA (published site files). The
 * backend clusters the points for the visible viewport and zoom level; the view draws one marker per cluster with its count, lists the files
 * of a small cluster on mouseover (a large one asks to zoom in; clicking a cluster zooms in), and opens the details and thumbnail of a
 * resource when it is clicked. The filters narrow the resources on the backend.
 */
export function MapView({
                            source, fileTypes, renderFileDetails, renderThumbnail, searchTags, tileUrl, attribution, heightPx = 600,
                            initialCenter = [60.17, 24.94], initialZoom = 5
                        }: MapViewProps) {
    const {t} = useTranslation();
    const text = useCallback((key: MapViewTranslationKey, options?: Record<string, unknown>) =>
            t(key, {defaultValue: MAP_VIEW_TRANSLATION_DEFAULTS[key], ...options}), [t]);
    const [filters, setFilters] = useState<MapFilterValues>(EMPTY_MAP_FILTERS);
    const [viewport, setViewport] = useState<Viewport | null>(null);
    const [clusters, setClusters] = useState<MapClusterResponse | null>(null);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<boolean>(false);
    const [openCell, setOpenCell] = useState<string | null>(null);
    const [cellFiles, setCellFiles] = useState<Record<string, MapFileResponse[] | "loading" | "error">>({});
    const [selectedFile, setSelectedFile] = useState<MapFileResponse | null>(null);
    const requestCounter = useRef(0);
    const filterRequest = useMemo(() => toFilterRequest(filters), [filters]);

    // The clusters of the viewport, asked for a moment after the last pan, zoom or filter change; a late answer of an older request is dropped
    useEffect(() => {
        if (!viewport) {
            return;
        }
        const requestId = ++requestCounter.current;
        const timer = window.setTimeout(() => {
            setLoading(true);
            source.getClusters({...filterRequest, ...viewport})
                    .then(response => {
                        if (requestId !== requestCounter.current) {
                            return;
                        }
                        setClusters(response);
                        setError(false);
                        setCellFiles({});
                        setOpenCell(null);
                    })
                    .catch(err => {
                        if (requestId !== requestCounter.current) {
                            return;
                        }
                        console.error("Failed to load the map clusters:", err);
                        setError(true);
                    })
                    .finally(() => {
                        if (requestId === requestCounter.current) {
                            setLoading(false);
                        }
                    });
        }, MAP_FETCH_DEBOUNCE_MS);
        return () => window.clearTimeout(timer);
    }, [source, filterRequest, viewport]);

    const precision = clusters?.precision ?? 0;

    // The files of a cluster small enough to list, fetched when its popup opens the first time
    const loadCellFiles = useCallback((cluster: MapClusterItem) => {
        const key = cellKey(cluster, precision);
        setOpenCell(key);
        if (cluster.count > MAP_MAX_LISTED_FILES || cellFiles[key] !== undefined) {
            return;
        }
        setCellFiles(current => ({...current, [key]: "loading"}));
        source.getClusterFiles({
            ...filterRequest,
            cell_latitude: cluster.cell_latitude,
            cell_longitude: cluster.cell_longitude,
            precision,
            limit: MAP_MAX_LISTED_FILES
        })
                .then(files => setCellFiles(current => ({...current, [key]: files})))
                .catch(err => {
                    console.error("Failed to load the files of a map cluster:", err);
                    setCellFiles(current => ({...current, [key]: "error"}));
                });
    }, [cellFiles, filterRequest, precision, source]);

    function applyFilters(next: MapFilterValues) {
        setFilters(next);
    }

    return (
            <div data-testid="map-view">
                <MapFilters fileTypes={fileTypes} initialValue={filters} onApply={applyFilters} searchTags={searchTags}/>
                <div style={{marginBottom: 8, minHeight: 24}} data-testid="map-status">
                    {loading && <Spin size="small" style={{marginRight: 8}}/>}
                    {error && <Alert type="error" showIcon title={text("MapView.status.error")}/>}
                    {clusters && !error && (
                            <Typography.Text type="secondary">
                                {text("MapView.status.points", {count: clusters.total_points})}
                                {clusters.truncated && <> &middot; {text("MapView.status.truncated")}</>}
                            </Typography.Text>
                    )}
                </div>
                <div style={{width: "100%", height: heightPx}}>
                    <MapContainer center={initialCenter} zoom={initialZoom} style={{width: "100%", height: "100%"}} scrollWheelZoom>
                        <TileLayer attribution={attribution} url={tileUrl}/>
                        <ViewportTracker onChange={setViewport}/>
                        {clusters?.clusters.map(cluster => (
                                <ClusterMarker key={cellKey(cluster, precision)} cluster={cluster} precision={precision}
                                               open={openCell === cellKey(cluster, precision)}
                                               files={cellFiles[cellKey(cluster, precision)]}
                                               text={text}
                                               onHover={loadCellFiles}
                                               onClose={() => setOpenCell(null)}
                                               onFileClick={setSelectedFile}/>
                        ))}
                    </MapContainer>
                </div>
                <Modal open={selectedFile !== null} onCancel={() => setSelectedFile(null)} footer={null} destroyOnHidden width={720}
                       title={text("MapView.details.title")}>
                    {selectedFile && (
                            <div data-testid="map-file-details">
                                {renderThumbnail && <div style={{marginBottom: 12}} data-testid="map-file-thumbnail">{renderThumbnail(selectedFile)}</div>}
                                {renderFileDetails(selectedFile)}
                            </div>
                    )}
                </Modal>
            </div>
    );
}

interface ClusterMarkerProps {
    cluster: MapClusterItem;
    precision: number;
    open: boolean;
    files: MapFileResponse[] | "loading" | "error" | undefined;
    text: (key: MapViewTranslationKey, options?: Record<string, unknown>) => string;
    onHover: (cluster: MapClusterItem) => void;
    onClose: () => void;
    onFileClick: (file: MapFileResponse) => void;
}

/**
 * One cluster: a circle sized by its count with the count as a permanent label. Mouseover opens a popup with the files of the cluster (or
 * the hint to zoom in when there are too many); a click zooms the map in on the cluster, or opens the single resource of a point.
 */
function ClusterMarker({cluster, precision, open, files, text, onHover, onClose, onFileClick}: ClusterMarkerProps) {
    const map = useMap();
    const single = cluster.count === 1 && cluster.file_id !== null;

    function zoomIn() {
        map.setView([cluster.latitude, cluster.longitude], Math.min(18, map.getZoom() + MAP_CLUSTER_ZOOM_STEP));
    }

    function click() {
        if (single) {
            const listed = Array.isArray(files) ? files.find(file => file.id === cluster.file_id) : undefined;
            if (listed) {
                onFileClick(listed);
                return;
            }
            // the files of the point are not loaded yet: the popup lists it and the user clicks it there
            onHover(cluster);
            return;
        }
        zoomIn();
    }

    return (
            <CircleMarker center={[cluster.latitude, cluster.longitude]} radius={clusterRadius(cluster.count)}
                          pathOptions={{color: single ? "#1677ff" : "#d4380d", fillColor: single ? "#1677ff" : "#ff7a45", fillOpacity: 0.75, weight: 1}}
                          eventHandlers={{mouseover: () => onHover(cluster), click}}>
                {!single && (
                        <Tooltip permanent direction="center" className="vempain-map-cluster-count" opacity={1}>
                            {cluster.count}
                        </Tooltip>
                )}
                {open && (
                        <Popup eventHandlers={{remove: onClose}} closeButton>
                            <ClusterFiles cluster={cluster} precision={precision} files={files} text={text} onFileClick={onFileClick} onZoomIn={zoomIn}/>
                        </Popup>
                )}
            </CircleMarker>
    );
}

interface ClusterFilesProps {
    cluster: MapClusterItem;
    precision: number;
    files: MapFileResponse[] | "loading" | "error" | undefined;
    text: (key: MapViewTranslationKey, options?: Record<string, unknown>) => string;
    onFileClick: (file: MapFileResponse) => void;
    onZoomIn: () => void;
}

/** The content of a cluster's popup: the list of its files, or the hint to zoom in when it holds too many */
export function ClusterFiles({cluster, precision, files, text, onFileClick, onZoomIn}: ClusterFilesProps) {
    if (cluster.count > MAP_MAX_LISTED_FILES) {
        return (
                <div data-testid="map-cluster-too-many" data-precision={precision}>
                    <Typography.Paragraph>{text("MapView.cluster.tooMany")}</Typography.Paragraph>
                    <Button size="small" type="primary" onClick={onZoomIn}>{text("MapView.cluster.zoomIn")}</Button>
                </div>
        );
    }
    if (files === undefined || files === "loading") {
        return <Spin size="small" data-testid="map-cluster-loading"><span>{text("MapView.cluster.loading")}</span></Spin>;
    }
    if (files === "error") {
        return <Alert type="warning" showIcon title={text("MapView.cluster.loadError")}/>;
    }
    return (
            <div data-testid="map-cluster-files" style={{maxHeight: 240, overflowY: "auto", minWidth: 220}}>
                <Typography.Text strong>{text("MapView.cluster.files", {count: cluster.count})}</Typography.Text>
                <List size="small" dataSource={files} renderItem={file => (
                        <List.Item key={file.id}>
                            <Button type="link" size="small" style={{padding: 0}} onClick={() => onFileClick(file)}>{file.filename}</Button>
                        </List.Item>
                )}/>
            </div>
    );
}
