import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  // A-3: `@typescript-eslint/no-explicit-any` 는 기존 코드 71건이 error 인 상태라
  // lint blocking 복원이 막힌다. 신규 회귀를 막는 blocking 을 우선 복원하고,
  // 누적된 `any` 는 warn 으로 가시화해 점진 청소 대상으로 남긴다.
  // 후속 리팩터 (A-2-a Phase 2+) 중 개별 함수 타입 정비 시 함께 해결.
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
]);

export default eslintConfig;
