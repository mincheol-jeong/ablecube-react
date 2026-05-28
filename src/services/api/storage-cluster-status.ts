import { requestCubeApi } from "./client";

export interface StorageClusterStatusData {
  clusterStatus: string;
  diskStatus: string;
  gatewayStatus: string;
  daemonStatus: string;
  storagePools: string;
  storageCapacity: string;
  maintenanceStatus: boolean;
}

interface GlueClusterStatusResponse {
  cluster_status?: string;
  osd?: number | string;
  osd_up?: number | string;
  mon_gw1?: number | string;
  mon_gw2?: string[] | string;
  mgr?: string;
  mgr_cnt?: number | string;
  pools?: number | string;
  avail?: string;
  used?: string;
  usage_percentage?: string;
  maintenance_status?: boolean;
  json_raw?: {
    quorum_names?: string[] | string;
    monmap?: {
      mons?: Array<{
        name?: string;
      }>;
    };
    health?: {
      status?: string;
      checks?: {
        MON_DOWN?: {
          summary?: {
            count?: number | string;
          };
        };
      };
    };
  };
}

export const STORAGE_CLUSTER_STATUS_FALLBACK: StorageClusterStatusData = {
  clusterStatus: "N/A",
  diskStatus: "N/A",
  gatewayStatus: "N/A",
  daemonStatus: "N/A",
  storagePools: "N/A",
  storageCapacity: "N/A",
  maintenanceStatus: false,
};

function normalizeValue(value: number | string | undefined): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  const normalizedValue = String(value).trim();

  return normalizedValue && normalizedValue !== "N/A" ? normalizedValue : null;
}

function normalizeNumber(value: number | string | undefined): number | null {
  const normalizedValue = normalizeValue(value);

  if (!normalizedValue) {
    return null;
  }

  const numberValue = Number(normalizedValue);

  return Number.isFinite(numberValue) ? numberValue : null;
}

function normalizeStringList(value: string[] | string | undefined): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => item.trim()).filter(Boolean);
  }

  const normalizedValue = normalizeValue(value);

  return normalizedValue
    ? normalizedValue.split(",").map((item) => item.trim()).filter(Boolean)
    : [];
}

function uniqueValues(values: string[]): string[] {
  return Array.from(new Set(values));
}

function formatDiskStatus(response: GlueClusterStatusResponse): string {
  const osd = normalizeValue(response.osd);
  const osdUp = normalizeValue(response.osd_up);

  return osd && osdUp
    ? `전체 ${osd}개의 디스크 중 ${osdUp}개 작동 중`
    : "N/A";
}

function getAllGatewayNodes(response: GlueClusterStatusResponse): string[] {
  return uniqueValues(
    response.json_raw?.monmap?.mons
      ?.map((monitor) => monitor.name?.trim())
      .filter((name): name is string => Boolean(name)) ?? []
  );
}

function formatMissingQuorumStatus(
  gatewayCount: number,
  quorumNodes: string[],
  allGatewayNodes: string[]
): string {
  const quorumNodeSet = new Set(quorumNodes);
  const missingQuorumNodes = allGatewayNodes.filter((node) => !quorumNodeSet.has(node));

  if (missingQuorumNodes.length > 0) {
    return ` / quorum 누락 : ${missingQuorumNodes.join(", ")}`;
  }

  const missingQuorumCount = gatewayCount - quorumNodes.length;

  return missingQuorumCount > 0
    ? ` / quorum 누락 : ${missingQuorumCount}개`
    : "";
}

function formatGatewayStatus(response: GlueClusterStatusResponse): string {
  const gatewayCount = normalizeNumber(response.mon_gw1);
  const responseQuorumNodes = normalizeStringList(response.mon_gw2);
  const quorumNodes = uniqueValues(
    responseQuorumNodes.length > 0
      ? responseQuorumNodes
      : normalizeStringList(response.json_raw?.quorum_names)
  );

  if (gatewayCount === null || quorumNodes.length === 0) {
    return "N/A";
  }

  const monDownCount =
    normalizeNumber(response.json_raw?.health?.checks?.MON_DOWN?.summary?.count) ?? 0;
  const activeGatewayCount = Math.max(gatewayCount - monDownCount, 0);

  return [
    `RBD GW ${activeGatewayCount}개 실행 중`,
    `${gatewayCount}개 제공 중 (quorum : ${quorumNodes.join(", ")}${formatMissingQuorumStatus(
      gatewayCount,
      quorumNodes,
      getAllGatewayNodes(response)
    )})`,
  ].join(" / ");
}

function formatDaemonStatus(response: GlueClusterStatusResponse): string {
  const manager = normalizeValue(response.mgr);
  const managerCount = normalizeValue(response.mgr_cnt);

  return manager && managerCount
    ? `${manager} (전체 ${managerCount}개 실행중)`
    : "N/A";
}

function formatStoragePools(pools: number | string | undefined): string {
  const poolCount = normalizeValue(pools);

  return poolCount ? `${poolCount} pools` : "N/A";
}

function formatUsagePercentage(usagePercentage: string | undefined): string | null {
  const normalizedUsagePercentage = normalizeValue(usagePercentage);

  if (!normalizedUsagePercentage) {
    return null;
  }

  return normalizedUsagePercentage.includes("%")
    ? normalizedUsagePercentage
    : `${normalizedUsagePercentage} %`;
}

function formatStorageCapacity(response: GlueClusterStatusResponse): string {
  const available = normalizeValue(response.avail);
  const used = normalizeValue(response.used);
  const usagePercentage = formatUsagePercentage(response.usage_percentage);

  return available && used && usagePercentage
    ? `전체 ${available} 중 ${used} 사용 중 (사용률 ${usagePercentage})`
    : "N/A";
}

function mapGlueClusterStatus(response: GlueClusterStatusResponse): StorageClusterStatusData {
  return {
    clusterStatus: response.cluster_status ?? response.json_raw?.health?.status ?? "N/A",
    diskStatus: formatDiskStatus(response),
    gatewayStatus: formatGatewayStatus(response),
    daemonStatus: formatDaemonStatus(response),
    storagePools: formatStoragePools(response.pools),
    storageCapacity: formatStorageCapacity(response),
    maintenanceStatus: response.maintenance_status ?? false,
  };
}

export async function fetchStorageClusterStatus(): Promise<StorageClusterStatusData> {
  const parsed = await requestCubeApi<GlueClusterStatusResponse>(
    "/api/v1/cube/gluecluster/status"
  );

  return mapGlueClusterStatus(parsed);
}
