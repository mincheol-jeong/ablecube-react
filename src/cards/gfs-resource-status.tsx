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

import WwnListModal from "./wwn-list-modal";
import CheckedConfirmActionModal from "../components/common/CheckedConfirmActionModal";
import SelectActionModal from "../components/common/SelectActionModal";
import {
  fetchGfsResourceStatus,
  GFS_RESOURCE_STATUS_FALLBACK,
  type GfsResourceStatusData,
} from "../services/api/gfs-resource-status";
import "./status-card.scss";

const STATUS_META = {
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

export default function GfsResourceStatus() {
  const [isOpen, setIsOpen] = React.useState(false);
  const [isExternalStorageSyncModalOpen, setIsExternalStorageSyncModalOpen] = React.useState(false);
  const [isExternalStorageRescanModalOpen, setIsExternalStorageRescanModalOpen] = React.useState(false);
  const [isWwnListModalOpen, setIsWwnListModalOpen] = React.useState(false);
  const [isHostRemoveModalOpen, setIsHostRemoveModalOpen] = React.useState(false);

  const [data, setData] = React.useState<GfsResourceStatusData>(GFS_RESOURCE_STATUS_FALLBACK);

  React.useEffect(() => {
    let isMounted = true;

    fetchGfsResourceStatus()
      .then((nextData) => {
        if (isMounted) {
          setData(nextData);
        }
      })
      .catch((err) => {
        console.error("gfs resource status API error:", err);

        if (isMounted) {
          setData(GFS_RESOURCE_STATUS_FALLBACK);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const onSelect = () => setIsOpen(false);

  const openExternalStorageSyncModal = () => {
    setIsExternalStorageSyncModalOpen(true);
    setIsOpen(false);
  };

  const closeExternalStorageSyncModal = () => {
    setIsExternalStorageSyncModalOpen(false);
  };

  const confirmExternalStorageSync = () => {
    // TODO: 백엔드 API 전환 후 multipath sync API로 연결합니다.
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
    // TODO: 백엔드 API 전환 후 storage rescan API로 연결합니다.
    setIsExternalStorageRescanModalOpen(false);
  };

  const openWwnListModal = () => {
    setIsWwnListModalOpen(true);
    setIsOpen(false);
  };

  const closeWwnListModal = () => {
    setIsWwnListModalOpen(false);
  };

  const openHostRemoveModal = () => {
    setIsHostRemoveModalOpen(true);
    setIsOpen(false);
  };

  const closeHostRemoveModal = () => {
    setIsHostRemoveModalOpen(false);
  };

  const confirmHostRemove = (hostname: string) => {
    // TODO: 백엔드 API 전환 후 GFS host remove API로 연결합니다.
    console.log("gfs host remove", hostname);
    setIsHostRemoveModalOpen(false);
  };

  const renderStatusDetail = (statusKey: string, detail?: string, detailLines?: string[]) => {
    const status =
      (STATUS_META as any)[statusKey] ?? {
        label: "상태 체크 중...",
        color: "orange",
        icon: <InfoCircleIcon />,
      };

    return (
      <Flex className="ct-status-card__detail" gap={{ default: "gapSm" }}>
        <Label
          className="ct-health-label"
          color={status.color}
          icon={status.icon}
        >
          {status.label}
        </Label>
        {detailLines && detailLines.length > 0 ? (
          <Flex direction={{ default: "column" }} className="ct-status-card__detail-text">
            {detailLines.map((line, index) => (
              <FlexItem key={`${line}-${index}`}>{line}</FlexItem>
            ))}
          </Flex>
        ) : (
          <span className="ct-status-card__detail-text">{detail}</span>
        )}
      </Flex>
    );
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
                <DropdownItem onClick={openExternalStorageSyncModal}>
                  외부 스토리지 동기화
                </DropdownItem>
                <DropdownItem onClick={openExternalStorageRescanModal}>
                  외부 스토리지 재검색
                </DropdownItem>
                <DropdownItem onClick={openWwnListModal}>
                  WWN 목록 조회
                </DropdownItem>
                <DropdownItem onClick={openHostRemoveModal}>
                  호스트 제거
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
                <span>GFS 리소스 상태</span>
              </Flex>
            </CardTitle>
          </FlexItem>
        </Flex>
      </CardHeader>

      <CardBody>
        <DescriptionList isCompact className="ct-status-card__dl">
          <DescriptionListGroup>
            <DescriptionListTerm>펜스 장치 상태</DescriptionListTerm>
            <DescriptionListDescription>
              {renderStatusDetail(data.fenceDeviceStatus, data.fenceDeviceDetail)}
            </DescriptionListDescription>
          </DescriptionListGroup>

          <DescriptionListGroup>
            <DescriptionListTerm>잠금 장치 상태</DescriptionListTerm>
            <DescriptionListDescription>
              {renderStatusDetail(data.lockDeviceStatus, undefined, data.lockDeviceDetails)}
            </DescriptionListDescription>
          </DescriptionListGroup>

          <DescriptionListGroup>
            <DescriptionListTerm>GFS 장치 상태</DescriptionListTerm>
            <DescriptionListDescription>
              {renderStatusDetail(data.gfsDeviceStatus, undefined, data.gfsDeviceDetails)}
            </DescriptionListDescription>
          </DescriptionListGroup>
        </DescriptionList>
      </CardBody>

      <CardFooter className="ct-status-card__footer" style={{ color: data.footerColor }}>
        {data.footerMessage}
      </CardFooter>

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

      <WwnListModal
        isOpen={isWwnListModalOpen}
        onClose={closeWwnListModal}
      />

      <SelectActionModal
        isOpen={isHostRemoveModalOpen}
        title="호스트 제거"
        message="제거할 호스트를 선택해 주세요."
        selectLabel="호스트"
        options={[
          { value: "ablecube1", label: "ablecube1" },
          { value: "ablecube2", label: "ablecube2" },
          { value: "ablecube3", label: "ablecube3" },
        ]}
        warning="호스트를 제거하면 해당 호스트는 클러스터에서 제외되며, 더 이상 자원을 사용할 수 없습니다."
        checkLabel="호스트명 확인"
        onClose={closeHostRemoveModal}
        onConfirm={confirmHostRemove}
      />
    </Card>
  );
}
