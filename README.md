# ABLESTACK Cube

Cube에 ABLESTACK 관리기능을 제공합니다.


# Development dependencies

On Fedora:

    sudo dnf -y install git gcc gcc-c++ make autoconf automake libtool intltool \
        glib2-devel libxslt-devel libmount-devel pam-devel \
        systemd-devel json-glib-devel gnutls-devel krb5-devel \
        nodejs npm xmlto rpm-build


# Getting and building the source

이 명령어들은 소스 코드를 가져와(checkout) dist/ 디렉터리로 빌드하는 작업을 수행합니다.

```
git clone https://github.com/qoxown12/ablecube-react.git
cd ablecube-react
make
```

# Installing
개발 시에는 일반적으로 git 트리에서 바로 모듈을 실행하고 싶을 때가 많습니다. 이를 위해서는 make devel-install을 실행하면, 체크아웃한 코드를 cockpit-bridge가 패키지를 찾는 위치에 심볼릭 링크로 연결합니다.
수동으로 하고 싶다면:

```
mkdir -p ~/.local/share/cockpit
ln -s `pwd`/dist ~/.local/share/cockpit/ablestack
```

코드를 변경한 뒤 `make` 또는 `./build.js` 를 실행하고, 브라우저에서 Cockpit 페이지를 새로고침하세요.

watch mode를 사용하면 코드 변경 시마다 번들이 자동으로 다시 생성됩니다.

    npm run watch

로컬에 설치된 버전을 제거하려면 make devel-uninstall을 실행하거나 심볼릭 링크를 직접 제거하십시오.

    rm ~/.local/share/cockpit/ablestack

# Running eslint

Cockpit Files는 .js 및 .jsx 파일의 JavaScript 코드 스타일을 자동으로 검사하기 위해 ESLint를 사용합니다.

개발자 편의를 위해 ESLint를 다음 명령으로 직접 실행할 수도 있습니다:

    npm run eslint

일부 규칙 위반은 다음 명령을 통해 자동으로 수정할 수 있습니다:

    npm run eslint:fix

규칙 설정은 `.eslintrc.json` 파일에서 확인할 수 있습니다

## Running stylelint

Cockpit은 .css 및 .scss 파일의 CSS 코드 스타일을 자동으로 검사하기 위해 Stylelint를 사용합니다.

개발자 편의를 위해 Stylelint를 다음 명령으로 직접 실행할 수도 있습니다:

    npm run stylelint

일부 규칙 위반은 다음 명령을 통해 자동으로 수정할 수 있습니다:

    npm run stylelint:fix

규칙 설정은 `.stylelintrc.json` 파일에서 확인할 수 있습니다

## rpm build

RPM을 생성하려면 RPM 기반 Linux 환경에서 다음을 실행하세요.

```
./rpm-builder.sh
```

스크립트는 프로덕션 `dist/`를 먼저 생성한 후, 해당 정적 파일을 포함한
`ablestack-cockpit-plugin` RPM과 source RPM을 만듭니다. 결과물은
`./artifacts/rpm/`에 생성됩니다. 기본 버전은 루트의 `VERSION` 파일에서
읽고, 해당 버전의 `## [버전]` 항목이 `CHANGELOG.md`에 있어야 빌드됩니다.
두 파일은 RPM 문서에도 포함됩니다.

`--version`으로 버전을 임시 지정할 수도 있지만, 지정한 버전에 해당하는
CHANGELOG 항목은 반드시 먼저 추가해야 합니다.

```
./rpm-builder.sh --version v1.2.0 --release 1 --dist .el9
```

빌드 머신에는 `make`, Node.js/npm, GNU tar 및 `rpm-build` 패키지가 필요합니다.

### 태그로 RPM 릴리스 만들기

GitHub에 `v1.2.0` 형식의 태그를 push하면 `Release RPM` GitHub Actions
워크플로가 Rocky Linux 9에서 RPM을 만들고, 같은 태그의 GitHub Release에
binary RPM과 source RPM을 첨부합니다. Release 본문에는 GitHub 자동 생성
문구 대신 태그와 동일한 `CHANGELOG.md` 버전 항목이 사용됩니다. 기존
Release를 다시 빌드해도 RPM 파일과 Release 본문을 함께 갱신합니다.

```
git tag v1.2.0
git push origin v1.2.0
```

GitHub Actions 화면에서 `Release RPM`을 수동 실행할 수도 있으며, 이때는
`v`를 제외한 버전(`1.2.0`)과 RPM release 번호를 입력합니다.

Rocky Linux 9 릴리스 워크플로의 결과 파일명은 다음과 같습니다.

```
ablestack-cockpit-plugin-v1.2.0-1.el9.x86_64.rpm
```

### 버전 관리

릴리스할 때는 먼저 `VERSION`의 버전을 변경하고, 같은 버전의 변경 항목을
`CHANGELOG.md` 맨 위에 추가합니다. 이 변경을 반드시 커밋하고 main 브랜치에
push한 다음, 그 커밋에 같은 버전의 `v` 태그를 생성해야 합니다. 커밋하기 전에
태그를 만들면 GitHub Actions는 변경 전 `VERSION`과 CHANGELOG를 읽게 됩니다.

Pull Request가 `main`에 merge되면 `Bump version after merge` 워크플로가
현재 버전의 patch 번호를 자동으로 올리고, 같은 버전의 CHANGELOG 제목과
merge된 PR 제목·번호를 기록한 후 `VERSION`과 `CHANGELOG.md`를 커밋합니다.
동일한 PR 워크플로를 재실행해도 버전은 중복 증가하지 않습니다.

```
# VERSION: v1.2.0
git status --short
git add -A
git diff --cached --stat
git commit -m "Release v1.2.0"
git push origin main
git tag "$(cat VERSION)"
git push origin "$(cat VERSION)"
```
