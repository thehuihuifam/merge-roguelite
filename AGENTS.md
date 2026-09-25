# AGENTS.md — AI 코딩 에이전트 작업 지침

이 문서는 이 저장소에서 작업하는 모든 AI 코딩 에이전트(및 사람)를 위한 규칙이다. 읽지 않고 코드를 건드리지 않는다.

## 1. 프로젝트 목적과 기술 스택

**목적:** 물리 기반 머지 로그라이트 웹게임. 상단에서 숫자 공을 떨어뜨리고, 같은 숫자 공 2개가 충돌하면 하나로 합쳐지며 점수를 얻는다. 공이 위험선 위로 넘치면 런 종료. 차별화 메커니즘 3종(슬로우모션 선택, 리스크 카드, 근접 실패 연출)을 확장 포인트로 갖는다. 자세한 정신은 `CONTEXT.md`, 디자인은 `docs/GDD.md`.

**스택 (모두 고정, 임의 교체 금지):**

| 영역      | 도구                                  | 비고                                               |
| --------- | ------------------------------------- | -------------------------------------------------- |
| 언어      | TypeScript 5.x, strict                | `noUncheckedIndexedAccess`, `verbatimModuleSyntax` |
| 번들러    | Vite 7                                | `npm run dev` / `npm run build`                    |
| 물리      | Matter.js 0.20                        | `src/physics/` 안에서만 import                     |
| 테스트    | Vitest 4                              | `tests/**/*.test.ts`, Node 환경                    |
| 린트/포맷 | ESLint 9 (eslintrc 모드) + Prettier 3 | `npm run lint`, `npm run format`                   |
| 런타임    | Node.js 20 LTS                        | `.nvmrc` = 20, `engines.node >= 20`                |

> 참고: `npm run lint` 는 `ESLINT_USE_FLAT_CONFIG=false` 로 `.eslintrc.cjs` 를 사용한다. 실행 시 출력되는 ESLintRCWarning 은 정상이다.
> 참고: `npm install` 이 `Cannot read properties of null (reading 'edgesOut')` 로 실패하면 npm 10.9.x 의 peer 해석 버그다. 커밋된 `package-lock.json` 으로 `npm ci` 를 사용하거나, `npm install --legacy-peer-deps` 로 우회한다. 의존성을 바꾸지 않는다.

## 2. 폴더 구조와 각 파일의 역할

```
.
├── index.html                      Vite 엔트리 HTML (#app 루트)
├── src/
│   ├── main.ts                     부트스트랩: #app 에 createApp 마운트
│   ├── style.css                   전역 스타일 (캔버스 비율 2:3 고정)
│   ├── config/
│   │   └── gameConfig.ts           모든 튜닝 상수 (보드 크기, 티어 표, 위험선, 쿨다운, 슬로우모션 파라미터)
│   ├── core/                       ★ 순수 도메인. DOM/Canvas/matter-js 금지
│   │   ├── types.ts                Ball, Vec2, BallTierSpec, CollisionPair, MergePlan, MergeEvent, NearMissSample
│   │   ├── Game.ts                 런 오케스트레이터: 입력 커맨드 + 시간 → 물리/합체/점수/위험선 → GameSnapshot
│   │   ├── ball/BallFactory.ts     티어 스펙 조회, id 발급, 스폰 티어 가중 랜덤
│   │   ├── ball/BallRegistry.ts    보드 위 공 컬렉션 (id → Ball)
│   │   ├── merge/MergeRules.ts     canMerge / resultTierFor (순수 함수)
│   │   ├── merge/MergeResolver.ts  충돌 쌍 → 충돌 없는 MergePlan 목록 (공 1개는 패스당 1회)
│   │   ├── score/ScoreCalculator.ts 기본 점수 × 체인 배율 → IScoreModifier 체인
│   │   ├── score/ScoreState.ts     현재 런 점수 / 세션 베스트
│   │   ├── state/GameState.ts      상태·이벤트 타입과 전이 테이블
│   │   ├── state/GameStateMachine.ts 전이 실행기 (send / trySend / can / onChange)
│   │   ├── time/TimeController.ts  실시간 → 게임시간 변환, 슬로우모션 timeScale
│   │   ├── danger/OverflowDetector.ts 위험선 위 정지 시간 누적 → overflow, 근접 실패 샘플
│   │   ├── events/EventBus.ts      타입 안전 pub/sub
│   │   ├── events/GameEvents.ts    GameEventMap (모든 이벤트 이름과 페이로드)
│   │   ├── rng/SeededRandom.ts     mulberry32 시드 난수
│   │   └── interfaces/             ★ 확장 포인트. 새 기능은 여기 인터페이스를 구현한 새 파일로 추가
│   │       ├── IMergeCard.ts       MergeCard / RiskCard / IMergeCardProvider
│   │       ├── ISlowMotionSelector.ts 머지 순간 슬로우모션 + 카드 제시
│   │       ├── INearMissEffect.ts  근접 실패 연출 훅
│   │       ├── IScoreModifier.ts   배율 카드 등 점수 수정자
│   │       ├── ISpecialBall.ts     특수 공 행동
│   │       ├── IRoundSystem.ts     라운드 구조
│   │       ├── ISaveSystem.ts      저장
│   │       ├── IAudioSystem.ts     사운드
│   │       ├── IParticleSystem.ts  파티클
│   │       └── index.ts            배럴 export
│   ├── physics/                    matter-js 를 아는 유일한 계층
│   │   ├── PhysicsWorld.ts         엔진/월드 래퍼: addBall, removeBall, step, sync, drainCollisions
│   │   ├── BodyFactory.ts          Ball → Matter.Body, 벽 생성, 라벨 인코딩
│   │   └── CollisionCollector.ts   collisionStart/Active 이벤트를 CollisionPair 로 버퍼링
│   ├── render/                     Canvas 2D 렌더링 (GameSnapshot 만 읽음)
│   │   ├── CanvasRenderer.ts       DPR/스케일 처리, 프레임 합성
│   │   ├── BallRenderer.ts         공 원형 + 숫자
│   │   ├── DangerLineRenderer.ts   위험선 + 근접 실패 붉은 비네트
│   │   ├── HudRenderer.ts          점수/베스트/NEXT/오버레이
│   │   └── palette.ts              색상 상수
│   ├── input/PointerInput.ts       포인터/키보드 → aim / drop / restart / nudge
│   ├── systems/                    확장 포인트의 기본(no-op) 구현
│   │   ├── NoopSlowMotionSelector.ts
│   │   └── NoopNearMissEffect.ts
│   └── app/
│       ├── GameLoop.ts             rAF + 고정 스텝 누산기
│       └── createApp.ts            core + physics + render + input 조립
├── tests/                          Vitest 단위/통합 테스트 (파일명 = 대상 모듈 camelCase)
├── docs/                           GDD, ARCHITECTURE, DECISIONS, ROADMAP
├── CONTEXT.md / PROGRESS.md / AGENTS.md
└── .github/                        CI 워크플로, PR 템플릿
```

