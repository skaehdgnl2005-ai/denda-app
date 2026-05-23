// Expo config plugin — Kakao SDK Maven 리포지토리를 android/build.gradle의
// `allprojects.repositories`에 추가한다.
//
// 이유: @react-native-kakao/core (2.4.5)의 android/build.gradle은
// `repositories { mavenCentral() google() }`만 선언한다. Kakao SDK는 자체 Nexus
// 저장소(devrepo.kakao.com)에 호스팅되어 있어, mavenCentral에서 못 찾는다.
//
// `expo-autolinking-settings-plugin`이 settings.gradle에서
// `dependencyResolutionManagement`를 사용하지만 repositoriesMode를 설정하지 않으므로,
// `allprojects.repositories`는 여전히 유효하다.

const { withProjectBuildGradle } = require('expo/config-plugins');

const KAKAO_MAVEN_URL = 'https://devrepo.kakao.com/nexus/content/groups/public/';
const MARKER = 'devrepo.kakao.com';

module.exports = function withKakaoMaven(config) {
  return withProjectBuildGradle(config, (modConfig) => {
    let contents = modConfig.modResults.contents;

    if (contents.includes(MARKER)) {
      return modConfig;
    }

    // allprojects { repositories { ... } } 블록 내부에 maven 라인 삽입
    const regex = /(allprojects\s*\{\s*repositories\s*\{)/m;

    if (regex.test(contents)) {
      contents = contents.replace(
        regex,
        `$1\n    maven { url '${KAKAO_MAVEN_URL}' }`,
      );
    } else {
      // 블록이 없으면 파일 끝에 추가 (방어적)
      contents += `\nallprojects {\n  repositories {\n    maven { url '${KAKAO_MAVEN_URL}' }\n  }\n}\n`;
    }

    modConfig.modResults.contents = contents;
    return modConfig;
  });
};
