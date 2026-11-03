import {act, fireEvent, render, screen, waitFor} from "@testing-library/react";
import dayjs from "dayjs";
// imported from the modules, not the barrel: the barrel pulls the API client, which needs the auth library the test runtime cannot load
import {clusterRadius, MapView, toFilterRequest} from "../../map/MapView";
import {MAP_FETCH_DEBOUNCE_MS, MAP_MAX_LISTED_FILES} from "../../map/MapViewConfig";
import type {MapClusterResponse, MapFileResponse} from "../../map/models";
import {mapEventHandlers, mockMap} from "../../testUtils/reactLeafletMock";

jest.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (_key: string, options?: {
            defaultValue?: string;
            count?: number
        }) => (options?.defaultValue ?? _key).replace("{{count}}", String(options?.count ?? ""))
    })
}));

const getClusters = jest.fn();
const getClusterFiles = jest.fn();
const source = {getClusters, getClusterFiles};

const file = (id: number, filename: string): MapFileResponse => ({
    id, filename, file_path: "/trips", file_type: "IMAGE", mimetype: "image/jpeg", latitude: 60.17, longitude: 24.94,
    original_datetime: "2026-06-01T12:00:00Z", thumbnail_id: id + 100
});

function clusters(items: MapClusterResponse["clusters"], overrides: Partial<MapClusterResponse> = {}): MapClusterResponse {
    return {precision: 2, clustered: true, total_points: items.reduce((sum, item) => sum + item.count, 0), truncated: false, clusters: items, ...overrides};
}

const helsinki = {latitude: 60.17, longitude: 24.94, cell_latitude: 60.17, cell_longitude: 24.94, count: 3, file_id: null, filename: null};
const single = {latitude: 61.5, longitude: 23.76, cell_latitude: 61.5, cell_longitude: 23.76, count: 1, file_id: 7, filename: "tampere.jpg"};
const huge = {latitude: 60.2, longitude: 25.0, cell_latitude: 60.2, cell_longitude: 25.0, count: MAP_MAX_LISTED_FILES + 1, file_id: null, filename: null};

function renderMap(extra: Partial<Parameters<typeof MapView>[0]> = {}) {
    return render(<MapView source={source} fileTypes={[{value: "IMAGE", label: "Image"}, {value: "VIDEO", label: "Video"}]}
                           renderFileDetails={f => <div data-testid="details">details of {f.filename}</div>}
                           renderThumbnail={f => <img alt={`thumb ${f.thumbnail_id}`}/>}
                           tileUrl="https://tiles/{z}/{x}/{y}.png" attribution="tiles" {...extra}/>);
}

async function settle() {
    await act(async () => {
        await new Promise(resolve => setTimeout(resolve, MAP_FETCH_DEBOUNCE_MS + 20));
    });
}

