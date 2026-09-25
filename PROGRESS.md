# PROGRESS.md

## Current Status

Active Next Action: Task 2.15 — 앱 렌더 단계의 라운드 HUD 연결 복구

- 버전: v0.2.0 (차별화 메커니즘 1차 완료, v0.3.0 로그라이트 구조 진행 중)
- 마지막 갱신: 2026-09-25 — 백로그 보충 전용 루프, Task 2.15~2.34 제안 (기능 구현 없음)
- 규칙: 세션당 태스크 1개. 완료 시 체크박스와 위의 `Active Next Action` 을 함께 갱신한다. 번호는 재사용하지 않고 뒤에 추가만 한다.

## 이번 루프 기록 (2026-09-25)

- 진입 시 미완료 0개 → AGENTS.md 4.11.2에 따라 구현 없이 백로그 보충만 수행.
- 이번 세션 완료 태스크 0개, 보충 전 미완료 0개, 보충 수 `20 - 0 = 20`개, 보충 후 미완료 20개.
- CONTEXT.md, docs/GDD.md, docs/ROADMAP.md 재확인: 물리적 가변 보상·에스컬레이션·근접 실패·juice를 유지하며, 슬로우모션 선택·리스크 카드·근접 실패 연출과 런 구조에 한정해 제안했다.
- 중복 점검: 세이브·사운드·파티클·ModifierStack·위험선 페널티는 이미 구현됨. CONTEXT.md의 오래된 미구현 목록보다 실제 코드와 완료 기록을 우선해 재구현 태스크를 만들지 않았다. 라운드 HUD는 구현체가 있지만 `createApp.ts`의 렌더 호출에서 `round` 합성이 빠져 있으므로 연결 회귀만 별도 등록했다.
- 검증: `npm ci`, `npm run lint`, `npm run typecheck`, `npm test` 통과 (27개 파일, 207개 테스트). 코드 변경 및 브라우저 수동 QA는 수행하지 않음.
- 아래 신규 태스크는 각각 10분 이내의 작업 단위이며, 선행 태스크를 명시했다. 이번 PR 머지 시 제안 승인으로 간주하고 다음 세션부터 순서대로 수행한다.

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
- [x] **Task 2.2: `IRoundSystem` 기본 구현 (라운드별 목표 점수, 클리어 시 카드 보상)**
  - 실제 구현: `src/systems/BasicRoundSystem.ts` — 라운드마다 "그 라운드 안에서 벌어야 하는 점수" 목표(`ROUNDS.firstTargetScore` 150 + 100/라운드)와 드롭 예산(15 + 3/라운드)을 관리. 진행도는 라운드 시작 시점부터의 점수 델타라서, 큰 점수가 한 번에 튀어도 다음 라운드가 덤으로 클리어되지 않는다. 예산을 먼저 쓰면 라운드는 보상 없이 넘어간다(`isDropBudgetExhausted` — `IRoundSystem` 에 필드 추가).
  - `src/systems/cards/RoundClearRewardCard.ts` — 클리어 보상 카드 `+N점`(N = 50 + 25×(라운드−1))을 즉시 지급하는 `MergeCard` 팩토리(`ROUND_CLEAR_CARD_ID`).
  - `src/systems/RoundRunner.ts` — `EventBus` 구독(`ball:dropped`, `score:changed`, `run:started`)으로 라운드를 진행하고, 클리어 시 `Game.applyRewardCard` 로 보상 카드를 적용한 뒤 다음 라운드로 넘어간다. 보상 적용이 다시 쏘는 `score:changed` 는 가드로 막아 보상이 라운드당 1회만 지급된다.
  - `Game.applyRewardCard(card)` 메서드 추가 — `chooseCard` 와 같은 카드 컨텍스트(`buildCardContext` 로 추출)를 쓰고, idle/game_over 에서는 거부한다. `createApp.ts` 에 `BasicRoundSystem` + `RoundRunner` 연결(해제는 `dispose`).
  - 테스트 추가: `tests/basicRoundSystem.test.ts` 7건(목표/예산 증가, 라운드 스코프 진행도, 점수 차감 시 클리어 해제, 예산 소진, advance/reset), `tests/roundRunner.test.ts` 8건(보상 카드 수치·적용, 클리어→보상→다음 라운드, 예산 소진 시 무보상 스킵, 이미 클리어된 라운드 보호, run:started 리셋, dispose 후 무반응, 실제 Game 통합 — 보상 재진입 가드 검증), `tests/game.test.ts` 2건(`applyRewardCard` 승인/거부).
  - 미연결: 라운드/목표/예산 HUD 표시는 Task 2.12, 보상을 자동 지급 대신 카드 선택지로 주는 것은 Task 2.13 로 백로그 추가.
