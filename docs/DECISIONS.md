# Architecture Decision Records

형식: 배경 → 결정 → 근거 → 결과/트레이드오프. 새 결정은 아래에 번호를 이어서 추가한다. 기존 결정을 뒤집을 때는 삭제하지 말고 "Superseded by ADR-N" 을 적는다.

---

## ADR-001: 물리 엔진으로 Matter.js 를 사용한다

**배경.** 게임의 핵심 재미가 "공이 굴러가며 생기는 예측 불가한 합체" 이므로 2D 강체 물리가 필요하다. 후보: Matter.js, Planck.js(Box2D 포팅), Rapier(WASM), 자체 구현.

**결정.** Matter.js 0.20.x.

**근거.**

- 순수 JS 라이브러리라 Vitest Node 환경에서 헤드리스로 돌아간다. 물리 통합 테스트(`tests/physicsWorld.test.ts`, `tests/game.test.ts`)를 브라우저 없이 실행할 수 있다는 점이 결정적이었다.
- 원, 정적 벽, 충돌 이벤트(`collisionStart/Active`), 바디 추가/제거라는 우리의 요구가 API 로 직접 지원된다.
- 머지 게임 장르(Suika 류)에서 가장 널리 쓰여 튜닝 레퍼런스가 많다. `@types/matter-js` 가 정비되어 있다.
- Rapier 는 성능은 좋지만 WASM 로딩과 Node 테스트 설정이 복잡하고, 수십 개의 원에는 과하다. 자체 구현은 스택 안정성(원 더미의 떨림)을 잡는 데 시간이 든다.

**결과.** `matter-js` import 는 `src/physics/` 에만 허용한다. 엔진 교체 시 `PhysicsWorld` 의 공개 메서드(`addBall`, `removeBall`, `step`, `sync`, `drainCollisions`, `maxSpeed`)만 유지하면 된다. 트레이드오프: Matter.js 는 결정성을 보장하지 않지만 고정 스텝 + 정렬된 충돌 쌍으로 실용적 수준의 재현성을 확보했다.

---

## ADR-002: 빌드 도구로 Vite 를 사용한다

**배경.** TypeScript 웹게임의 개발 서버와 프로덕션 번들이 필요하다. 후보: Vite, webpack, Parcel, esbuild 직접 사용.

**결정.** Vite 7.

**근거.**

- 설정이 거의 없고(`vite.config.ts` 20줄), 에이전트가 빌드 설정을 건드릴 이유가 사라진다.
- Vitest 와 같은 설정 체계(`resolve.alias` 등)를 공유하므로 `@/` 경로 별칭을 한 번만 정의한다.
- ES 모듈 기반 HMR 로 게임 파라미터 튜닝 반복이 빠르다.
- 정적 결과물(`dist/`)이므로 GitHub Pages 등 어디에나 배포 가능하다.

**결과.** `base: './'` 로 상대 경로 배포를 지원한다. 개발 서버는 `0.0.0.0` 에 바인딩하고 `allowedHosts: true` 로 프록시 미리보기 환경을 허용한다.

---

## ADR-003: 테스트 러너로 Vitest 를 사용한다

**배경.** 도메인 로직(합체 규칙, 점수, 상태 머신, 위험선)을 빠르게 검증할 단위 테스트와, 물리 포함 통합 테스트가 필요하다. 후보: Vitest, Jest, node:test.

**결정.** Vitest 4.

**근거.**

- Vite 설정을 그대로 재사용해 TypeScript + 경로 별칭을 추가 설정 없이 처리한다. Jest 는 ts-jest/babel 과 moduleNameMapper 설정이 따로 필요하다.
- ESM 네이티브라 `verbatimModuleSyntax` 기반 코드와 마찰이 없다.
- Node 환경 기본값으로 `src/core/`, `src/physics/` 를 헤드리스 검증한다. 렌더/입력 테스트가 필요해지면 `environment: 'jsdom'` 을 파일 단위로 켤 수 있다(Task 2.8).
- 실행이 빨라(전체 55개 테스트 약 2초) 에이전트가 매 변경마다 돌리기 부담이 없다.

