import cockpit from "cockpit";

import { isPreviewMode } from "./preview.ts";

const CUBE_CONF_PATHS = [
    "/etc/ablestack/cube.conf",
    "/root/ablecube-react/cube.conf",
];
const STATUS_CARD_REFRESH_INTERVAL_CONF_KEY = "DEFAULT_STATUS_CARD_REFRESH_INTERVAL_SECONDS";
const DEFAULT_CUBE_API_BASE_URL = "http://127.0.0.1:18090";
const ABLESTACK_API_ENV_PATH = "/etc/ablestack/ablestack-api.env";
const AUTH_TOKEN_HELPER = "/usr/bin/ablestack-auth-token";

export const FALLBACK_STATUS_CARD_REFRESH_INTERVAL_SECONDS = 10;

interface CubeApiConfig {
  baseUrl: string;
  token: string;
}

interface AuthTokenHelperResponse {
  authorization?: string;
  access_token?: string;
}

let cubeConfPromise: Promise<Record<string, string>> | null = null;
let apiEnvPromise: Promise<Record<string, string>> | null = null;
let cubeApiConfigPromise: Promise<CubeApiConfig> | null = null;
let cubeConfReadError = "";

function stripQuotes(value: string): string {
    return value.replace(/^["']|["']$/g, "");
}

function parseCubeConf(content: string): Record<string, string> {
    const config: Record<string, string> = {};

    for (const line of content.split(/\r?\n/)) {
        const trimmed = line.trim();

        if (!trimmed || trimmed.startsWith("#")) {
            continue;
        }

        const separatorIndex = trimmed.indexOf("=");

        if (separatorIndex === -1) {
            continue;
        }

        const key = trimmed.slice(0, separatorIndex).trim();
        const value = stripQuotes(trimmed.slice(separatorIndex + 1).trim());

        if (key && value) {
            config[key] = value;
        }
    }

    return config;
}

function normalizeBaseUrl(baseUrl: string): string {
    return baseUrl.replace(/\/+$/, "");
}

async function readCubeConf(): Promise<string> {
    const errors: string[] = [];

    for (const path of CUBE_CONF_PATHS) {
        try {
            const content = await cockpit.file(path, { superuser: "try" }).read();

            if (typeof content === "string") {
                return content;
            }

            errors.push(`${path}: 파일이 없습니다.`);
        } catch (error) {
            errors.push(`${path}: ${String(error)}`);
        }
    }

    cubeConfReadError = errors.join("; ");
    return "";
}

async function getCubeConf(): Promise<Record<string, string>> {
    if (!cubeConfPromise) {
        cubeConfPromise = readCubeConf().then(parseCubeConf);
    }

    return cubeConfPromise;
}

async function getApiEnv(): Promise<Record<string, string>> {
    if (!apiEnvPromise) {
        apiEnvPromise = cockpit.file(ABLESTACK_API_ENV_PATH, { superuser: "try" })
                .read()
                .then((content) => parseCubeConf(typeof content === "string" ? content : ""))
                .catch(() => ({}));
    }

    return apiEnvPromise;
}

function localApiBaseUrl(config: Record<string, string>, apiEnv: Record<string, string>): string {
    if (config.CUBE_API_BASE_URL) {
        return normalizeBaseUrl(config.CUBE_API_BASE_URL);
    }

    const port = apiEnv.ABLESTACK_API_PORT;

    if (port && /^\d+$/.test(port) && Number(port) >= 1 && Number(port) <= 65535) {
        return `http://127.0.0.1:${Number(port)}`;
    }

    return DEFAULT_CUBE_API_BASE_URL;
}

function parsePositiveIntervalSeconds(value: string | undefined): number {
    if (!value) {
        return FALLBACK_STATUS_CARD_REFRESH_INTERVAL_SECONDS;
    }

    const intervalSeconds = Number(value.replace(/_/g, ""));

    if (!Number.isFinite(intervalSeconds) || intervalSeconds <= 0) {
        return FALLBACK_STATUS_CARD_REFRESH_INTERVAL_SECONDS;
    }

    return intervalSeconds;
}

function normalizeBearerToken(value: string): string {
    return value.replace(/^Bearer\s+/i, "").trim();
}

async function issueCockpitAuthToken(): Promise<string> {
    const stdout = await cockpit.spawn([AUTH_TOKEN_HELPER], { superuser: "try" });
    const parsed = JSON.parse(stdout) as AuthTokenHelperResponse;
    const token = parsed.authorization ?? parsed.access_token;

    if (!token) {
        throw new Error("ablestack-auth-token 응답에 access token이 없습니다.");
    }

    return normalizeBearerToken(token);
}

async function resolveApiToken(
    config: Record<string, string>,
    forceIssuedToken = false
): Promise<string> {
    const configuredToken = normalizeBearerToken(config.CUBE_API_TOKEN ?? "");

    if (configuredToken && !forceIssuedToken) {
        return configuredToken;
    }

    try {
        return await issueCockpitAuthToken();
    } catch (error) {
        const confMessage = cubeConfReadError
            ? ` cube.conf 확인 결과: ${cubeConfReadError}`
            : "";
        const authMessage = configuredToken
            ? "CUBE_API_TOKEN 인증 실패 후 Cockpit 인증 토큰 재발급에 실패했습니다."
            : "CUBE_API_TOKEN 값이 없고 Cockpit 인증 토큰 발급에 실패했습니다.";

        throw new Error(`${authMessage}${confMessage} ${String(error)}`);
    }
}

function createCubeApiConfig(forceIssuedToken = false): Promise<CubeApiConfig> {
    return Promise.all([getCubeConf(), getApiEnv()]).then(async ([config, apiEnv]) => {
        const baseUrl = localApiBaseUrl(config, apiEnv);
        const token = await resolveApiToken(config, forceIssuedToken);

        return {
            baseUrl,
            token,
        };
    });
}

export async function getStatusCardRefreshIntervalMs(): Promise<number> {
    if (isPreviewMode()) {
        return Math.round(FALLBACK_STATUS_CARD_REFRESH_INTERVAL_SECONDS * 1000);
    }

    const config = await getCubeConf();
    const intervalSeconds = parsePositiveIntervalSeconds(
        config[STATUS_CARD_REFRESH_INTERVAL_CONF_KEY]
    );

    return Math.round(intervalSeconds * 1000);
}

export async function getCubeApiBaseUrl(): Promise<string> {
    if (isPreviewMode()) {
        return DEFAULT_CUBE_API_BASE_URL;
    }

    const [config, apiEnv] = await Promise.all([getCubeConf(), getApiEnv()]);

    return localApiBaseUrl(config, apiEnv);
}

export async function getCubeApiConfig(): Promise<CubeApiConfig> {
    if (isPreviewMode()) {
        return {
            baseUrl: DEFAULT_CUBE_API_BASE_URL,
            token: "preview-token",
        };
    }

    if (!cubeApiConfigPromise) {
        cubeApiConfigPromise = createCubeApiConfig()
                .catch((error) => {
                    cubeApiConfigPromise = null;
                    throw error;
                });
    }

    return cubeApiConfigPromise;
}

export function resetCubeApiConfigCache(): void {
    cubeApiConfigPromise = null;
}

export async function refreshCubeApiConfig(): Promise<CubeApiConfig> {
    if (isPreviewMode()) {
        return {
            baseUrl: DEFAULT_CUBE_API_BASE_URL,
            token: "preview-token",
        };
    }

    cubeApiConfigPromise = createCubeApiConfig(true)
            .catch((error) => {
                cubeApiConfigPromise = null;
                throw error;
            });

    return cubeApiConfigPromise;
}
