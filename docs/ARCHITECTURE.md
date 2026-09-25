# Architecture

## 1. 폴더 구조와 모듈 경계

```
src/
  config/      튜닝 상수. 어느 계층에서든 import 가능.
  core/        순수 도메인 로직. 의존: config 만. DOM · Canvas · matter-js 금지.
    interfaces/  확장 포인트 계약. 구현체는 systems/ 에 둔다.
  physics/     matter-js 어댑터. 의존: config, core/types, core/ball(티어 반지름). core 로 역의존 금지.
  render/      Canvas 2D. 의존: config, core(타입과 GameSnapshot 만). 게임 상태를 바꾸지 않는다.
  input/       DOM 이벤트 → 의도(aim/drop/restart/nudge). 게임을 직접 모른다(콜백만).
  systems/     확장 포인트 인터페이스의 구현체. 의존: core/interfaces, core/time 등.
  app/         조립과 프레임 루프. 유일하게 모든 계층을 import 하는 곳.
tests/         Vitest. Node 환경에서 core/physics 를 헤드리스로 검증.
```

**허용 의존 방향:** `app → {input, render, physics, systems, core, config}`, `render → core(types/snapshot), config`, `physics → core(types), config`, `systems → core, config`, `core → config`. 역방향 import 는 리뷰에서 반려한다.

**`Game` 은 `PhysicsWorld` 를 알지만** (core → physics 로 보이지만) `PhysicsWorld` 는 matter-js 를 완전히 감싸므로 core 는 여전히 matter-js 를 모른다. 물리 엔진을 바꾸려면 `src/physics/` 만 교체한다. 이 예외는 `docs/DECISIONS.md` 에 기록되어 있다.

## 2. 데이터 흐름: 입력 → 물리 → 합체 → 점수 → 렌더

```
PointerInput ──aim(x)/drop()──▶ Game
                                 │  update(realDeltaMs)  (GameLoop 가 16.67ms 고정 스텝으로 호출)
                                 ▼
                     TimeController.advance ──▶ gameDeltaMs (슬로우모션이면 ×0.25)
                                 │
                                 ▼
                     PhysicsWorld.step(gameDeltaMs)      matter-js Engine.update
                     PhysicsWorld.sync(balls)            body → Ball.position/velocity
                     PhysicsWorld.drainCollisions()      CollisionPair[] (같은 스텝의 충돌, 정렬·중복 제거)
                                 │
                                 ▼
                     MergeResolver.resolve(pairs, lookup) ──▶ MergePlan[]  (공 1개 = 패스당 1회)
                                 │  for each plan
                                 ▼
                     Game.applyMerge:
                        registry/physics 에서 두 공 제거
                        ScoreCalculator.calculate({resultTier, chainIndex}) ──▶ IScoreModifier 체인
                        ScoreState.add
                        결과 공 생성 (평균 속도 상속) → registry/physics 추가
                        events.emit('merge:resolved')
                        ISlowMotionSelector.onMergeMoment ──▶ (요청 시) slowmo_select 진입
                                 │
                                 ▼
                     OverflowDetector.update(balls, gameDeltaMs)
                        nearMiss → INearMissEffect 훅 + danger:* 이벤트
                        overflow → fsm 'overflow' → game_over, run:over 이벤트
                                 │
                                 ▼
                     dropping 쿨다운 소진 → fsm 'settle' → aiming
                                 │
                                 ▼
             GameLoop.render ──▶ Game.getSnapshot() ──▶ CanvasRenderer.render(snapshot)
                                    (state === 'slowmo_select' 이면 카드 오버레이를 합성하고,
                                     pointerup 은 cardIndexAt 히트 테스트로 chooseCard 에 연결)
```

렌더러는 `GameSnapshot` 만 읽는다. 스냅샷은 매 프레임 새로 만들어지며 `balls` 는 레지스트리 복사본이다(렌더러가 위치를 바꿀 수 없다).

## 3. 확장 포인트 목록

