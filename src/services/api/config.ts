import cockpit from "cockpit";

const CUBE_CONF_PATHS = [
  "/etc/ablestack/cube.conf",
  "/root/ablecube-react/cube.conf",
];

interface CubeApiConfig {
  baseUrl: string;
  token: string;
}

let cubeApiConfigPromise: Promise<CubeApiConfig> | null = null;

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

  throw new Error(`cube.conf 파일을 읽을 수 없습니다. ${errors.join("; ")}`);
}

export async function getCubeApiConfig(): Promise<CubeApiConfig> {
  if (!cubeApiConfigPromise) {
    cubeApiConfigPromise = readCubeConf().then((content) => {
      const config = parseCubeConf(content);
      const baseUrl = config.CUBE_API_BASE_URL;
      const token = config.CUBE_API_TOKEN;

      if (!baseUrl || !token) {
        throw new Error("cube.conf에 CUBE_API_BASE_URL 또는 CUBE_API_TOKEN 값이 없습니다.");
      }

      return {
        baseUrl: normalizeBaseUrl(baseUrl),
        token,
      };
    });
  }

  return cubeApiConfigPromise;
}