- [x] **Task 2.3: `ISpecialBall` 폭탄 공 (인접 공 제거) 구현과 스폰 확률 설정**
  - 실제 구현: `src/systems/special/BombBallBehavior.ts` — `ISpecialBallBehavior` 구현(kind `bomb`). 머지하지 않고(`canMergeWith` → false) 첫 충돌에 폭발한다. `blastRadius` 필드를 `ISpecialBallBehavior` 에 추가(기존 메서드 무변경)해 호스트(Game)가 폭발을 실행하고, 생명주기 훅은 `bomb:spawned`/`bomb:contact` 이벤트를 발화한다. `onMerged` 는 불변식 가드(폭탄은 병합될 수 없다).
  - `src/systems/special/SpecialBallRegistry.ts` — `ISpecialBallRegistry` 구현. `createApp` 에서 `Game` 생성 후 폭탄 행동을 등록해 이벤트 버스를 주입할 수 있게 했다.
  - 폭발 대상은 순수 함수 `blastVictims(bomb, balls, radius, contact)`: 자신 + 닿은 공(반경 밖이어도 무조건) + 중심 기준 반경 90px(`SPECIAL_BALLS.bombBlastRadius`) 안의 공. `Game.resolveMerges` 가 머지 규칙 앞단에서 특수 공 쌍을 먼저 소비해 폭탄이 머지로 새지 않는다.
  - 스폰 확률: `SPECIAL_BALLS.bombSpawnChance`(= 0.05)를 `BallFactory.rollSpawnSpecial()` 이 매 드롭에 굴린다. `Game` 에 `specialBalls`/`specialSpawnChance` 의존 선택 필드를 추가해 테스트가 확률 0/1로 고정할 수 있다. `Ball.special` 필드(선택)와 `HeldBall.special`/`GameSnapshot.nextSpecial`로 홀드·NEXT 미리보기까지 폭탄 표시(황색 테두리 + `✹`)가 붙는다.
  - 이벤트 추가: `bomb:spawned`, `bomb:contact`, `ball:detonated`(제거된 id 일괄 포함).
  - 테스트 추가: `tests/specialBalls.test.ts` 11건 — 행동/불변식/반경 검증, `blastVictims` 순수 로직 3건(반경 내 제거·접촉 공 강제 포함·스택 정리), 레지스트리 교체, 실제 Game 통합 4건(확률 1 폭탄 발급·이벤트, 확률 0 일반 공, 홀로 앉은 폭탄 미폭발, 첫 충돌 폭발로 보드 정리), `tests/ballFactory.test.ts` 3건(스폰 확률 경계·예외·특수 태그).
- [x] **Task 2.4: `ISaveSystem` localStorage 구현 (베스트 점수, 총 런 수)**
  - 실제 구현: `src/systems/LocalStorageSaveSystem.ts` — `ISaveSystem` 구현. `StorageLike` 인터페이스 주입 가능(테스트는 `FakeStorage`), `window.localStorage` 가 없거나 예외면 메모리 폴백. 키 `merge-roguelite:save`, 버전 `1`(`SAVE` 상수). `load()` 는 JSON 파싱·형태 검증·버전 마이그레이션(구버전은 best/total/lastSeed 유지 후 버전만 승격), `save()` 는 정수 클램프·floor, `clear()` 는 removeItem. 모든 메서드는 try/catch 로 quota/접근 예외를 삼켜 게임이 계속 돌아가게 한다.
  - 설정 추가: `src/config/gameConfig.ts` 에 `SAVE` 블록(키·버전) — 매직 스트링 금지.
  - `createApp.ts` 연결: `LocalStorageSaveSystem` 생성 → `load()` 로 `initialBest` 를 `Game` 에 주입, `run:started` 에서 `lastSeed` 저장, `run:over` 에서 `bestScore = max(saved, best, score)` + `totalRuns++` 저장.
  - 테스트 추가: `tests/saveSystem.test.ts` 8건 — 빈 저장소 기본값, round-trip, clear, invalid JSON 방어, 음수/float 클램프, 버전 불일치 마이그레이션, 예외 무시, 메모리 폴백.
- [x] **Task 2.5: `IParticleSystem` 머지 파티클 버스트**
  - 실제 구현: `src/systems/BasicParticleSystem.ts` — `IParticleSystem` 구현. `burst()` 는 kind·intensity 에 따라 개수 결정(`PARTICLES` 설정: merge 14, mergeMax 24, dropDust 8, dangerSpark 6), 랜덤 각도·속도·수명에 중력·드래그 적용, 최대 200개 cap. `update()` 는 수명 감소·이동·제거, `render()` 는 alpha 페이드 원형 드로잉.
  - 설정 추가: `src/config/gameConfig.ts` 에 `PARTICLES` 블록(개수·수명·속도·지터·중력·드래그·크기·cap).
  - 렌더 연결: `CanvasRenderer` 에 `particles?: IParticleSystem` 옵션 추가(정적 타입 `exactOptionalPropertyTypes` 대응), 클립 안에서 공 뒤·HUD 아래에 `particles.render(ctx)` 합성.
  - `createApp.ts` 연결: `BasicParticleSystem` 생성 → `CanvasRenderer` 주입, `GameLoop` update 에서 `particles.update(stepMs)`, 이벤트 구독 `merge:resolved`(티어 색·chain 기반 intensity, max면 merge_max), `ball:dropped`(drop_dust), `ball:detonated`(폭발), `danger:nearMissEnter`(스파크, 공 위치 탐색).
  - 테스트 추가: `tests/particleSystem.test.ts` 9건 — burst 생성, intensity 스케일, zero 무시, 수명 후 제거, 이동·clear·cap·render 스텁·모든 kind 지원.
