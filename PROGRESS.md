# PROGRESS.md

## Current Status

Active Next Action: Task 2.2

- 버전: v0.1.0 (MVP 베이스라인)
- 마지막 갱신: Task 2.1 완료 — 근접 실패 붉은 비네트 애니메이션 + 심박 펄스 연출
- 규칙: 세션당 태스크 1개. 완료 시 체크박스와 위의 `Active Next Action` 을 함께 갱신한다. 번호는 재사용하지 않고 뒤에 추가만 한다.

## Task Backlog

### v0.1.0 — 베이스라인

- [x] **Task 0.0: 초기 MVP 베이스라인 구현 완료**
  - 코어 루프(공 생성 → 낙하 → 충돌/합체 → 점수 → 위험선 → 런 종료), 상태 머신, 시드 난수, 이벤트 버스, Canvas 렌더러, 포인터/키보드 입력
  - 확장 포인트 인터페이스 9종(`src/core/interfaces/`)과 no-op 기본 구현
  - Vitest 테스트 11개 파일, CI 워크플로, PR 템플릿, 문서 세트

### v0.2.0 — 차별화 메커니즘 1차

- [x] **Task 1.1: 근접 실패 시 슬로우모션 진입 (INearMissEffect 구현체 1개)**
  - 파일 추가: `src/systems/SlowMotionNearMissEffect.ts` — `INearMissEffect` 구현. `onNearMissEnter` 에서 `TimeController.startSlowMotion(SLOW_MOTION.durationMs, SLOW_MOTION.timeScale)` 호출, `getIntensity()` 는 severity 를 그대로 반환.
  - 생성자에서 `TimeController` 를 주입받는다. `createApp.ts` 에서 `new Game({ nearMissEffect: new SlowMotionNearMissEffect(time) })` 형태로 연결하기 위해 `Game` 이 `deps.timeController` 를 받도록 `GameDependencies` 에 선택 필드 1개 추가(기존 기본값 유지).
  - 테스트 추가: `tests/slowMotionNearMissEffect.test.ts` — enter 시 timeScale 이 0.25 로 내려가고 exit 후 400ms 지나면 1 로 복귀.
  - 완료 기준: 위험선 근처에 공이 멈추면 게임이 느려지고 HUD 에 `SLOW ×0.25` 가 보인다. 10분 크기.

- [x] **Task 1.2: 기본 머지 카드 덱과 IMergeCardProvider 구현**
  - 파일 추가: `src/systems/cards/BasicMergeCardProvider.ts` — `IMergeCardProvider` 구현. 보상 카드 3종(`+N점`: 합체 점수만큼 추가, `×2 배율 2회`: `pushScoreMultiplier(2, 2)`, `×3 배율 1회`: `pushScoreMultiplier(3, 1)`)과 리스크 카드 2종(`score_loss`: 현재 점수 10% 차감 후 `pushScoreMultiplier(4, 1)`, `raise_danger_line`: severity 0.5, 현재 v0.1.0 컨텍스트로는 위험선을 올릴 수 없으므로 apply 는 점수 −50 만 수행하고 위험선 상승은 Task 2.x 에서 `MergeCardContext` 필드 추가로 확장) 정의.
  - `draw(merge, count, riskCount)` 는 `SeededRandom` 을 주입받아 결정적으로 뽑고, 정확히 `riskCount` 장이 `RiskCard` 여야 한다.
  - 테스트 추가: `tests/basicMergeCardProvider.test.ts` — 3장 중 1장이 risk, 같은 시드는 같은 결과, apply 가 점수를 바꾼다.
  - 실제 구현: `src/systems/cards/BasicMergeCardProvider.ts` 추가. 보상 카드 3종(`+N점` / `SCORE ×2` 2회 / `SCORE ×3` 1회), 리스크 카드 2종(`score_loss` severity 0.7 = 현재 점수 10% 차감 후 `pushScoreMultiplier(4, 1)`, `raise_danger_line` severity 0.5 = 점수 −50) 정의. 카드 id 는 `CARD_IDS` 로 export 해 Task 1.4 UI 가 재사용한다.
  - `draw(merge, count, riskCount)` 는 생성자로 주입한 `SeededRandom` 으로 보상/리스크 풀에서 비복원 추출 후 Fisher-Yates 셔플 → 정확히 `riskCount` 장이 `RiskCard`, 한 핸드는 중복 카드 없음, 같은 시드는 같은 핸드를 반환. 덱이 감당 못 하는 요청(`riskCount > count`, 카드 수 초과, 정수 아닌 count)은 `RangeError`.
  - 카드 수치는 `src/config/gameConfig.ts` 의 `MERGE_CARDS` 상수 블록으로 이동(매직 넘버 금지 규칙).
  - 테스트 추가: `tests/basicMergeCardProvider.test.ts` 17개 — draw 계약(3장 중 1장 risk, 시드 결정성, 중복 없음, 경계/예외), 카드별 apply 효과(가짜 `MergeCardContext` 로 점수 델타·배율 인자 검증), 그리고 `Game.chooseCard` 통합 2건(실제 드롭 → `slowmo_select` → 리스크 카드 선택 시 점수가 `score_loss`/`raise_danger_line` 규칙대로 감소하고 상태가 복귀).
  - 미연결: `createApp.ts` 주입과 `ISlowMotionSelector` 연결은 Task 1.3, 카드 렌더링/입력은 Task 1.4.

