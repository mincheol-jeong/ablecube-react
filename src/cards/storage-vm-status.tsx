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
  VirtualMachineIcon,
  InfoCircleIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ExclamationCircleIcon,
  EllipsisVIcon,
} from "@patternfly/react-icons";

import ConfirmActionModal from "../components/common/ConfirmActionModal";
import VmResourceUpdateModal from "../components/common/VmResourceUpdateModal";
import {
  fetchStorageVmStatus,
  STORAGE_VM_STATUS_FALLBACK,
  type StorageVmStatusData,
} from "../services/api/storage-vm-status";
import "./status-card.scss";

const VM_STATUS_META = {
  running: {
    label: "Running",
    color: "green",
    icon: <CheckCircleIcon />,
  },
  shutOff: {
    label: "Stopped",
    color: "orange",
    icon: <ExclamationTriangleIcon />,
  },
  HEALTH_ERR: {
    label: "Health Err",
    color: "red",
    icon: <ExclamationCircleIcon />,
  },
};

type StorageVmAction = "start" | "stop" | "delete" | "connect";

const STORAGE_VM_ACTIONS: Record<StorageVmAction, { title: string; message: string; confirmLabel?: string }> = {
  start: {
    title: "스토리지 센터 가상머신 상태 변경",
    message: "스토리지 센터 가상머신을 '시작' 하시겠습니까?",
    confirmLabel: "시작",
  },
  stop: {
    title: "스토리지 센터 가상머신 상태 변경",
    message: "스토리지 센터 가상머신을 '정지' 하시겠습니까?",
    confirmLabel: "정지",
  },
  delete: {
    title: "스토리지 센터 가상머신 상태 변경",
    message: "스토리지 센터 가상머신을 '삭제' 하시겠습니까?",
    confirmLabel: "삭제",
  },
  connect: {
    title: "스토리지센터VM 연결",
    message: "스토리지센터VM 관리 화면으로 연결하시겠습니까?",
    confirmLabel: "연결",
  },
};

