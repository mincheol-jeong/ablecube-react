import React from "react";

import {
    Alert,
    Button,
    Card,
    CardBody,
    CardHeader,
    CardTitle,
    Checkbox,
    Content,
    Form,
    FormGroup,
    FormSelect,
    FormSelectOption,
    Label,
    Modal,
    ModalBody,
    ModalFooter,
    ModalHeader,
    Spinner,
    TextArea,
    TextInput,
} from "@patternfly/react-core";

import {
    fetchDeployUrl,
    fetchDeployRunJobs,
    startDeployRun,
    type DeployRunJob,
    type DeployRunStepResult,
    type DeployStatusData,
} from "../services/api/deploy-status.ts";
import { fetchDiskInventory, fetchNicInventory, type DiskInventoryOption, type InventorySelectOption } from "../services/api/inventory";
import { fetchCurrentHostIp, fetchCurrentHostname } from "../services/host";

interface AllInOneControlModalProps {
  isOpen: boolean;
  onClose: () => void;
  deployStatus: DeployStatusData;
  onStarted: (message: string) => void;
  onCompleted?: () => void;
}

type ProductType =
  | "ablestack-vm"
  | "ablestack-hci"
  | "ablestack-hci-filesystem"
  | "ablestack-standalone";

type RunPhase = "idle" | "running" | "success" | "error";
type UiStepState = "done" | "current" | "pending" | "failed";
type InventoryLoadState = "idle" | "loading" | "success" | "error";

interface HostRow {
  index: string;
  hostname: string;
  ablecube: string;
  scvmMngt?: string;
  ablecubePn?: string;
  scvm?: string;
  scvmCn?: string;
}

interface FlowStep {
  id: string;
  label: string;
  description: string;
  deploySteps: string[];
}

interface RestartRecommendation {
  index: number;
  summary: string;
  detail: string;
  isComplete: boolean;
}

const PRODUCT_OPTIONS: Array<{ value: ProductType; label: string }> = [
    { value: "ablestack-vm", label: "ABLESTACK-VM" },
    { value: "ablestack-hci", label: "ABLESTACK-HCI" },
    { value: "ablestack-hci-filesystem", label: "ABLESTACK-HCI Filesystem" },
    { value: "ablestack-standalone", label: "ABLESTACK Standalone" },
];

const EMPTY_BRIDGE_OPTIONS: InventorySelectOption[] = [
    { value: "", label: "선택하십시오" },
];

const optionValueAt = (options: InventorySelectOption[], index: number) =>
    options.filter((option) => option.value)[index]?.value || "";

const PRODUCT_SET = new Set<string>(PRODUCT_OPTIONS.map((option) => option.value));

const DEFAULT_HOSTS = [
    "1,ablecube1,10.10.31.1,10.10.31.11,100.100.31.1,100.100.31.11,100.200.31.11",
    "2,ablecube2,10.10.31.2,10.10.31.12,100.100.31.2,100.100.31.12,100.200.31.12",
    "3,ablecube3,10.10.31.3,10.10.31.13,100.100.31.3,100.100.31.13,100.200.31.13",
].join("\n");

const DEFAULT_SCVM_BY_HOST = [
    "ablecube1=/dev/disk/by-id/wwn-0x1111",
    "ablecube2=/dev/disk/by-id/wwn-0x2222",
    "ablecube3=/dev/disk/by-id/wwn-0x3333",
].join("\n");

const STEP_STATUS_LABELS: Record<string, string> = {
    pending: "대기",
    running: "진행 중",
    succeeded: "성공",
    failed: "실패",
    skipped: "건너뜀",
};

function isProductType(value: string): value is ProductType {
    return PRODUCT_SET.has(value);
}

function initialProductType(status: DeployStatusData): ProductType {
    return isProductType(status.osType) ? status.osType : "ablestack-vm";
}

function productLabel(type: ProductType): string {
    return PRODUCT_OPTIONS.find((option) => option.value === type)?.label ?? type;
}

function splitLines(value: string): string[] {
    return value
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter(Boolean);
}

function splitList(value: string): string[] {
    return value
            .split(/[\n,]+/)
            .map((item) => item.trim())
            .filter(Boolean);
}

function parseHosts(value: string): HostRow[] {
    return splitLines(value).map((line) => {
        const fields = line.split(",").map((field) => field.trim());

        return {
            index: fields[0] ?? "",
            hostname: fields[1] ?? "",
            ablecube: fields[2] ?? "",
            scvmMngt: fields[3] || undefined,
            ablecubePn: fields[4] || undefined,
            scvm: fields[5] || undefined,
            scvmCn: fields[6] || undefined,
        };
    });
}

function serializeHosts(hosts: HostRow[]): string {
    return hosts.map((host) => [
        host.index,
        host.hostname,
        host.ablecube,
        host.scvmMngt ?? "",
        host.ablecubePn ?? "",
        host.scvm ?? "",
        host.scvmCn ?? "",
    ].join(",")).join("\n");
}

function parseVolumeGroups(value: string): Array<{ vg_name: string; lv_name: string }> {
    return splitLines(value).map((line) => {
        const separator = line.includes("/") && !line.includes(",") ? "/" : ",";
        const [vgName, lvName] = line.split(separator).map((field) => field.trim());

        return {
            vg_name: vgName ?? "",
            lv_name: lvName ?? "",
        };
    })
            .filter((item) => item.vg_name && item.lv_name);
}

function readFileAsBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = () => {
            const result = typeof reader.result === "string" ? reader.result : "";
            resolve(result.includes(",") ? result.split(",")[1] : result);
        };
        reader.onerror = () => reject(reader.error ?? new Error("파일을 읽을 수 없습니다."));
        reader.readAsDataURL(file);
    });
}

function flowStepsFor(productType: ProductType): FlowStep[] {
    const usesStorageCenter = productType === "ablestack-hci" || productType === "ablestack-hci-filesystem";
    const usesHciFilesystem = productType === "ablestack-hci-filesystem";
    const usesExternalGfs = productType === "ablestack-vm";
    const usesLocal = productType === "ablestack-standalone";

    return [
        {
            id: "license",
            label: "라이센스 등록",
            description: "선택한 라이센스 파일 또는 마스터 노드의 기존 라이센스를 전체 대상에 배포합니다.",
            deploySteps: ["license_apply"],
        },
        {
            id: "cluster",
            label: "클러스터 구성 준비",
            description: "제품 타입, host 목록, 관리 네트워크와 PCS 대상 정보를 검증합니다.",
            deploySteps: ["cluster_apply"],
        },
        ...(usesStorageCenter
            ? [
                {
                    id: "scvm",
                    label: "스토리지 VM 구성",
                    description: "host별 SCVM 리소스, 디스크 passthrough, 네트워크 bridge 값을 검증합니다.",
                    deploySteps: ["scvm_prepare"],
                },
                {
                    id: "storage_center",
                    label: "스토리지센터 구성",
                    description: "SCVM bootstrap 상태와 스토리지센터 API 준비 상태를 기준으로 초기 구성을 확인합니다.",
                    deploySteps: ["scvm_bootstrap"],
                },
                {
                    id: "storage_cluster",
                    label: "스토리지 클러스터 상세 구성",
                    description: "SCVM host 등록, OSD 등록, rbd pool 복제/PG autoscale 구성 흐름을 확인합니다.",
                    deploySteps: [],
                }
            ]
            : []),
        ...(usesHciFilesystem
            ? [
                {
                    id: "hci_shared_file",
                    label: "RBD/GFS 구성",
                    description: "rbd image 생성, 각 host rbd map, Global File System mount 구성을 준비합니다.",
                    deploySteps: ["rbd_prepare", "storage_prepare"],
                }
            ]
            : []),
        ...(usesExternalGfs
            ? [
                {
                    id: "gfs_storage",
                    label: "GFS 스토리지 구성",
                    description: "외부 스토리지 기반 GFS 대상 디스크, VG/LV, mount point 값을 검증합니다.",
                    deploySteps: ["storage_prepare"],
                }
            ]
            : []),
        ...(usesLocal
            ? [
                {
                    id: "local_storage",
                    label: "로컬 스토리지 구성",
                    description: "Standalone 로컬 디스크 구성을 검증합니다.",
                    deploySteps: ["local_prepare"],
                }
            ]
            : []),
        {
            id: "ccvm",
            label: "클라우드 VM 구성",
            description: "CCVM 리소스, 관리 bridge, 선택적 service network 값을 검증합니다.",
            deploySteps: ["ccvm_prepare"],
        },
        {
            id: "cloud_center",
            label: "클라우드센터 구성",
            description: "CCVM bootstrap 실행과 CloudStack 서비스 준비 상태를 확인합니다.",
            deploySteps: ["ccvm_bootstrap"],
        },
        {
            id: "monitoring_connect",
            label: "모니터링센터 연결",
            description: "입력값을 최종 검증한 뒤 올인원 구성 Job을 시작하고, 완료 후 모니터링센터 연결로 이어갑니다.",
            deploySteps: ["system_profile"],
        },
    ];
}

