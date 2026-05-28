import { requestCubeApi } from "./client";

export interface CloudClusterStatusData {
  clusterStatus: string;
  nodeStatus: string;
  resourceStatus: string;
  executionNode: string;
}

interface CloudClusterNode {
  host?: string;
  online?: string;
  resources_running?: string;
  standby?: string;
  maintenance?: string;
  pending?: string;
  unclean?: string;
  shutdown?: string;
  expected_up?: string;
}

interface PcsStatusResponse {
  code?: number;
  val?: {
    clustered_host?: string[];
    nodes?: CloudClusterNode[];
    started?: string;
    role?: string;
    active?: string;
    blocked?: string;
    failed?: string;
  };
  message?: string;
}

export const CLOUD_CLUSTER_STATUS_FALLBACK: CloudClusterStatusData = {
  clusterStatus: "N/A",
  nodeStatus: "N/A",
  resourceStatus: "N/A",
  executionNode: "N/A",
};

function isTrue(value: string | undefined): boolean {
  return value?.toLowerCase() === "true";
}

function isProblemNode(node: CloudClusterNode): boolean {
  return (
    !isTrue(node.online) ||
    isTrue(node.standby) ||
    isTrue(node.maintenance) ||
    isTrue(node.pending) ||
    isTrue(node.unclean) ||
    isTrue(node.shutdown) ||
    !isTrue(node.expected_up)
  );
}

function formatClusterStatus(val: NonNullable<PcsStatusResponse["val"]>): string {
  if (isTrue(val.failed) || isTrue(val.blocked) || !isTrue(val.active)) {
    return "HEALTH_ERR";
  }

  if (val.nodes?.some(isProblemNode)) {
    return "HEALTH_WARN";
  }

  return "HEALTH_OK";
}

function formatNodeStatus(val: NonNullable<PcsStatusResponse["val"]>): string {
  const nodes = val.clustered_host?.length
    ? val.clustered_host
    : val.nodes?.map((node) => node.host).filter((host): host is string => Boolean(host)) ?? [];

  if (nodes.length === 0) {
    return "N/A";
  }

  return `총 ${nodes.length}노드로 구성됨 : ( ${nodes.join(", ")} )`;
}

function formatResourceStatus(val: NonNullable<PcsStatusResponse["val"]>): string {
  if (isTrue(val.failed)) {
    return "실패";
  }

  if (isTrue(val.blocked)) {
    return "차단";
  }

  if (!isTrue(val.active)) {
    return "중지";
  }

  if (val.role?.toLowerCase() === "started") {
    return "실행중";
  }

  return val.role ?? "N/A";
}

function mapPcsStatus(val: NonNullable<PcsStatusResponse["val"]>): CloudClusterStatusData {
  return {
    clusterStatus: formatClusterStatus(val),
    nodeStatus: formatNodeStatus(val),
    resourceStatus: formatResourceStatus(val),
    executionNode: val.started ?? "N/A",
  };
}

export async function fetchCloudClusterStatus(): Promise<CloudClusterStatusData> {
  const parsed = await requestCubeApi<PcsStatusResponse>(
    "/api/v1/cube/pcs/control",
    {
      method: "POST",
      body: { action: "status" },
    }
  );

  if (parsed.code !== 200 || !parsed.val) {
    throw new Error(parsed.message ?? "Invalid PCS status response");
  }

  return mapPcsStatus(parsed.val);
}
