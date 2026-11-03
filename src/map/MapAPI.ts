import {AbstractAPI} from "@vempain/vempain-auth-frontend";
import type {MapClusterFilesRequest, MapClusterRequest, MapClusterResponse, MapFileResponse} from "./models";

/**
 * What the map view needs from a backend: the clusters of a viewport and the files of one cluster. {@link MapAPI} is the implementation
 * over the `/map` endpoints; a host may hand the view any object with these two methods.
 */
export interface MapViewSource {
    getClusters(request: MapClusterRequest): Promise<MapClusterResponse>;

    getClusterFiles(request: MapClusterFilesRequest): Promise<MapFileResponse[]>;
}

/**
 * Client of the `MapAPI` of vempain-common (`POST /map/clusters`, `POST /map/files`), hosted by the file backend for the original files and
 * by the admin backend for the published site files. Hosts create one instance per backend, for example `new MapAPI(apiUrl, "/map")`.
 */
export class MapAPI extends AbstractAPI<unknown, MapClusterResponse> implements MapViewSource {
    /** The clusters of the readable GPS-tagged resources inside the viewport, grouped by the backend at the precision of the zoom level */
    public async getClusters(request: MapClusterRequest): Promise<MapClusterResponse> {
        this.setAuthorizationHeader();
        this.axiosInstance.defaults.headers.post['Content-Type'] = 'application/json;charset=utf-8';
        const response = await this.axiosInstance.post<MapClusterResponse>("/clusters", request);
        return response.data;
    }

    /** The resources of one cluster, newest first, cut at the limit */
    public async getClusterFiles(request: MapClusterFilesRequest): Promise<MapFileResponse[]> {
        this.setAuthorizationHeader();
        this.axiosInstance.defaults.headers.post['Content-Type'] = 'application/json;charset=utf-8';
        const response = await this.axiosInstance.post<MapFileResponse[]>("/files", request);
        return response.data;
    }
}
