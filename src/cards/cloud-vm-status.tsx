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
import SelectActionModal from "../components/common/SelectActionModal";
import TextInputConfirmModal from "../components/common/TextInputConfirmModal";
import VmResourceUpdateModal from "../components/common/VmResourceUpdateModal";
import {
  CLOUD_VM_STATUS_FALLBACK,
  fetchCloudVmStatus,
  type CloudVmStatusData,
} from "../services/api/cloud-vm-status";
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

type CloudVmConfirmAction = "snapshotBackup";

type CloudVmSelectAction =
  | "moldService"
  | "moldDb"
  | "snapshotRollback"
  | "dbBackup";

const CLOUD_VM_CONFIRM_ACTIONS: Record<CloudVmConfirmAction, { title: string; message: string; confirmLabel?: string }> = {
  snapshotBackup: {
    title: "클라우드센터VM 스냅샷 백업",
    message: "클라우드센터VM 백업용 스냅샷을 생성하시겠습니까?",
  },
};

const CLOUD_VM_SELECT_ACTIONS: Record<
CloudVmSelectAction,
{ title: string; message: string; selectLabel: string; options: { value: string; label: string }[]; warning?: string }
> = {
  moldService: {
    title: "Mold 서비스 제어",
    message: "Mold 서비스 제어 명령을 선택해주세요.",
    selectLabel: "제어 명령",
    options: [
      { value: "start", label: "시작" },
      { value: "restart", label: "재시작" },
      { value: "stop", label: "정지" },
    ],
  },
  moldDb: {
    title: "Mold DB 제어",
    message: "Mold DB 제어 명령을 선택해주세요.",
    selectLabel: "제어 명령",
    options: [
      { value: "start", label: "시작" },
      { value: "restart", label: "재시작" },
      { value: "stop", label: "정지" },
    ],
  },
  snapshotRollback: {
    title: "클라우드센터VM 스냅샷 복구",
    message: "복구할 스냅샷을 선택해주세요.",
    selectLabel: "스냅샷 목록",
    options: [
      { value: "snap-20260521-0100", label: "snap-20260521-0100" },
      { value: "snap-20260520-0100", label: "snap-20260520-0100" },
    ],
    warning: "스냅샷 복구 후에는 현재 상태로 돌아갈 수 없습니다.",
  },
  dbBackup: {
    title: "DB 백업",
    message: "DB 백업 작업을 선택해주세요.",
    selectLabel: "백업 작업",
    options: [
      { value: "instantBackup", label: "즉시 백업" },
      { value: "regularBackup", label: "정기 백업" },
      { value: "deleteOldBackup", label: "백업파일 삭제관리" },
    ],
  },
};