- [x] **Task 2.6: `IAudioSystem` WebAudio 기반 효과음 (merge 피치는 티어에 비례)**
  - 실제 구현: `src/systems/WebAudioSystem.ts` — `IAudioSystem` 구현. `AudioContext` lazy 생성, 없으면 no-op(테스트/미지원 브라우저). `frequencyForMergeTier(tier, chain)` 가 `AUDIO` 설정(220Hz base, 티어당 2 semitone, chain당 0.8 semitone)으로 주파수 계산해 티어 비례 피치 구현. `play()` 는 short/long envelope(oscillator+gain), `merge_big` 은 두 배음, `game_over` 는 하강, `card_show`/`card_pick` 은 코드, `near_miss_loop` 는 loop voice map으로 지속음. `stop()` 은 loop 정지, `setMuted()` 는 masterGain 0 및 loop 정리.
  - 설정 추가: `src/config/gameConfig.ts` 에 `AUDIO` 블록(baseFreq, semitonePerTier, chainSemitone, masterVolume, durations).
  - `createApp.ts` 연결: `WebAudioSystem` 생성, 이벤트 구독 `merge:resolved`(tier/chain → frequencyForMergeTier → merge/merge_big), `ball:dropped`(drop), `ball:detonated`(merge_big), `danger:nearMissEnter`(near_miss_loop), `danger:nearMissExit`(stop), `time:slowMotionStart`(card_show), `run:over`(game_over+loop stop), `onSelect` 에서 choose 성공 시 card_pick.
  - 테스트 추가: `tests/audioSystem.test.ts` 6건 — Node no-op 안전, muted 억제, frequency가 tier/chain에 비례 증가, null tier 처리, 모든 cue 타입 무예외.
- [x] **Task 2.7: 배율 카드 확장 (`IScoreModifier` 를 지속 시간 기반으로 관리하는 `ModifierStack`)**
  - 실제 구현: `src/core/score/ModifierStack.ts` — 남은 머지 수·시간 기반 지속 관리. `push(id, multiplier, remainingMerges, remainingMs?)` 가 엔트리 생성, `apply(points, ctx)` 가 삽입 순서대로 배율 적용 후 머지 카운터 1 감소·만료 제거, `update(deltaMs)` 가 시간 만료 처리, `asModifier()` 가 `ScoreCalculator` 에 주입할 단일 `IScoreModifier` 반환, `pushModifier()` 로 제네릭 modifier 확장 가능, `clear()`·`activeCount`·`detach` 지원.
  - `Game` 리팩터: `ModifierStack` 소유, 생성자에서 `asModifier()` 를 `ScoreCalculator` 에 주입, `resetRun()` 에서 `clear()`, `update()` 에서 `modifierStack.update(gameDelta)`, `pushTemporaryMultiplier()` 가 `modifierStack.push()` 로 위임 — 기존 클로저 기반 임시 수정자를 스택으로 교체.
  - `ARCHITECTURE.md` 확장 포인트 표 갱신: 점수 수정자·세이브·사운드·파티클·특수공 기본 구현을 실제 파일명으로 업데이트.
  - 테스트 추가: `tests/modifierStack.test.ts` 9건 — 단일 배율, 남은 횟수 소진 만료, 다중 스택 곱, detach 조기 제거, clear, 시간 만료 update, asModifier 위임, invalid 인자 예외, Game-like 통합 흐름.
- [x] **Task 2.8: 모바일 터치 QA 및 캔버스 리사이즈 회귀 테스트(jsdom 환경 도입 여부 결정)**
  - 모바일 입력 시뮬레이션: `PointerInput` 이 활성 pointer ID 를 추적해 멀티터치의 다른 손가락 입력을 무시하고, `pointercancel` 후 드롭하지 않으며 다음 터치를 받을 수 있게 보강. `touch-action: none` 을 유지한다.
  - 회귀 테스트 추가: `tests/pointerInput.test.ts` 에 터치 드래그→선택/드롭, 포인터 격리, 취소/재시작, 호버 조준 4건; `tests/canvasRenderer.test.ts` 에 DPR 변경·세로형 레터박스·리사이즈 후 보드 좌표 및 초기 0 크기 bounds 2건.
  - jsdom 미도입 결정: 테스트 환경은 계속 Node 로 유지. PointerEvent/EventTarget 과 Canvas bounds/context 의 작은 스텁으로 필요한 브라우저 경계 동작을 고정해 새 의존성을 피한다. 실제 기기별 수동 QA 는 이 세션에서 수행하지 않음.
