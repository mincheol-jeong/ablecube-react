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
  CubesIcon,
  InfoCircleIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ExclamationCircleIcon,
  EllipsisVIcon,
} from "@patternfly/react-icons";

import ClvmDiskActionModal from "./clvm-disk-action-modal";
import type { ClvmDiskAction } from "./clvm-disk-action-modal";
import WwnListModal from "./wwn-list-modal";
import CheckedConfirmActionModal from "../components/common/CheckedConfirmActionModal";
import ConfirmActionModal from "../components/common/ConfirmActionModal";
import MaintenanceModeConfirmModal from "../components/common/MaintenanceModeConfirmModal";
import type { MaintenanceModeAction } from "../components/common/MaintenanceModeConfirmModal";
import {
  fetchStorageClusterStatus,
  STORAGE_CLUSTER_STATUS_FALLBACK,
  type StorageClusterStatusData,
} from "../services/api/storage-cluster-status";
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

export default function StorageClusterStatus() {
  const [isOpen, setIsOpen] = React.useState(false);
  const [isMaintenance, setIsMaintenance] = React.useState(false);
  const [maintenanceModeToConfirm, setMaintenanceModeToConfirm] =
    React.useState<MaintenanceModeAction | null>(null);
  const [isGlueUpdateModalOpen, setIsGlueUpdateModalOpen] = React.useState(false);
  const [isExternalStorageSyncModalOpen, setIsExternalStorageSyncModalOpen] = React.useState(false);
  const [isExternalStorageRescanModalOpen, setIsExternalStorageRescanModalOpen] = React.useState(false);
  const [clvmDiskAction, setClvmDiskAction] = React.useState<ClvmDiskAction | null>(null);
  const [isWwnListModalOpen, setIsWwnListModalOpen] = React.useState(false);
  const [isAutoShutdownModalOpen, setIsAutoShutdownModalOpen] = React.useState(false);
  const [isRemoveCubeHostModalOpen, setIsRemoveCubeHostModalOpen] = React.useState(false);

  const [data, setData] = React.useState<StorageClusterStatusData>(STORAGE_CLUSTER_STATUS_FALLBACK);

  React.useEffect(() => {
    let isMounted = true;

    fetchStorageClusterStatus()
      .then((nextData) => {
        if (isMounted) {
          setData(nextData);
          setIsMaintenance(nextData.maintenanceStatus);
        }
      })
      .catch((err) => {
        console.error("storage cluster status API error:", err);

        if (isMounted) {
          setData(STORAGE_CLUSTER_STATUS_FALLBACK);
          setIsMaintenance(false);
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
    ? "스토리지센터 클러스터 상태 정보를 확인할 수 없습니다."
    : isClusterError
      ? "스토리지센터 클러스터가 구성되지 않았습니다."
      : "스토리지센터 클러스터가 구성되었습니다.";
  const footerColor = isClusterUnknown ? "#f0ab00" : isClusterError ? "#c9190b" : "#3e8635";

  const onSelect = () => setIsOpen(false);

  const openMaintenanceModeModal = (mode: MaintenanceModeAction) => {
    setMaintenanceModeToConfirm(mode);
    setIsOpen(false);
  };

  const closeMaintenanceModeModal = () => {
    setMaintenanceModeToConfirm(null);
  };

  const confirmMaintenanceModeChange = () => {
    if (!maintenanceModeToConfirm) return;
    setIsMaintenance(maintenanceModeToConfirm === "set");
    setMaintenanceModeToConfirm(null);
  };

  const openGlueUpdateModal = () => {
    setIsGlueUpdateModalOpen(true);
    setIsOpen(false);
  };

  const closeGlueUpdateModal = () => {
    setIsGlueUpdateModalOpen(false);
  };

  const confirmGlueUpdate = () => {
    // TODO: 백엔드 API 전환 후 python/glue/update_glue_config.py update 호출로 연결합니다.
    setIsGlueUpdateModalOpen(false);
  };

  const openExternalStorageSyncModal = () => {
    setIsExternalStorageSyncModalOpen(true);
    setIsOpen(false);
  };

  const closeExternalStorageSyncModal = () => {
    setIsExternalStorageSyncModalOpen(false);
  };

  const confirmExternalStorageSync = () => {
    // TODO: 백엔드 API 전환 후 shell/host/multipath_sync.sh sync 호출로 연결합니다.
    setIsExternalStorageSyncModalOpen(false);
  };

  const openExternalStorageRescanModal = () => {
    setIsExternalStorageRescanModalOpen(true);
    setIsOpen(false);
  };

  const closeExternalStorageRescanModal = () => {
    setIsExternalStorageRescanModalOpen(false);
  };

  const confirmExternalStorageRescan = () => {
    // TODO: 백엔드 API 전환 후 shell/host/multipath_sync.sh rescan 호출로 연결합니다.
    setIsExternalStorageRescanModalOpen(false);
  };

  const openClvmDiskActionModal = (action: ClvmDiskAction) => {
    setClvmDiskAction(action);
    setIsOpen(false);
  };

  const closeClvmDiskActionModal = () => {
    setClvmDiskAction(null);
  };

  const confirmClvmDiskAction = (action: Exclude<ClvmDiskAction, "info">, selectedIds: string[]) => {
    // TODO: 백엔드 API 전환 후 add는 --create-clvm, delete는 --delete-clvm 호출로 연결합니다.
    console.log("CLVM disk action", action, selectedIds);
    setClvmDiskAction(null);
  };

  const openWwnListModal = () => {
    // TODO: 백엔드 API 전환 후 python/clvm/disk_manage.py --list-hba-wwn 호출 결과로 목록을 채웁니다.
    setIsWwnListModalOpen(true);
    setIsOpen(false);
  };

  const closeWwnListModal = () => {
    setIsWwnListModalOpen(false);
  };

  const openAutoShutdownModal = () => {
    setIsAutoShutdownModalOpen(true);
    setIsOpen(false);
  };

  const closeAutoShutdownModal = () => {
    setIsAutoShutdownModalOpen(false);
  };

  const confirmAutoShutdown = () => {
    // TODO: 백엔드 API 전환 후 auto-shutdown.py의 cloud VM stop, noout set, SCVM stop, host shutdown 순서로 연결합니다.
    setIsAutoShutdownModalOpen(false);
  };

  const openRemoveCubeHostModal = () => {
    setIsRemoveCubeHostModalOpen(true);
    setIsOpen(false);
  };

  const closeRemoveCubeHostModal = () => {
    setIsRemoveCubeHostModalOpen(false);
  };

  const confirmRemoveCubeHost = () => {
    // TODO: 백엔드 API 전환 후 python/cluster/remove_cube_host.py remove 호출로 연결합니다.
    setIsRemoveCubeHostModalOpen(false);
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
                  isDisabled={isMaintenance}
                  onClick={() => openMaintenanceModeModal("set")}
                >
                  유지보수 모드 설정
                </DropdownItem>

                <DropdownItem
                  isDisabled={!isMaintenance}
                  onClick={() => openMaintenanceModeModal("unset")}
                >
                  유지보수 모드 해제
                </DropdownItem>

                <DropdownItem
                  isDisabled={isMaintenance}
                  onClick={() => {
                    setIsMaintenance(false);
                    setIsOpen(false);
                  }}
                >
                  스토리지센터 연결
                </DropdownItem>

                <DropdownItem
                  isDisabled={isMaintenance}
                  onClick={openGlueUpdateModal}
                >
                  전체 호스트 Glue 설정 업데이트
                </DropdownItem>
                
                <DropdownItem
                  isDisabled={isMaintenance}
                  onClick={openExternalStorageSyncModal}
                >
                  외부 스토리지 동기화
                </DropdownItem>

                <DropdownItem
                  isDisabled={isMaintenance}
                  onClick={openExternalStorageRescanModal}
                >
                  외부 스토리지 재검색
                </DropdownItem>

                <DropdownItem
                  isDisabled={isMaintenance}
                  onClick={() => openClvmDiskActionModal("add")}
                >
                  CLVM 디스크 추가
                </DropdownItem>
                <DropdownItem
                  isDisabled={isMaintenance}
                  onClick={() => openClvmDiskActionModal("delete")}
                >
                  CLVM 디스크 삭제
                </DropdownItem>
                <DropdownItem
                  isDisabled={isMaintenance}
                  onClick={() => openClvmDiskActionModal("info")}
                >
                  CLVM 디스크 정보
                </DropdownItem>
                <DropdownItem
                  isDisabled={isMaintenance}
                  onClick={openWwnListModal}
                >
                  WWN 목록 조회
                </DropdownItem>
                <DropdownItem
                  isDisabled={isMaintenance}
                  onClick={openAutoShutdownModal}
                >
                  전체 시스템 자동 종료
                </DropdownItem>
                <DropdownItem
                  isDisabled={isMaintenance}
                  onClick={openRemoveCubeHostModal}
                >
                  Cube 호스트 제거
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
                <CubesIcon
                  style={{ fontSize: "var(--pf-global--icon--FontSize--lg)" }}
                  aria-hidden="true"
                />
                <span>스토리지센터 클러스터 상태</span>
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
            <DescriptionListTerm>디스크</DescriptionListTerm>
            <DescriptionListDescription>{data.diskStatus}</DescriptionListDescription>
          </DescriptionListGroup>

          <DescriptionListGroup>
            <DescriptionListTerm>게이트웨이</DescriptionListTerm>
            <DescriptionListDescription>{data.gatewayStatus}</DescriptionListDescription>
          </DescriptionListGroup>

          <DescriptionListGroup>
            <DescriptionListTerm>관리데몬</DescriptionListTerm>
            <DescriptionListDescription>{data.daemonStatus}</DescriptionListDescription>
          </DescriptionListGroup>

          <DescriptionListGroup>
            <DescriptionListTerm>스토리지 풀</DescriptionListTerm>
            <DescriptionListDescription>{data.storagePools}</DescriptionListDescription>
          </DescriptionListGroup>

          <DescriptionListGroup>
            <DescriptionListTerm>스토리지 용량</DescriptionListTerm>
            <DescriptionListDescription>{data.storageCapacity}</DescriptionListDescription>
          </DescriptionListGroup>
        </DescriptionList>
      </CardBody>

      <CardFooter className="ct-status-card__footer" style={{ color: footerColor }}>
        {footerMessage}
      </CardFooter>

      <MaintenanceModeConfirmModal
        isOpen={maintenanceModeToConfirm !== null}
        mode={maintenanceModeToConfirm ?? "set"}
        subject="스토리지 클러스터"
        onClose={closeMaintenanceModeModal}
        onConfirm={confirmMaintenanceModeChange}
      />

      <ConfirmActionModal
        isOpen={isGlueUpdateModalOpen}
        title="전체 호스트 Glue 설정 업데이트"
        message="전체 호스트 Glue 설정 업데이트를 진행하시겠습니까?"
        onClose={closeGlueUpdateModal}
        onConfirm={confirmGlueUpdate}
      />

      <CheckedConfirmActionModal
        isOpen={isExternalStorageSyncModalOpen}
        title="외부 스토리지 동기화"
        message="동기화를 진행하시겠습니까?"
        warning="해당 장치는 반드시 이중화되어 있어야 합니다. 만약 싱글 패스로 구성되어 있다면 실행하지 마세요."
        checkLabel="외부 스토리지 설정 확인"
        onClose={closeExternalStorageSyncModal}
        onConfirm={confirmExternalStorageSync}
      />

      <CheckedConfirmActionModal
        isOpen={isExternalStorageRescanModalOpen}
        title="외부 스토리지 재검색"
        message="재검색을 진행하시겠습니까?"
        warning="외부 스토리지를 먼저 연결해주시기 바랍니다. 스토리지에서 연결이 정상적으로 확인된 후, 작업을 진행해주시기 바랍니다."
        checkLabel="외부 스토리지 연결 확인"
        onClose={closeExternalStorageRescanModal}
        onConfirm={confirmExternalStorageRescan}
      />

      <ClvmDiskActionModal
        action={clvmDiskAction}
        isOpen={clvmDiskAction !== null}
        onClose={closeClvmDiskActionModal}
        onConfirm={confirmClvmDiskAction}
      />

      <WwnListModal
        isOpen={isWwnListModalOpen}
        onClose={closeWwnListModal}
      />

      <CheckedConfirmActionModal
        isOpen={isAutoShutdownModalOpen}
        title="전체 시스템 종료 절차 실행"
        message="전체 시스템을 '종료' 하시겠습니까?"
        warning="사전에 각 호스트에 Mount된 볼륨을 작업 수행자가 직접 해제해야 합니다. 해제 후, 아래 볼륨 마운트 해제 확인을 체크하여 계속 진행합니다."
        checkLabel="볼륨 마운트 해제 확인"
        onClose={closeAutoShutdownModal}
        onConfirm={confirmAutoShutdown}
      />

      <CheckedConfirmActionModal
        isOpen={isRemoveCubeHostModalOpen}
        title="Cube 호스트 제거"
        message="Cube 호스트 제거를 진행하시겠습니까?"
        warning="주의!! 실행하실 경우 cube 호스트 설정정보가 초기화 됩니다."
        checkLabel="Cube 호스트 제거 확인"
        onClose={closeRemoveCubeHostModal}
        onConfirm={confirmRemoveCubeHost}
      />
    </Card>
  );
}