export default function CloudVmStatus() {
  const [isOpen, setIsOpen] = React.useState(false);
  const [confirmAction, setConfirmAction] = React.useState<CloudVmConfirmAction | null>(null);
  const [selectAction, setSelectAction] = React.useState<CloudVmSelectAction | null>(null);
  const [isResourceUpdateModalOpen, setIsResourceUpdateModalOpen] = React.useState(false);
  const [isSecondarySizeModalOpen, setIsSecondarySizeModalOpen] = React.useState(false);

  const [data, setData] = React.useState<CloudVmStatusData>(CLOUD_VM_STATUS_FALLBACK);

  React.useEffect(() => {
    let isMounted = true;

    fetchCloudVmStatus()
      .then((nextData) => {
        if (isMounted) {
          setData(nextData);
        }
      })
      .catch((err) => {
        console.error("cloud vm status API error:", err);

        if (isMounted) {
          setData(CLOUD_VM_STATUS_FALLBACK);
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
    ? "클라우드센터 가상머신 상태 정보를 확인할 수 없습니다."
    : isVmError
      ? "클라우드센터 가상머신이 배포되지 않았습니다."
      : "클라우드센터 가상머신이 배포되었습니다.";
  const footerColor = isVmUnknown ? "#f0ab00" : isVmError ? "#c9190b" : "#3e8635";
  const isVmRunning = data.vmStatus === "running";
  const currentConfirmAction = confirmAction ? CLOUD_VM_CONFIRM_ACTIONS[confirmAction] : null;
  const currentSelectAction = selectAction ? CLOUD_VM_SELECT_ACTIONS[selectAction] : null;

  const onSelect = () => setIsOpen(false);

  const openConfirmActionModal = (action: CloudVmConfirmAction) => {
    setConfirmAction(action);
    setIsOpen(false);
  };

  const closeConfirmActionModal = () => {
    setConfirmAction(null);
  };

  const confirmCloudVmAction = () => {
    if (!confirmAction) return;
    // TODO: 백엔드 API 전환 후 local_ccvm_manage.py, ccvm_snap_action.py, create_address.py 호출로 연결합니다.
    console.log("cloud vm action", confirmAction);
    setConfirmAction(null);
  };

  const openSelectActionModal = (action: CloudVmSelectAction) => {
    setSelectAction(action);
    setIsOpen(false);
  };

  const closeSelectActionModal = () => {
    setSelectAction(null);
  };

  const confirmCloudVmSelectAction = (value: string) => {
    if (!selectAction) return;
    // TODO: 백엔드 API 전환 후 Mold 제어, 스냅샷 복구, DB 백업, 모니터링 API로 연결합니다.
    console.log("cloud vm select action", selectAction, value);
    setSelectAction(null);
  };

  const openResourceUpdateModal = () => {
    setIsResourceUpdateModalOpen(true);
    setIsOpen(false);
  };

  const closeResourceUpdateModal = () => {
    setIsResourceUpdateModalOpen(false);
  };

  const confirmResourceUpdate = (cpu: string, memory: string) => {
    // TODO: 백엔드 API 전환 후 클라우드센터VM offering 변경 API로 연결합니다.
    console.log("cloud vm resource update", cpu, memory);
    setIsResourceUpdateModalOpen(false);
  };

  const openSecondarySizeModal = () => {
    setIsSecondarySizeModalOpen(true);
    setIsOpen(false);
  };

  const closeSecondarySizeModal = () => {
    setIsSecondarySizeModalOpen(false);
  };

  const confirmSecondarySize = (size: string) => {
    // TODO: 백엔드 API 전환 후 Mold secondary resize API로 연결합니다.
    console.log("mold secondary size expansion", size);
    setIsSecondarySizeModalOpen(false);
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
                  isDisabled={isVmRunning}
                  onClick={openResourceUpdateModal}
                >
                  클라우드센터VM 자원변경
                </DropdownItem>
                <DropdownItem
                  isDisabled={!isVmRunning}
                  onClick={() => openSelectActionModal("moldService")}
                >
                  Mold 서비스 제어
                </DropdownItem>
                <DropdownItem
                  isDisabled={!isVmRunning}
                  onClick={() => openSelectActionModal("moldDb")}
                >
                  Mold DB 제어
                </DropdownItem>
                <DropdownItem
                  isDisabled={!isVmRunning}
                  onClick={openSecondarySizeModal}
                >
                  Mold 세컨더리 용량 추가
                </DropdownItem>
                <DropdownItem onClick={() => openConfirmActionModal("snapshotBackup")}>
                  스냅샷 백업
                </DropdownItem>
                <DropdownItem
                  isDisabled={isVmRunning}
                  onClick={() => openSelectActionModal("snapshotRollback")}
                >
                  스냅샷 복구
                </DropdownItem>
                <DropdownItem
                  isDisabled={!isVmRunning}
                  onClick={() => openSelectActionModal("dbBackup")}
                >
                  DB 백업
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
                <span>클라우드센터 가상머신 상태</span>
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
            <DescriptionListTerm>Mold 서비스 상태</DescriptionListTerm>
            <DescriptionListDescription>{data.moldServiceStatus}</DescriptionListDescription>
          </DescriptionListGroup>

          <DescriptionListGroup>
            <DescriptionListTerm>Mold DB 상태</DescriptionListTerm>
            <DescriptionListDescription>{data.moldDbStatus}</DescriptionListDescription>
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
            <DescriptionListTerm>세컨더리 Disk 크기</DescriptionListTerm>
            <DescriptionListDescription>{data.secondaryDiskSize}</DescriptionListDescription>
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
          onConfirm={confirmCloudVmAction}
        />
      )}

      {currentSelectAction && (
        <SelectActionModal
          isOpen={selectAction !== null}
          title={currentSelectAction.title}
          message={currentSelectAction.message}
          selectLabel={currentSelectAction.selectLabel}
          options={currentSelectAction.options}
          warning={currentSelectAction.warning}
          onClose={closeSelectActionModal}
          onConfirm={confirmCloudVmSelectAction}
        />
      )}

      <VmResourceUpdateModal
        isOpen={isResourceUpdateModalOpen}
        title="클라우드센터VM 자원변경"
        cpuOptions={["2", "4", "8", "16"]}
        memoryOptions={["4", "8", "16", "32", "64"]}
        onClose={closeResourceUpdateModal}
        onConfirm={confirmResourceUpdate}
      />

      <TextInputConfirmModal
        isOpen={isSecondarySizeModalOpen}
        title="Mold 세컨더리 용량 추가"
        message="추가 확장할 용량을 입력해 주세요. (1회 최대 500GiB)"
        inputLabel="추가 용량"
        placeholder="예: 100"
        warning="용량 추가 작업시 클라우드센터 가상머신 스냅샷이 모두 삭제되고, 클라우드센터 가상머신을 재시작합니다."
        checkLabel="Mold 세컨더리 용량 추가 확인"
        onClose={closeSecondarySizeModal}
        onConfirm={confirmSecondarySize}
      />
    </Card>
  );
}
