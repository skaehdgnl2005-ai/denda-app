// Expo config plugin — 네이버 지도 SDK Maven 리포지토리를 android/build.gradle의
// `allprojects.repositories`에 추가한다. (withKakaoMaven.js 미러)
//
// 이유: @mj-studio/react-native-naver-map(2.9.0)의 android/build.gradle은
// `implementation "com.naver.maps:map-sdk:..."`를 선언하지만 repositories는
// `mavenCentral() google()`뿐이다. 네이버 지도 SDK는 자체 저장소
// (repository.map.naver.com)에 호스팅되어 있어 mavenCentral/Google에서 못 찾는다.
// → app.plugin.js는 매니페스트 CLIENT_ID만 주입하고 repo는 추가하지 않으므로
//   소비 측(앱)에서 직접 추가해야 한다 (네이티브 빌드 시 처음 발견 — D38 M0 호환성 리스크).
//
// `expo-autolinking-settings-plugin`이 settings.gradle에서 dependencyResolutionManagement를
// 쓰지만 repositoriesMode 미설정이라 `allprojects.repositories`는 여전히 유효하다(Kakao 선례).

const { withProjectBuildGradle } = require('expo/config-plugins');

const NAVER_MAVEN_URL = 'https://repository.map.naver.com/archive/maven';
const MARKER = 'repository.map.naver.com';

module.exports = function withNaverMaven(config) {
  return withProjectBuildGradle(config, (modConfig) => {
    let contents = modConfig.modResults.contents;

    if (contents.includes(MARKER)) {
      return modConfig;
    }

    // allprojects { repositories { ... } } 블록 내부에 maven 라인 삽입
    const regex = /(allprojects\s*\{\s*repositories\s*\{)/m;

    if (regex.test(contents)) {
      contents = contents.replace(regex, `$1\n    maven { url '${NAVER_MAVEN_URL}' }`);
    } else {
      // 블록이 없으면 파일 끝에 추가 (방어적)
      contents += `\nallprojects {\n  repositories {\n    maven { url '${NAVER_MAVEN_URL}' }\n  }\n}\n`;
    }

    modConfig.modResults.contents = contents;
    return modConfig;
  });
};