| 확장 포인트             | 인터페이스 파일                                                                                         | 기본 구현 (v0.1.0)                                                                                                                  | 주입 위치                                                                                 | 예정 태스크             |
| ----------------------- | ------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ----------------------- |
| 머지 카드 / 리스크 카드 | `src/core/interfaces/IMergeCard.ts` (`MergeCard`, `RiskCard`, `IMergeCardProvider`, `MergeCardContext`) | `src/systems/cards/BasicMergeCardProvider.ts` (보상 3종 + 리스크 2종, 시드 결정적 드로)                                             | `createApp.ts` 에서 `CardSlowMotionSelector` 에 주입                                      | Task 1.4                |
| 슬로우모션 선택         | `src/core/interfaces/ISlowMotionSelector.ts`                                                            | `src/systems/CardSlowMotionSelector.ts` (티어 2 이상 머지에서만 발동, 선택 창 종료 시 패 폐기)                                      | `new Game({ slowMotionSelector })`                                                        | Task 1.4                |
| 근접 실패 연출          | `src/core/interfaces/INearMissEffect.ts`                                                                | `src/systems/SlowMotionNearMissEffect.ts`(슬로우모션) + `src/render/NearMissVignetteRenderer.ts`(페이드·심박 펄스 비네트, Task 2.1) | `new Game({ nearMissEffect })`                                                            | Task 2.6 (심박음)       |
| 점수 수정자 (배율 카드) | `src/core/interfaces/IScoreModifier.ts`                                                                 | `src/core/score/ModifierStack.ts` — 남은 머지 수·시간 기반 지속 관리, `asModifier()` 를 `ScoreCalculator` 에 주입                   | `Game` 내부에서 `ModifierStack` 소유, `push()` 로 카드 배율 추가, `update()` 로 시간 만료 | Task 2.7 완료           |
| 특수 공                 | `src/core/interfaces/ISpecialBall.ts`                                                                   | `src/systems/special/BombBallBehavior.ts` + `SpecialBallRegistry`                                                                   | `Game` 의 specialBalls, `createApp` 에서 등록                                             | Task 2.3 완료           |
| 라운드                  | `src/core/interfaces/IRoundSystem.ts` (`isDropBudgetExhausted` 필드 추가, Task 2.2)                     | `src/systems/BasicRoundSystem.ts` + `src/systems/RoundRunner.ts`(이벤트 구독·보상 지급)                                             | `createApp.ts` 에서 `RoundRunner` 가 `EventBus` 구독 + `game.applyRewardCard`             | Task 2.13 (보상 선택지) |
| 세이브                  | `src/core/interfaces/ISaveSystem.ts`                                                                    | `src/systems/LocalStorageSaveSystem.ts` — localStorage + 메모리 폴백, SAVE 키/버전 관리                                             | `createApp.ts` 에서 `initialBest` 주입 + `run:started`/`run:over` 구독                    | Task 2.4 완료           |
| 사운드                  | `src/core/interfaces/IAudioSystem.ts`                                                                   | `src/systems/WebAudioSystem.ts` — WebAudio oscillator, 티어 비례 피치(`frequencyForMergeTier`), loop map                            | `createApp.ts` 에서 `EventBus` 구독 + `onSelect` 직접 호출                                | Task 2.6 완료           |
| 파티클                  | `src/core/interfaces/IParticleSystem.ts`                                                                | `src/systems/BasicParticleSystem.ts` — kind별 개수·속도·수명, 중력·드래그, maxAlive cap                                             | `createApp.ts` 에서 `EventBus` 구독 + `CanvasRenderer` 에서 `render(ctx)`                 | Task 2.5 완료           |
| 위험선 규칙             | `src/core/danger/OverflowDetector.ts` (옵션 객체 + `shiftDangerLine`)                                   | 이동 가능한 lineY, 보드 범위 클램프, 런 reset 시 초기값 복원                                                                        | `Game` 의 `MergeCardContext.shiftDangerLine` 가 detector 에 위임                          | Task 2.9 완료           |
| 이벤트                  | `src/core/events/GameEvents.ts`                                                                         | —                                                                                                                                   | `game.events.on(...)`                                                                     | 모든 juice 시스템       |

**확장 규칙:** 새 기능 = 인터페이스 구현 파일 추가(`src/systems/...`) + `createApp.ts` 에서 주입 + 테스트. 인터페이스 변경은 필드 **추가** 만 허용.

## 4. 상태 머신

파일: `src/core/state/GameState.ts` (전이 테이블), `src/core/state/GameStateMachine.ts` (실행기).

```
                 start                drop                 settle
   ┌──────┐ ─────────▶ ┌────────┐ ─────────▶ ┌──────────┐ ─────────▶ (aiming)
   │ idle │            │ aiming │            │ dropping │
   └──────┘            └────────┘ ◀───────── └──────────┘
                          │  ▲   resumeAiming    │  ▲
              mergeMoment │  │                   │  │ resumeDropping
                          ▼  │      mergeMoment  ▼  │
                       ┌───────────────────────────────┐
                       │         slowmo_select         │
                       └───────────────────────────────┘

   aiming | dropping | slowmo_select ──overflow──▶ ┌───────────┐ ──restart──▶ aiming
                                                   │ game_over │
                                                   └───────────┘
```

| 상태            | 의미                                                       | 허용 이벤트                                  |
| --------------- | ---------------------------------------------------------- | -------------------------------------------- |
| `idle`          | 부팅 직후. 아무 런도 없음                                  | `start`                                      |
| `aiming`        | 공을 들고 조준 중. `drop()` 가능                           | `drop`, `mergeMoment`, `overflow`            |
| `dropping`      | 드롭 직후 쿨다운(550ms). 드롭 불가                         | `settle`, `mergeMoment`, `overflow`          |
| `slowmo_select` | 슬로우모션 + 카드 선택 대기. 드롭 불가, 물리는 느리게 진행 | `resumeAiming`, `resumeDropping`, `overflow` |
| `game_over`     | 런 종료 오버레이                                           | `restart`                                    |

`Game` 은 `slowmo_select` 진입 시 직전 상태를 기억해 `resumeAiming`/`resumeDropping` 중 하나로 복귀한다. 잘못된 전이는 `InvalidTransitionError` 를 던지며, 방어적으로 `trySend`/`can` 을 쓴다.

## 5. 결정성

- 모든 난수는 `SeededRandom`(mulberry32) 을 통한다. `Game.start(seed)` 가 시드다.
- 물리 스텝은 항상 `PHYSICS_STEP_MS`(16.67ms) 고정. `GameLoop` 가 누산기로 보정한다.
- 충돌 쌍은 id 로 정렬되고 중복 제거되어 `MergeResolver` 에 들어가므로 같은 입력 → 같은 합체 순서.
- `tests/game.test.ts` 의 결정성 테스트가 이를 고정한다.
