import React from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardBody,
  CardFooter,
  Label,
  Flex,
  FlexItem,
  DescriptionList,
  DescriptionListGroup,
  DescriptionListTerm,
  DescriptionListDescription,
  Dropdown,
  DropdownList,
  DropdownItem,
  MenuToggle,
} from "@patternfly/react-core";
import {
  NetworkIcon,
  InfoCircleIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ExclamationCircleIcon,
  EllipsisVIcon,
} from "@patternfly/react-icons";

import CloudClusterMigrationModal from "./cloud-cluster-migration-modal";
import SshPortChangeModal from "./ssh-port-change-modal";
import ConfirmActionModal from "../components/common/ConfirmActionModal";
import {
  CLOUD_CLUSTER_STATUS_FALLBACK,
  fetchCloudClusterStatus,
  type CloudClusterStatusData,
} from "../services/api/cloud-cluster-status";
import "./status-card.scss";

const CLUSTER_STATUS_META = {
  HEALTH_OK: {
    label: "Health OK",
    color: "green",
    icon: <CheckCircleIcon />,
  },
  HEALTH_WARN: {
    label: "Health Warn",
    color: "orange",
    icon: <ExclamationTriangleIcon />,
  },
  HEALTH_ERR: {
    label: "Health Err",
    color: "red",
    icon: <ExclamationCircleIcon />,
  },
};

type CloudClusterConfirmAction =
  | "start"
  | "stop"
  | "cleanup"
  | "bootstrap"
  | "connect"
  | "monitoringSetup"
  | "monitoringDashboard"
  | "monitoringConfigUpdate";

const CLOUD_CLUSTER_ACTIONS: Record<
CloudClusterConfirmAction,
{ title: string; message: string; confirmLabel?: string }
> = {
  start: {
    title: "클라우드센터VM 시작",
    message: "클라우드센터VM을 시작하시겠습니까?",
  },
  stop: {
    title: "클라우드센터VM 정지",
    message: "클라우드센터VM을 정지하시겠습니까?",
  },
  cleanup: {
    title: "클라우드센터 클러스터 클린업",
    message: "클라우드센터 클러스터를 클린업하시겠습니까?",
  },
  bootstrap: {
    title: "클라우드센터 구성하기",
    message: "클라우드센터 구성을 진행하시겠습니까?",
  },
  connect: {
    title: "클라우드센터 연결",
    message: "클라우드센터 관리 화면으로 연결하시겠습니까?",
    confirmLabel: "연결",
  },
  monitoringSetup: {
    title: "모니터링센터 구성",
    message: "모니터링센터 구성을 진행하시겠습니까?",
  },
  monitoringDashboard: {
    title: "모니터링센터 대시보드 연결",
    message: "모니터링센터 대시보드로 연결하시겠습니까?",
    confirmLabel: "연결",
  },
  monitoringConfigUpdate: {
    title: "모니터링센터 수집 정보 업데이트",
    message: "모니터링센터 수집 정보를 업데이트하시겠습니까?",
  },
};

const parseMigrationNodes = (nodeStatus: string, executionNode: string) => {
  const match = nodeStatus.match(/\(([^)]+)\)/);
  const nodes = match
    ? match[1].split(",").map((node) => node.trim()).filter(Boolean)
    : ["100.100.22.1", "100.100.22.2", "100.100.22.3"];

  return nodes.filter((node) => node !== executionNode);
};

