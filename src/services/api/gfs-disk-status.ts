import { requestCubeApi } from "./client";

export interface GfsDiskMountInfo {
  mountPath: string;
  status: string;
  devices: string;
  multipaths: string;
  physicalVolume: string;
  volumeGroup: string;
  diskSize: string;
  resourceStatus: string[];
}

export interface GfsDiskStatusData {
  mode: string;
  mountPath: string;
  mountDetails: GfsDiskMountInfo[];
  footerMessage: string;
  footerColor: string;
}

interface GfsDiskBlockDevice {
  lvm?: string;
  mountpoint?: string;
  size?: string;
  multipaths?: string[];
  devices?: string[];
  disk_id?: string[];
}

interface GfsDiskStatusResponse {
  code?: number | string;
  val?: {
    mode?: string;
    blockdevices?: GfsDiskBlockDevice[];
    message?: string;
  };
  message?: string;
}

interface GfsResourceItem {
  id?: string;
  node_name?: string;
  role?: string;
}

interface GfsResourceStatusResponse {
  code?: number | string;
  val?: {
    resources?: {
      glue_gfs_resources?: GfsResourceItem[];
    };
  };
}

export const GFS_DISK_STATUS_FALLBACK: GfsDiskStatusData = {
  mode: "N/A",
  mountPath: "",
  mountDetails: [],
  footerMessage: "GFS 디스크 상태 정보를 확인할 수 없습니다.",
  footerColor: "#f0ab00",
};

const GFS_DISK_STATUS_UNCONFIGURED: GfsDiskStatusData = {
  mode: "N/A",
  mountPath: "",
  mountDetails: [],
  footerMessage: "GFS 디스크가 생성되지 않았습니다.",
  footerColor: "#c9190b",
};

function isSuccessCode(code: number | string | undefined): boolean {
  return Number(code) === 200;
}

function formatMode(mode: string | undefined): string {
  switch (mode?.toLowerCase()) {
  case "multi":
    return "다중 모드";
  case "single":
    return "단일 모드";
  default:
    return mode?.trim() || "N/A";
  }
}

function formatList(values: string[] | undefined): string {
  const normalizedValues = values
    ?.map((value) => value.trim())
    .filter(Boolean) ?? [];

  return normalizedValues.length > 0 ? normalizedValues.join(", ") : "N/A";
}

function formatSize(size: string | undefined): string {
  const normalizedSize = size?.trim();

  if (!normalizedSize) {
    return "N/A";
  }

  if (/^\d+(?:\.\d+)?\s*[kmgtpe]$/i.test(normalizedSize)) {
    return `${normalizedSize}B`;
  }

  return normalizedSize;
}

function uniqueValues(values: Array<string | undefined>): string[] {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

function mountResourceId(mountPath: string): string {
  const mountPathSegments = mountPath.split("/").filter(Boolean);

  return mountPathSegments[mountPathSegments.length - 1] ?? mountPath;
}

function groupedResourceStatus(resources: GfsResourceItem[]): string[] {
  if (resources.length === 0) {
    return ["N/A"];
  }

  const grouped = new Map<string, string[]>();

  for (const resource of resources) {
    const role = resource.role ?? "N/A";
    grouped.set(role, [
      ...(grouped.get(role) ?? []),
      resource.node_name ?? "N/A",
    ]);
  }

  return Array.from(grouped.entries()).map(([role, nodes]) => (
    `${role} ( ${uniqueValues(nodes).join(", ") || "N/A"} )`
  ));
}

async function fetchGfsResourceStatusMap(): Promise<Map<string, string[]>> {
  const parsed = await requestCubeApi<GfsResourceStatusResponse>(
    "/api/v1/cube/gfs/resource/status"
  );
  const resources = isSuccessCode(parsed.code)
    ? parsed.val?.resources?.glue_gfs_resources ?? []
    : [];
  const grouped = new Map<string, GfsResourceItem[]>();

  for (const resource of resources) {
    const id = resource.id ?? "N/A";
    grouped.set(id, [...(grouped.get(id) ?? []), resource]);
  }

  const statusMap = new Map<string, string[]>();

  for (const [id, items] of grouped.entries()) {
    const statuses = groupedResourceStatus(items);
    statusMap.set(id, statuses);
    statusMap.set(mountResourceId(id), statuses);
  }

  return statusMap;
}

function mapBlockDevice(
  blockDevice: GfsDiskBlockDevice,
  resourceStatusMap: Map<string, string[]>
): GfsDiskMountInfo {
  const lvm = blockDevice.lvm?.trim() || "N/A";
  const mountPath = blockDevice.mountpoint?.trim() || "N/A";

  return {
    mountPath,
    status: "Health OK",
    devices: formatList(blockDevice.devices),
    multipaths: formatList(blockDevice.multipaths),
    physicalVolume: lvm,
    volumeGroup: lvm,
    diskSize: formatSize(blockDevice.size),
    resourceStatus: resourceStatusMap.get(mountResourceId(mountPath)) ?? ["N/A"],
  };
}

function mapGfsDiskStatus(
  val: NonNullable<GfsDiskStatusResponse["val"]>,
  resourceStatusMap: Map<string, string[]>
): GfsDiskStatusData {
  const mountDetails = (val.blockdevices ?? []).map((blockDevice) => (
    mapBlockDevice(blockDevice, resourceStatusMap)
  ));

  if (mountDetails.length === 0) {
    return GFS_DISK_STATUS_UNCONFIGURED;
  }

  return {
    mode: formatMode(val.mode),
    mountPath: mountDetails.map((mountInfo) => mountInfo.mountPath).join(", "),
    mountDetails,
    footerMessage: "GFS 디스크가 생성되었습니다.",
    footerColor: "#3e8635",
  };
}

export async function fetchGfsDiskStatus(): Promise<GfsDiskStatusData> {
  const [parsed, resourceStatusMap] = await Promise.all([
    requestCubeApi<GfsDiskStatusResponse>("/api/v1/cube/gfs/disk/status"),
    fetchGfsResourceStatusMap().catch(() => new Map<string, string[]>()),
  ]);

  if (parsed.code !== undefined && !isSuccessCode(parsed.code)) {
    return GFS_DISK_STATUS_UNCONFIGURED;
  }

  if (!parsed.val) {
    throw new Error(parsed.message ?? "Invalid GFS disk status response");
  }

  return mapGfsDiskStatus(parsed.val, resourceStatusMap);
}
