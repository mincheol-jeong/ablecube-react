# CHANGELOG

ABLESTACK Cockpit UI의 변경 이력은 이 파일에 기록합니다. RPM 버전은
`VERSION.md` 파일을 기준으로 관리합니다.

## [v1.0.0] - 2026-08-05

### Added

- 배포 현황 화면에 스토리지센터, 스토리지 클러스터, 외부 스토리지 GFS, HCI Filesystem RBD/GFS, 로컬 스토리지, 클라우드센터 단계를 추가했습니다.
- 올인원 배포 화면에서 제품 유형에 따라 SCVM bootstrap, RBD 준비, GFS 구성, 로컬 스토리지 준비 단계를 선택하고 필요한 값을 입력할 수 있도록 추가했습니다.
- 클라우드 리소스 구성 화면과 보안 증적 생성·조회·다운로드 화면을 추가했습니다.
- GFS 관리, Mold bootstrap, 보안 증적 API 클라이언트를 추가했습니다.

### Changed

- RPM 패키지 이름을 `ablestack-cockpit-plugin`으로 정하고, 태그 버전을 유지하는 `v1.0.0` 형식과 Enterprise Linux 배포 식별자(`.el9`)를 RPM 파일명에 포함하도록 변경했습니다.
- Cockpit 플러그인 binary RPM의 대상 아키텍처를 `noarch` 대신 `x86_64`로 지정해 source RPM과 x86_64 RPM을 함께 배포하도록 변경했습니다.
- Rocky Linux 컨테이너에서 마운트된 Git 작업 디렉터리를 safe directory로 등록해 태그 기반 RPM 빌드가 소유자 검증 오류 없이 실행되도록 변경했습니다.
- 배포 진행 상태와 완료 조건을 스토리지 및 클라우드센터 구성 단위로 더 자세히 표시하도록 개선했습니다.
- 클러스터 구성, 미리보기 다운로드, 보안 패치 API 응답 처리와 상태 화면의 레이아웃을 갱신했습니다.
- 클러스터 구성 및 GFS 스토리지 설정 마법사의 입력 흐름과 스타일을 정리했습니다.