function deployOnlyStepsFor(productType: ProductType): string[] {
    const commonHead = ["license_apply", "cluster_apply"];
    const commonTail = ["ccvm_prepare", "ccvm_bootstrap", "system_profile"];

    switch (productType) {
    case "ablestack-hci":
        return [...commonHead, "scvm_prepare", "scvm_bootstrap", ...commonTail];
    case "ablestack-hci-filesystem":
        return [...commonHead, "scvm_prepare", "scvm_bootstrap", "rbd_prepare", "storage_prepare", ...commonTail];
    case "ablestack-standalone":
        return [...commonHead, "local_prepare", ...commonTail];
    case "ablestack-vm":
    default:
        return [...commonHead, "storage_prepare", ...commonTail];
    }
}

function labelForUiStepState(state: UiStepState, phase: RunPhase) {
    switch (state) {
    case "done":
        return <Label color={phase === "idle" ? "cyan" : "green"}>{phase === "idle" ? "입력 완료" : "완료"}</Label>;
    case "current":
        return (
            <Label color={phase === "idle" ? "blue" : "orange"}>
                {phase === "idle" ? "입력 중" : "진행 중"}
            </Label>
        );
    case "failed":
        return <Label color="red">실패</Label>;
    default:
        return <Label color="grey">대기</Label>;
    }
}

function colorForJobStatus(status: string) {
    if (status === "failed") return "red";
    if (status === "succeeded") return "green";
    return "blue";
}

function colorForJobStepStatus(status: string) {
    if (status === "failed") return "red";
    if (status === "succeeded") return "green";
    return "grey";
}

function isTrueStatus(value: string): boolean {
    return value.toLowerCase() === "true";
}

function isRunningStatus(value: string): boolean {
    return value.toUpperCase() === "RUNNING" || value.toLowerCase() === "running";
}

function isFlowStepComplete(step: FlowStep, productType: ProductType, status: DeployStatusData): boolean {
    const raw = status.raw;

    switch (step.id) {
    case "license":
        return isTrueStatus(raw.licenseStatus);
    case "cluster":
        return isTrueStatus(raw.clusterConfigStatus);
    case "scvm":
        return isRunningStatus(raw.storageVmStatus);
    case "storage_center":
        return isTrueStatus(raw.storageVmBootstrapStatus);
    case "storage_cluster":
        return raw.storageClusterStatus.toUpperCase() === "HEALTH_OK" ||
            raw.storageClusterStatus.toUpperCase() === "HEALTH_WARN";
    case "hci_shared_file":
    case "gfs_storage":
        return isTrueStatus(raw.gfsConfigureStatus);
    case "local_storage":
        return isTrueStatus(raw.localConfigureStatus);
    case "ccvm":
        return isRunningStatus(raw.cloudVmStatus);
    case "cloud_center":
        return isTrueStatus(raw.cloudVmBootstrapStatus);
    case "monitoring_connect":
        return isTrueStatus(raw.monitoringStatus);
    default:
        return false;
    }
}

function firstFailedFlowStepIndex(flowSteps: FlowStep[], job: DeployRunJob | null): number {
    const failedStep = job?.steps.find((step) => step.status === "failed");

    if (!failedStep) return -1;
    return flowSteps.findIndex((step) => step.deploySteps.includes(failedStep.name));
}

function restartRecommendationFor(
    productType: ProductType,
    status: DeployStatusData,
    job: DeployRunJob | null = null
): RestartRecommendation {
    const flowSteps = flowStepsFor(productType);
    const failedIndex = firstFailedFlowStepIndex(flowSteps, job);

    if (failedIndex >= 0) {
        const failedFlowStep = flowSteps[failedIndex];
        const failedJobStep = job?.steps.find((step) => step.status === "failed");
        const failedMessage = failedJobStep?.message ? ` 실패 메시지: ${failedJobStep.message}` : "";

        return {
            index: failedIndex,
            summary: `${failedFlowStep.label}부터 재시도`,
            detail: `${failedFlowStep.label} 단계에서 Job 실행이 실패했습니다.${failedMessage} 입력값을 확인한 뒤 해당 단계부터 다시 진행하는 것을 권장합니다.`,
            isComplete: false,
        };
    }

    const incompleteIndex = flowSteps.findIndex((step) => !isFlowStepComplete(step, productType, status));

    if (incompleteIndex < 0) {
        const lastIndex = Math.max(flowSteps.length - 1, 0);

        return {
            index: lastIndex,
            summary: "재시작 필요 없음",
            detail: "현재 제품 흐름은 모니터링센터 연결 단계까지 완료된 상태로 판단됩니다.",
            isComplete: true,
        };
    }

    const incompleteStep = flowSteps[incompleteIndex];
    const completedCount = flowSteps.slice(0, incompleteIndex)
            .filter((step) => isFlowStepComplete(step, productType, status))
            .length;

    return {
        index: incompleteIndex,
        summary: `${incompleteStep.label}부터 다시 확인`,
        detail: `현재 제품 흐름에서 ${completedCount}/${flowSteps.length} 단계가 완료된 것으로 판단됩니다. 이전 단계는 상태값 기준으로 완료되어 있으니 ${incompleteStep.label} 단계부터 입력값을 확인하고 이어서 진행하세요.`,
        isComplete: false,
    };
}

function jobStepMap(job: DeployRunJob | null): Record<string, DeployRunStepResult> {
    return Object.fromEntries((job?.steps ?? []).map((step) => [step.name, step]));
}

function stateForFlowStep(
    step: FlowStep,
    index: number,
    activeStep: number,
    phase: RunPhase,
    job: DeployRunJob | null
): UiStepState {
    if (!job || phase === "idle") {
        if (index < activeStep) return "done";
        if (index === activeStep) return "current";
        return "pending";
    }

    const steps = jobStepMap(job);
    const statuses = step.deploySteps
            .map((deployStep) => steps[deployStep]?.status)
            .filter(Boolean);

    if (statuses.includes("failed")) return "failed";
    if (statuses.includes("running") || step.deploySteps.includes(job.currentStep)) return "current";
    if (statuses.length > 0 && statuses.every((status) => status === "succeeded" || status === "skipped")) {
        return "done";
    }
    if (job.status === "succeeded") return "done";

    return "pending";
}

function jobSummary(job: DeployRunJob): string {
    return `Job ${job.jobId || "-"} 시작됨`;
}

function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

