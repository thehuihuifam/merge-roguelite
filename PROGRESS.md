# PROGRESS.md

## Current Status

Active Next Action: Task 1.1

- 버전: v0.1.0 (MVP 베이스라인)
- 마지막 갱신: Task 0.0 완료
- 규칙: 세션당 태스크 1개. 완료 시 체크박스와 위의 `Active Next Action` 을 함께 갱신한다. 번호는 재사용하지 않고 뒤에 추가만 한다.

## Task Backlog

### v0.1.0 — 베이스라인

- [x] **Task 0.0: 초기 MVP 베이스라인 구현 완료**
  - 코어 루프(공 생성 → 낙하 → 충돌/합체 → 점수 → 위험선 → 런 종료), 상태 머신, 시드 난수, 이벤트 버스, Canvas 렌더러, 포인터/키보드 입력
  - 확장 포인트 인터페이스 9종(`src/core/interfaces/`)과 no-op 기본 구현
  - Vitest 테스트 11개 파일, CI 워크플로, PR 템플릿, 문서 세트

### v0.2.0 — 차별화 메커니즘 1차

- [ ] **Task 1.1: 근접 실패 시 슬로우모션 진입 (INearMissEffect 구현체 1개)**
  - 파일 추가: `src/systems/SlowMotionNearMissEffect.ts` — `INearMissEffect` 구현. `onNearMissEnter` 에서 `TimeController.startSlowMotion(SLOW_MOTION.durationMs, SLOW_MOTION.timeScale)` 호출, `getIntensity()` 는 severity 를 그대로 반환.
  - 생성자에서 `TimeController` 를 주입받는다. `createApp.ts` 에서 `new Game({ nearMissEffect: new SlowMotionNearMissEffect(time) })` 형태로 연결하기 위해 `Game` 이 `deps.timeController` 를 받도록 `GameDependencies` 에 선택 필드 1개 추가(기존 기본값 유지).
  - 테스트 추가: `tests/slowMotionNearMissEffect.test.ts` — enter 시 timeScale 이 0.25 로 내려가고 exit 후 400ms 지나면 1 로 복귀.
  - 완료 기준: 위험선 근처에 공이 멈추면 게임이 느려지고 HUD 에 `SLOW ×0.25` 가 보인다. 10분 크기.

- [ ] **Task 1.2: 기본 머지 카드 덱과 IMergeCardProvider 구현**
  - 파일 추가: `src/systems/cards/BasicMergeCardProvider.ts` — `IMergeCardProvider` 구현. 보상 카드 3종(`+N점`: 합체 점수만큼 추가, `×2 배율 2회`: `pushScoreMultiplier(2, 2)`, `×3 배율 1회`: `pushScoreMultiplier(3, 1)`)과 리스크 카드 2종(`score_loss`: 현재 점수 10% 차감 후 `pushScoreMultiplier(4, 1)`, `raise_danger_line`: severity 0.5, 현재 v0.1.0 컨텍스트로는 위험선을 올릴 수 없으므로 apply 는 점수 −50 만 수행하고 위험선 상승은 Task 2.x 에서 `MergeCardContext` 필드 추가로 확장) 정의.
  - `draw(merge, count, riskCount)` 는 `SeededRandom` 을 주입받아 결정적으로 뽑고, 정확히 `riskCount` 장이 `RiskCard` 여야 한다.
  - 테스트 추가: `tests/basicMergeCardProvider.test.ts` — 3장 중 1장이 risk, 같은 시드는 같은 결과, apply 가 점수를 바꾼다.

- [ ] **Task 1.3: 슬로우모션 선택 셀렉터 구현 (ISlowMotionSelector 실구현)**
  - 파일 추가: `src/systems/CardSlowMotionSelector.ts` — `ISlowMotionSelector` 구현. `onMergeMoment` 에서 `resultTier >= 2` 인 머지에 대해 `IMergeCardProvider.draw(merge, SLOW_MOTION.cardCount, SLOW_MOTION.riskCardCount)` 결과와 `SLOW_MOTION` 파라미터로 `SlowMotionRequest` 를 반환. `onTimeout` 은 첫 번째 비-리스크 카드를 반환.
  - `createApp.ts` 에서 Task 1.2 의 provider 와 함께 `Game` 에 주입.
  - 테스트 추가: `tests/cardSlowMotionSelector.test.ts` — 조건 미달 머지는 null, 조건 충족 시 카드 3장/타임아웃 시 리스크 아닌 카드 선택. 기존 `tests/game.test.ts` 의 셀렉터 통합 테스트는 그대로 통과해야 한다.

- [ ] **Task 1.4: 카드 선택 UI 렌더링과 입력 연결**
  - 파일 추가: `src/render/CardOverlayRenderer.ts` — `snapshot.state === 'slowmo_select'` 일 때 `snapshot.pendingCards` 3장을 가로로 그린다(제목, 설명, 리스크 카드는 붉은 테두리 + `RISK` 배지). 카드 사각형 좌표 계산 함수를 export 하여 입력 판정에 재사용.
  - `src/input/PointerInput.ts` 의 핸들러에 `onSelect(clientX, clientY)` 를 추가(기존 핸들러는 유지)하고, `createApp.ts` 에서 `slowmo_select` 상태일 때 좌표 → 카드 인덱스 → `game.chooseCard(card)` 로 연결. `CanvasRenderer.toBoardY` 추가.
  - 테스트 추가: `tests/cardOverlayLayout.test.ts` — 카드 사각형 좌표가 보드 안에 있고 서로 겹치지 않는다.

### 이후 (v0.3.0+, 순서 미정 — 각각 착수 시 세부 스펙을 먼저 태스크로 쪼갠다)

- [ ] Task 2.1: `INearMissEffect` 붉은 화면 + 심박 펄스 연출 강화 (`src/render/` 비네트 애니메이션)
- [ ] Task 2.2: `IRoundSystem` 기본 구현 (라운드별 목표 점수, 클리어 시 카드 보상)
- [ ] Task 2.3: `ISpecialBall` 폭탄 공 (인접 공 제거) 구현과 스폰 확률 설정
- [ ] Task 2.4: `ISaveSystem` localStorage 구현 (베스트 점수, 총 런 수)
- [ ] Task 2.5: `IParticleSystem` 머지 파티클 버스트
- [ ] Task 2.6: `IAudioSystem` WebAudio 기반 효과음 (merge 피치는 티어에 비례)
- [ ] Task 2.7: 배율 카드 확장 (`IScoreModifier` 를 지속 시간 기반으로 관리하는 `ModifierStack`)
- [ ] Task 2.8: 모바일 터치 QA 및 캔버스 리사이즈 회귀 테스트(jsdom 환경 도입 여부 결정)
