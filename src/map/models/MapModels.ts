/**
 * The contract of the map of GPS-tagged resources (`MapAPI` of vempain-common, hosted at `/map` by every backend that keeps files with
 * coordinates). JSON is snake_case like the Java DTOs of `vempain-common-api`.
 */

/** The optional filters shared by the cluster request and the request for the files of one cluster */
export interface MapFilterRequest {
    /** Only resources of this file type (a FileTypeEnum name); every type when absent */
    file_type?: string | null;
    /** Only resources taken at or after this ISO instant */
    from?: string | null;
    /** Only resources taken at or before this ISO instant */
    to?: string | null;
    /** Only resources carrying at least one of these tags (case insensitive) */
    tags?: string[] | null;
    /** Only resources whose file name contains this text (case insensitive) */
    search?: string | null;
}

/** The viewport and zoom level the clusters are asked for */
export interface MapClusterRequest extends MapFilterRequest {
    south: number;
    west: number;
    north: number;
    east: number;
    zoom: number;
}

/** The cell of one cluster, as the cluster response named it, plus the same filters */
export interface MapClusterFilesRequest extends MapFilterRequest {
    cell_latitude: number;
    cell_longitude: number;
    precision: number;
    limit?: number;
}

/** One cluster: the resources whose coordinates round to the same cell at the response's precision */
export interface MapClusterItem {
    /** Centroid of the clustered resources, where the marker is drawn */
    latitude: number;
    longitude: number;
    /** The cell, the coordinates rounded to the precision; identifies the cluster in a MapClusterFilesRequest */
    cell_latitude: number;
    cell_longitude: number;
    count: number;
    /** The resource when the cluster holds exactly one, null otherwise */
    file_id: number | null;
    filename: string | null;
}

export interface MapClusterResponse {
    /** Number of decimals the coordinates were rounded to (5 = single resources) */
    precision: number;
    /** Whether the clusters merge several resources */
    clustered: boolean;
    total_points: number;
    /** Whether the list of clusters was cut at the backend's limit; zoom in to see the rest */
    truncated: boolean;
    clusters: MapClusterItem[];
}

/** A GPS-tagged resource of a cluster: an original file on the file backend, a published site file on the admin backend */
export interface MapFileResponse {
    id: number;
    filename: string;
    file_path: string;
    file_type: string;
    mimetype: string;
    latitude: number;
    longitude: number;
    original_datetime: string | null;
    /** The thumbnail the answering service can show, null when it has none; what it refers to is the host's business */
    thumbnail_id: number | null;
}