**결과.** 테스트는 `tests/` 에 두고 파일명은 대상 모듈의 camelCase 로 맞춘다. 참고: npm 10.9.x 는 vitest 4.1.x 의 optional peer 를 해석하다 `edgesOut` 오류를 낼 수 있어 `package-lock.json` 을 커밋하고 CI 는 `npm ci` 를 쓴다.

---

## ADR-004: TypeScript strict 모드(+ 추가 엄격 옵션)를 사용한다

**배경.** 여러 AI 에이전트가 PR 단위로 코드를 이어 쓴다. 각 에이전트는 전체 맥락을 갖지 못하므로 컴파일러가 최대한 많은 실수를 잡아야 한다.

**결정.** `strict: true` 에 더해 `noUncheckedIndexedAccess`, `noImplicitOverride`, `noImplicitReturns`, `noFallthroughCasesInSwitch`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`, `isolatedModules` 를 켠다. ESLint 로 `explicit-function-return-type`, `no-explicit-any`, `consistent-type-imports` 를 에러로 강제한다.

**근거.**

- `noUncheckedIndexedAccess` 는 `BALL_TIERS[tier]` 같은 배열 접근에서 `undefined` 처리를 강제해, 티어 범위 버그를 컴파일 타임에 막는다(`getTierSpec` 이 그 결과물이다).
- 명시적 반환 타입은 인터페이스 계약(`src/core/interfaces/`)이 구현체에서 조용히 넓어지는 것을 막고, 에이전트가 함수 시그니처만 보고 의도를 파악하게 한다.
- `exactOptionalPropertyTypes` 는 `GameDependencies` 같은 옵션 객체에서 `undefined` 를 명시적으로 넘기는 실수를 잡는다.
- `verbatimModuleSyntax` 는 타입 전용 import 를 강제해 번들에 불필요한 런타임 import 가 섞이지 않게 한다.

**결과.** 초기 작성 비용이 조금 늘지만, `npm run typecheck` 가 통과하면 런타임 타입 오류 대부분이 배제된다. 규칙 완화는 ADR 로 기록한 뒤에만 허용한다.

---

## ADR-005: ESLint 9 를 eslintrc(레거시) 설정으로 실행한다

**배경.** 요구된 설정 파일은 `.eslintrc.cjs` 이지만, ESLint 9 의 기본은 flat config(`eslint.config.js`) 이고 ESLint 10 은 eslintrc 를 제거했다.

**결정.** ESLint 9.x 를 고정하고 `npm run lint` 에서 `ESLINT_USE_FLAT_CONFIG=false` 로 `.eslintrc.cjs` 를 사용한다.

**근거.** 지원 중인 메이저(9) 를 쓰면서 요구된 파일 형식을 유지한다. ESLint 8 은 EOL 이라 배제했다.

**결과.** 실행 시 ESLintRCWarning 이 출력되지만 동작에 영향은 없다. flat config 로의 이관은 별도 태스크(chore)로 다루며, 이 ADR 을 supersede 한다.

---

## ADR-006: `Game` 이 `PhysicsWorld` 를 직접 소유한다 (core → physics 예외)

**배경.** 순수하게는 core 가 물리 인터페이스만 알고 app 이 구현을 주입해야 한다.

**결정.** v0.1.0 에서는 `Game` 이 `PhysicsWorld` 구체 클래스를 기본값으로 생성하되 `GameDependencies.physics` 로 교체 가능하게 한다.

**근거.** 물리 엔진 교체 가능성은 낮고, 추상 인터페이스를 하나 더 두면 에이전트가 읽어야 할 파일이 늘어난다. `PhysicsWorld` 가 matter-js 를 완전히 캡슐화하므로 core 의 matter-js 무지(無知)라는 본질적 목표는 지켜진다.

**결과.** 향후 `IPhysicsWorld` 인터페이스 추출이 필요하면 `PhysicsWorld` 의 공개 메서드를 그대로 인터페이스로 승격하면 되고 호출부 변경은 없다.