- [x] **Task 2.9: `MergeCardContext` 에 위험선 이동 필드 추가 후 `raise_danger_line` 카드를 실동작으로 연결**
  - `MergeCardContext.shiftDangerLine(deltaY)` 추가(양수 = 화면 아래 방향), `Game` 에서 `OverflowDetector` 로 위임. detector 의 위험선은 보드 범위로 제한하고 런 reset 시 생성 당시 기준선으로 복원한다.
  - `raise_danger_line` 은 설정값 기준 −50점 + 위험선 아래로 30 보드 단위 이동 + 다음 머지 ×4 1회로 작동한다. 설명과 수치는 `MERGE_CARDS`, 규칙은 `docs/GDD.md` 에 기록.
  - 테스트 보강: 카드 컨텍스트 효과와 실제 Game 선택 통합, `OverflowDetector` 위험선 이동에 따른 판정/보드 경계/초기화 검증. `docs/ARCHITECTURE.md` 확장 포인트 갱신.
- [x] **Task 2.10: 최대 티어 소멸(`resultTier === null`, 10,000점 보너스)에도 카드 선택창 열기**
  - `CardSlowMotionSelector` 는 일반 머지의 `minResultTier` 기준을 유지하면서 `resultTier === null` 인 최대 티어 소멸은 항상 발동하도록 판정한다.
  - 테스트 보강: 최대 티어 이벤트가 3장/리스크 1장 패를 열고 `+10000 PTS` 카드를 포함하며, 타임아웃도 제시된 비-리스크 카드 중 고르는지 확인. `docs/GDD.md` 와 아키텍처 표의 트리거 설명 갱신.
- [x] **Task 2.11: 카드 선택 키보드 지원(1/2/3 키)**
  - `PointerInput` 이 상단 숫자열과 숫자패드의 1/2/3 키를 0/1/2 카드 인덱스로 전달한다. 실제 카드 선택에 성공했을 때만 기본 동작을 막고, Ctrl/Alt/Meta/Shift 조합 단축키는 가로채지 않는다.
  - `createApp.ts` 의 공통 `choosePendingCard` 가 마우스/터치와 키보드 선택을 모두 `game.chooseCard` 로 연결하고, 성공 시 카드 선택 효과음을 낸다.
  - 테스트 추가: `tests/pointerInput.test.ts` 3건 — 숫자열/숫자패드 인덱스 매핑, 선택 실패 시 기본 동작 유지, 수정키 단축키 비간섭.
- [x] **Task 2.12: 라운드 HUD 표시(라운드 번호 · 목표 진행도 · 남은 드롭)**
  - `src/core/interfaces/IRoundSystem.ts` 에 `RoundHudState`(index/targetScore/scoreProgress/dropsUsed/dropBudget)와 선택 필드 `getHudState?()` 추가(인터페이스 확장 규칙 준수). `BasicRoundSystem` 이 실구현(진행도는 라운드 시작점 델타, 0 하한 클램프), `RoundRunner.getHudState()` 가 위임하며 HUD 미지원 구 시스템에는 `null` 반환.
  - `GameSnapshot` 에 선택 필드 `round?: RoundHudState` 추가 — `Game` 은 손대지 않고 `createApp.ts` 렌더 단계에서 `{ ...game.getSnapshot(), round }` 로 합성해 코어가 라운드 구조를 모르게 유지(경계 준수).
  - `HudRenderer.drawHud` 가 `round` 존재 시 좌측 컬럼 BEST 아래에 `ROUND n · m DROPS` + `진행도 / 목표` 2행을 텍스트로 표시(위험선 y=120과 4px 이상 간격). `docs/GDD.md` 4절과 `docs/ARCHITECTURE.md` 라운드 행 갱신.
  - 테스트 추가: `tests/roundHud.test.ts` 9건 — 상태 조회(초기/추적/어드밴스/음수 클램프), Runner 위임·구버전 null, 그리기 3건(표시·드롭 0 클램프·미표시 시 기존 HUD 유지).
- [x] **Task 2.13: 라운드 클리어 보상을 자동 지급 대신 카드 선택지로**
  - `Game.openRewardChoice(cards)` 추가 — 머지 선택과 같은 `slowmo_select`·오버레이·포인터/1-2-3 입력·400ms(`SLOW_MOTION`) 타임아웃을 재사용하는 합성 머지 기반 선택창. 바쁘거나(`mergeMoment` 불가) 빈 패면 `false`.
  - `ISlowMotionSelector` 에 선택 필드 `offerCards?(merge, cards)` 추가, `CardSlowMotionSelector` 가 제시 패를 기억해 타임아웃이 화면에 보인 비-리스크 카드를 고르게 했다(라운드 패는 전부 reward라 선두 `+N점` 확정).
  - `createRoundClearChoice(round)` 신설 — `+N점` + `SCORE ×2` 2회 + `SCORE ×3` 1회(기존 팩토리 재사용). `RoundRunner` 생성자가 `rewardFor` 단일 카드에서 `choiceFor` 패로 바뀌고, 클리어 시 선택 오픈+즉시 어드밴스(고른 보상은 새 라운드 소득), 선택 중 추가 지급은 `choosing` 가드로 대기 후 `time:slowMotionEnd` 재확인, 보드 busy 시 선두 카드 즉시 지급 폴백, 빈 패면 무보상 어드밴스.
  - `docs/GDD.md` 4절(선택 규칙·새 라운드 합산·폴백)과 `docs/ARCHITECTURE.md` 슬로우모션/라운드 행 갱신.
  - 테스트: `tests/roundRunner.test.ts` 전면 개편(선택 오픈·busy 폴백·예산 스킵·선택 중 대기 후 지급·빈 패·리셋·dispose·실Game 전체 루프) + `createRoundClearChoice` 1건, `tests/roundClearChoice.test.ts` 6건(Game 오픈/재개/거부 3건, 셀렉터 offerCards 3건). `roundHud.test.ts` fake Game 도 새 인터페이스에 맞춤.