- [x] **Task 1.3: 슬로우모션 선택 셀렉터 구현 (ISlowMotionSelector 실구현)**
  - 파일 추가: `src/systems/CardSlowMotionSelector.ts` — `ISlowMotionSelector` 구현. `onMergeMoment` 에서 `resultTier >= 2` 인 머지에 대해 `IMergeCardProvider.draw(merge, SLOW_MOTION.cardCount, SLOW_MOTION.riskCardCount)` 결과와 `SLOW_MOTION` 파라미터로 `SlowMotionRequest` 를 반환. `onTimeout` 은 첫 번째 비-리스크 카드를 반환.
  - `createApp.ts` 에서 Task 1.2 의 provider 와 함께 `Game` 에 주입.
  - 테스트 추가: `tests/cardSlowMotionSelector.test.ts` — 조건 미달 머지는 null, 조건 충족 시 카드 3장/타임아웃 시 리스크 아닌 카드 선택. 기존 `tests/game.test.ts` 의 셀렉터 통합 테스트는 그대로 통과해야 한다.
  - 실제 구현: `src/systems/CardSlowMotionSelector.ts` 추가. `onMergeMoment` 는 `SLOW_MOTION.minResultTier`(=2, 값 8) 이상 결과에서만 `SlowMotionRequest { durationMs, timeScale, cards }` 를 만들고, 그 외(작은 머지 · 최대 티어 소멸 `resultTier === null`) 는 `null` 로 건너뛴다. 뽑은 패를 내부에 보관해 `onTimeout` 은 **화면에 보인 그 패** 에서 첫 비-리스크 카드를 고른다(패가 없으면 새로 뽑는 방어 경로). `onCardChosen` 은 이미 닫힌 패를 버려 타임아웃이 지난 카드를 되살리지 않게 한다.
  - 설정 추가: `src/config/gameConfig.ts` 의 `SLOW_MOTION` 에 `minResultTier: 2` 추가(매직 넘버 금지 규칙). 발동 빈도 가이드는 `docs/GDD.md` 3.1 절의 "티어 2(값 8) 이상" 을 그대로 따른다.
  - 결정성: `SeededRandom.reseed(seed)` 메서드를 추가하고 `createApp.ts` 에서 `run:started` 이벤트로 카드 전용 난수 스트림을 런 시드에 맞춰 재시딩한다. 같은 런 시드 → 같은 카드 패. 테스트 1건 추가(`tests/seededRandom.test.ts`).
  - 테스트 추가: `tests/cardSlowMotionSelector.test.ts` 9건 — 임계값 미달/null 결과 무시, 카드 3장·리스크 1장 계약, 시드 결정성, 타임아웃이 비-리스크 카드를 고르고 그 카드가 제시된 패에 포함됨, 사전 제시 없는 타임아웃 방어 경로, 선택 후 패 폐기, 빈 패 provider 는 `null`. 마지막 1건은 실제 `Game` 통합 — 드롭으로 `resultTier >= 2` 머지를 만들면 상태가 `slowmo_select` 로 바뀌고 `pendingCards` 3장(리스크 1장) · `timeScale` 0.25 가 확인되며, 400ms 타임아웃 후 패가 비워지고 상태가 복귀한다.
  - 미연결: 카드 렌더링과 입력은 Task 1.4.