export default function CloudClusterStatus() {
  const [isOpen, setIsOpen] = React.useState(false);
  const [confirmAction, setConfirmAction] = React.useState<CloudClusterConfirmAction | null>(null);
  const [isMigrationModalOpen, setIsMigrationModalOpen] = React.useState(false);
  const [isSshPortChangeModalOpen, setIsSshPortChangeModalOpen] = React.useState(false);

  const [data, setData] = React.useState<CloudClusterStatusData>(CLOUD_CLUSTER_STATUS_FALLBACK);

  React.useEffect(() => {
    let isMounted = true;

    fetchCloudClusterStatus()
      .then((nextData) => {
        if (isMounted) {
          setData(nextData);
        }
      })
      .catch((err) => {
        console.error("cloud cluster status API error:", err);

        if (isMounted) {
          setData(CLOUD_CLUSTER_STATUS_FALLBACK);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const statusMeta = (CLUSTER_STATUS_META as any)[data.clusterStatus] ?? {
    label: "상태 체크 중...",
    color: "orange",
    icon: <InfoCircleIcon />,
  };

  const isClusterError = data.clusterStatus === "HEALTH_ERR";
  const isClusterUnknown = data.clusterStatus === "N/A" || data.clusterStatus === "";
  const footerMessage = isClusterUnknown
    ? "클라우드센터 클러스터 상태 정보를 확인할 수 없습니다."
    : isClusterError
      ? "클라우드센터 클러스터가 구성되지 않았습니다."
      : "클라우드센터 클러스터가 구성되었습니다.";
  const footerColor = isClusterUnknown ? "#f0ab00" : isClusterError ? "#c9190b" : "#3e8635";
  const isClusterReady = data.clusterStatus === "HEALTH_OK";
  const isCloudVmRunning = data.resourceStatus === "실행중";
  const migrationNodes = parseMigrationNodes(data.nodeStatus, data.executionNode);
  const currentConfirmAction = confirmAction ? CLOUD_CLUSTER_ACTIONS[confirmAction] : null;

  const onSelect = () => setIsOpen(false);

  const openConfirmActionModal = (action: CloudClusterConfirmAction) => {
    setConfirmAction(action);
    setIsOpen(false);
  };

  const closeConfirmActionModal = () => {
    setConfirmAction(null);
  };

  const confirmCloudClusterAction = () => {
    if (!confirmAction) return;
    // TODO: 백엔드 API 전환 후 기존 card-cloud-cluster-status.py, create_address.py, wall 설정 호출로 연결합니다.
    console.log("cloud cluster action", confirmAction);
    setConfirmAction(null);
  };

  const openMigrationModal = () => {
    setIsMigrationModalOpen(true);
    setIsOpen(false);
  };

  const closeMigrationModal = () => {
    setIsMigrationModalOpen(false);
  };

  const confirmMigration = (targetNode: string) => {
    // TODO: 백엔드 API 전환 후 card-cloud-cluster-status.py pcsMigration --target 호출로 연결합니다.
    console.log("cloud vm migration", targetNode);
    setIsMigrationModalOpen(false);
  };

  const openSshPortChangeModal = () => {
    setIsSshPortChangeModalOpen(true);
    setIsOpen(false);
  };

  const closeSshPortChangeModal = () => {
    setIsSshPortChangeModalOpen(false);
  };

  const confirmSshPortChange = (beforePort: string, afterPort: string) => {
    // TODO: 백엔드 API 전환 후 security_patch.py --ssh-port before -P after --port-change 호출로 연결합니다.
    console.log("ssh port change", beforePort, afterPort);
    setIsSshPortChangeModalOpen(false);
  };

  return (
    <Card className="ct-status-card">
      <CardHeader
        className="ct-status-card__header"
        actions={{
          actions: (
            <Dropdown
              isOpen={isOpen}
              onSelect={onSelect}
              onOpenChange={setIsOpen}
              popperProps={{ placement: "bottom-end", preventOverflow: true }}
              toggle={(toggleRef) => (
                <MenuToggle
                  ref={toggleRef}
                  variant="plain"
                  aria-label="카드 메뉴"
                  onClick={() => setIsOpen(!isOpen)}
                >
                  <EllipsisVIcon />
                </MenuToggle>
              )}
            >
              <DropdownList>
                <DropdownItem
                  isDisabled={!isClusterReady || isCloudVmRunning}
                  onClick={() => openConfirmActionModal("start")}
                >
                  클라우드센터VM 시작
                </DropdownItem>

                <DropdownItem
                  isDisabled={!isClusterReady || !isCloudVmRunning}
                  onClick={() => openConfirmActionModal("stop")}
                >
                  클라우드센터VM 정지
                </DropdownItem>

                <DropdownItem
                  isDisabled={!isClusterReady}
                  onClick={() => openConfirmActionModal("cleanup")}
                >
                  클라우드센터 클러스터 클린업
                </DropdownItem>

                <DropdownItem
                  isDisabled={!isClusterReady || !isCloudVmRunning}
                  onClick={openMigrationModal}
                >
                  클라우드센터VM 마이그레이션
                </DropdownItem>

                <DropdownItem onClick={openSshPortChangeModal}>
                  SSH Port 변경
                </DropdownItem>

                <DropdownItem
                  isDisabled={isClusterReady}
                  onClick={() => openConfirmActionModal("bootstrap")}
                >
                  클라우드센터 구성하기
                </DropdownItem>

                <DropdownItem
                  isDisabled={!isClusterReady}
                  onClick={() => openConfirmActionModal("connect")}
                >
                  클라우드센터 연결
                </DropdownItem>

                <DropdownItem
                  isDisabled={!isClusterReady}
                  onClick={() => openConfirmActionModal("monitoringSetup")}
                >
                  모니터링센터 구성
                </DropdownItem>

                <DropdownItem
                  isDisabled={!isClusterReady}
                  onClick={() => openConfirmActionModal("monitoringDashboard")}
                >
                  모니터링센터 대시보드 연결
                </DropdownItem>

                <DropdownItem
                  isDisabled={!isClusterReady}
                  onClick={() => openConfirmActionModal("monitoringConfigUpdate")}
                >
                  모니터링센터 수집 정보 업데이트
                </DropdownItem>
              </DropdownList>
            </Dropdown>
          ),
        }}
      >
        <Flex alignItems={{ default: "alignItemsCenter" }} gap={{ default: "gapSm" }}>
          <FlexItem>
            <CardTitle>
              <Flex alignItems={{ default: "alignItemsCenter" }} gap={{ default: "gapSm" }}>
                <NetworkIcon
                  style={{ fontSize: "var(--pf-global--icon--FontSize--lg)" }}
                  aria-hidden="true"
                />
                <span>클라우드센터 클러스터 상태</span>
              </Flex>
            </CardTitle>
          </FlexItem>
        </Flex>
      </CardHeader>

      <CardBody>
        <DescriptionList isCompact className="ct-status-card__dl">
          <DescriptionListGroup>
            <DescriptionListTerm>클러스터 상태</DescriptionListTerm>
            <DescriptionListDescription>
              <Label
                className="ct-health-label"
                color={statusMeta.color}
                icon={statusMeta.icon}
              >
                {statusMeta.label}
              </Label>
            </DescriptionListDescription>
          </DescriptionListGroup>

          <DescriptionListGroup>
            <DescriptionListTerm>노드구성</DescriptionListTerm>
            <DescriptionListDescription>{data.nodeStatus}</DescriptionListDescription>
          </DescriptionListGroup>

          <DescriptionListGroup>
            <DescriptionListTerm>리소스 상태</DescriptionListTerm>
            <DescriptionListDescription>{data.resourceStatus}</DescriptionListDescription>
          </DescriptionListGroup>

          <DescriptionListGroup>
            <DescriptionListTerm>VM실행노드</DescriptionListTerm>
            <DescriptionListDescription>{data.executionNode}</DescriptionListDescription>
          </DescriptionListGroup>
        </DescriptionList>
      </CardBody>

      <CardFooter className="ct-status-card__footer" style={{ color: footerColor }}>
        {footerMessage}
      </CardFooter>

      {currentConfirmAction && (
        <ConfirmActionModal
          isOpen={confirmAction !== null}
          title={currentConfirmAction.title}
          message={currentConfirmAction.message}
          confirmLabel={currentConfirmAction.confirmLabel}
          onClose={closeConfirmActionModal}
          onConfirm={confirmCloudClusterAction}
        />
      )}

      <CloudClusterMigrationModal
        isOpen={isMigrationModalOpen}
        nodes={migrationNodes}
        onClose={closeMigrationModal}
        onConfirm={confirmMigration}
      />

      <SshPortChangeModal
        isOpen={isSshPortChangeModalOpen}
        onClose={closeSshPortChangeModal}
        onConfirm={confirmSshPortChange}
      />
    </Card>
  );
}
