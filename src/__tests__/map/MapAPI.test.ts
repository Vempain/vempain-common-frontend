import {axiosMock, resetServiceMockState, setAuthorizationHeaderSpy} from "../../testUtils/mockAuthFrontend";
import {MapAPI} from "../../map";

describe("MapAPI", () => {
    beforeEach(() => resetServiceMockState());

    it("POSTs the viewport and filters to /clusters and the cell to /files", async () => {
        const api = new MapAPI("http://localhost:8080/api", "/map");
        const clusters = {precision: 2, clustered: true, total_points: 3, truncated: false, clusters: []};
        axiosMock.post.mockResolvedValueOnce({data: clusters});
        const request = {south: 59, west: 24, north: 61, east: 26, zoom: 8, file_type: "IMAGE"};

        await expect(api.getClusters(request)).resolves.toEqual(clusters);
        expect(setAuthorizationHeaderSpy).toHaveBeenCalledTimes(1);
        expect(axiosMock.defaults.headers.post["Content-Type"]).toBe("application/json;charset=utf-8");
        expect(axiosMock.post).toHaveBeenCalledWith("/clusters", request);

        const files = [{
            id: 1, filename: "a.jpg", file_path: "/p", file_type: "IMAGE", mimetype: "image/jpeg", latitude: 60.1, longitude: 24.9,
            original_datetime: null, thumbnail_id: null
        }];
        axiosMock.post.mockResolvedValueOnce({data: files});
        const cell = {cell_latitude: 60.17, cell_longitude: 24.94, precision: 2, limit: 50};
        await expect(api.getClusterFiles(cell)).resolves.toEqual(files);
        expect(axiosMock.post).toHaveBeenLastCalledWith("/files", cell);
    });
});
