import React from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardBody,
  CardFooter,
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
import { EllipsisVIcon, StorageDomainIcon } from "@patternfly/react-icons";

import ClvmDiskActionModal from "./clvm-disk-action-modal";
import type { ClvmDiskAction } from "./clvm-disk-action-modal";
import GfsDiskActionModal from "./gfs-disk-action-modal";
import type { GfsDiskAction } from "./gfs-disk-action-modal";
import GfsMountInfoModal from "./gfs-mount-info-modal";
import type { GfsMountInfo } from "./gfs-mount-info-modal";
import {
  fetchGfsDiskStatus,
  GFS_DISK_STATUS_FALLBACK,
  type GfsDiskStatusData,
} from "../services/api/gfs-disk-status";
import "./status-card.scss";

export default function GfsDiskStatus() {
  const [isOpen, setIsOpen] = React.useState(false);
  const [gfsDiskAction, setGfsDiskAction] = React.useState<GfsDiskAction | null>(null);
  const [clvmDiskAction, setClvmDiskAction] = React.useState<ClvmDiskAction | null>(null);
  const [selectedMountInfo, setSelectedMountInfo] = React.useState<GfsMountInfo | null>(null);

  const [data, setData] = React.useState<GfsDiskStatusData>(GFS_DISK_STATUS_FALLBACK);

  React.useEffect(() => {
    let isMounted = true;

    fetchGfsDiskStatus()
      .then((nextData) => {
        if (isMounted) {
          setData(nextData);
        }
      })
      .catch((err) => {
        console.error("gfs disk status API error:", err);

        if (isMounted) {
          setData(GFS_DISK_STATUS_FALLBACK);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const onSelect = () => setIsOpen(false);

  const mountDetails = data.mountDetails.length > 0
    ? data.mountDetails
    : data.mountPath
      ? [{
        mountPath: data.mountPath,
        status: "N/A",
        devices: "N/A",
        multipaths: "N/A",
        physicalVolume: "N/A",
        volumeGroup: "N/A",
        diskSize: "N/A",
        resourceStatus: ["N/A"],
      }]
      : [];

  const openGfsDiskActionModal = (action: GfsDiskAction) => {
    setGfsDiskAction(action);
    setIsOpen(false);
  };

  const closeGfsDiskActionModal = () => {
    setGfsDiskAction(null);
  };

  const confirmGfsDiskAction = (action: Exclude<GfsDiskAction, "info">, selectedIds: string[]) => {
    // TODO: 백엔드 API 전환 후 GFS disk add/delete/extend API로 연결합니다.
    console.log("gfs disk action", action, selectedIds);
    setGfsDiskAction(null);
  };

  const openClvmDiskActionModal = (action: ClvmDiskAction) => {
    setClvmDiskAction(action);
    setIsOpen(false);
  };

  const closeClvmDiskActionModal = () => {
    setClvmDiskAction(null);
  };

  const confirmClvmDiskAction = (action: Exclude<ClvmDiskAction, "info">, selectedIds: string[]) => {
    // TODO: 백엔드 API 전환 후 CLVM disk add/delete API로 연결합니다.
    console.log("gfs clvm disk action", action, selectedIds);
    setClvmDiskAction(null);
  };

  const openMountInfoModal = (mountInfo: GfsMountInfo) => {
    setSelectedMountInfo(mountInfo);
  };

  const closeMountInfoModal = () => {
    setSelectedMountInfo(null);
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
                <DropdownItem onClick={() => openGfsDiskActionModal("add")}>
                  GFS 디스크 추가
                </DropdownItem>
                <DropdownItem onClick={() => openGfsDiskActionModal("delete")}>
                  GFS 디스크 삭제
                </DropdownItem>
                <DropdownItem onClick={() => openGfsDiskActionModal("extend")}>
                  GFS 디스크 확장
                </DropdownItem>
                <DropdownItem onClick={() => openClvmDiskActionModal("add")}>
                  CLVM 디스크 추가
                </DropdownItem>
                <DropdownItem onClick={() => openClvmDiskActionModal("delete")}>
                  CLVM 디스크 삭제
                </DropdownItem>
                <DropdownItem onClick={() => openClvmDiskActionModal("info")}>
                  CLVM 디스크 정보
                </DropdownItem>
                <DropdownItem onClick={() => openGfsDiskActionModal("info")}>
                  디스크 상세 정보
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
                <StorageDomainIcon
                  style={{ fontSize: "var(--pf-global--icon--FontSize--lg)" }}
                  aria-hidden="true"
                />
                <span>GFS 디스크 상태</span>
              </Flex>
            </CardTitle>
          </FlexItem>
        </Flex>
      </CardHeader>

      <CardBody>
        <DescriptionList isCompact className="ct-status-card__dl">
          <DescriptionListGroup>
            <DescriptionListTerm>모드</DescriptionListTerm>
            <DescriptionListDescription>{data.mode}</DescriptionListDescription>
          </DescriptionListGroup>

          <DescriptionListGroup>
            <DescriptionListTerm>마운트 경로</DescriptionListTerm>
            <DescriptionListDescription>
              <Flex gap={{ default: "gapSm" }} flexWrap={{ default: "wrap" }}>
                {mountDetails.length > 0 ? mountDetails.map((mountInfo, index) => (
                  <FlexItem key={`${mountInfo.mountPath}-${index}`}>
                    <button
                      type="button"
                      className="ct-status-card__mount ct-status-card__mount-button"
                      onClick={() => openMountInfoModal(mountInfo)}
                    >
                      {mountInfo.mountPath}
                    </button>
                  </FlexItem>
                )) : (
                  <FlexItem>N/A</FlexItem>
                )}
              </Flex>
            </DescriptionListDescription>
          </DescriptionListGroup>
        </DescriptionList>
      </CardBody>

      <CardFooter className="ct-status-card__footer" style={{ color: data.footerColor }}>
        {data.footerMessage}
      </CardFooter>

      <GfsDiskActionModal
        action={gfsDiskAction}
        isOpen={gfsDiskAction !== null}
        onClose={closeGfsDiskActionModal}
        onConfirm={confirmGfsDiskAction}
      />

      <ClvmDiskActionModal
        action={clvmDiskAction}
        isOpen={clvmDiskAction !== null}
        onClose={closeClvmDiskActionModal}
        onConfirm={confirmClvmDiskAction}
      />

      <GfsMountInfoModal
        isOpen={selectedMountInfo !== null}
        mountInfo={selectedMountInfo}
        onClose={closeMountInfoModal}
      />
    </Card>
  );
}
