import type {CSSProperties, ReactNode} from "react";

/**
 * Stand-in for the ESM-only `react-leaflet` package (installed by `jest.config.js` as the module `react-leaflet`): the components render plain
 * markup exposing the props the map view passes, `useMap()` answers `mockMap` and `useMapEvents()` records the handlers in `mapEventHandlers`
 * so that a test can fire a pan or zoom. `mockMap.bounds` and `mockMap.zoom` are what the viewport tracker reports.
 */
export const mockMap = {
    bounds: {south: 59.5, west: 24.0, north: 60.5, east: 25.5},
    zoom: 8,
    setViewCalls: [] as Array<{ center: [number, number]; zoom: number }>,
    getBounds() {
        const {south, west, north, east} = mockMap.bounds;
        return {getSouth: () => south, getWest: () => west, getNorth: () => north, getEast: () => east};
    },
    getZoom() {
        return mockMap.zoom;
    },
    setView(center: [number, number], zoom: number) {
        mockMap.setViewCalls.push({center, zoom});
        mockMap.zoom = zoom;
    },
    reset() {
        mockMap.bounds = {south: 59.5, west: 24.0, north: 60.5, east: 25.5};
        mockMap.zoom = 8;
        mockMap.setViewCalls = [];
        mapEventHandlers.current = {};
    }
};

export const mapEventHandlers: { current: Record<string, () => void> } = {current: {}};

export function useMap() {
    return mockMap;
}

export function useMapEvents(handlers: Record<string, () => void>) {
    mapEventHandlers.current = handlers;
    return mockMap;
}

export function MapContainer({children, center, zoom, style}: {
    children?: ReactNode;
    center?: [number, number];
    zoom?: number;
    style?: CSSProperties;
    scrollWheelZoom?: boolean
}) {
    return <div data-testid="map-container" data-center={center?.join(",")} data-zoom={zoom} style={style}>{children}</div>;
}

export function TileLayer({url, attribution}: { url?: string; attribution?: string }) {
    return <div data-testid="tile-layer" data-url={url} data-attribution={attribution}/>;
}

interface MarkerProps {
    children?: ReactNode;
    center: [number, number];
    radius?: number;
    eventHandlers?: { mouseover?: () => void; click?: () => void };
    pathOptions?: { color?: string };
}

/** A circle marker as buttons the test can hover and click, with the radius and colour exposed */
export function CircleMarker({children, center, radius, eventHandlers, pathOptions}: MarkerProps) {
    return (
            <div data-testid="circle-marker" data-center={center.join(",")} data-radius={radius} data-color={pathOptions?.color}>
                <button type="button" data-testid="marker-hover" onClick={() => eventHandlers?.mouseover?.()}>hover</button>
                <button type="button" data-testid="marker-click" onClick={() => eventHandlers?.click?.()}>click</button>
                {children}
            </div>
    );
}

export function Tooltip({children}: { children?: ReactNode; permanent?: boolean; direction?: string; className?: string; opacity?: number }) {
    return <span data-testid="tooltip">{children}</span>;
}

export function Popup({children, eventHandlers}: { children?: ReactNode; eventHandlers?: { remove?: () => void }; closeButton?: boolean }) {
    return (
            <div data-testid="popup">
                <button type="button" data-testid="popup-close" onClick={() => eventHandlers?.remove?.()}>close</button>
                {children}
            </div>
    );
}
