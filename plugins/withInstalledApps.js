const { withMainApplication } = require('@expo/config-plugins');

function withInstalledApps(config) {
  return withMainApplication(config, (mod) => {
    const contents = mod.modResults.contents;
    const kotlinPackageLine = 'add(com.screenguard.InstalledAppsPackage())';

    if (contents.includes('InstalledAppsPackage')) {
      return mod;
    }

    if (contents.includes('PackageList(this).packages.apply {')) {
      mod.modResults.contents = contents.replace(
        'PackageList(this).packages.apply {',
        `PackageList(this).packages.apply {\n            ${kotlinPackageLine}`,
      );
    } else if (contents.includes('val packages = PackageList(this).packages')) {
      mod.modResults.contents = contents.replace(
        'val packages = PackageList(this).packages',
        `val packages = PackageList(this).packages\n            ${kotlinPackageLine}`,
      );
    } else if (contents.includes('new PackageList(this).getPackages()')) {
      mod.modResults.contents = contents.replace(
        /new PackageList\(this\)\.getPackages\(\);/,
        'new PackageList(this).getPackages();\n        packages.add(new com.screenguard.InstalledAppsPackage());',
      );
    } else {
      throw new Error('Unable to register InstalledAppsPackage in MainApplication');
    }

    return mod;
  });
}

module.exports = withInstalledApps;
