import React from "react";

import {
    Alert,
    Button,
    Checkbox,
    Form,
    FormGroup,
    Modal,
    ModalBody,
    ModalFooter,
    ModalHeader,
    Spinner,
    TextInput,
} from "@patternfly/react-core";

import {
    downloadSecurityEvidenceZip,
    fetchLatestSecurityEvidence,
    generateSecurityEvidence,
    type SecurityEvidenceMetadata,
} from "../services/api/security-evidence.ts";

interface SecurityEvidenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCompleted: (message: string) => void;
}

type SubmitState = "idle" | "loading" | "running" | "downloading" | "success" | "error";

const TARGET_OPTIONS = [
    { value: "all", label: "전체" },
    { value: "ablecube", label: "호스트" },
    { value: "scvm", label: "스토리지센터 VM" },
    { value: "ccvm", label: "클라우드센터 VM" },
];

function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

function formatSize(size: number): string {
    if (!size) return "-";

    const units = ["B", "KiB", "MiB", "GiB"];
    let value = size;
    let unitIndex = 0;

    while (value >= 1024 && unitIndex < units.length - 1) {
        value /= 1024;
        unitIndex += 1;
    }

    return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function formatDateTime(value: string): string {
    if (!value) return "-";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return value;
    }

    return new Intl.DateTimeFormat("ko-KR", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
    }).format(date);
}

function evidenceSummary(evidence: SecurityEvidenceMetadata | null) {
    if (!evidence) {
        return "생성된 보안 증적이 없습니다.";
    }

    return `${evidence.filename} · ${formatSize(evidence.size)} · ${formatDateTime(evidence.generatedAt)}`;
}

