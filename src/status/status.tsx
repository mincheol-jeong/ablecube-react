import React from "react";

import {
    PageSection,
    PageSectionVariants,
} from "@patternfly/react-core";
import { Gallery } from "@patternfly/react-core/dist/esm/layouts/Gallery";

import CloudClusterStatus from "../cards/cloud-cluster-status.tsx";
import CloudVmStatus from "../cards/cloud-vm-status.tsx";
import GfsDiskStatus from "../cards/gfs-disk-status.tsx";
import GfsResourceStatus from "../cards/gfs-resource-status.tsx";
import StorageClusterStatus from "../cards/storage-cluster-status.tsx";
import StorageVmStatus from "../cards/storage-vm-status.tsx";
import ConfirmActionModal from "../components/common/ConfirmActionModal.tsx";
import { bootstrapCCVM } from "../services/api/cloud-vm-deploy.ts";
import {
    DEPLOY_STATUS_FALLBACK,
    fetchDeployUrl,
    type DeployStatusData,
    type DeployUrlOption,
} from "../services/api/deploy-status.ts";
import CloudVmDeployWizardModal from "../wizard/cloud-vm-deploy-wizard.tsx";
import ClusterConfigPrepareWizardModal from "../wizard/cluster-config-prepare-wizard.tsx";
import GfsStorageConfigureWizardModal from "../wizard/gfs-storage-configure-wizard.tsx";
import MonitoringCenterWizardModal from "../wizard/monitoring-center-wizard.tsx";
import StorageVmDeployWizardModal from "../wizard/storage-vm-deploy-wizard.tsx";

import AblestackUpdateModal from "./ablestack-update-modal.tsx";
import AllInOneControlModal from "./all-in-one-control-modal.tsx";
import CloudResourceConfigureModal from "./cloud-resource-configure-modal.tsx";
import ConfigFileDownloadModal from "./config-file-download-modal.tsx";
import DeploymentOverview from "./deployment-overview.tsx";
import LicenseManagementModal from "./license-management-modal.tsx";
import SecurityEvidenceModal from "./security-evidence-modal.tsx";
import SecurityPatchModal from "./security-patch-modal.tsx";

import "./status.scss";

type DeployClusterType =
    | "ablestack-hci"
    | "ablestack-vm"
    | "ablestack-standalone"
    | "ablestack-hci-filesystem";