## 3. 코딩 규칙

1. **타입 힌트 필수.** 모든 함수/메서드에 명시적 반환 타입, 모든 매개변수에 타입. `any` 금지 (ESLint 가 에러로 막는다).
2. **린트 통과.** `npm run lint` 가 경고 0, 에러 0 이어야 한다 (`--max-warnings 0`). 포맷은 `npm run format`.
3. **타입 체크 통과.** `npm run typecheck` 에러 0.
4. **테스트 통과.** `npm test` 전부 통과. 도메인 로직(`src/core/`)을 수정하거나 추가하면 대응하는 테스트를 `tests/` 에 추가/수정한다. 테스트를 삭제하거나 `skip` 으로 CI 를 통과시키지 않는다.
5. **Conventional Commits.** `feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:` 접두사. 예) `feat(cards): add BasicMergeCardProvider`.
6. **경계 준수.** `src/core/` 는 DOM/Canvas/matter-js 를 import 하지 않는다. `matter-js` 는 `src/physics/` 에서만. 렌더러는 `GameSnapshot` 만 읽는다.
7. **확장은 추가로.** 새 기능은 `src/core/interfaces/` 의 인터페이스를 구현한 새 파일(`src/systems/...`)을 만들고 `createApp.ts` 또는 `GameDependencies` 로 주입한다. 인터페이스 메서드 삭제/시그니처 변경 금지, 필드 추가는 허용.
8. **상수는 `src/config/gameConfig.ts`.** 매직 넘버를 코드에 흩뿌리지 않는다.
9. **축약 금지.** `// TODO`, `...`, 빈 구현으로 남기지 않는다. 미룰 것은 PROGRESS.md 태스크로 적는다.
10. **파일당 하나의 역할.** 300줄을 넘기면 분리를 검토한다.

## 4. 에이전트 행동 수칙