export default function AllInOneControlModal({
    isOpen,
    onClose,
    deployStatus,
    onStarted,
    onCompleted,
}: AllInOneControlModalProps) {
    const [activeStep, setActiveStep] = React.useState(0);
    const [productType, setProductType] = React.useState<ProductType>(initialProductType(deployStatus));
    const [licenseFile, setLicenseFile] = React.useState<File | null>(null);
    const [licenseFilename, setLicenseFilename] = React.useState("license.lic");
    const [updateSystemProfile, setUpdateSystemProfile] = React.useState(true);
    const [ccvmIp, setCcvmIp] = React.useState("10.10.31.10");
    const [mngtCidr, setMngtCidr] = React.useState("16");
    const [mngtGw, setMngtGw] = React.useState("10.10.0.1");
    const [mngtDns, setMngtDns] = React.useState("8.8.8.8");
    const [externalTimeServer, setExternalTimeServer] = React.useState("time.google.com");
    const [currentHostIp, setCurrentHostIp] = React.useState("");
    const [iscsiStorage, setIscsiStorage] = React.useState(false);
    const [pcsClusterListText, setPcsClusterListText] = React.useState("10.10.31.1");
    const [hostsText, setHostsText] = React.useState(DEFAULT_HOSTS);
    const [scvmCpu, setScvmCpu] = React.useState("8");
    const [scvmMemory, setScvmMemory] = React.useState("32");
    const [scvmDiskType, setScvmDiskType] = React.useState("disk_passthrough");
    const [scvmMgmtBridge, setScvmMgmtBridge] = React.useState("");
    const [scvmStorageMode, setScvmStorageMode] = React.useState("bridge");
    const [scvmServerBridge, setScvmServerBridge] = React.useState("");
    const [scvmReplicationBridge, setScvmReplicationBridge] = React.useState("");
    const [scvmByHostText, setScvmByHostText] = React.useState(DEFAULT_SCVM_BY_HOST);
    const [gfsDisksText, setGfsDisksText] = React.useState("");
    const [gfsDiskOptions, setGfsDiskOptions] = React.useState<DiskInventoryOption[]>([]);
    const [gfsDiskLoadState, setGfsDiskLoadState] = React.useState<InventoryLoadState>("idle");
    const [gfsDiskLoadError, setGfsDiskLoadError] = React.useState("");
    const [volumeGroupsText, setVolumeGroupsText] = React.useState("vg_glue,lv_glue");
    const [gfsMountPoint, setGfsMountPoint] = React.useState("/mnt/glue-gfs");
    const [rbdPoolName, setRbdPoolName] = React.useState("rbd");
    const [rbdImagePrefix, setRbdImagePrefix] = React.useState("gfs");
    const [rbdSizeGiB, setRbdSizeGiB] = React.useState("5000");
    const [localDisksText, setLocalDisksText] = React.useState("/dev/sdb");
    const [ccvmCpu, setCcvmCpu] = React.useState("8");
    const [ccvmMemory, setCcvmMemory] = React.useState("32");
    const [ccvmMgmtBridge, setCcvmMgmtBridge] = React.useState("");
    const [ccvmServiceBridge, setCcvmServiceBridge] = React.useState("");
    const [bridgeOptions, setBridgeOptions] = React.useState<InventorySelectOption[]>(EMPTY_BRIDGE_OPTIONS);
    const [nicLoadState, setNicLoadState] = React.useState<InventoryLoadState>("idle");
    const [nicLoadError, setNicLoadError] = React.useState("");
    const [serviceNetworkEnabled, setServiceNetworkEnabled] = React.useState(false);
    const [serviceNic, setServiceNic] = React.useState("");
    const [serviceIp, setServiceIp] = React.useState("");
    const [servicePrefix, setServicePrefix] = React.useState("16");
    const [serviceGw, setServiceGw] = React.useState("");
    const [serviceDns, setServiceDns] = React.useState("");
    const [phase, setPhase] = React.useState<RunPhase>("idle");
    const [message, setMessage] = React.useState("");
    const [connectionNotice, setConnectionNotice] = React.useState("");
    const [runningJob, setRunningJob] = React.useState<DeployRunJob | null>(null);
    const [runningJobId, setRunningJobId] = React.useState("");
    const wasOpenRef = React.useRef(false);

    const isHci = productType === "ablestack-hci" || productType === "ablestack-hci-filesystem";
    const usesHciFilesystem = productType === "ablestack-hci-filesystem";
    const usesExternalGfs = productType === "ablestack-vm";
    const usesGfsMount = usesExternalGfs || usesHciFilesystem;
    const usesLocal = productType === "ablestack-standalone";
    const cloudCenterWaitText = productType === "ablestack-vm"
        ? "CloudStack 서비스 준비까지 보통 5~10분 정도 걸립니다."
        : "CloudStack 서비스 준비까지 보통 20분 정도 걸립니다.";
    const flowSteps = flowStepsFor(productType);
    const activeFlowStep = flowSteps[activeStep] ?? flowSteps[0];
    const restartRecommendation = restartRecommendationFor(productType, deployStatus, runningJob);
    const isRunning = phase === "running";
    const isInputPhase = phase === "idle";

    React.useEffect(() => {
        if (!isOpen) {
            wasOpenRef.current = false;
            return;
        }

        if (wasOpenRef.current) return;
        wasOpenRef.current = true;

        const nextProductType = initialProductType(deployStatus);
        const nextRecommendation = restartRecommendationFor(nextProductType, deployStatus);

        setProductType(nextProductType);
        setActiveStep(nextRecommendation.index);
        setPhase("idle");
        setMessage("");
        setConnectionNotice("");
        setRunningJob(null);
        setRunningJobId("");
        fetchCurrentHostIp()
                .then((hostIp) => {
                    if (!hostIp) return;
                    setCurrentHostIp(hostIp);
                    setExternalTimeServer((prev) => (
                        !prev.trim() || prev.trim() === "time.google.com" ? hostIp : prev
                    ));
                    setHostsText((prev) => {
                        const rows = parseHosts(prev);

                        if (rows[0] && (!rows[0].ablecube || rows[0].ablecube === "10.10.31.1")) {
                            rows[0] = { ...rows[0], ablecube: hostIp };
                            return serializeHosts(rows);
                        }

                        return prev;
                    });
                })
                .catch(() => undefined);
        fetchCurrentHostname()
                .then((hostname) => {
                    if (!hostname) return;
                    setHostsText((prev) => {
                        const rows = parseHosts(prev);

                        if (rows[0] && (!rows[0].hostname || rows[0].hostname === "ablecube1")) {
                            rows[0] = { ...rows[0], hostname };
                            return serializeHosts(rows);
                        }

                        return prev;
                    });
                })
                .catch(() => undefined);
    }, [isOpen, deployStatus]);

    React.useEffect(() => {
        if (!isOpen) return;

        let isActive = true;

        setNicLoadState("loading");
        setNicLoadError("");
        fetchNicInventory()
                .then((inventory) => {
                    if (!isActive) return;
                    const nextBridgeOptions = inventory.bridges.length > 0 ? inventory.bridges : EMPTY_BRIDGE_OPTIONS;

                    setBridgeOptions(nextBridgeOptions);
                    setScvmMgmtBridge((prev) => (
                        nextBridgeOptions.some((option) => option.value === prev) ? prev : optionValueAt(nextBridgeOptions, 0)
                    ));
                    setCcvmMgmtBridge((prev) => (
                        nextBridgeOptions.some((option) => option.value === prev) ? prev : optionValueAt(nextBridgeOptions, 0)
                    ));
                    setScvmServerBridge((prev) => (
                        nextBridgeOptions.some((option) => option.value === prev) ? prev : optionValueAt(nextBridgeOptions, 1)
                    ));
                    setScvmReplicationBridge((prev) => (
                        nextBridgeOptions.some((option) => option.value === prev) ? prev : optionValueAt(nextBridgeOptions, 2)
                    ));
                    setNicLoadState("success");
                })
                .catch((error) => {
                    if (!isActive) return;
                    setBridgeOptions(EMPTY_BRIDGE_OPTIONS);
                    setNicLoadState("error");
                    setNicLoadError(errorMessage(error) || "NIC 목록을 불러오지 못했습니다.");
                });

        setGfsDiskLoadState("loading");
        setGfsDiskLoadError("");
        fetchDiskInventory("gfs")
                .then((options) => {
                    if (!isActive) return;
                    setGfsDiskOptions(options);
                    setGfsDisksText((prev) => {
                        const selected = splitList(prev).filter((disk) => options.some((option) => option.value === disk));

                        if (selected.length > 0) {
                            return selected.join("\n");
                        }

                        return "";
                    });
                    setGfsDiskLoadState("success");
                })
                .catch((error) => {
                    if (!isActive) return;
                    setGfsDiskOptions([]);
                    setGfsDisksText("");
                    setGfsDiskLoadState("error");
                    setGfsDiskLoadError(errorMessage(error) || "GFS 디스크 목록을 불러오지 못했습니다.");
                });

        return () => {
            isActive = false;
        };
    }, [isOpen]);

    React.useEffect(() => {
        if (activeStep > flowSteps.length - 1) {
            setActiveStep(flowSteps.length - 1);
        }
    }, [activeStep, flowSteps.length]);

    React.useEffect(() => {
        if (!runningJobId || phase !== "running") return undefined;

        const refreshJob = () => {
            fetchDeployRunJobs()
                    .then((jobs) => {
                        const nextJob = jobs.find((job) => job.jobId === runningJobId);

                        if (!nextJob) return;
                        setRunningJob(nextJob);
                        if (nextJob.status === "succeeded") {
                            setPhase("success");
                            setMessage(`올인원 구성 Job이 완료되었습니다. ${cloudCenterWaitText}`);
                            onCompleted?.();
                        } else if (nextJob.status === "failed") {
                            setPhase("error");
                            setMessage(nextJob.message || "올인원 구성 Job이 실패했습니다.");
                        }
                    })
                    .catch((error) => {
                        setMessage(`Job 상태 확인에 실패했습니다: ${errorMessage(error)}`);
                    });
        };

        refreshJob();
        const intervalId = window.setInterval(refreshJob, 5000);

        return () => window.clearInterval(intervalId);
    }, [cloudCenterWaitText, onCompleted, phase, runningJobId]);

    const updateProductType = (nextType: ProductType) => {
        setProductType(nextType);
        setActiveStep(restartRecommendationFor(nextType, deployStatus).index);
        if (nextType === "ablestack-standalone") {
            setPcsClusterListText("");
        } else if (!pcsClusterListText.trim()) {
            setPcsClusterListText("10.10.31.1");
        }
    };

    const updateHosts = (nextHosts: HostRow[]) => {
        setHostsText(serializeHosts(nextHosts));
    };

    const updateHost = (index: number, key: keyof HostRow, value: string) => {
        const hosts = parseHosts(hostsText);

        hosts[index] = {
            ...hosts[index],
            [key]: value,
        };
        updateHosts(hosts);
    };

    const addHost = () => {
        const hosts = parseHosts(hostsText);
        const nextIndex = hosts.length + 1;

        updateHosts([
            ...hosts,
            {
                index: String(nextIndex),
                hostname: `ablecube${nextIndex}`,
                ablecube: "",
                scvmMngt: "",
                ablecubePn: "",
                scvm: "",
                scvmCn: "",
            },
        ]);
    };

    const removeHost = () => {
        const minHosts = isHci ? 3 : 1;
        const hosts = parseHosts(hostsText);

        if (hosts.length <= minHosts) return;
        updateHosts(hosts.slice(0, -1));
    };

    const updatePcsItem = (index: number, value: string) => {
        const items = splitList(pcsClusterListText);

        items[index] = value;
        setPcsClusterListText(items.join("\n"));
    };

    const addPcsItem = () => {
        setPcsClusterListText([...splitList(pcsClusterListText), ""].join("\n"));
    };

    const removePcsItem = () => {
        const minItems = isHci ? 3 : 1;
        const items = splitList(pcsClusterListText);

        if (items.length <= minItems) return;
        setPcsClusterListText(items.slice(0, -1).join("\n"));
    };

    const parseSCVMByHost = () => {
        const shared = {
            cpu: Number(scvmCpu) || 8,
            memory: Number(scvmMemory) || 32,
            disk_type: scvmDiskType,
            management_network_bridge: scvmMgmtBridge,
            storage_traffic_network_type: scvmStorageMode,
            server_network_bridge: scvmServerBridge,
            replication_network_bridge: scvmReplicationBridge,
        };
        const out: Record<string, unknown> = {};

        splitLines(scvmByHostText).forEach((line) => {
            const [rawKey, rawValue] = line.includes("=")
                ? line.split(/=(.*)/s)
                : [
                    line.split(",")[0], line.split(",").slice(1)
                            .join(",")
                ];
            const key = rawKey.trim();
            const disks = splitList(rawValue ?? "");

            if (!key) return;
            out[key] = {
                ...shared,
                ...(scvmDiskType === "raid_passthrough" ? { raid_passthrough_list: disks } : {}),
                ...(scvmDiskType === "lun_passthrough" ? { lun_passthrough_list: disks } : {}),
                ...(scvmDiskType === "disk_passthrough" ? { disk_passthrough_list: disks } : {}),
            };
        });

        return out;
    };

    const buildPayload = async (): Promise<Record<string, unknown>> => {
        const hosts = parseHosts(hostsText).map((host) => (
            isHci
                ? host
                : {
                    index: host.index,
                    hostname: host.hostname,
                    ablecube: host.ablecube,
                }
        ));
        const payload: Record<string, unknown> = {
            mode: "all",
            only: deployOnlyStepsFor(productType),
            update_system_profile: updateSystemProfile,
            cluster: {
                action: "insert",
                option: "hostOnly",
                type: productType,
                ccvm: { ip: ccvmIp.trim() },
                mngtNic: {
                    cidr: mngtCidr.trim(),
                    gw: mngtGw.trim(),
                    dns: mngtDns.trim(),
                },
                external_timeserver: externalTimeServer.trim(),
                storage_network: String(iscsiStorage),
                pcs_cluster_list: splitList(pcsClusterListText),
                hosts,
            },
            ccvm_xml: {
                cpu: Number(ccvmCpu) || 8,
                memory: Number(ccvmMemory) || 32,
                management_network_bridge: ccvmMgmtBridge.trim(),
                ...(ccvmServiceBridge.trim() ? { service_network_bridge: ccvmServiceBridge.trim() } : {}),
                ...(usesGfsMount ? { gfs_mount_point: gfsMountPoint.trim() } : {}),
            },
            ccvm_lifecycle: { action: "setup" },
        };

        if (licenseFile) {
            payload.license_content = await readFileAsBase64(licenseFile);
            payload.license_filename = licenseFilename.trim() || licenseFile.name || "license.lic";
        }

        if (isHci) {
            payload.scvm_by_host = parseSCVMByHost();
        }

        if (usesExternalGfs) {
            payload.gfs = {
                action: "init-pcs-cluster",
                disks: splitList(gfsDisksText),
                mount_point: gfsMountPoint.trim(),
                volume_groups: parseVolumeGroups(volumeGroupsText),
            };
        }

        if (usesHciFilesystem) {
            payload.gfs = {
                action: "init-pcs-cluster",
                mount_point: gfsMountPoint.trim(),
                volume_groups: parseVolumeGroups(volumeGroupsText),
            };
            payload.rbd = {
                action: "create",
                pool_name: rbdPoolName.trim() || "rbd",
                image_prefix: rbdImagePrefix.trim() || "gfs",
                size: Number(rbdSizeGiB) || 0,
                mount_point: gfsMountPoint.trim(),
            };
        }

        if (usesLocal) {
            payload.local = {
                action: "create-local-disk",
                disks: splitList(localDisksText),
            };
        }

        if (serviceNetworkEnabled) {
            payload.ccvm_cloudinit = {
                ...(serviceNic.trim() ? { sn_nic: serviceNic.trim() } : {}),
                ...(serviceIp.trim() ? { sn_ip: serviceIp.trim() } : {}),
                ...(servicePrefix.trim() ? { sn_prefix: Number(servicePrefix) || 16 } : {}),
                ...(serviceGw.trim() ? { sn_gw: serviceGw.trim() } : {}),
                ...(serviceDns.trim() ? { sn_dns: serviceDns.trim() } : {}),
            };
        }

        return payload;
    };

    const validateStep = (stepId: string): string => {
        const hosts = parseHosts(hostsText);

        if (stepId === "cluster") {
            if (!ccvmIp.trim()) return "클라우드센터 VM IP를 입력해주세요.";
            if (!mngtCidr.trim()) return "관리 네트워크 CIDR을 입력해주세요.";
            if (hosts.length < (isHci ? 3 : 1)) {
                return isHci ? "HCI 구성은 host를 3대 이상 입력해야 합니다." : "host를 1대 이상 입력해야 합니다.";
            }
            if (hosts.some((host) => !host.index || !host.hostname || !host.ablecube)) {
                return "host 입력은 index, hostname, ablecube IP가 모두 필요합니다.";
            }
            if (!usesLocal && splitList(pcsClusterListText).length < (isHci ? 3 : 1)) {
                return isHci ? "HCI 구성은 PCS 클러스터 IP를 3개 이상 입력해야 합니다." : "PCS 클러스터 IP를 1개 이상 입력해주세요.";
            }
        }

        if (stepId === "scvm") {
            if (nicLoadState === "error") return `NIC 정보를 확인해주세요. ${nicLoadError}`;
            if (!scvmMgmtBridge.trim()) return "SCVM 관리 Bridge를 입력해주세요.";
            if (Object.keys(parseSCVMByHost()).length < hosts.length) {
                return "SCVM host별 디스크 설정을 host 수만큼 입력해주세요.";
            }
        }

        if (stepId === "gfs_storage") {
            if (gfsDiskLoadState === "error") return `GFS 디스크 정보를 확인해주세요. ${gfsDiskLoadError}`;
            if (splitList(gfsDisksText).length === 0) return "GFS 구성 대상 디스크를 입력해주세요.";
            if (parseVolumeGroups(volumeGroupsText).length === 0) return "GFS VG/LV 쌍을 입력해주세요.";
        }

        if (stepId === "hci_shared_file") {
            if (!rbdPoolName.trim()) return "RBD pool 이름을 입력해주세요.";
            if (!rbdImagePrefix.trim()) return "RBD image prefix를 입력해주세요.";
            if (!Number.isFinite(Number(rbdSizeGiB)) || Number(rbdSizeGiB) <= 0) return "RBD 총 용량 GiB를 입력해주세요.";
            if (!gfsMountPoint.trim()) return "GFS mount point를 입력해주세요.";
            if (parseVolumeGroups(volumeGroupsText).length === 0) return "GFS VG/LV 쌍을 입력해주세요.";
        }

        if (stepId === "local_storage") {
            if (usesLocal && splitList(localDisksText).length === 0) return "로컬 스토리지 대상 디스크를 입력해주세요.";
        }

        if (stepId === "ccvm") {
            if (nicLoadState === "error") return `NIC 정보를 확인해주세요. ${nicLoadError}`;
            if (!ccvmMgmtBridge.trim()) return "CCVM 관리 Bridge를 입력해주세요.";
            if (usesGfsMount && !gfsMountPoint.trim()) return "GFS mount point를 입력해주세요.";
        }

        return "";
    };

    const validateAll = (): string => {
        for (const step of flowSteps) {
            const stepMessage = validateStep(step.id);

            if (stepMessage) {
                return `${step.label}: ${stepMessage}`;
            }
        }

        return "";
    };

    const selectStep = (index: number) => {
        if (isRunning) return;
        setActiveStep(index);
        setMessage("");
        setConnectionNotice("");
        setPhase("idle");
        setRunningJob(null);
        setRunningJobId("");
    };

    const nextStep = () => {
        const validationMessage = validateStep(activeFlowStep.id);

        if (validationMessage) {
            setMessage(validationMessage);
            setPhase("error");
            return;
        }

        setMessage("");
        setPhase("idle");
        setActiveStep((current) => Math.min(current + 1, flowSteps.length - 1));
    };

    const previousStep = () => {
        if (isRunning) return;
        setMessage("");
        setPhase("idle");
        setActiveStep((current) => Math.max(current - 1, 0));
    };

    const startRun = async () => {
        const validationMessage = validateAll();

        if (validationMessage) {
            setMessage(validationMessage);
            setPhase("error");
            return;
        }

        setPhase("running");
        setMessage("올인원 구성 Job을 시작하고 있습니다.");
        setConnectionNotice("");
        setActiveStep(flowSteps.length - 1);
        setRunningJob(null);
        setRunningJobId("");

        try {
            const payload = await buildPayload();
            const job = await startDeployRun(payload);
            const summary = jobSummary(job);

            setRunningJob(job);
            setRunningJobId(job.jobId);
            setMessage(`${summary}. ${cloudCenterWaitText}`);
            onStarted(summary);
        } catch (error) {
            setPhase("error");
            setMessage(`올인원 구성 Job 시작에 실패했습니다: ${errorMessage(error)}`);
        }
    };

    const closeModal = () => {
        if (isRunning) return;
        onClose();
    };

    const openMonitoringCenter = async () => {
        setConnectionNotice("");
        const centerWindow = window.open("about:blank", "_blank");

        if (!centerWindow) {
            setConnectionNotice("브라우저 팝업 차단을 해제한 후 다시 시도해주세요.");
            return;
        }

        try {
            centerWindow.document.title = "모니터링센터 연결";

            const targetUrl = await fetchDeployUrl("wallCenter");

            centerWindow.opener = null;
            centerWindow.location.href = targetUrl;
        } catch (error) {
            centerWindow.close();
            setConnectionNotice(
                `모니터링센터 연결 주소 조회에 실패했습니다: ${errorMessage(error)}`
            );
        }
    };

    const renderLicenseStep = () => (
        <Form className="ct-all-in-one-form" isHorizontal>
            <FormGroup
              label="제품 타입" isRequired
              fieldId="all-in-one-product-type"
            >
                <FormSelect
                  id="all-in-one-product-type"
                  value={productType}
                  onChange={(_event, value) => updateProductType(value as ProductType)}
                >
                    {PRODUCT_OPTIONS.map((option) => (
                        <FormSelectOption
                          key={option.value} value={option.value}
                          label={option.label}
                        />
                    ))}
                </FormSelect>
            </FormGroup>
            <FormGroup label="라이센스 파일" fieldId="all-in-one-license-file">
                <input
                  id="all-in-one-license-file"
                  type="file"
                  className="ct-all-in-one-file-input"
                  onChange={(event) => {
                      const file = event.currentTarget.files?.[0] ?? null;

                      setLicenseFile(file);
                      setLicenseFilename(file?.name ?? "license.lic");
                  }}
                />
            </FormGroup>
            <FormGroup label="저장 파일명" fieldId="all-in-one-license-filename">
                <TextInput
                  id="all-in-one-license-filename"
                  value={licenseFilename}
                  onChange={(_event, value) => setLicenseFilename(value)}
                />
            </FormGroup>
            <Checkbox
              id="all-in-one-update-profile"
              label="성공한 단계의 systemProfile 상태를 자동 반영"
              isChecked={updateSystemProfile}
              onChange={(_event, checked) => setUpdateSystemProfile(checked)}
            />
            <Alert
              variant="info"
              isInline
              title="라이센스 파일을 선택하지 않으면 마스터 노드에 이미 등록된 라이센스를 사용합니다."
            />
        </Form>
    );

    const renderClusterStep = () => {
        const hostRows = parseHosts(hostsText);
        const pcsItems = splitList(pcsClusterListText);
        const minHosts = isHci ? 3 : 1;
        const minPcsItems = isHci ? 3 : 1;

        return (
            <div className="ct-all-in-one-cluster">
                <Form className="ct-all-in-one-form ct-all-in-one-form--compact" isHorizontal>
                    <FormGroup
                      label="클라우드센터 VM IP" isRequired
                      fieldId="all-in-one-ccvm-ip"
                    >
                        <TextInput
                          id="all-in-one-ccvm-ip"
                          value={ccvmIp}
                          onChange={(_event, value) => setCcvmIp(value)}
                        />
                    </FormGroup>
                    <FormGroup
                      label="관리 CIDR" isRequired
                      fieldId="all-in-one-mngt-cidr"
                    >
                        <TextInput
                          id="all-in-one-mngt-cidr"
                          value={mngtCidr}
                          onChange={(_event, value) => setMngtCidr(value)}
                        />
                    </FormGroup>
                    <FormGroup label="관리 Gateway" fieldId="all-in-one-mngt-gw">
                        <TextInput
                          id="all-in-one-mngt-gw"
                          value={mngtGw}
                          onChange={(_event, value) => setMngtGw(value)}
                        />
                    </FormGroup>
                    <FormGroup label="관리 DNS" fieldId="all-in-one-mngt-dns">
                        <TextInput
                          id="all-in-one-mngt-dns"
                          value={mngtDns}
                          onChange={(_event, value) => setMngtDns(value)}
                        />
                    </FormGroup>
                    <FormGroup label="시간 서버" fieldId="all-in-one-time-server">
                        <TextInput
                          id="all-in-one-time-server"
                          value={externalTimeServer}
                          placeholder={currentHostIp || "현재 호스트 IP"}
                          onChange={(_event, value) => setExternalTimeServer(value)}
                        />
                    </FormGroup>
                    <Checkbox
                      id="all-in-one-iscsi-storage"
                      label="스토리지 네트워크 전용"
                      isChecked={iscsiStorage}
                      onChange={(_event, checked) => setIscsiStorage(checked)}
                    />
                </Form>

                {!usesLocal && (
                    <div className="ct-all-in-one-field-card">
                        <div className="ct-all-in-one-field-card__header">
                            <strong>PCS 클러스터 IP</strong>
                            <div className="ct-all-in-one-stepper">
                                <Button
                                  variant="control"
                                  onClick={removePcsItem}
                                  isDisabled={pcsItems.length <= minPcsItems}
                                  aria-label="PCS IP 제거"
                                >
                                    -
                                </Button>
                                <div className="ct-all-in-one-stepper__value">{pcsItems.length}</div>
                                <Button
                                  variant="control"
                                  onClick={addPcsItem}
                                  aria-label="PCS IP 추가"
                                >
                                    +
                                </Button>
                                <span>개</span>
                            </div>
                        </div>
                        <div className="ct-all-in-one-pcs-grid">
                            {pcsItems.map((ip, index) => (
                                <div key={`all-in-one-pcs-${index}`} className="ct-all-in-one-pcs-item">
                                    <span>#{index + 1}</span>
                                    <TextInput
                                      aria-label={`PCS 클러스터 IP ${index + 1}`}
                                      value={ip}
                                      onChange={(_event, value) => updatePcsItem(index, value)}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div className="ct-all-in-one-table-wrap">
                    <div className="ct-all-in-one-field-card__header">
                        <strong>Host 목록</strong>
                        <div className="ct-all-in-one-stepper">
                            <Button
                              variant="control"
                              onClick={removeHost}
                              isDisabled={hostRows.length <= minHosts}
                              aria-label="Host 제거"
                            >
                                -
                            </Button>
                            <div className="ct-all-in-one-stepper__value">{hostRows.length}</div>
                            <Button
                              variant="control"
                              onClick={addHost}
                              aria-label="Host 추가"
                            >
                                +
                            </Button>
                            <span>대</span>
                        </div>
                    </div>
                    <table className="ct-all-in-one-table">
                        <thead>
                            <tr>
                                <th>순번</th>
                                <th>호스트명</th>
                                <th>Ablecube IP</th>
                                {isHci && <th>SCVM MNGT</th>}
                                {isHci && <th>HOST PN</th>}
                                {isHci && <th>SCVM PN</th>}
                                {isHci && <th>SCVM CN</th>}
                            </tr>
                        </thead>
                        <tbody>
                            {hostRows.map((row, index) => (
                                <tr key={`all-in-one-host-${index}`}>
                                    <td>
                                        <TextInput
                                          aria-label={`Host 순번 ${index + 1}`}
                                          value={row.index}
                                          onChange={(_event, value) => updateHost(index, "index", value)}
                                        />
                                    </td>
                                    <td>
                                        <TextInput
                                          aria-label={`Host 호스트명 ${index + 1}`}
                                          value={row.hostname}
                                          onChange={(_event, value) => updateHost(index, "hostname", value)}
                                        />
                                    </td>
                                    <td>
                                        <TextInput
                                          aria-label={`Host Ablecube IP ${index + 1}`}
                                          value={row.ablecube}
                                          onChange={(_event, value) => updateHost(index, "ablecube", value)}
                                        />
                                    </td>
                                    {isHci && (
                                        <td>
                                            <TextInput
                                              aria-label={`Host SCVM MNGT ${index + 1}`}
                                              value={row.scvmMngt ?? ""}
                                              onChange={(_event, value) => updateHost(index, "scvmMngt", value)}
                                            />
                                        </td>
                                    )}
                                    {isHci && (
                                        <td>
                                            <TextInput
                                              aria-label={`Host PN ${index + 1}`}
                                              value={row.ablecubePn ?? ""}
                                              onChange={(_event, value) => updateHost(index, "ablecubePn", value)}
                                            />
                                        </td>
                                    )}
                                    {isHci && (
                                        <td>
                                            <TextInput
                                              aria-label={`SCVM PN ${index + 1}`}
                                              value={row.scvm ?? ""}
                                              onChange={(_event, value) => updateHost(index, "scvm", value)}
                                            />
                                        </td>
                                    )}
                                    {isHci && (
                                        <td>
                                            <TextInput
                                              aria-label={`SCVM CN ${index + 1}`}
                                              value={row.scvmCn ?? ""}
                                              onChange={(_event, value) => updateHost(index, "scvmCn", value)}
                                            />
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    };

    const renderSCVMStep = () => (
        <Form className="ct-all-in-one-form" isHorizontal>
            {nicLoadState === "loading" && (
                <Alert
                  variant="info"
                  isInline
                  title="NIC 목록을 불러오는 중입니다."
                />
            )}
            {nicLoadState === "error" && (
                <Alert
                  variant="danger"
                  isInline
                  title="NIC 목록을 불러오지 못했습니다."
                >
                    {nicLoadError}
                </Alert>
            )}
            <FormGroup
              label="CPU" isRequired
              fieldId="all-in-one-scvm-cpu"
            >
                <TextInput
                  id="all-in-one-scvm-cpu" value={scvmCpu}
                  onChange={(_event, value) => setScvmCpu(value)}
                />
            </FormGroup>
            <FormGroup
              label="Memory GiB" isRequired
              fieldId="all-in-one-scvm-memory"
            >
                <TextInput
                  id="all-in-one-scvm-memory"
                  value={scvmMemory}
                  onChange={(_event, value) => setScvmMemory(value)}
                />
            </FormGroup>
            <FormGroup
              label="디스크 방식" isRequired
              fieldId="all-in-one-scvm-disk-type"
            >
                <FormSelect
                  id="all-in-one-scvm-disk-type"
                  value={scvmDiskType}
                  onChange={(_event, value) => setScvmDiskType(value)}
                >
                    <FormSelectOption value="disk_passthrough" label="Disk passthrough" />
                    <FormSelectOption value="lun_passthrough" label="LUN passthrough" />
                    <FormSelectOption value="raid_passthrough" label="RAID passthrough" />
                </FormSelect>
            </FormGroup>
            <FormGroup
              label="관리 Bridge" isRequired
              fieldId="all-in-one-scvm-mgmt-bridge"
            >
                <FormSelect
                  id="all-in-one-scvm-mgmt-bridge"
                  value={scvmMgmtBridge}
                  onChange={(_event, value) => setScvmMgmtBridge(value)}
                >
                    {bridgeOptions.map((option) => (
                        <FormSelectOption key={option.value} value={option.value} label={option.label} />
                    ))}
                </FormSelect>
            </FormGroup>
            <FormGroup
              label="스토리지 네트워크 방식" isRequired
              fieldId="all-in-one-scvm-storage-mode"
            >
                <FormSelect
                  id="all-in-one-scvm-storage-mode"
                  value={scvmStorageMode}
                  onChange={(_event, value) => setScvmStorageMode(value)}
                >
                    <FormSelectOption value="bridge" label="Bridge" />
                    <FormSelectOption value="nic_passthrough" label="NIC passthrough" />
                    <FormSelectOption value="nic_passthrough_bonding" label="NIC passthrough bonding" />
                </FormSelect>
            </FormGroup>
            <FormGroup label="서버 Bridge" fieldId="all-in-one-scvm-server-bridge">
                <FormSelect
                  id="all-in-one-scvm-server-bridge"
                  value={scvmServerBridge}
                  onChange={(_event, value) => setScvmServerBridge(value)}
                >
                    {bridgeOptions.map((option) => (
                        <FormSelectOption key={option.value} value={option.value} label={option.label} />
                    ))}
                </FormSelect>
            </FormGroup>
            <FormGroup label="복제 Bridge" fieldId="all-in-one-scvm-repl-bridge">
                <FormSelect
                  id="all-in-one-scvm-repl-bridge"
                  value={scvmReplicationBridge}
                  onChange={(_event, value) => setScvmReplicationBridge(value)}
                >
                    {bridgeOptions.map((option) => (
                        <FormSelectOption key={option.value} value={option.value} label={option.label} />
                    ))}
                </FormSelect>
            </FormGroup>
            <FormGroup
              label="Host별 디스크" isRequired
              fieldId="all-in-one-scvm-by-host"
            >
                <TextArea
                  id="all-in-one-scvm-by-host"
                  value={scvmByHostText}
                  rows={5}
                  resizeOrientation="vertical"
                  onChange={(_event, value) => setScvmByHostText(value)}
                />
                <Content component="p" className="ct-all-in-one-help">
                    한 줄에 `hostname=/dev/disk/by-id/...` 형식으로 입력합니다. 여러 디스크는 쉼표로 구분합니다.
                </Content>
            </FormGroup>
        </Form>
    );

    const renderStorageCenterStep = () => (
        <div className="ct-all-in-one-static-step">
            <Alert
              variant="info"
              isInline
              title="SCVM bootstrap으로 스토리지센터 초기 구성을 진행합니다."
            >
                스토리지 VM이 Running 상태가 된 뒤, 각 SCVM의 bootstrap API를 실행해 Glue 클러스터 host 등록과
                스토리지센터 API 준비 상태를 확인합니다.
            </Alert>
            <div className="ct-all-in-one-static-step__grid">
                <div>
                    <span>적용 대상 제품</span>
                    <strong>ABLESTACK-HCI / HCI Filesystem</strong>
                </div>
                <div>
                    <span>실행 Job 단계</span>
                    <strong>scvm_bootstrap</strong>
                </div>
                <div>
                    <span>완료 판단</span>
                    <strong>scvm_bootstrap_status = true</strong>
                </div>
            </div>
        </div>
    );

    const renderStorageClusterStep = () => (
        <div className="ct-all-in-one-static-step">
            <Alert
              variant="info"
              isInline
              title="스토리지 클러스터 상세 구성을 확인합니다."
            >
                SCVM이 Glue host로 정확히 등록되었는지 확인한 뒤, passthrough 디스크를 OSD로 등록하고
                rbd pool을 replicated 2와 PG autoscale 기준으로 구성하는 단계입니다.
            </Alert>
            <div className="ct-all-in-one-plan-list">
                <div>
                    <strong>1. SCVM host 확인</strong>
                    <span>cluster.json hosts의 SCVM 이름과 Glue host 목록을 비교합니다.</span>
                </div>
                <div>
                    <strong>2. OSD 등록</strong>
                    <span>LUN/Disk passthrough 장치를 초기화 후 OSD로 등록합니다.</span>
                </div>
                <div>
                    <strong>3. rbd pool 구성</strong>
                    <span>rbd pool, 2벌 복제, autoscale on, application rbd를 적용합니다.</span>
                </div>
                <div>
                    <strong>4. 상태 검증</strong>
                    <span>Glue Cluster 상태가 Health OK 또는 Warn인지 확인합니다.</span>
                </div>
            </div>
        </div>
    );

    const selectedGfsDisks = splitList(gfsDisksText);

    const toggleGfsDisk = (diskValue: string, checked: boolean) => {
        const next = checked
            ? Array.from(new Set([...selectedGfsDisks, diskValue]))
            : selectedGfsDisks.filter((disk) => disk !== diskValue);

        setGfsDisksText(next.join("\n"));
    };

    const renderGfsStorageStep = () => (
        <Form className="ct-all-in-one-form" isHorizontal>
                <FormGroup
                  label="GFS 디스크" isRequired
                  fieldId="all-in-one-gfs-disks"
                >
                    {gfsDiskLoadState === "loading" ? (
                        <Alert
                          variant="info"
                          isInline
                          title="GFS 디스크 목록을 불러오는 중입니다."
                        />
                    ) : gfsDiskLoadState === "error" ? (
                        <Alert
                          variant="danger"
                          isInline
                          title="GFS 디스크 목록을 불러오지 못했습니다."
                        >
                            {gfsDiskLoadError}
                        </Alert>
                    ) : gfsDiskOptions.length === 0 ? (
                        <Alert
                          variant="warning"
                          isInline
                          title="GFS 디스크 후보가 없습니다."
                        />
                    ) : (
                        <div className="ct-all-in-one-choice-list">
                            {gfsDiskOptions.map((disk) => (
                                <Checkbox
                                  key={disk.value}
                                  id={`all-in-one-gfs-disk-${disk.value.replace(/[^a-zA-Z0-9_-]/g, "-")}`}
                                  label={disk.label}
                                  isChecked={selectedGfsDisks.includes(disk.value)}
                                  onChange={(_event, checked) => toggleGfsDisk(disk.value, checked)}
                                />
                            ))}
                        </div>
                    )}
                </FormGroup>
                <FormGroup
                  label="VG/LV" isRequired
                  fieldId="all-in-one-volume-groups"
                >
                    <TextArea
                      id="all-in-one-volume-groups"
                      value={volumeGroupsText}
                      rows={4}
                      resizeOrientation="vertical"
                      onChange={(_event, value) => setVolumeGroupsText(value)}
                    />
                    <Content component="p" className="ct-all-in-one-help">
                        한 줄에 `vg_glue,lv_glue` 형식으로 입력합니다.
                    </Content>
                </FormGroup>
                <FormGroup
                  label="Mount point" isRequired
                  fieldId="all-in-one-gfs-mount"
                >
                    <TextInput
                      id="all-in-one-gfs-mount"
                      value={gfsMountPoint}
                      onChange={(_event, value) => setGfsMountPoint(value)}
                    />
                </FormGroup>
        </Form>
    );

    const renderHciSharedFileStep = () => (
        <Form className="ct-all-in-one-form" isHorizontal>
            <Alert
              variant="info"
              isInline
              title="HCI Filesystem은 RBD image를 생성한 뒤 각 host에 rbd map을 반영합니다."
            >
                SCVM이 아닌 물리 host를 대상으로 /etc/ceph/rbdmap을 적용하고, map된 RBD 장치로 Global File System을 구성합니다.
            </Alert>
            <FormGroup
              label="RBD pool" isRequired
              fieldId="all-in-one-rbd-pool"
            >
                <TextInput
                  id="all-in-one-rbd-pool"
                  value={rbdPoolName}
                  onChange={(_event, value) => setRbdPoolName(value)}
                />
            </FormGroup>
            <FormGroup
              label="RBD image prefix" isRequired
              fieldId="all-in-one-rbd-prefix"
            >
                <TextInput
                  id="all-in-one-rbd-prefix"
                  value={rbdImagePrefix}
                  onChange={(_event, value) => setRbdImagePrefix(value)}
                />
            </FormGroup>
            <FormGroup
              label="총 용량 GiB" isRequired
              fieldId="all-in-one-rbd-size"
            >
                <TextInput
                  id="all-in-one-rbd-size"
                  value={rbdSizeGiB}
                  onChange={(_event, value) => setRbdSizeGiB(value)}
                />
            </FormGroup>
            <FormGroup
              label="VG/LV" isRequired
              fieldId="all-in-one-hci-fs-volume-groups"
            >
                <TextArea
                  id="all-in-one-hci-fs-volume-groups"
                  value={volumeGroupsText}
                  rows={4}
                  resizeOrientation="vertical"
                  onChange={(_event, value) => setVolumeGroupsText(value)}
                />
                <Content component="p" className="ct-all-in-one-help">
                    한 줄에 `vg_glue,lv_glue` 형식으로 입력합니다.
                </Content>
            </FormGroup>
            <FormGroup
              label="Mount point" isRequired
              fieldId="all-in-one-hci-fs-mount"
            >
                <TextInput
                  id="all-in-one-hci-fs-mount"
                  value={gfsMountPoint}
                  onChange={(_event, value) => setGfsMountPoint(value)}
                />
            </FormGroup>
        </Form>
    );

    const renderLocalStorageStep = () => (
        <Form className="ct-all-in-one-form" isHorizontal>
            <FormGroup
              label="로컬 디스크" isRequired
              fieldId="all-in-one-local-disks"
            >
                <TextArea
                  id="all-in-one-local-disks"
                  value={localDisksText}
                  rows={5}
                  resizeOrientation="vertical"
                  onChange={(_event, value) => setLocalDisksText(value)}
                />
            </FormGroup>
            <Alert
              variant="info" isInline
              title="Standalone은 로컬 디스크 준비 후 CCVM을 구성합니다."
            />
        </Form>
    );

    const renderCCVMStep = () => (
        <Form className="ct-all-in-one-form" isHorizontal>
            {nicLoadState === "loading" && (
                <Alert
                  variant="info"
                  isInline
                  title="NIC 목록을 불러오는 중입니다."
                />
            )}
            {nicLoadState === "error" && (
                <Alert
                  variant="danger"
                  isInline
                  title="NIC 목록을 불러오지 못했습니다."
                >
                    {nicLoadError}
                </Alert>
            )}
            <FormGroup
              label="CPU" isRequired
              fieldId="all-in-one-ccvm-cpu"
            >
                <TextInput
                  id="all-in-one-ccvm-cpu" value={ccvmCpu}
                  onChange={(_event, value) => setCcvmCpu(value)}
                />
            </FormGroup>
            <FormGroup
              label="Memory GiB" isRequired
              fieldId="all-in-one-ccvm-memory"
            >
                <TextInput
                  id="all-in-one-ccvm-memory"
                  value={ccvmMemory}
                  onChange={(_event, value) => setCcvmMemory(value)}
                />
            </FormGroup>
            <FormGroup
              label="관리 Bridge" isRequired
              fieldId="all-in-one-ccvm-mgmt-bridge"
            >
                <FormSelect
                  id="all-in-one-ccvm-mgmt-bridge"
                  value={ccvmMgmtBridge}
                  onChange={(_event, value) => setCcvmMgmtBridge(value)}
                >
                    {bridgeOptions.map((option) => (
                        <FormSelectOption key={option.value} value={option.value} label={option.label} />
                    ))}
                </FormSelect>
            </FormGroup>
            <FormGroup label="서비스 Bridge" fieldId="all-in-one-ccvm-service-bridge">
                <FormSelect
                  id="all-in-one-ccvm-service-bridge"
                  value={ccvmServiceBridge}
                  onChange={(_event, value) => setCcvmServiceBridge(value)}
                >
                    {bridgeOptions.filter((option) => !option.value || option.value !== ccvmMgmtBridge).map((option) => (
                        <FormSelectOption key={option.value} value={option.value} label={option.label} />
                    ))}
                </FormSelect>
            </FormGroup>
            {usesGfsMount && (
                <FormGroup
                  label="GFS mount point" isRequired
                  fieldId="all-in-one-ccvm-gfs-mount"
                >
                    <TextInput
                      id="all-in-one-ccvm-gfs-mount"
                      value={gfsMountPoint}
                      onChange={(_event, value) => setGfsMountPoint(value)}
                    />
                </FormGroup>
            )}
            <Checkbox
              id="all-in-one-service-network-enabled"
              label="CCVM service network cloud-init 값 직접 지정"
              isChecked={serviceNetworkEnabled}
              onChange={(_event, checked) => setServiceNetworkEnabled(checked)}
            />
            {serviceNetworkEnabled && (
                <div className="ct-all-in-one-inline-grid">
                    <TextInput
                      aria-label="Service NIC"
                      placeholder="Service NIC"
                      value={serviceNic}
                      onChange={(_event, value) => setServiceNic(value)}
                    />
                    <TextInput
                      aria-label="Service IP"
                      placeholder="Service IP"
                      value={serviceIp}
                      onChange={(_event, value) => setServiceIp(value)}
                    />
                    <TextInput
                      aria-label="Service Prefix"
                      placeholder="Prefix"
                      value={servicePrefix}
                      onChange={(_event, value) => setServicePrefix(value)}
                    />
                    <TextInput
                      aria-label="Service Gateway"
                      placeholder="Gateway"
                      value={serviceGw}
                      onChange={(_event, value) => setServiceGw(value)}
                    />
                    <TextInput
                      aria-label="Service DNS"
                      placeholder="DNS"
                      value={serviceDns}
                      onChange={(_event, value) => setServiceDns(value)}
                    />
                </div>
            )}
            <Alert
              variant="warning" isInline
              title={cloudCenterWaitText}
            />
        </Form>
    );

    const renderReviewStep = () => (
        <div className="ct-all-in-one-review">
            <div className="ct-all-in-one-review__summary">
                <div>
                    <span>제품 타입</span>
                    <strong>{productLabel(productType)}</strong>
                </div>
                <div>
                    <span>Host</span>
                    <strong>{parseHosts(hostsText).length}대</strong>
                </div>
                <div>
                    <span>CloudStack 준비 예상</span>
                    <strong>{productType === "ablestack-vm" ? "5~10분" : "약 20분"}</strong>
                </div>
                <div>
                    <span>시간 서버</span>
                    <strong>{externalTimeServer || currentHostIp || "N/A"}</strong>
                </div>
            </div>
            <Alert
              variant="info"
              isInline
              title="입력한 값으로 올인원 구성 Job을 한 번에 시작합니다."
            >
                라이센스, 클러스터 구성, VM 준비, 스토리지 구성, systemProfile 반영이 순서대로 실행됩니다.
                구성 완료 후 모니터링센터 연결 단계로 이어집니다.
            </Alert>
        </div>
    );

    const renderInputPanel = () => {
        switch (activeFlowStep.id) {
        case "license":
            return renderLicenseStep();
        case "cluster":
            return renderClusterStep();
        case "scvm":
            return renderSCVMStep();
        case "storage_center":
            return renderStorageCenterStep();
        case "storage_cluster":
            return renderStorageClusterStep();
        case "hci_shared_file":
            return renderHciSharedFileStep();
        case "gfs_storage":
            return renderGfsStorageStep();
        case "local_storage":
            return renderLocalStorageStep();
        case "ccvm":
            return renderCCVMStep();
        default:
            return renderReviewStep();
        }
    };

    const renderExecutionPanel = () => (
        <div className="ct-all-in-one-execution">
            <Alert
              variant={phase === "error" ? "danger" : phase === "success" ? "success" : "info"}
              isInline
              title={message || "올인원 구성 Job을 실행 중입니다."}
            >
                {phase === "running" && <Spinner size="sm" aria-label="올인원 구성 Job 실행 중" />}
            </Alert>
            {runningJob && (
                <div className="ct-all-in-one-job">
                    <div>
                        <span>Job ID</span>
                        <strong>{runningJob.jobId}</strong>
                    </div>
                    <div>
                        <span>상태</span>
                        <Label color={colorForJobStatus(runningJob.status)}>
                            {runningJob.status || "N/A"}
                        </Label>
                    </div>
                    <div className="ct-all-in-one-job__steps">
                        {runningJob.steps.map((step) => (
                            <span key={step.name}>
                                <Label color={colorForJobStepStatus(step.status)}>
                                    {STEP_STATUS_LABELS[step.status] ?? step.status}
                                </Label>
                                {step.name}
                            </span>
                        ))}
                    </div>
                </div>
            )}
            {connectionNotice && (
                <Alert
                  variant="danger"
                  isInline
                  title={connectionNotice}
                />
            )}
        </div>
    );

    const showExecutionPanel = isRunning || (phase === "success" && Boolean(runningJob));

    return (
        <Modal
          isOpen={isOpen}
          onClose={closeModal}
          variant="large"
          aria-label="올인원 제어"
          className="ct-all-in-one-control-modal"
        >
            <ModalHeader title="올인원 제어" />
            <ModalBody>
                <Card className="ct-deploy-overview ct-all-in-one-embedded">
                    <CardHeader className="ct-deploy-overview__header">
                        <div>
                            <CardTitle>ABLESTACK 올인원 구성 입력</CardTitle>
                            <Content component="p" className="ct-deploy-overview__subtitle">
                                단계별 입력값을 검증한 뒤 한 번에 실행합니다.
                            </Content>
                        </div>
                        {isRunning && (
                            <div className="ct-deploy-overview__summary">
                                <Spinner size="sm" aria-label="올인원 구성 중" />
                                <Label color="blue">실행 중</Label>
                            </div>
                        )}
                    </CardHeader>
                    <CardBody>
                        <div className="ct-deploy-overview__meta">
                            <div>
                                <span>제품 타입</span>
                                <strong>{productLabel(productType)}</strong>
                            </div>
                            <div>
                                <span>{isRunning ? "실행 단계" : "입력 단계"}</span>
                                <strong>{activeFlowStep.label}</strong>
                            </div>
                            <div>
                                <span>CloudStack 준비 예상</span>
                                <strong>{productType === "ablestack-vm" ? "5~10분" : "약 20분"}</strong>
                            </div>
                            <div>
                                <span>권장 재시작</span>
                                <strong>{restartRecommendation.summary}</strong>
                            </div>
                        </div>

                        <div className="ct-all-in-one-resume">
                            <div>
                                <span>현재 제품 흐름 기준</span>
                                <strong>{restartRecommendation.summary}</strong>
                            </div>
                            {!isRunning && !restartRecommendation.isComplete &&
                                activeStep !== restartRecommendation.index && (
                                    <Button
                                      variant="secondary"
                                      onClick={() => selectStep(restartRecommendation.index)}
                                    >
                                        권장 단계로 이동
                                    </Button>
                            )}
                            <Content component="p">{restartRecommendation.detail}</Content>
                        </div>

                        <div className="ct-deploy-overview__flow ct-all-in-one-flow">
                            <div className="ct-deploy-overview__flow-list">
                                <div className="ct-deploy-overview__section-title">제품 흐름</div>
                                <div className="ct-deploy-overview__stage-list">
                                    {flowSteps.map((step, index) => {
                                        const state = stateForFlowStep(step, index, activeStep, phase, runningJob);

                                        return (
                                            <button
                                              key={step.id}
                                              type="button"
                                              className={[
                                                  "ct-deploy-overview__stage",
                                                  `ct-deploy-overview__stage--${state}`,
                                                  isInputPhase && state === "done"
                                                      ? "ct-deploy-overview__stage--input-done"
                                                      : "",
                                                  "ct-all-in-one-flow__stage",
                                              ].join(" ")}
                                              onClick={() => selectStep(index)}
                                              disabled={isRunning}
                                            >
                                                <div className="ct-deploy-overview__stage-marker">{index + 1}</div>
                                                <div className="ct-deploy-overview__stage-body">
                                                    <span>{step.label}</span>
                                                    {labelForUiStepState(state, phase)}
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="ct-deploy-overview__current-panel ct-all-in-one-input-panel">
                                <span className="ct-deploy-overview__current-eyebrow">
                                    {isRunning ? "실행 상태" : "현재 입력"}
                                </span>
                                <h2>{isRunning ? "올인원 구성 중" : activeFlowStep.label}</h2>
                                <Content component="p">{activeFlowStep.description}</Content>
                                {showExecutionPanel
                                    ? renderExecutionPanel()
                                    : renderInputPanel()}
                                {message && !isRunning && !(phase === "success" && runningJob) && (
                                    <Alert
                                      className="ct-all-in-one-message"
                                      isInline
                                      variant={phase === "error" ? "danger" : "success"}
                                      title={message}
                                    />
                                )}
                                {!isRunning && (
                                    <div className="ct-deploy-overview__action-row">
                                        {phase === "success" && runningJob
                                            ? (
                                                <>
                                                    <Button variant="primary" onClick={openMonitoringCenter}>
                                                        모니터링센터 연결
                                                    </Button>
                                                    <Button variant="secondary" onClick={closeModal}>
                                                        완료
                                                    </Button>
                                                </>
                                            )
                                            : (
                                                <>
                                                    <Button
                                                      variant="secondary"
                                                      onClick={previousStep}
                                                      isDisabled={activeStep === 0}
                                                    >
                                                        이전
                                                    </Button>
                                                    {activeStep < flowSteps.length - 1
                                                        ? (
                                                            <Button variant="primary" onClick={nextStep}>
                                                                다음
                                                            </Button>
                                                        )
                                                        : (
                                                            <Button variant="primary" onClick={startRun}>
                                                                구성
                                                            </Button>
                                                        )}
                                                </>
                                            )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </CardBody>
                </Card>
            </ModalBody>
            <ModalFooter>
                <Button
                  variant="link" onClick={closeModal}
                  isDisabled={isRunning}
                >
                    닫기
                </Button>
            </ModalFooter>
        </Modal>
    );
}
