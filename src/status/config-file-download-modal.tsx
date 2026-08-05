// 상단 "설정파일 다운로드" 버튼에서 사용하는 다운로드 목록 모달입니다.
import React from "react";

import {
    Button,
    Content,
    Modal,
    ModalBody,
    ModalFooter,
    ModalHeader,
    Spinner,
} from "@patternfly/react-core";

import cockpit from "cockpit";

import { getCubeApiConfig } from "../services/api/config.ts";
import { requestCubeApi } from "../services/api/client.ts";
import { isPreviewMode } from "../services/api/preview.ts";

type DownloadStatus = "loading" | "ready" | "error";

interface DownloadFileDefinition {
  key: string;
  label: string;
  filename: string;
  source: "file" | "api" | "ssh-key-api";
  paths?: string[];
  apiPath?: string;
}

interface DownloadFileState extends DownloadFileDefinition {
  status: DownloadStatus;
  href?: string;
  error?: string;
}

interface ConfigFileDownloadModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type RecordValue = Record<string, unknown>;

function isRecord(value: unknown): value is RecordValue {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseMaybeJson(value: unknown): unknown {
    if (typeof value !== "string") return value;

    try {
        return JSON.parse(value);
    } catch {
        return value;
    }
}

function unwrapDownloadValue(value: unknown): unknown {
    const parsed = parseMaybeJson(value);

    if (!isRecord(parsed)) return parsed;
    if (parsed.val !== undefined) return unwrapDownloadValue(parsed.val);
    if (parsed.data !== undefined) return unwrapDownloadValue(parsed.data);

    return parsed;
}

const DOWNLOAD_FILES: DownloadFileDefinition[] = [
    {
        key: "ssh-key-bundle",
        label: "SSH KEY 파일 다운로드",
        filename: "ssh-key.dat",
        source: "ssh-key-api",
        apiPath: "/api/v1/cube/ssh/key",
    },
    {
        key: "cluster-config-api",
        label: "Cluster 설정 파일 다운로드",
        filename: "cluster.json",
        source: "api",
        apiPath: "/api/v1/cube/cluster/config",
    },
];

const downloadHref = (content: string) =>
    `data:attachment/text;charset=utf-8,${encodeURIComponent(content)}`;

const binaryDownloadHref = (base64Content: string) =>
    `data:application/octet-stream;base64,${base64Content.replace(/\s+/g, "")}`;

function joinUrl(baseUrl: string, path: string): string {
    return `${baseUrl}/${path.replace(/^\/+/, "")}`;
}

async function readFirstAvailable(paths: string[]) {
    let lastError = "";

    for (const path of paths) {
        try {
            const content = await cockpit.file(path).read();
            if (content) {
                return { content, path };
            }
            lastError = `${path} 파일이 비어 있습니다.`;
        } catch (error) {
            lastError = error instanceof Error ? error.message : String(error);
        }
    }

    throw new Error(lastError || "파일을 읽을 수 없습니다.");
}

async function readApiJson(apiPath: string) {
    const content = await requestCubeApi<unknown>(apiPath);

    return JSON.stringify(unwrapDownloadValue(content), null, 2);
}

async function readSshKeyBundleHref(apiPath: string) {
    if (isPreviewMode()) {
        return binaryDownloadHref(window.btoa("preview ssh key bundle"));
    }

    const { baseUrl, token } = await getCubeApiConfig();
    const tempPath = `/tmp/ablestack-ssh-key-${Date.now()}-${Math.random().toString(16).slice(2)}.dat`;

    try {
        await cockpit.spawn([
            "curl",
            "-fSs",
            "--connect-timeout",
            "5",
            "--max-time",
            "30",
            "-X",
            "POST",
            joinUrl(baseUrl, apiPath),
            "-H",
            "accept: application/octet-stream",
            "-H",
            `Authorization: Bearer ${token}`,
            "-H",
            "Content-Type: application/json",
            "-d",
            JSON.stringify({ action: "download" }),
            "-o",
            tempPath,
        ]);

        const base64Content = await cockpit.spawn(["base64", tempPath]);
        return binaryDownloadHref(base64Content);
    } finally {
        await cockpit.spawn(["rm", "-f", tempPath]).catch(() => undefined);
    }
}

async function readDownloadHref(file: DownloadFileDefinition) {
    if (file.source === "ssh-key-api") {
        if (!file.apiPath) {
            throw new Error("SSH KEY API 경로가 설정되어 있지 않습니다.");
        }

        return readSshKeyBundleHref(file.apiPath);
    }

    if (file.source === "api") {
        if (!file.apiPath) {
            throw new Error("API 경로가 설정되어 있지 않습니다.");
        }

        return downloadHref(await readApiJson(file.apiPath));
    }

    if (!file.paths) {
        throw new Error("파일 경로가 설정되어 있지 않습니다.");
    }

    const { content } = await readFirstAvailable(file.paths);

    return downloadHref(content);
}

export default function ConfigFileDownloadModal({
    isOpen,
    onClose,
}: ConfigFileDownloadModalProps) {
    const [files, setFiles] = React.useState<DownloadFileState[]>(
        DOWNLOAD_FILES.map((file) => ({ ...file, status: "loading" }))
    );

    React.useEffect(() => {
        if (!isOpen) return;

        let isCurrent = true;
        setFiles(DOWNLOAD_FILES.map((file) => ({ ...file, status: "loading" })));

        DOWNLOAD_FILES.forEach((file) => {
            readDownloadHref(file)
                    .then((href) => {
                        if (!isCurrent) return;
                        setFiles((prev) =>
                            prev.map((item) =>
                                item.key === file.key
                                    ? { ...item, status: "ready", href, error: undefined }
                                    : item));
                    })
                    .catch((error) => {
                        if (!isCurrent) return;
                        setFiles((prev) =>
                            prev.map((item) =>
                                item.key === file.key
                                    ? {
                                        ...item,
                                        status: "error",
                                        href: undefined,
                                        error: error instanceof Error ? error.message : String(error),
                                    }
                                    : item));
                    });
        });

        return () => {
            isCurrent = false;
        };
    }, [isOpen]);

    return (
        <Modal
          isOpen={isOpen}
          onClose={onClose}
          variant="small"
          aria-label="설정파일 다운로드"
          className="ct-config-file-download-modal"
        >
            <ModalHeader title="설정파일 다운로드" />
            <ModalBody>
                <Content component="p">다운로드할 서버 설정파일을 클릭해주세요</Content>
                <div className="ct-config-file-download-modal__list">
                    {files.map((file) => (
                        <div className="ct-config-file-download-modal__item" key={file.key}>
                            <span className="ct-config-file-download-modal__label">- {file.label} :</span>
                            {file.status === "loading" && (
                                <span className="ct-config-file-download-modal__loading">
                                    <Spinner size="sm" aria-label={`${file.label} 확인 중`} />
                                    파일 확인 중
                                </span>
                            )}
                            {file.status === "ready" && file.href && (
                                <a
                                  className="pf-v6-c-button pf-m-link"
                                  href={file.href}
                                  download={file.filename}
                                >
                                    파일을 다운로드 하시려면 클릭하십시오
                                </a>
                            )}
                            {file.status === "error" && (
                                <span className="ct-config-file-download-modal__error">
                                    {file.error || "파일이 존재하지 않습니다."}
                                </span>
                            )}
                        </div>
                    ))}
                </div>
            </ModalBody>
            <ModalFooter>
                <Button variant="link" onClick={onClose}>
                    닫기
                </Button>
            </ModalFooter>
        </Modal>
    );
}