- [x] **Task 2.14: 폭탄 폭발 득점 보상 설계**
  - 규칙(GDD 2.2와 함께 결정): 폭발 점수 = `round(제거된 공 티어 값 합 × SPECIAL_BALLS.blastScoreRatio(=0.5))`, 폭탄 자신 포함·연쇄/카드 배율 없는 flat 지급. `score:changed`를 거쳐 라운드 목표에도 합산된다.
  - 순수 함수 `blastScore(victims, ratio)`를 `BombBallBehavior.ts`에 추가(비율 음수/NaN은 `RangeError`). `Game.detonate`가 제거 후 점수부터 적용하고(`score:changed`), `ball:detonated`에 `scoreGained` 필드(페이로드 확장)를 담아 발화 — 머지와 같은 발화 순서(점수→이벤트).
  - `docs/GDD.md` 2.2절(폭발 점수 규칙)과 `docs/ARCHITECTURE.md` 특수공 행(`blastScore`, `scoreGained`, Task 2.14 완료) 갱신.
  - 테스트: `tests/specialBalls.test.ts` 5건 — `blastScore` 순수 로직 4건(비율·반올림·0·예외)과 실Game 통합 1건(2폭탄 폭발의 정확한 점수·이벤트·`score:changed` 일치).

### Infra

- [x] **Task infra.pages: GitHub Pages 배포 워크플로 추가**
  - `.github/workflows/pages.yml` 추가: main push + workflow_dispatch 트리거, permissions(contents: read, pages: write, id-token: write), concurrency group "pages"(cancel-in-progress: false)
  - 단계: checkout → setup-node(Node 20, npm cache) → npm ci (실패 시 --legacy-peer-deps 우회) → npm run build → configure-pages → upload-pages-artifact(dist/) → deploy-pages(github-pages environment)
  - ci.yml 과 역할 분리: ci.yml 은 PR 검증(Lint/Typecheck/Test), pages.yml 은 빌드+배포 전용
  - vite.config.ts base: './' 설정으로 /merge-roguelite/ 하위 경로 배포 호환 확인

### 신규 보충 — v0.3.0 마무리 및 런 피드백 (Task 2.15~2.34)

공통: 아래 수치와 UI 문구는 제안이다. 구현 시 수치는 `src/config/gameConfig.ts`에 모으고, 인터페이스 확장은 `docs/ARCHITECTURE.md`, 규칙 변경은 `docs/GDD.md`, 미구현 항목 완료는 `CONTEXT.md`에 함께 반영한다. 기존 메서드 시그니처는 유지하고 선택 필드·새 구현·얇은 조립 연결만 추가한다. 각 태스크의 완료 기준에 더해 lint/typecheck/전체 테스트 통과가 필수다.

- [ ] **Task 2.15: 앱 렌더 단계의 라운드 HUD 연결 복구**
  - 기존 수정: `src/app/createApp.ts`. 신규: `src/app/composeRoundSnapshot.ts`, `tests/composeRoundSnapshot.test.ts`.
  - 확장 방식: 기존 `IRoundSystem.getHudState` → `RoundRunner.getHudState()` 결과를 `GameSnapshot.round`에 합성하는 작은 순수 헬퍼를 추가하고 실제 렌더 콜백에서 사용한다. Task 2.12의 HUD/라운드 구현을 다시 만들지 않는다.
  - 완료 기준: 라운드 상태가 있으면 스냅샷에 포함되고 null이면 필드가 생략되며 원본은 불변인 테스트 통과. 화면에서 ROUND/목표/남은 드롭이 표시된다. 범위는 누락된 연결만, 10분.

- [ ] **Task 2.16: 큰 공 스폰 페널티 상태와 카드 컨텍스트 계약 추가**
  - 신규: `src/core/ball/SpawnTierPenalty.ts`, `tests/spawnTierPenalty.test.ts`. 기존 수정: `src/core/interfaces/IMergeCard.ts`.
  - 확장 방식: `MergeCardContext`에 선택 콜백 `raiseSpawnTierFloor?(minTier, count)` 추가. 순수 상태 객체는 하한/남은 발급 수를 보관하고 `apply(tier)`마다 1회 소비한다. 중첩은 하한과 잔여 횟수 각각의 최댓값, reset은 전부 해제. Game 연결은 다음 태스크.
  - 완료 기준: 하한 적용·정확히 N회 뒤 만료·중첩·reset·유효하지 않은 티어/횟수 거부 테스트 통과. 스폰 가능한 티어 범위만 허용한다. 10분.

