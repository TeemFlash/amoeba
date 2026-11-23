const { withAppBuildGradle } = require('expo/config-plugins');

const marker = '// Mobi Windows CMake object paths';
const gradle = `${marker}
if (System.getProperty('os.name').startsWith('Windows')) {
    androidComponents.finalizeDsl { android ->
        // Hash long object filenames before the bundled Ninja reaches its 260-character limit.
        android.defaultConfig.externalNativeBuild.cmake.arguments.add('-DCMAKE_OBJECT_PATH_MAX=240')
    }
}
`;

module.exports = function withWindowsCmakeObjectPaths(config) {
  return withAppBuildGradle(config, (config) => {
    const gradleFile = config.modResults;
    if (gradleFile.language !== 'groovy') {
      throw new Error('The Mobi Windows CMake config plugin requires a Groovy app/build.gradle.');
    }
    if (!gradleFile.contents.includes(marker)) {
      gradleFile.contents = `${gradleFile.contents.trimEnd()}\n\n${gradle}`;
    }
    return config;
  });
};
