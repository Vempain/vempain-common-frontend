export const ApiTokenScope = {
    FILE_SERVICE: "FILE_SERVICE" as const,
    MCP_READ: "MCP_READ" as const
};
export type ApiTokenScope = typeof ApiTokenScope[keyof typeof ApiTokenScope];

export interface ApiTokenRequest {
    description: string;
    network: string;
    expires_at: string;
    scope?: ApiTokenScope;
}

export interface ApiTokenResponse {
    id: number;
    token_prefix: string;
    description: string;
    scope: ApiTokenScope;
    network: string;
    expires_at: string;
    owner_user_id: number;
    created: string;
    last_used: string | null;
    expired: boolean;
}

export interface ApiTokenCreatedResponse {
    token: string;
    api_token: ApiTokenResponse;
}

export const ApiTokenNetworkSource = {
    CONFIGURED: "CONFIGURED" as const,
    PRIVATE_NETWORK: "PRIVATE_NETWORK" as const,
    NONE: "NONE" as const
};
export type ApiTokenNetworkSource = typeof ApiTokenNetworkSource[keyof typeof ApiTokenNetworkSource];

export interface ApiTokenNetworkCandidate {
    network: string;
    interface_name: string;
    address: string;
}

export interface ApiTokenNetworkResponse {
    network: string | null;
    source: ApiTokenNetworkSource;
    candidates: ApiTokenNetworkCandidate[];
}