- [ ] **Task 2.17: 스폰 페널티를 Game의 신규 공 발급에 연결**
  - 선행: Task 2.16. 기존 수정: `src/core/Game.ts`. 신규: `tests/gameSpawnPenalty.test.ts`.
  - 확장 방식: Game이 상태 객체를 소유하고 카드 컨텍스트 콜백을 구현한다. 선택 당시 이미 보이는 held/NEXT는 변경하지 않고 이후 신규 발급 때만 하한을 적용한다. 폭탄 여부 난수와 발급 순서는 유지하고 재시작 시 reset한다.
  - 완료 기준: 테스트 카드 적용 후 기존 NEXT 유지, 다음 N회 신규 발급 하한 보장, 이후 정상 복귀, 재시작 해제 통합 테스트 통과. UI/덱 변경은 제외, 10분.

- [ ] **Task 2.18: 큰 공 스폰 리스크 카드 추가**
  - 선행: Task 2.17. 신규: `src/systems/cards/SpawnLargerBallsCard.ts`, `tests/spawnLargerBallsCard.test.ts`. 기존 수정: `src/systems/cards/BasicMergeCardProvider.ts`, `src/config/gameConfig.ts`, `tests/basicMergeCardProvider.test.ts`.
  - 확장 방식: `RiskCard` 구현으로 다음 신규 발급 3회 티어 하한 3의 대가와 다음 머지 ×4 1회 보상을 제안한다. 컨텍스트 기능이 없으면 페널티 없는 보상을 주지 않고 적용을 거부한다. 기존 provider의 리스크 풀에 1장만 추가한다.
  - 완료 기준: 페널티/보상 콜백 인자, 미지원 컨텍스트 거부, 시드 결정성, 3장 중 리스크 정확히 1장 계약 테스트 통과. 설명에 하한/횟수/보상을 명시한다. 10분.

- [ ] **Task 2.19: 스폰 압박의 남은 발급 수 HUD 표시**
  - 선행: Task 2.18. 신규: `src/render/SpawnPenaltyHudRenderer.ts`, `tests/spawnPenaltyHud.test.ts`. 기존 수정: `src/core/Game.ts`, `src/render/CanvasRenderer.ts`, `src/config/gameConfig.ts`.
  - 확장 방식: 카드 컨텍스트로 생성한 페널티를 읽기 전용 `GameSnapshot.spawnPenalty?`로 노출하고 작은 렌더러가 하한 값과 남은 신규 발급 수를 표시한다. 게임 상태를 렌더러에서 수정하지 않는다.
  - 완료 기준: 활성 시 숫자/횟수 표시, 만료·재시작 시 숨김을 스냅샷/Canvas 스텁 테스트로 확인. 기존 ROUND/NEXT와 겹치지 않는 배치. 10분.

- [ ] **Task 2.20: 활성 점수 수정자의 읽기 전용 스냅샷 추가**
  - 기존 수정: `src/core/interfaces/IScoreModifier.ts`, `src/core/score/ModifierStack.ts`, `src/core/Game.ts`, `tests/modifierStack.test.ts`. 신규: `tests/modifierSnapshot.test.ts`.
  - 확장 방식: `IScoreModifier` 지원 HUD 데이터 타입을 추가하고 스택 항목을 복사한 `GameSnapshot.activeModifiers?`를 노출한다. 범용 수정자의 NaN 배율/무제한 횟수는 표시용 null로 정규화한다. 기존 점수 계산은 그대로 유지한다.
  - 완료 기준: ID·배율·남은 머지/시간 조회, 만료 제거, reset, 스냅샷 수정이 내부 상태에 영향 없는 테스트 통과. 표시 구현은 제외, 10분.

- [ ] **Task 2.21: 누적 카드 배율과 남은 효과 HUD 표시**
  - 선행: Task 2.20. 신규: `src/render/ModifierHudRenderer.ts`, `tests/modifierHud.test.ts`. 기존 수정: `src/render/CanvasRenderer.ts`, `src/config/gameConfig.ts`.
  - 확장 방식: `IScoreModifier`의 읽기 전용 표시 데이터를 소비해 최대 2개 효과와 초과 개수를 표시한다. 횟수형은 남은 머지, 시간형은 남은 초를 구분하고 범용 수정자는 배율 대신 ID를 쓴다.
  - 완료 기준: 빈 상태 무표시, 배율/횟수/초 표시, 3개 이상 요약, NaN/무한값 미노출 Canvas 스텁 테스트 통과. 스폰 압박 HUD와 다른 영역 사용. 10분.

- [ ] **Task 2.22: 시간 제한 배율의 카드 컨텍스트 연결**
  - 기존 수정: `src/core/interfaces/IMergeCard.ts`, `src/core/Game.ts`. 신규: `tests/timedMultiplierContext.test.ts`.
  - 확장 방식: 기존 `pushScoreMultiplier`를 변경하지 않고 선택 콜백 `pushTimedScoreMultiplier?(multiplier, durationMs)` 추가. 기존 `ModifierStack.pushModifier`와 `IScoreModifier` 구현을 사용해 머지 횟수 제한 없이 게임시간으로 만료시킨다.
  - 완료 기준: 지정 시간 이내 여러 머지에 적용, 게임시간 만료 후 해제, 슬로우모션 중 실시간보다 느린 감소, 재시작 해제 테스트 통과. 스택 재구현 없이 연결만, 10분.

