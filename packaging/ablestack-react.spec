# This package ships pre-built JavaScript/CSS assets and has no debuginfo.
%global debug_package %{nil}

Name:           ablestack-cockpit-plugin
Version:        v1.0.0
Release:        1%{?dist}
Summary:        ABLESTACK Cockpit plugin

License:        LGPL-2.1-or-later
BuildArch:      x86_64

Source0:        %{name}-%{version}.tar.xz

Requires:       cockpit-bridge >= 318

%description
ABLESTACK management functionality for the Cockpit web console.

%prep
%autosetup -n %{name}-%{version}

%build
# The RPM is intentionally built from assets pre-built by rpm-builder.sh.

%install
install -d %{buildroot}%{_datadir}/cockpit/ablestack
cp -a dist/. %{buildroot}%{_datadir}/cockpit/ablestack/
install -Dpm 0644 io.ablecloud.ablestack.metainfo.xml \
    %{buildroot}%{_datadir}/metainfo/io.ablecloud.ablestack.metainfo.xml

%files
%license LICENSE
%doc README.md CHANGELOG.md VERSION
%{_datadir}/cockpit/ablestack
%{_datadir}/metainfo/io.ablecloud.ablestack.metainfo.xml

%changelog
* Wed Aug 05 2026 Ablecloud <support@ablecloud.io> - v1.0.0-1
- Initial package