describe("MapView", () => {
    beforeEach(() => {
        jest.useRealTimers();
        mockMap.reset();
        getClusters.mockReset();
        getClusterFiles.mockReset();
        getClusters.mockResolvedValue(clusters([helsinki, single, huge]));
        getClusterFiles.mockResolvedValue([file(1, "a.jpg"), file(2, "b.jpg"), file(3, "c.jpg")]);
        jest.spyOn(console, "error").mockImplementation(() => undefined);
    });

    afterEach(() => jest.restoreAllMocks());

    it("asks the backend for the clusters of the viewport once the map settles and draws one marker per cluster", async () => {
        renderMap();
        await settle();

        await waitFor(() => expect(getClusters).toHaveBeenCalledWith({south: 59.5, west: 24.0, north: 60.5, east: 25.5, zoom: 8}));
        expect(screen.getByTestId("tile-layer")).toHaveAttribute("data-url", "https://tiles/{z}/{x}/{y}.png");
        const markers = await screen.findAllByTestId("circle-marker");
        expect(markers).toHaveLength(3);
        // the count labels the clusters, a single resource has none
        expect(screen.getAllByTestId("tooltip").map(tip => tip.textContent)).toEqual(["3", String(MAP_MAX_LISTED_FILES + 1)]);
        expect(markers[1]).toHaveAttribute("data-color", "#1677ff");
        expect(screen.getByText("55 resources in view")).toBeInTheDocument();

        // a pan reports the new viewport and refetches after the debounce; the status shows the truncation hint
        getClusters.mockResolvedValue(clusters([helsinki], {truncated: true}));
        mockMap.bounds = {south: 50, west: 20, north: 70, east: 30};
        mockMap.zoom = 4;
        act(() => mapEventHandlers.current.moveend());
        await settle();
        await waitFor(() => expect(getClusters).toHaveBeenLastCalledWith({south: 50, west: 20, north: 70, east: 30, zoom: 4}));
        expect(await screen.findByText(/Only the largest clusters are shown/)).toBeInTheDocument();
    });

    it("lists the files of a small cluster on mouseover and opens the details and thumbnail of a clicked file", async () => {
        renderMap();
        await settle();
        const markers = await screen.findAllByTestId("circle-marker");

        fireEvent.click(markers[0].querySelector("[data-testid=marker-hover]") as HTMLElement);
        await waitFor(() => expect(getClusterFiles).toHaveBeenCalledWith({
            cell_latitude: 60.17, cell_longitude: 24.94, precision: 2, limit: MAP_MAX_LISTED_FILES
        }));
        expect(await screen.findByText("3 files")).toBeInTheDocument();
        expect(screen.getByText("b.jpg")).toBeInTheDocument();

        fireEvent.click(screen.getByText("b.jpg"));
        expect(await screen.findByTestId("details")).toHaveTextContent("details of b.jpg");
        expect(screen.getByAltText("thumb 102")).toBeInTheDocument();

        // hovering again does not fetch the same cell twice
        fireEvent.click(markers[0].querySelector("[data-testid=marker-hover]") as HTMLElement);
        expect(getClusterFiles).toHaveBeenCalledTimes(1);
    });

    it("asks to zoom in on a large cluster and zooms in when a cluster is clicked", async () => {
        renderMap();
        await settle();
        const markers = await screen.findAllByTestId("circle-marker");

        fireEvent.click(markers[2].querySelector("[data-testid=marker-hover]") as HTMLElement);
        expect(await screen.findByTestId("map-cluster-too-many")).toHaveTextContent("Too many files to display, please zoom in to see the individual files");
        expect(getClusterFiles).not.toHaveBeenCalled();

        fireEvent.click(screen.getByText("Zoom in"));
        expect(mockMap.setViewCalls).toEqual([{center: [60.2, 25.0], zoom: 11}]);

        fireEvent.click(markers[0].querySelector("[data-testid=marker-click]") as HTMLElement);
        expect(mockMap.setViewCalls).toHaveLength(2);
        expect(mockMap.setViewCalls[1]).toEqual({center: [60.17, 24.94], zoom: 14});
    });

    it("opens the single resource of a point from its popup", async () => {
        getClusterFiles.mockResolvedValue([file(7, "tampere.jpg")]);
        renderMap();
        await settle();
        const markers = await screen.findAllByTestId("circle-marker");

        fireEvent.click(markers[1].querySelector("[data-testid=marker-click]") as HTMLElement);
        await waitFor(() => expect(getClusterFiles).toHaveBeenCalledWith(expect.objectContaining({cell_latitude: 61.5, cell_longitude: 23.76})));
        fireEvent.click(await screen.findByText("tampere.jpg"));
        expect(await screen.findByTestId("details")).toHaveTextContent("details of tampere.jpg");
        expect(mockMap.setViewCalls).toHaveLength(0);
    });

    it("sends the applied filters with every request and clears them on reset", async () => {
        renderMap();
        await settle();
        await waitFor(() => expect(getClusters).toHaveBeenCalledTimes(1));

        fireEvent.change(screen.getByLabelText("File name contains"), {target: {value: "IMG_20"}});
        fireEvent.click(screen.getByText("Apply"));
        await settle();
        await waitFor(() => expect(getClusters).toHaveBeenLastCalledWith(expect.objectContaining({search: "IMG_20"})));
        expect(getClusters).toHaveBeenLastCalledWith(expect.not.objectContaining({file_type: expect.anything()}));

        fireEvent.click(screen.getByText("Reset"));
        await settle();
        await waitFor(() => expect(getClusters).toHaveBeenLastCalledWith({south: 59.5, west: 24.0, north: 60.5, east: 25.5, zoom: 8}));
    });

    it("reports a failed cluster load", async () => {
        getClusters.mockRejectedValue(new Error("down"));
        renderMap();
        await settle();
        expect(await screen.findByText("Could not load the map")).toBeInTheDocument();
    });

    it("turns the filter values into the request fields and sizes the markers by count", () => {
        expect(toFilterRequest({fileType: null, from: null, to: null, tags: [], search: "  "})).toEqual({});
        expect(toFilterRequest({fileType: "VIDEO", from: dayjs("2026-06-01T10:00:00Z"), to: dayjs("2026-06-30T10:00:00Z"), tags: ["summer"], search: " x "}))
                .toEqual({
                    file_type: "VIDEO", from: dayjs("2026-06-01T10:00:00Z").startOf("day").toISOString(),
                    to: dayjs("2026-06-30T10:00:00Z").endOf("day").toISOString(), tags: ["summer"], search: "x"
                });
        expect(clusterRadius(1)).toBe(7);
        expect(clusterRadius(10)).toBe(16);
        expect(clusterRadius(1_000_000)).toBe(28);
    });
});