- [ ] **Task 2.23: 시간 제한 배율 보상 카드 1종 추가**
  - 선행: Task 2.22. 신규: `src/systems/cards/TimedMultiplierCard.ts`, `tests/timedMultiplierCard.test.ts`. 기존 수정: `src/systems/cards/BasicMergeCardProvider.ts`, `src/config/gameConfig.ts`, `tests/basicMergeCardProvider.test.ts`.
  - 확장 방식: `MergeCard` 구현으로 게임시간 5초간 ×2 카드를 보상 풀에 추가한다. 콜백 미지원이면 적용을 거부하고, 카드 설명에 게임시간 기준임을 명시한다.
  - 완료 기준: 컨텍스트 호출 인자·미지원 거부·고유 ID·확장된 덱의 리스크 수/중복 없음 테스트 통과. 라운드 보상 풀은 변경하지 않는다. 10분.

- [ ] **Task 2.24: 카드 선택 결과 이벤트 추가**
  - 기존 수정: `src/core/events/GameEvents.ts`, `src/core/Game.ts`. 신규: `tests/cardChosenEvent.test.ts`.
  - 확장 방식: 이벤트 계약에 `card:chosen`(cardId, kind, source: manual/timeout)을 추가한다. `ISlowMotionSelector`의 기존 선택 흐름에서 실제 적용 성공당 한 번 발화하고 공개 `chooseCard` 시그니처는 유지한다. 즉시 보상 폴백은 선택으로 세지 않는다.
  - 완료 기준: 수동/타임아웃 각각 1회, 거부/중복 클릭/타임아웃 null/직접 보상 적용 시 0회 테스트 통과. 통계 및 연출은 구독자에서 구현한다. 10분.

- [ ] **Task 2.25: 런별 리스크 선택과 최대 연쇄 통계 수집**
  - 선행: Task 2.24. 신규: `src/systems/RunStatsTracker.ts`, `tests/runStatsTracker.test.ts`.
  - 확장 방식: 기존 `GameEventMap`/`EventBus` 계약의 구독자로 리스크 선택 수·전체 선택 수·최대 chainIndex·폭탄 폭발 수를 모은다. 읽기 전용 복사본 조회, `run:started` 초기화, `run:over` 집계 동결, dispose 구독 해제를 제공한다.
  - 완료 기준: 이벤트별 카운트, 타임아웃 선택 포함, 런 종료 후 불변, 다음 런 초기화, dispose 후 무반응 테스트 통과. UI/저장은 제외, 10분.

- [ ] **Task 2.26: 런 종료 화면에 선택 통계 표시**
  - 선행: Task 2.25. 신규: `src/render/RunStatsRenderer.ts`, `tests/runStatsRenderer.test.ts`. 기존 수정: `src/core/Game.ts`(스냅샷 타입만), `src/app/createApp.ts`, `src/render/CanvasRenderer.ts`, `src/config/gameConfig.ts`.
  - 확장 방식: 이벤트 구독 통계를 app에서 `GameSnapshot.runStats?`로 합성하고 종료 화면에 리스크 선택 수·최대 연쇄·폭발 수를 표시한다. tracker의 생성/해제만 app에 추가한다.
  - 완료 기준: game_over에만 통계 표시, 필드 없는 스냅샷은 기존 화면 유지, 재시작 안내와 겹치지 않는 Canvas 스텁 테스트 통과. 10분.

- [ ] **Task 2.27: 세이브에 최고 도달 라운드 필드 추가**
  - 기존 수정: `src/core/interfaces/ISaveSystem.ts`, `src/systems/LocalStorageSaveSystem.ts`, `src/config/gameConfig.ts`, `tests/saveSystem.test.ts`.
  - 확장 방식: `SaveData`에 선택 필드 `highestRound?` 추가. 기존 메서드 계약 유지, 저장 버전 승격과 구버전 기본값 0 마이그레이션으로 런 성장 기록을 준비한다.
  - 완료 기준: 구버전의 점수/런 수/시드 보존, 새 필드 round-trip, 음수·소수·비유한 값 정규화, clear/메모리 폴백 테스트 통과. 앱 연결 제외, 10분.

- [ ] **Task 2.28: 런 종료 시 최고 도달 라운드 저장 연결**
  - 선행: Task 2.27. 신규: `src/systems/save/withHighestRound.ts`, `tests/highestRoundSave.test.ts`. 기존 수정: `src/app/createApp.ts`.
  - 확장 방식: `ISaveSystem` 데이터와 `IRoundSystem.currentRound()`를 받아 최고 라운드를 갱신하는 순수 헬퍼를 만들고 기존 `run:over` 저장에 연결한다. 도달 기준이므로 클리어/예산 소진 여부와 무관하게 현재 라운드를 기록한다.
  - 완료 기준: 낮은 런으로 기존 기록이 줄지 않음, 높은 런 갱신, bestScore/totalRuns/lastSeed 보존 테스트 통과. 중복 저장 구독자를 만들지 않는다. 10분.

