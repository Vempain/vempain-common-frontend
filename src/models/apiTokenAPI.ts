import {AbstractAPI} from "@vempain/vempain-auth-frontend";
import type {ApiTokenCreatedResponse, ApiTokenNetworkResponse, ApiTokenRequest, ApiTokenResponse} from "./apiToken";

export class ApiTokenAPI extends AbstractAPI<ApiTokenRequest, ApiTokenResponse> {
    public async list(): Promise<ApiTokenResponse[]> {
        return this.findAll();
    }

    public async defaultNetwork(): Promise<ApiTokenNetworkResponse> {
        this.setAuthorizationHeader();
        const response = await this.axiosInstance.get<ApiTokenNetworkResponse>("/default-network");
        return response.data;
    }

    public async createToken(request: ApiTokenRequest): Promise<ApiTokenCreatedResponse> {
        this.setAuthorizationHeader();
        const response = await this.axiosInstance.post<ApiTokenCreatedResponse>("", request);
        return response.data;
    }

    public async deleteToken(id: number): Promise<void> {
        this.setAuthorizationHeader();
        await this.axiosInstance.delete("/" + id);
    }
}