- [x] **Task 1.4: 카드 선택 UI 렌더링과 입력 연결**
  - 파일 추가: `src/render/CardOverlayRenderer.ts` — `snapshot.state === 'slowmo_select'` 일 때 `snapshot.pendingCards` 3장을 가로로 그린다(제목, 설명, 리스크 카드는 붉은 테두리 + `RISK` 배지). 카드 사각형 좌표 계산 함수를 export 하여 입력 판정에 재사용.
  - `src/input/PointerInput.ts` 의 핸들러에 `onSelect(clientX, clientY)` 를 추가(기존 핸들러는 유지)하고, `createApp.ts` 에서 `slowmo_select` 상태일 때 좌표 → 카드 인덱스 → `game.chooseCard(card)` 로 연결. `CanvasRenderer.toBoardY` 추가.
  - 테스트 추가: `tests/cardOverlayLayout.test.ts` — 카드 사각형 좌표가 보드 안에 있고 서로 겹치지 않는다.
  - 실제 구현: `src/render/CardOverlayRenderer.ts` 추가. `cardRects(count)` 가 보드 폭 기준 가로 중앙 정렬 · `CARD_OVERLAY.bottomMargin` 위쪽 앵커로 사각형을 만들고, `cardIndexAt(cards, x, y)` 가 그 사각형으로 히트 테스트를 한다(그리기 좌표와 판정 좌표가 항상 일치). 카드는 보드를 반투명하게 덮은 뒤 제목(16px) + 자동 줄바꿈 설명(12px) 을 그리며, 리스크 카드는 `PALETTE.cardRiskBorder` 테두리 3px + 카드 하단 중앙 `RISK` 배지로 구분된다.
  - `CanvasRenderer` 는 `toBoardY(clientY)` 를 추가하고 `slowmo_select` 스냅샷에서 HUD 아래에 카드 오버레이를 합성한다(HUD 는 가리지 않도록 오버레이 → HUD 순서).
  - `PointerInput` 은 `onSelect(clientX, clientY)` 핸들러를 받아 pointerup 에서 `onAim` → `onSelect` → `onDrop` 순으로 호출한다. `createApp.ts` 의 `onSelect` 는 `slowmo_select` 가 아니면 즉시 반환, 카드 밖을 누르면 무시, 카드 안이면 `game.chooseCard(card)`. `onDrop` 은 `slowmo_select` 에서 조기 반환해 카드 탭이 드롭으로 새지 않게 한다(스페이스바도 동일 경로라 안전).
  - 카드 오버레이 좌표/여백/폰트 수치는 `src/config/gameConfig.ts` 의 `CARD_OVERLAY` 블록에, 색은 `src/render/palette.ts` 에 추가(매직 넘버 금지 규칙).
  - 테스트 추가: `tests/cardOverlayLayout.test.ts` 11건 — 레이아웃 8건(보드 안 · 겹침 없음 · gap 일치 · 좌우 대칭 · 헤더와 겹치지 않음 · 카드 중심 히트 · 카드 밖 미스 · 빈 패), 그리기 3건(캔버스 스텁으로 실제 덱 카드 3장이 DOM 없이 그려지고 제목/`RISK` 배지가 나옴 · 리스크 2장이면 배지 2개 · 빈 패는 아무것도 그리지 않음).

### 이후 (v0.3.0+, 순서 미정 — 각각 착수 시 세부 스펙을 먼저 태스크로 쪼갠다)