- [ ] **Task 2.29: severity 기반 근접 실패 심박 스케줄러 추가**
  - 신규: `src/systems/NearMissHeartbeat.ts`, `tests/nearMissHeartbeat.test.ts`. 기존 수정: `src/core/interfaces/IAudioSystem.ts`, `src/systems/WebAudioSystem.ts`, `src/config/gameConfig.ts`.
  - 확장 방식: `IAudioSystem`의 SoundCue에 단발 `near_miss_beat`를 추가하고 별도 스케줄러가 실시간 update와 severity로 박동 간격을 조절한다. 기존 시각 심박 상수를 재사용하며 정지/리셋을 제공한다. 기존 근접 실패의 지속음은 다음 태스크에서만 교체한다.
  - 완료 기준: severity가 높을수록 박동 간격 감소, 큰 delta에도 한 프레임 폭주 없음, stop 이후 무음, Node 오디오 no-op 테스트 통과. 10분.

- [ ] **Task 2.30: 근접 실패 이벤트를 심박 스케줄러에 연결**
  - 선행: Task 2.29. 신규: `src/systems/bindNearMissHeartbeat.ts`, `tests/nearMissHeartbeatBinding.test.ts`. 기존 수정: `src/app/createApp.ts`.
  - 확장 방식: `GameEventMap` enter/update/exit 구독으로 Task 2.29 스케줄러를 갱신하고 app 프레임에서 실시간 update를 호출한다. 기존 `near_miss_loop`의 app 재생/정지 연결만 대체하며 다른 효과음은 유지한다.
  - 완료 기준: enter 시작·update 강도 반영·exit/run:over/run:started 정지, dispose 해제 테스트 통과. 비네트와 함께 위험도에 따른 빠른 심박을 청각적으로 확인 가능. 10분.

- [ ] **Task 2.31: 카드 선택 잔여 시간을 스냅샷으로 노출**
  - 기존 수정: `src/core/Game.ts`. 신규: `tests/cardChoiceTimer.test.ts`.
  - 확장 방식: `ISlowMotionSelector`의 요청 durationMs와 실제 선택 타이머를 읽는 `GameSnapshot.cardChoiceTimer?`(durationMs, remainingMs)를 추가한다. 근접 실패용 TimeController 잔여 시간과 혼동하지 않는다.
  - 완료 기준: 머지/라운드 보상 양쪽에서 실시간 감소, 선택·타임아웃·게임오버·재시작 시 필드 해제, 근접 실패만 발생하면 미노출 테스트 통과. 400ms 규칙 자체는 변경하지 않는다. 10분.

- [ ] **Task 2.32: 카드 오버레이에 선택 카운트다운 바 표시**
  - 선행: Task 2.31. 신규: `src/render/CardChoiceTimerRenderer.ts`, `tests/cardChoiceTimerRenderer.test.ts`. 기존 수정: `src/render/CanvasRenderer.ts`, `src/config/gameConfig.ts`.
  - 확장 방식: 선택 타이머 스냅샷만 읽어 CHOOSE 헤더 아래에 남은 시간 비율 바를 그린다. 카드 히트 영역은 유지하고 타이머 필드가 없으면 그리지 않는다.
  - 완료 기준: 잔여 시간 100%/50%/0%의 바 길이, 0~1 클램프, slowmo_select 외 무표시 Canvas 스텁 테스트 통과. 10분.

- [ ] **Task 2.33: 카드 선택지에 키보드 번호 안내 표시**
  - 기존 수정: `src/render/CardOverlayRenderer.ts`, `src/config/gameConfig.ts`, `tests/cardOverlayLayout.test.ts`.
  - 확장 방식: 기존 `MergeCard` 선택 패의 인덱스를 읽어 첫 3장에 1/2/3 키 배지를 추가한다. Task 2.11의 입력 구현은 변경하지 않고 리스크 배지/설명과 다른 영역을 쓴다.
  - 완료 기준: 실제 표시 순서에 맞는 숫자, 2장/빈 패 처리, RISK 배지 유지, 히트 영역 불변 Canvas 스텁 테스트 통과. 색에만 의존하지 않는 선택 안내, 10분.

- [ ] **Task 2.34: 리스크 선택과 자동 선택의 효과음 피드백 구분**
  - 선행: Task 2.24. 신규: `src/systems/bindCardChoiceAudio.ts`, `tests/cardChoiceAudio.test.ts`. 기존 수정: `src/app/createApp.ts`, `src/config/gameConfig.ts`.
  - 확장 방식: `IAudioSystem`의 기존 card_pick cue를 `card:chosen` 구독자로 재생한다. 리스크는 낮은 pitch, 자동 선택은 낮은 volume으로 구분하고 app의 수동 입력 경로 직접 재생은 제거해 중복을 막는다.
  - 완료 기준: 수동 보상/리스크/타임아웃별 설정값과 성공당 정확히 1회 재생, dispose 후 무반응 테스트 통과. 새 오디오 엔진/의존성 없이 선택 결과 인지를 강화한다. 10분.
