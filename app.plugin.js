const {
  withAppBuildGradle,
  withProjectBuildGradle,
  withDangerousMod,
  withSettingsGradle,
  withXcodeProject,
} = require('expo/config-plugins');
const fs = require('node:fs/promises');
const path = require('node:path');

// These are ownership identifiers, not signing credentials. Device distribution
// remains a separate owner-controlled release operation, never an automated run.
const productionSigningOwner = {
  appleTeam: 'UBF8T346G9',
  appleProfile: 'IoT Plug and Play Development',
  androidPropertyPrefix: 'PAAD_BETARELEASE',
};

module.exports = (config, {isCI = false} = {}) => {
  config = withSettingsGradle(config, mod => {
    mod.modResults.contents = mod.modResults.contents.replace(/[ \t]+$/gm, '');
    return mod;
  });
  config = withDangerousMod(config, [
    'android',
    async mod => {
      const wrapper = path.join(
        mod.modRequest.platformProjectRoot,
        'gradle/wrapper/gradle-wrapper.properties',
      );
      const contents = await fs.readFile(wrapper, 'utf8');
      if (!contents.includes('gradle-9.3.1-bin.zip')) {
        throw new Error('Review the Gradle wrapper checksum when changing templates.');
      }
      if (!contents.includes('distributionSha256Sum=')) {
        await fs.writeFile(
          wrapper,
          `${contents}\ndistributionSha256Sum=b266d5ff6b90eada6dc3b20cb090e3731302e553a27c5d3e4df1f0d76beaff06\n`,
        );
      }
      return mod;
    },
  ]);

  config = withProjectBuildGradle(config, mod => {
    const marker = '// PAAD pinned NDK';
    if (!mod.modResults.contents.includes(marker)) {
      mod.modResults.contents = mod.modResults.contents.replace(
        'buildscript {',
        `buildscript {\n  ${marker}\n  ext.ndkVersion = "27.1.12297006"`,
      );
    }
    return mod;
  });

  config = withAppBuildGradle(config, mod => {
    const marker = '// PAAD isolated bundled CI variant';
    if (!mod.modResults.contents.includes(marker)) {
      mod.modResults.contents = mod.modResults.contents.replace(
        '    buildTypes {',
        `    buildTypes {
        ${marker}
        ci {
${isCI ? '' : '            applicationIdSuffix ".ci"'}
            debuggable false
            signingConfig signingConfigs.debug
            matchingFallbacks = ['release']
            minifyEnabled false
        }`,
      );
    }
    // The template signs release with a development key. Do not carry that
    // behavior into the production identity; only the .ci variant is signed.
    mod.modResults.contents = mod.modResults.contents.replace(
      /release \{([\s\S]*?)signingConfig signingConfigs\.debug/,
      'release {$1signingConfig null',
    );
    return mod;
  });

  return withXcodeProject(config, mod => {
    const configurations = mod.modResults.pbxXCBuildConfigurationSection();
    for (const entry of Object.values(configurations)) {
      if (!entry.buildSettings?.PRODUCT_BUNDLE_IDENTIFIER) {
        continue;
      }
      const settings = entry.buildSettings;
      settings.DEVELOPMENT_TEAM = '""';
      settings.PROVISIONING_PROFILE_SPECIFIER = '""';
      if (!isCI) {
        settings.PAAD_PRODUCTION_SIGNING_TEAM = productionSigningOwner.appleTeam;
        settings.PAAD_PRODUCTION_SIGNING_PROFILE =
          `"${productionSigningOwner.appleProfile}"`;
        settings.PAAD_ANDROID_SIGNING_PROPERTY_PREFIX =
          productionSigningOwner.androidPropertyPrefix;
      }
    }
    return mod;
  });
};