- [x] **Task 2.1: `INearMissEffect` 붉은 화면 + 심박 펄스 연출 강화 (`src/render/` 비네트 애니메이션)**
  - 실제 구현: `src/render/NearMissVignetteRenderer.ts` 추가 — `NearMissVignetteAnimator` 가 프레임마다 `nearMissIntensity` 를 받아 페이드인 120ms(`NEAR_MISS_FX.fadeInMs`), 종료 후 300ms 페이드아웃을 만들고, `heartbeatPulse(phase)` 의 "lub-dub" 2단 박동이 비네트 밝기를 밀어 올린다. 심박 주기는 severity 0 에서 900ms → 1 에서 450ms 로 짧아진다(`heartbeatPeriodMs`).
  - `drawNearMissVignette` 가 기존 `DangerLineRenderer` 의 정적 붉은 비네트를 대체해 레이디얼 그라디언트를 그린다(위험선 선 자체는 `drawDangerLine` 유지). 게임 오버에서는 `hold` 플래그로 비네트와 박동을 멈춘 채 유지한다(GDD 3.3).
  - `CanvasRenderer` 는 주입 가능한 `Clock`(기본 `performance.now`)로 프레임 dt 를 계산해 애니메이터를 진행하고, 클립 안에서 공 뒤 · 카드 오버레이/HUD 아래에 비네트를 합성한다.
  - 상수는 `src/config/gameConfig.ts` 의 `NEAR_MISS_FX` 블록, 비네트 색은 `src/render/palette.ts` 의 `nearMissVignetteRgb` 로 이동(매직 넘버 금지 규칙).
  - 테스트 추가: `tests/nearMissVignette.test.ts` 11건 — 심박 주기·클램프, 펄스 0..1·사이클 랩, lub-dub 두 봉우리, 페이드인/페이드아웃 타이밍, 게임 오버 hold, severity 별 심박 속도 차이, 페이드아웃 중 박동 유지, 스텁 ctx 드로잉 3건(그라디언트 정지색·프레임 크기·알파 0 무그림).
- [ ] Task 2.2: `IRoundSystem` 기본 구현 (라운드별 목표 점수, 클리어 시 카드 보상)
- [ ] Task 2.3: `ISpecialBall` 폭탄 공 (인접 공 제거) 구현과 스폰 확률 설정
- [ ] Task 2.4: `ISaveSystem` localStorage 구현 (베스트 점수, 총 런 수)
- [ ] Task 2.5: `IParticleSystem` 머지 파티클 버스트
- [ ] Task 2.6: `IAudioSystem` WebAudio 기반 효과음 (merge 피치는 티어에 비례)
- [ ] Task 2.7: 배율 카드 확장 (`IScoreModifier` 를 지속 시간 기반으로 관리하는 `ModifierStack`)
- [ ] Task 2.8: 모바일 터치 QA 및 캔버스 리사이즈 회귀 테스트(jsdom 환경 도입 여부 결정)
- [ ] Task 2.9: `MergeCardContext` 에 위험선 이동 필드 추가 후 `raise_danger_line` 카드를 실동작으로 연결 — 현재 이 카드는 점수 −50 만 적용하고 `severity` 0.5 만 들고 있어 보상이 없는 순수 페널티다(Task 1.2 에서 발견)
- [ ] Task 2.10: 최대 티어 소멸(`resultTier === null`, 10,000점 보너스)에도 카드 선택창 열기 — 지금은 `CardSlowMotionSelector` 가 결과 티어가 있는 머지만 취급해서, 가장 화려한 합체가 선택 없이 지나간다(Task 1.3 에서 발견). `minResultTier` 판정에 `resultTier === null` 케이스를 추가하고 테스트 1건 보강.
- [ ] Task 2.11: 카드 선택 키보드 지원(1/2/3 키) — 지금은 포인터 `onSelect` 만 연결돼 있어 키보드 플레이어는 타임아웃에만 의존한다(Task 1.4 에서 발견). `PointerInput` 의 keydown 스위치에 숫자 키를 추가하고 `createApp.ts` 에서 인덱스 → `game.chooseCard` 로 연결.

### Infra

- [x] **Task infra.pages: GitHub Pages 배포 워크플로 추가**
  - `.github/workflows/pages.yml` 추가: main push + workflow_dispatch 트리거, permissions(contents: read, pages: write, id-token: write), concurrency group "pages"(cancel-in-progress: false)
  - 단계: checkout → setup-node(Node 20, npm cache) → npm ci (실패 시 --legacy-peer-deps 우회) → npm run build → configure-pages → upload-pages-artifact(dist/) → deploy-pages(github-pages environment)
  - ci.yml 과 역할 분리: ci.yml 은 PR 검증(Lint/Typecheck/Test), pages.yml 은 빌드+배포 전용
  - vite.config.ts base: './' 설정으로 /merge-roguelite/ 하위 경로 배포 호환 확인