1. **세션 시작 시 반드시 다음 순서로 읽는다:** `CONTEXT.md` → `docs/GDD.md` → `docs/ARCHITECTURE.md` → `PROGRESS.md`.
2. **1회 세션에서는 PROGRESS.md 의 태스크 1개만 수행한다.** `Active Next Action` 이 가리키는 태스크다. 옆 태스크가 쉬워 보여도 손대지 않는다.
3. **main 브랜치에 직접 커밋하지 않는다.** 브랜치명은 `feat/task-X.Y-요약` (예: `feat/task-1.1-slowmo-config`). 버그 수정은 `fix/task-X.Y-요약`.
4. 작업 전 `npm ci` 로 의존성을 맞추고, 작업 후 `npm run lint && npm run typecheck && npm test` 를 로컬에서 통과시킨다.
5. **작업 완료 시 PROGRESS.md 를 갱신한다:** 해당 태스크의 `- [ ]` 를 `- [x]` 로 바꾸고, 맨 위 `Active Next Action: Task X.Y` 를 다음 태스크로 갱신한다. 새로 발견한 후속 작업은 백로그 끝에 새 태스크로 추가한다(기존 번호는 바꾸지 않는다).
6. **소스 코드 변경과 PROGRESS.md 갱신을 하나의 PR 로 묶어서 제출한다.** PR 본문은 `.github/pull_request_template.md` 체크리스트를 채운다.
7. 인터페이스를 새로 추가하거나 확장했다면 `docs/ARCHITECTURE.md` 의 확장 포인트 표를 같은 PR 에서 갱신한다. 게임 규칙 수치를 바꿨다면 `docs/GDD.md` 를 갱신한다. 주요 마일스톤(v0.x.0)이 완료되거나 CONTEXT.md 의 '미구현' 목록에 있는 항목이 구현되면, CONTEXT.md 의 '현재 버전과 상태' 표도 같은 PR 에서 갱신한다.
8. 요청 범위 밖의 리팩터링, 의존성 추가/교체, 설정 파일 변경은 하지 않는다. 필요하다면 PR 본문에 제안만 적는다.
9. 막히면 임의로 우회하지 말고 PR 또는 이슈에 실패 로그와 함께 상황을 보고한다.

## 4.11 백로그 자동 보충 모드 (Semi-auto Loop)

### 4.11.1 백로그 목표 개수

- 백로그에 유지할 미완료 태스크 목표 개수는 20개다.
- 사용자는 세션당 1개, 2개, 3개, 4개, 5개 등 원하는 만큼 태스크를 수행할 수 있다.
- 어떤 수를 수행하든, 세션 마지막에 백로그를 20개로 복구한다.

### 4.11.2 진입 및 보충 조건

세션 시작 시 PROGRESS.md 를 읽고 미완료 태스크("- [ ]" 로 시작하는 항목) 개수를 센다.

- 미완료 태스크가 1개 이상이면 정상 루프 모드로 진행하고, 세션 마지막에 백로그 보충 절차를 실행한다.
- 미완료 태스크가 0개이면 루프 없이 백로그 보충 절차만 실행한다.

### 4.11.3 백로그 보충 절차 (세션 마지막에 실행)

1. 세션 시작 시점의 미완료 태스크 개수와, 세션 중 완료한 태스크 개수를 기록한다.

2. 세션 종료 시점의 미완료 태스크 개수를 센다. 보충할 개수 = 20 - 세션 종료 시점 미완료 개수.

3. 보충할 개수가 0 이하면 아무것도 하지 않는다.

4. 보충할 개수가 1 이상이면 다음을 수행한다.

   4.1. CONTEXT.md, docs/GDD.md, docs/ROADMAP.md 를 다시 읽는다.

   4.2. 게임 정체성(물리 기반 머지 로그라이트)과 도파민 설계 4요소, 차별화 메커니즘 3종을 재확인한다.

   4.3. 보충할 개수만큼 새 태스크를 작성한다. 각 태스크는 다음 조건을 모두 만족해야 한다.
        - 10분 안에 끝나는 크기.
        - 대상 파일 경로가 명시됨(신규 생성 또는 기존 수정 구분).
        - 기존 인터페이스를 구현하거나 확장하는 방식이며, 기존 코드를 뜯어고치지 않는다.
        - 완료 기준이 관찰 가능하게 서술됨(테스트 통과 또는 화면 확인).
        - 이전 태스크와 중복되지 않는 내용.

   4.4. PROGRESS.md 백로그 끝에 새 태스크를 추가한다. 기존 번호는 재사용하지 않고, 가장 큰 번호 다음부터 이어서 매긴다. (예: 마지막이 2.20 이면 2.21 부터)

   4.5. 새 태스크들은 같은 세션의 소스 코드 변경과 함께 하나의 PR 에 포함한다.

   4.6. PR 본문에 "이번 세션에 추가된 신규 태스크" 섹션을 만들어 추가된 태스크 개수와 각 태스크의 제목을 나열한다.

5. 사용자가 PR 을 머지하면 추가된 태스크도 함께 승인된 것으로 간주한다.

6. 사용자가 추가된 태스크 중 일부를 원치 않으면 GitHub 웹에서 PROGRESS.md 를 직접 편집해 삭제할 수 있다. 에이전트는 이 경우 다음 세션에서 삭제된 사실을 인지하고 진행한다.

### 4.11.4 백로그 보충 시 주의사항

- 새 태스크는 기존 태스크와 내용이 겹치지 않아야 한다.
- 이미 구현된 기능을 다시 태스크로 만들지 않는다. CONTEXT.md 미구현 목록과 PROGRESS.md 기존 태스크를 확인한다.
- 게임 정체성(Suika 클론으로 퇴화 금지)을 위반하는 태스크를 만들지 않는다. 모든 태스크는 3대 차별화 메커니즘 또는 로그라이트 구조에 기여해야 한다.
