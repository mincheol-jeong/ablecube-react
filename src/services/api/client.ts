import cockpit from "cockpit";

import { getCubeApiConfig } from "./config";

interface CubeApiRequestOptions {
  method?: "GET" | "POST";
  body?: unknown;
}

function joinUrl(baseUrl: string, path: string): string {
  return `${baseUrl}/${path.replace(/^\/+/, "")}`;
}

export async function requestCubeApi<T>(
  path: string,
  options: CubeApiRequestOptions = {}
): Promise<T> {
  const { baseUrl, token } = await getCubeApiConfig();
  const method = options.method ?? "GET";
  const curlArgs = [
    "curl",
    "-sS",
    "--connect-timeout",
    "5",
    "--max-time",
    "15",
    "-X",
    method,
    joinUrl(baseUrl, path),
    "-H",
    "accept: application/json",
    "-H",
    `Authorization: Bearer ${token}`,
  ];

  if (options.body !== undefined) {
    curlArgs.push(
      "-H",
      "Content-Type: application/json",
      "-d",
      JSON.stringify(options.body)
    );
  }

  const stdout = await cockpit.spawn(curlArgs);
  return JSON.parse(stdout) as T;
}