export default function StatusPage() {
    const [isClusterWizardOpen, setIsClusterWizardOpen] = React.useState(false);
    const [isStorageVmWizardOpen, setIsStorageVmWizardOpen] = React.useState(false);
    const [isCloudVmWizardOpen, setIsCloudVmWizardOpen] = React.useState(false);
    const [isMonitoringWizardOpen, setIsMonitoringWizardOpen] = React.useState(false);
    const [isGfsWizardOpen, setIsGfsWizardOpen] = React.useState(false);
    const [isConfigFileDownloadOpen, setIsConfigFileDownloadOpen] = React.useState(false);
    const [isLicenseManagementOpen, setIsLicenseManagementOpen] = React.useState(false);
    const [isAllInOneControlOpen, setIsAllInOneControlOpen] = React.useState(false);
    const [isSecurityPatchOpen, setIsSecurityPatchOpen] = React.useState(false);
    const [isAblestackUpdateOpen, setIsAblestackUpdateOpen] = React.useState(false);
    const [isSecurityEvidenceOpen, setIsSecurityEvidenceOpen] = React.useState(false);
    const [isCloudResourceOpen, setIsCloudResourceOpen] = React.useState(false);
    const [isCloudCenterConfigureOpen, setIsCloudCenterConfigureOpen] = React.useState(false);
    const [isCloudCenterConfiguring, setIsCloudCenterConfiguring] = React.useState(false);
    const [isCloudCenterConfigured, setIsCloudCenterConfigured] = React.useState(false);
    const [cloudCenterConfigureError, setCloudCenterConfigureError] = React.useState("");
    const [deployStatus, setDeployStatus] = React.useState<DeployStatusData>(DEPLOY_STATUS_FALLBACK);
    const [actionNotice, setActionNotice] = React.useState("");
    const [statusRefreshKey, setStatusRefreshKey] = React.useState(0);

    const refreshDeployOverview = React.useCallback(() => {
        setStatusRefreshKey((current) => current + 1);
    }, []);

    const openAllInOneControl = React.useCallback(() => {
        if (deployStatus.raw.licenseStatus.toLowerCase() !== "true") {
            setActionNotice("라이센스 등록을 완료한 뒤 올인원 제어를 사용할 수 있습니다.");
            setIsLicenseManagementOpen(true);
            return;
        }

        setIsAllInOneControlOpen(true);
    }, [deployStatus.raw.licenseStatus]);

    const openCenterUrl = async (option: DeployUrlOption, title: string) => {
        setActionNotice("");
        const centerWindow = window.open("about:blank", "_blank");

        if (!centerWindow) {
            setActionNotice("브라우저 팝업 차단을 해제한 후 다시 시도해주세요.");
            return;
        }

        try {
            centerWindow.document.title = title;

            const targetUrl = await fetchDeployUrl(option);

            centerWindow.opener = null;
            centerWindow.location.href = targetUrl;
        } catch (error) {
            centerWindow.close();
            setActionNotice(
                error instanceof Error ? error.message : `${title} 주소 조회에 실패했습니다.`
            );
        }
    };

    const closeCloudCenterConfigure = () => {
        if (isCloudCenterConfiguring) return;
        setIsCloudCenterConfigureOpen(false);
        setIsCloudCenterConfigured(false);
        setCloudCenterConfigureError("");
    };

    const configureCloudCenter = async () => {
        setIsCloudCenterConfiguring(true);
        setCloudCenterConfigureError("");

        try {
            await bootstrapCCVM();
            setIsCloudCenterConfigured(true);
            refreshDeployOverview();
        } catch (error) {
            setCloudCenterConfigureError(
                error instanceof Error ? error.message : "클라우드센터 구성에 실패했습니다."
            );
        } finally {
            setIsCloudCenterConfiguring(false);
        }
    };

    const handleDeployAction = (action: string) => {
        setActionNotice("");

        switch (action) {
        case "manage_license":
            setIsLicenseManagementOpen(true);
            break;
        case "download_config_file":
            setIsConfigFileDownloadOpen(true);
            break;
        case "prepare_cluster_config":
            setIsClusterWizardOpen(true);
            break;
        case "deploy_storage_vm":
        case "configure_storage_vm":
            setIsStorageVmWizardOpen(true);
            break;
        case "configure_hci_shared_file":
        case "configure_gfs_storage":
            setIsGfsWizardOpen(true);
            break;
        case "configure_storage_cluster":
        case "open_storage_center":
            openCenterUrl("storageCenter", "스토리지센터 연결");
            break;
        case "deploy_cloud_vm":
            setIsCloudVmWizardOpen(true);
            break;
        case "configure_cloud_vm":
            setCloudCenterConfigureError("");
            setIsCloudCenterConfigured(false);
            setIsCloudCenterConfigureOpen(true);
            break;
        case "configure_cloud_cluster":
        case "open_cloud_center":
            openCenterUrl("cloudCenter", "클라우드센터 연결");
            break;
        case "configure_cloud_resource":
            setIsCloudResourceOpen(true);
            break;
        case "configure_monitoring":
            setIsMonitoringWizardOpen(true);
            break;
        case "open_monitoring_center":
            openCenterUrl("wallCenter", "모니터링센터 연결");
            break;
        case "configure_local_storage":
            openAllInOneControl();
            break;
        case "run_security_patch":
            setIsSecurityPatchOpen(true);
            break;
        case "ablestack_update":
            setIsAblestackUpdateOpen(true);
            break;
        case "security_evidence":
            setIsSecurityEvidenceOpen(true);
            break;
        default:
            setActionNotice(`${action} 작업은 아직 화면 액션에 연결되어 있지 않습니다.`);
        }
    };

    const renderDashboardCards = () => {
        const osType = deployStatus.osType;
        const usesGfs = osType === "ablestack-hci-filesystem" || osType === "ablestack-vm";
        const isKnownProduct = [
            "ablestack-hci",
            "ablestack-hci-filesystem",
            "ablestack-vm",
            "ablestack-standalone",
        ].includes(osType);
        const cards: React.ReactElement[] = [];
        const isLicenseRegistered = deployStatus.raw.licenseStatus.toLowerCase() === "true";
        const isClusterPrepared = deployStatus.raw.clusterConfigStatus.toLowerCase() === "true";

        if (!isKnownProduct || !isLicenseRegistered || !isClusterPrepared) {
            return null;
        }

        const addGfsCards = () => {
            if (!usesGfs) return;
            cards.push(
                <GfsResourceStatus
                  key="gfs-resource"
                  pollingEnabled={deployStatus.polling.gfsResource.enabled}
                />
            );
            cards.push(<GfsDiskStatus key="gfs-disk" pollingEnabled={deployStatus.polling.gfsDisk.enabled} />);
        };

        if (osType === "ablestack-vm") {
            cards.push(
                <GfsResourceStatus
                  key="gfs-resource"
                  pollingEnabled={deployStatus.polling.gfsResource.enabled}
                />
            );
            cards.push(
                <CloudClusterStatus
                  key="cloud-cluster"
                  pollingEnabled={deployStatus.polling.cloudCluster.enabled}
                />
            );
            cards.push(<GfsDiskStatus key="gfs-disk" pollingEnabled={deployStatus.polling.gfsDisk.enabled} />);
            cards.push(<CloudVmStatus key="cloud-vm" pollingEnabled={deployStatus.polling.cloudVm.enabled} />);
        } else if (osType === "ablestack-standalone") {
            cards.push(<CloudVmStatus key="cloud-vm" pollingEnabled={deployStatus.polling.cloudVm.enabled} />);
        } else if (osType === "ablestack-hci-filesystem") {
            cards.push(
                <StorageClusterStatus
                  key="storage-cluster"
                  pollingEnabled={deployStatus.polling.storageCluster.enabled}
                />
            );
            cards.push(
                <CloudClusterStatus
                  key="cloud-cluster"
                  pollingEnabled={deployStatus.polling.cloudCluster.enabled}
                />
            );
            cards.push(<StorageVmStatus key="storage-vm" pollingEnabled={deployStatus.polling.storageVm.enabled} />);
            cards.push(<CloudVmStatus key="cloud-vm" pollingEnabled={deployStatus.polling.cloudVm.enabled} />);
            addGfsCards();
        } else {
            cards.push(
                <StorageClusterStatus
                  key="storage-cluster"
                  pollingEnabled={deployStatus.polling.storageCluster.enabled}
                />
            );
            cards.push(
                <CloudClusterStatus
                  key="cloud-cluster"
                  pollingEnabled={deployStatus.polling.cloudCluster.enabled}
                />
            );
            cards.push(<StorageVmStatus key="storage-vm" pollingEnabled={deployStatus.polling.storageVm.enabled} />);
            cards.push(<CloudVmStatus key="cloud-vm" pollingEnabled={deployStatus.polling.cloudVm.enabled} />);
        }

        if (cards.length === 0) {
            return null;
        }

        return (
            <PageSection className="ct-status-context">
                <Gallery
                  hasGutter
                  minWidths={{
                      default: "520px",
                      md: "420px",
                      sm: "320px",
                  }}
                  className="ct-system-status"
                >
                    {cards}
                </Gallery>
            </PageSection>
        );
    };

    return (
        <>
            <PageSection
              variant={PageSectionVariants.default}
              className="ct-status-deploy-overview"
            >
                <DeploymentOverview
                  key={`deploy-overview-${statusRefreshKey}`}
                  mode="ribbon"
                  onAction={handleDeployAction}
                  onOpenDeployRun={openAllInOneControl}
                  onStatusChange={setDeployStatus}
                />
            </PageSection>

            {actionNotice && (
                <PageSection
                  variant={PageSectionVariants.default}
                  className="ct-status-notice-section"
                >
                    <div className="ct-status-action-notice">{actionNotice}</div>
                </PageSection>
            )}

            {renderDashboardCards()}

            <ClusterConfigPrepareWizardModal
              isOpen={isClusterWizardOpen}
              onClose={() => setIsClusterWizardOpen(false)}
              onCompleted={refreshDeployOverview}
            />

            <StorageVmDeployWizardModal
              isOpen={isStorageVmWizardOpen}
              onClose={() => setIsStorageVmWizardOpen(false)}
            />

            <CloudVmDeployWizardModal
              isOpen={isCloudVmWizardOpen}
              onClose={() => setIsCloudVmWizardOpen(false)}
              onCompleted={refreshDeployOverview}
              clusterType={deployStatus.osType as DeployClusterType}
            />

            <ConfirmActionModal
              isOpen={isCloudCenterConfigureOpen}
              title="클라우드센터 구성"
              message={isCloudCenterConfiguring
                  ? "Mold 데이터베이스와 서비스, System VM 템플릿을 구성하고 있습니다. 환경에 따라 수 분 이상 걸릴 수 있습니다."
                  : "클라우드센터를 구성하시겠습니까?"}
              confirmLabel="구성"
              isSubmitting={isCloudCenterConfiguring}
              isCompleted={isCloudCenterConfigured}
              completedMessage="클라우드센터 구성이 완료되었습니다."
              errorMessage={cloudCenterConfigureError}
              onClose={closeCloudCenterConfigure}
              onConfirm={configureCloudCenter}
            />

            <MonitoringCenterWizardModal
              isOpen={isMonitoringWizardOpen}
              onClose={() => setIsMonitoringWizardOpen(false)}
              onCompleted={refreshDeployOverview}
              clusterType={deployStatus.osType as DeployClusterType}
            />

            <GfsStorageConfigureWizardModal
              isOpen={isGfsWizardOpen}
              onClose={() => setIsGfsWizardOpen(false)}
              onCompleted={refreshDeployOverview}
            />

            <ConfigFileDownloadModal
              isOpen={isConfigFileDownloadOpen}
              onClose={() => setIsConfigFileDownloadOpen(false)}
            />

            <LicenseManagementModal
              isOpen={isLicenseManagementOpen}
              onClose={() => setIsLicenseManagementOpen(false)}
            />

            <AllInOneControlModal
              isOpen={isAllInOneControlOpen}
              onClose={() => setIsAllInOneControlOpen(false)}
              deployStatus={deployStatus}
              onStarted={setActionNotice}
              onCompleted={refreshDeployOverview}
            />

            <SecurityPatchModal
              isOpen={isSecurityPatchOpen}
              onClose={() => setIsSecurityPatchOpen(false)}
              onCompleted={() => {
                  refreshDeployOverview();
              }}
            />

            <SecurityEvidenceModal
              isOpen={isSecurityEvidenceOpen}
              onClose={() => setIsSecurityEvidenceOpen(false)}
              onCompleted={setActionNotice}
              clusterType={deployStatus.osType as DeployClusterType}
            />

            <AblestackUpdateModal
              isOpen={isAblestackUpdateOpen}
              onClose={() => setIsAblestackUpdateOpen(false)}
              onCompleted={setActionNotice}
            />

            <CloudResourceConfigureModal
              isOpen={isCloudResourceOpen}
              onClose={() => setIsCloudResourceOpen(false)}
              onCompleted={(message) => {
                  setActionNotice(message);
                  refreshDeployOverview();
              }}
            />
        </>
    );
}