export default function SecurityEvidenceModal({
    isOpen,
    onClose,
    onCompleted,
}: SecurityEvidenceModalProps) {
    const [targets, setTargets] = React.useState<string[]>(["all"]);
    const [items, setItems] = React.useState("all");
    const [sshPort, setSshPort] = React.useState("");
    const [timeout, setTimeoutValue] = React.useState("120");
    const [maxOutputLines, setMaxOutputLines] = React.useState("400");
    const [latest, setLatest] = React.useState<SecurityEvidenceMetadata | null>(null);
    const [submitState, setSubmitState] = React.useState<SubmitState>("idle");
    const [message, setMessage] = React.useState("");

    React.useEffect(() => {
        if (!isOpen) return;

        let isCurrent = true;

        setTargets(["all"]);
        setItems("all");
        setSshPort("");
        setTimeoutValue("120");
        setMaxOutputLines("400");
        setLatest(null);
        setSubmitState("loading");
        setMessage("최신 보안 증적 정보를 확인하고 있습니다.");

        fetchLatestSecurityEvidence()
                .then((metadata) => {
                    if (!isCurrent) return;
                    setLatest(metadata);
                    setSubmitState("idle");
                    setMessage(metadata ? "" : "아직 생성된 보안 증적이 없습니다.");
                })
                .catch((error) => {
                    if (!isCurrent) return;
                    setLatest(null);
                    setSubmitState("error");
                    setMessage(errorMessage(error));
                });

        return () => {
            isCurrent = false;
        };
    }, [isOpen]);

    const closeModal = () => {
        if (submitState === "running" || submitState === "downloading") return;
        onClose();
    };

    const toggleTarget = (value: string, checked: boolean) => {
        setMessage("");
        setTargets((current) => {
            if (value === "all") {
                return checked ? ["all"] : [];
            }

            const withoutAll = current.filter((target) => target !== "all");
            const next = checked
                ? [...withoutAll, value]
                : withoutAll.filter((target) => target !== value);

            return next.length > 0 ? next : ["all"];
        });
    };

    const validate = (): string => {
        if (targets.length === 0) {
            return "실행 대상을 선택해주세요.";
        }

        if (!items.trim()) {
            return "점검 항목을 입력해주세요.";
        }

        if (sshPort.trim()) {
            const port = Number(sshPort);

            if (!Number.isInteger(port) || port <= 0 || port > 65535) {
                return "SSH 포트는 1-65535 사이의 숫자여야 합니다.";
            }
        }

        const timeoutNumber = Number(timeout);
        if (!Number.isInteger(timeoutNumber) || timeoutNumber < 1 || timeoutNumber > 3600) {
            return "수집 제한 시간은 1-3600초 사이여야 합니다.";
        }

        const lines = Number(maxOutputLines);
        if (!Number.isInteger(lines) || lines < 1 || lines > 10000) {
            return "최대 출력 라인은 1-10000 사이여야 합니다.";
        }

        return "";
    };

    const createEvidence = async () => {
        const validationMessage = validate();

        if (validationMessage) {
            setSubmitState("error");
            setMessage(validationMessage);
            return;
        }

        setSubmitState("running");
        setMessage("보안 증적을 생성하고 있습니다. 대상 수에 따라 시간이 걸릴 수 있습니다.");

        try {
            const metadata = await generateSecurityEvidence({
                targets,
                items: items.trim(),
                ...(sshPort.trim() ? { sshPort: Number(sshPort.trim()) } : {}),
                timeout: Number(timeout),
                maxOutputLines: Number(maxOutputLines),
            });

            setLatest(metadata);
            setSubmitState("success");
            const nextMessage = `보안 증적 생성 완료: ${evidenceSummary(metadata)}`;
            setMessage(nextMessage);
            onCompleted(nextMessage);
        } catch (error) {
            setSubmitState("error");
            setMessage(errorMessage(error));
        }
    };

    const downloadEvidence = async () => {
        setSubmitState("downloading");
        setMessage("보안 증적 파일을 준비하고 있습니다.");

        try {
            const href = await downloadSecurityEvidenceZip();
            const anchor = document.createElement("a");

            anchor.href = href;
            anchor.download = latest?.filename || "security-evidence.zip";
            document.body.appendChild(anchor);
            anchor.click();
            anchor.remove();
            setSubmitState("success");
            setMessage("보안 증적 다운로드를 시작했습니다.");
        } catch (error) {
            setSubmitState("error");
            setMessage(errorMessage(error));
        }
    };

    const isBusy = submitState === "loading" || submitState === "running" || submitState === "downloading";
    const canDownload = Boolean(latest?.downloadAvailable || latest?.filename);

    return (
        <Modal
          isOpen={isOpen}
          onClose={closeModal}
          variant="medium"
          aria-label="보안 증적"
          className="ct-security-evidence-modal"
        >
            <ModalHeader title="보안 증적" />
            <ModalBody>
                <div className="ct-security-evidence-modal__summary">
                    <span>최신 증적</span>
                    <strong>{evidenceSummary(latest)}</strong>
                    {latest?.collectorWarning && (
                        <p>{latest.collectorWarning}</p>
                    )}
                </div>

                <Form className="ct-security-evidence-modal__form">
                    <FormGroup label="수집 대상" fieldId="security-evidence-targets">
                        <div className="ct-security-evidence-modal__target-grid">
                            {TARGET_OPTIONS.map((option) => (
                                <Checkbox
                                  key={option.value}
                                  id={`security-evidence-target-${option.value}`}
                                  label={option.label}
                                  isChecked={targets.includes(option.value)}
                                  onChange={(_event, checked) => toggleTarget(option.value, checked)}
                                />
                            ))}
                        </div>
                    </FormGroup>
                    <FormGroup label="점검 항목" fieldId="security-evidence-items">
                        <TextInput
                          id="security-evidence-items"
                          value={items}
                          placeholder="all 또는 U-01,U-02 형식으로 입력"
                          onChange={(_event, value) => {
                              setItems(value);
                              setMessage("");
                          }}
                        />
                    </FormGroup>
                    <div className="ct-security-evidence-modal__grid">
                        <FormGroup label="SSH 포트" fieldId="security-evidence-ssh-port">
                            <TextInput
                              id="security-evidence-ssh-port"
                              type="number"
                              value={sshPort}
                              placeholder="자동 감지"
                              onChange={(_event, value) => {
                                  setSshPort(value);
                                  setMessage("");
                              }}
                            />
                        </FormGroup>
                        <FormGroup label="제한 시간(초)" fieldId="security-evidence-timeout">
                            <TextInput
                              id="security-evidence-timeout"
                              type="number"
                              value={timeout}
                              onChange={(_event, value) => {
                                  setTimeoutValue(value);
                                  setMessage("");
                              }}
                            />
                        </FormGroup>
                        <FormGroup label="최대 출력 라인" fieldId="security-evidence-max-output">
                            <TextInput
                              id="security-evidence-max-output"
                              type="number"
                              value={maxOutputLines}
                              onChange={(_event, value) => {
                                  setMaxOutputLines(value);
                                  setMessage("");
                              }}
                            />
                        </FormGroup>
                    </div>
                </Form>

                {latest && (
                    <div className="ct-security-evidence-modal__meta">
                        <div>
                            <span>클러스터 타입</span>
                            <strong>{latest.clusterType || "-"}</strong>
                        </div>
                        <div>
                            <span>수집 호스트</span>
                            <strong>{latest.collectedHosts.length > 0 ? latest.collectedHosts.join(", ") : "-"}</strong>
                        </div>
                        <div>
                            <span>대상 그룹</span>
                            <strong>{latest.targetGroups.length > 0 ? latest.targetGroups.join(", ") : "-"}</strong>
                        </div>
                        <div>
                            <span>항목 / 슬라이드</span>
                            <strong>{latest.items || "-"} / {latest.slides || "-"}</strong>
                        </div>
                    </div>
                )}

                {message && (
                    <Alert
                      className="ct-security-evidence-modal__alert"
                      variant={submitState === "error" ? "danger" : submitState === "success" ? "success" : "info"}
                      title={message}
                      isInline
                    />
                )}
            </ModalBody>
            <ModalFooter>
                <Button
                  variant="primary"
                  isDisabled={isBusy}
                  onClick={createEvidence}
                >
                    {submitState === "running" && <Spinner size="sm" aria-label="보안 증적 생성 중" />}
                    증적 생성
                </Button>
                <Button
                  variant="secondary"
                  isDisabled={isBusy || !canDownload}
                  onClick={downloadEvidence}
                >
                    {submitState === "downloading" && <Spinner size="sm" aria-label="보안 증적 다운로드 중" />}
                    다운로드
                </Button>
                <Button
                  variant="link"
                  isDisabled={isBusy}
                  onClick={closeModal}
                >
                    닫기
                </Button>
            </ModalFooter>
        </Modal>
    );
}