export default function StorageVmStatus() {
  const [isOpen, setIsOpen] = React.useState(false);
  const [confirmAction, setConfirmAction] = React.useState<StorageVmAction | null>(null);
  const [isResourceUpdateModalOpen, setIsResourceUpdateModalOpen] = React.useState(false);

  const [data, setData] = React.useState<StorageVmStatusData>(STORAGE_VM_STATUS_FALLBACK);

  React.useEffect(() => {
    let isMounted = true;

    fetchStorageVmStatus()
      .then((nextData) => {
        if (isMounted) {
          setData(nextData);
        }
      })
      .catch((err) => {
        console.error("storage vm status API error:", err);

        if (isMounted) {
          setData(STORAGE_VM_STATUS_FALLBACK);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const statusMeta = (VM_STATUS_META as any)[data.vmStatus] ?? {
    label: "상태 체크 중...",
    color: "orange",
    icon: <InfoCircleIcon />,
  };

  const isVmError = data.vmStatus === "HEALTH_ERR";
  const isVmUnknown = data.vmStatus === "N/A" || data.vmStatus === "";
  const footerMessage = isVmUnknown
    ? "스토리지센터 가상머신 상태 정보를 확인할 수 없습니다."
    : isVmError
      ? "스토리지센터 가상머신이 배포되지 않았습니다."
      : "스토리지센터 가상머신이 배포되었습니다.";
  const footerColor = isVmUnknown ? "#f0ab00" : isVmError ? "#c9190b" : "#3e8635";
  const isVmRunning = data.vmStatus === "running";
  const isVmStopped = data.vmStatus === "shutOff";
  const currentConfirmAction = confirmAction ? STORAGE_VM_ACTIONS[confirmAction] : null;

  const onSelect = () => setIsOpen(false);

  const openConfirmActionModal = (action: StorageVmAction) => {
    setConfirmAction(action);
    setIsOpen(false);
  };

  const closeConfirmActionModal = () => {
    setConfirmAction(null);
  };

  const confirmStorageVmAction = () => {
    if (!confirmAction) return;
    // TODO: 백엔드 API 전환 후 storage-vm-status-update.py start/stop/delete 또는 create_address.py 호출로 연결합니다.
    console.log("storage vm action", confirmAction);
    setConfirmAction(null);
  };

  const openResourceUpdateModal = () => {
    setIsResourceUpdateModalOpen(true);
    setIsOpen(false);
  };

  const closeResourceUpdateModal = () => {
    setIsResourceUpdateModalOpen(false);
  };

  const confirmResourceUpdate = (cpu: string, memory: string) => {
    // TODO: 백엔드 API 전환 후 storage-vm-resource-update.py에 해당하는 자원변경 API로 연결합니다.
    console.log("storage vm resource update", cpu, memory);
    setIsResourceUpdateModalOpen(false);
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
                  isDisabled={!isVmStopped}
                  onClick={() => openConfirmActionModal("start")}
                >
                  스토리지센터VM 시작
                </DropdownItem>
                <DropdownItem
                  isDisabled={!isVmRunning}
                  onClick={() => openConfirmActionModal("stop")}
                >
                  스토리지센터VM 정지
                </DropdownItem>
                <DropdownItem
                  isDisabled={isVmRunning}
                  onClick={() => openConfirmActionModal("delete")}
                >
                  스토리지센터VM 삭제
                </DropdownItem>
                <DropdownItem
                  isDisabled={isVmRunning}
                  onClick={openResourceUpdateModal}
                >
                  스토리지센터VM 자원변경
                </DropdownItem>
                <DropdownItem
                  isDisabled={!isVmRunning}
                  onClick={() => openConfirmActionModal("connect")}
                >
                  스토리지센터VM 연결
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
                <VirtualMachineIcon
                  style={{ fontSize: "var(--pf-global--icon--FontSize--lg)" }}
                  aria-hidden="true"
                />
                <span>스토리지센터 가상머신 상태</span>
              </Flex>
            </CardTitle>
          </FlexItem>
        </Flex>
      </CardHeader>

      <CardBody>
        <DescriptionList isCompact className="ct-status-card__dl">
          <DescriptionListGroup>
            <DescriptionListTerm>가상머신 상태</DescriptionListTerm>
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
            <DescriptionListTerm>CPU</DescriptionListTerm>
            <DescriptionListDescription>{data.cpu}</DescriptionListDescription>
          </DescriptionListGroup>

          <DescriptionListGroup>
            <DescriptionListTerm>Memory</DescriptionListTerm>
            <DescriptionListDescription>{data.memory}</DescriptionListDescription>
          </DescriptionListGroup>

          <DescriptionListGroup>
            <DescriptionListTerm>ROOT Disk 크기</DescriptionListTerm>
            <DescriptionListDescription>{data.rootDiskSize}</DescriptionListDescription>
          </DescriptionListGroup>

          <DescriptionListGroup>
            <DescriptionListTerm className="pf-v5-u-align-self-flex-start">관리 NIC</DescriptionListTerm>
            <DescriptionListDescription>
              <Flex direction={{ default: "column" }}>
                <FlexItem>{data.manageNicType}</FlexItem>
                <FlexItem>{data.manageNicIp}</FlexItem>
                <FlexItem>{data.manageNicPrefix}</FlexItem>
                <FlexItem>{data.manageNicGw}</FlexItem>
                <FlexItem>{data.manageNicDns}</FlexItem>
              </Flex>
            </DescriptionListDescription>
          </DescriptionListGroup>

          <DescriptionListGroup>
            <DescriptionListTerm className="pf-v5-u-align-self-flex-start">스토리지 NIC</DescriptionListTerm>
            <DescriptionListDescription>
              <Flex direction={{ default: "column" }}>
                <FlexItem>{data.storageServerNicType}</FlexItem>
                <FlexItem>{data.storageServerNicIp}</FlexItem>
                <FlexItem>{data.storageReplicationNicType}</FlexItem>
                <FlexItem>{data.storageReplicationNicIp}</FlexItem>
              </Flex>
            </DescriptionListDescription>
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
          onConfirm={confirmStorageVmAction}
        />
      )}

      <VmResourceUpdateModal
        isOpen={isResourceUpdateModalOpen}
        title="스토리지센터 가상머신 자원변경"
        onClose={closeResourceUpdateModal}
        onConfirm={confirmResourceUpdate}
      />
    </Card>
  );
}
