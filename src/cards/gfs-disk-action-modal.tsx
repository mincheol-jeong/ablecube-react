// GFS 디스크 추가/삭제/확장/상세정보 모달입니다.
import React from "react";
import {
  Button,
  Content,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
} from "@patternfly/react-core";
import { ExclamationTriangleIcon } from "@patternfly/react-icons";

export type GfsDiskAction = "add" | "delete" | "extend" | "info";

interface GfsDiskActionModalProps {
  action: GfsDiskAction | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (action: Exclude<GfsDiskAction, "info">, selectedIds: string[]) => void;
}

const AVAILABLE_DISKS = [
  { id: "disk-image-001", label: "disk-image-001 /dev/mapper/mpathg 500G" },
  { id: "disk-image-002", label: "disk-image-002 /dev/mapper/mpathh 1T" },
];

const GFS_DISKS = [
  { id: "gfs-data-01", mount: "/mnt/glue-gfs", pv: "/dev/mapper/mpathg", vg: "vg_gfs01", size: "500G" },
  { id: "gfs-data-02", mount: "/mnt/glue-gfs2", pv: "/dev/mapper/mpathh", vg: "vg_gfs02", size: "1T" },
];

const ACTION_TITLE: Record<GfsDiskAction, string> = {
  add: "GFS 디스크 추가",
  delete: "GFS 디스크 삭제",
  extend: "GFS 디스크 확장",
  info: "디스크 상세 정보",
};

const toggleSelection = (values: string[], value: string) => (
  values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value]
);

export default function GfsDiskActionModal({
  action,
  isOpen,
  onClose,
  onConfirm,
}: GfsDiskActionModalProps) {
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const [extendMethod, setExtendMethod] = React.useState("resize");
  const [isNoDowntime, setIsNoDowntime] = React.useState(false);

  React.useEffect(() => {
    if (!isOpen) {
      setSelectedIds([]);
      setExtendMethod("resize");
      setIsNoDowntime(false);
    }
  }, [isOpen]);

  if (!action) {
    return null;
  }

  const isInfo = action === "info";
  const isAdd = action === "add";
  const isExtend = action === "extend";
  const isExecutable = isInfo || selectedIds.length > 0;
  const sourceList = isAdd ? AVAILABLE_DISKS : GFS_DISKS;

  const execute = () => {
    if (isInfo) {
      onClose();
      return;
    }

    onConfirm(action, selectedIds);
  };

  const renderDiskChecks = () => (
    <div className="ct-clvm-disk-modal__scroll-list ct-clvm-disk-modal__mono">
      {sourceList.length > 0 ? sourceList.map((disk) => (
        <label className="ct-clvm-disk-modal__check" key={disk.id}>
          <input
            type="checkbox"
            checked={selectedIds.includes(disk.id)}
            onChange={() => setSelectedIds((values) => toggleSelection(values, disk.id))}
          />
          <span>{"label" in disk ? disk.label : `${disk.mount} ${disk.pv} ${disk.vg} ${disk.size}`}</span>
        </label>
      )) : (
        <Content component="p">데이터가 존재하지 않습니다.</Content>
      )}
    </div>
  );

  const renderInfo = () => (
    <div className="ct-action-confirm-modal__body">
      {GFS_DISKS.map((disk) => (
        <div className="ct-gfs-disk-info" key={disk.id}>
          <div><strong>디스크 마운트 상태</strong> Health OK</div>
          <div><strong>마운트 경로</strong> {disk.mount}</div>
          <div><strong>물리 볼륨</strong> {disk.pv}</div>
          <div><strong>볼륨 그룹</strong> {disk.vg}</div>
          <div><strong>디스크 크기</strong> {disk.size}</div>
        </div>
      ))}
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      variant={isAdd ? "large" : "medium"}
      aria-label={ACTION_TITLE[action]}
      className={`ct-clvm-disk-modal ${isAdd ? "ct-clvm-disk-modal--large" : "ct-clvm-disk-modal--medium"}`}
    >
      <ModalHeader title={ACTION_TITLE[action]} />
      <ModalBody>
        {isAdd && (
          <div className="ct-clvm-disk-modal__warning">
            <ExclamationTriangleIcon aria-hidden="true" />
            <span>선택한 항목과 관계없이 한 번에 하나의 디스크만 생성됩니다. 원하는 디스크를 신중하게 선택하세요.</span>
          </div>
        )}
        {action === "delete" && (
          <div className="ct-clvm-disk-modal__warning">
            <ExclamationTriangleIcon aria-hidden="true" />
            <span>선택한 디스크의 모든 데이터가 영구적으로 삭제됩니다.</span>
          </div>
        )}
        {isExtend && (
          <div className="ct-action-confirm-modal__body">
            <Content component="p">확장할 GFS 디스크 및 확장 방식을 선택해주세요.</Content>
            <label className="ct-action-confirm-modal__check">
              <input
                type="radio"
                name="gfs-extend-method"
                checked={extendMethod === "resize"}
                onChange={() => setExtendMethod("resize")}
              />
              <span>기존 디스크 사이즈만 확장</span>
            </label>
            <label className="ct-action-confirm-modal__check">
              <input
                type="radio"
                name="gfs-extend-method"
                checked={extendMethod === "add-lun"}
                onChange={() => setExtendMethod("add-lun")}
              />
              <span>새로운 LUN 디스크 추가</span>
            </label>
            <label className="ct-action-confirm-modal__check">
              <input
                type="checkbox"
                checked={isNoDowntime}
                onChange={(event) => setIsNoDowntime(event.currentTarget.checked)}
              />
              <span>무중단 확장</span>
            </label>
          </div>
        )}
        {isInfo ? renderInfo() : renderDiskChecks()}
      </ModalBody>
      <ModalFooter>
        <Button variant="primary" isDisabled={!isExecutable} onClick={execute}>
          {isAdd ? "추가" : action === "delete" ? "삭제" : isExtend ? "확장" : "확인"}
        </Button>
        {!isInfo && (
          <Button variant="link" onClick={onClose}>
            취소
          </Button>
        )}
      </ModalFooter>
    </Modal>
  );
}
