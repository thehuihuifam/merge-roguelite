# Game Design Document — Merge Roguelite

이 문서는 게임의 "무엇" 과 "왜" 를 정의한다. "어떻게" 는 `docs/ARCHITECTURE.md`. 수치는 `src/config/gameConfig.ts` 가 단일 진실이며, 이 문서의 숫자는 그 값을 설명하기 위해 인용한 것이다.

---

## 1. 코어 루프

### 1.1 5초 루프 — 한 번의 드롭

플레이어는 보드 상단(y = 60)에 떠 있는 "들고 있는 공" 을 좌우로 조준하고(포인터 이동 / 방향키), 놓는다(포인터 업 / Space). 공은 Matter.js 중력으로 떨어져 바닥이나 다른 공 위에 안착한다. 떨어지는 동안 같은 숫자 공과 닿으면 즉시 합체하여 한 티어 큰 공이 되고 점수가 오른다. 합체로 생긴 공이 또 같은 숫자와 닿으면 연쇄가 이어지고, 연쇄 순번(`chainIndex`)마다 배율이 0.5씩 오른다. 드롭 후 550ms 의 쿨다운이 지나면 다음 공을 들 수 있다. 이 5초 안에 플레이어가 느껴야 하는 것은 "떨어뜨렸다 → 굴렀다 → 터졌다(혹은 안 터졌다)" 의 짧은 기대와 해소다.

### 1.2 1분 루프 — 보드 관리

1분이면 10~15회 드롭이 쌓인다. 보드 폭 480 에 반지름 16~111 의 공이 뒤섞이면서 "작은 공을 어디에 묻을지, 큰 공을 어느 쪽 벽에 몰지" 가 결정의 핵심이 된다. 이 구간에서 슬로우모션 선택(2.3)과 리스크 카드가 개입한다. 큰 합체가 터질 때마다 0.4초 슬로우모션과 카드 3장이 끼어들어, 플레이어는 보드 관리와 별개로 "점수 vs 안전" 을 저울질한다. 위험선(y = 120) 아래 90px 의 경고 구역에 공이 정지하면 근접 실패 연출이 시작되어 긴장이 오른다.

### 1.3 1런 루프 — 시작부터 종료까지

런은 `start(seed)` 로 시작해 위험선 위에 공이 1초 이상 정지하는 순간 끝난다. 평균 런은 3~8분을 목표로 한다. 런 종료 화면은 점수와 세션 베스트를 보여주고 클릭/R 로 즉시 재시작한다. 로그라이트 구조(라운드, 카드 덱, 런 간 언락)는 v0.2.0 이후 `IRoundSystem`, `ISaveSystem` 을 통해 이 런 루프 위에 쌓인다. 런의 정체성은 "어떤 리스크 카드를 받아들였고, 몇 번 죽을 뻔했는가" 로 만들어진다.

---

## 2. 도파민 설계 4요소

### 2.1 가변 보상 (Variable Reward)

같은 위치에 같은 공을 떨어뜨려도 결과가 다르다. 이는 Matter.js 물리(반발 0.15, 마찰 0.08, 공기 저항 0.008)가 만드는 미세한 굴림과 튕김 때문이며, 우리는 이를 버그가 아니라 핵심 재미로 취급한다. 스폰 티어는 시드 난수에 가중치(티어 0 이 가장 흔함, 티어 4 가 가장 희귀)를 두어 "다음 공이 뭐가 나올까" 자체가 작은 보상 사건이 되게 한다. 연쇄 배율(1.0 → 1.5 → 2.0 → …)은 예측 불가한 연쇄가 터질 때 점수가 비선형으로 뛰게 만들어, 드물게 큰 보상이 오는 간헐 강화 스케줄을 구현한다. 확장: 머지 카드 덱(`IMergeCardProvider`)은 카드 자체를 가변 보상으로 만든다.

### 2.2 에스컬레이션 (Escalation)

공의 값은 2 → 4 → … → 2048 로 배가되고 반지름은 16 → 111 로 커진다. 큰 공은 점수도 크지만 보드 공간을 급격히 잠식하므로, 진행할수록 "더 큰 보상 × 더 큰 위험" 이 동시에 커진다. 기본 위험선은 고정이지만, `raise_danger_line` 리스크 카드는 위험선을 아래로 밀어 플레이어가 직접 난이도를 올리게 한다. 큰 공이 늘수록 실질 여유 공간도 줄어들어 난이도가 자연스럽게 상승한다. 최대 티어(2048) 두 개가 합쳐지면 두 공이 사라지고 10,000점 보너스를 주어, 후반의 목표를 "공간을 비우는 대형 이벤트" 로 만든다. 확장: `IRoundSystem` 은 라운드마다 목표 점수를 올려 명시적 에스컬레이션을 더한다.

폭탄 특수 공(Task 2.3)은 디스펜서가 `SPECIAL_BALLS.bombSpawnChance`(= 5%) 확률로 내주는 공이다. 머지하지 않는 대신 첫 충돌에 폭발해 자신, 닿은 공, 중심 기준 반경 `bombBlastRadius`(= 90px) 안의 공을 모두 제거하고, 제거된 공들의 티어 값 합 × `blastScoreRatio`(= 50%)를 반올림해 점수로 받는다(Task 2.14 — 폭발 점수는 연쇄·카드 배율 없이 flat 지급되며 `score:changed`를 거쳐 라운드 목표에도 합산된다). 황색 테두리와 불꽃 기호로 표시된다.

### 2.3 근접 실패 (Near Miss)

`OverflowDetector` 는 매 프레임 위험선 아래 90px 경고 구역에 정지한 공을 찾아 `severity`(0 = 구역 하단, 1 = 위험선에 닿음)를 계산하고 `INearMissEffect` 훅(enter/update/exit)과 `danger:nearMiss*` 이벤트를 발화한다. v0.1.0 에서는 위험선의 불투명도와 붉은 비네트가 severity 에 비례해 진해진다. 게임 오버는 즉시가 아니라 1초 유예(`OVERFLOW_GRACE_MS`) 후에 발생하므로, 아슬아슬하게 공이 굴러 내려가 살아남는 "거의 죽을 뻔한" 순간이 실제로 발생한다. 이 유예 시간이 근접 실패 연출(3.3)의 무대다.

### 2.4 Juice

v0.1.0 은 최소한의 juice 만 넣었다: 합체 시 새 공이 두 공의 평균 속도를 물려받아 "합쳐지며 튀는" 느낌을 주고, 조준선(점선 가이드)과 NEXT 미리보기로 조작감을 준다. 나머지 juice 는 전부 확장 포인트로 예약했다. `IParticleSystem`(합체 버스트, 낙하 먼지), `IAudioSystem`(티어에 비례하는 피치의 합체음, 근접 실패 심박 루프), `TimeController` 의 슬로우모션(히트 스톱 느낌), 그리고 `INearMissEffect` 의 붉은 화면. 원칙: juice 는 `EventBus` 의 이벤트를 구독해서 구현하며 코어 로직은 juice 의 존재를 모른다.

---

## 3. 차별화 메커니즘 3종 — 상세 스펙

### 3.1 슬로우모션 선택 (Slow-Motion Choice)

**의도:** 머지 게임에 "결정" 을 넣는다. 합체가 터지는 가장 기분 좋은 순간에 선택을 요구해 보상과 결정을 결합한다.

**스펙:**

- 트리거: 합체가 해결된 직후 `ISlowMotionSelector.onMergeMoment(merge)` 가 호출된다. 일반 결과 티어 2(값 8) 이상과 최대 티어 소멸(`resultTier === null`)에서 선택을 연다. 구현체가 `SlowMotionRequest { durationMs, timeScale, cards }` 를 반환하면 발동, `null` 이면 무시. 기본 파라미터는 `SLOW_MOTION = { durationMs: 400, timeScale: 0.25, cardCount: 3, riskCardCount: 1 }`.
- 시간: `TimeController.startSlowMotion` 으로 게임 시간이 0.25배가 된다. 물리는 계속 진행되므로 슬로우모션 중에도 공은 (느리게) 구른다. 실시간 400ms 동안 선택하지 않으면 `onTimeout(merge)` 가 대신 카드를 고르거나(`MergeCard` 반환) 아무 것도 적용하지 않는다(`null`).
- 상태: `aiming` 또는 `dropping` 에서 `slowmo_select` 로 진입하고, 선택/타임아웃 후 진입 전 상태로 복귀한다(`resumeAiming` / `resumeDropping`). `slowmo_select` 중에는 드롭이 막힌다.
- 입력: 포인터/터치로 카드를 누르거나 숫자열/숫자패드의 1/2/3 키로 해당 카드를 선택한다.
- 카드 적용: `Game.chooseCard(card)` 가 `MergeCardContext { merge, currentScore, addScore, pushScoreMultiplier, shiftDangerLine }` 를 넘겨 `card.apply` 를 실행한다. `shiftDangerLine(deltaY)` 는 보드 단위로 위험선을 움직이고, 양수는 화면 아래 방향이다.
- v0.1.0 범위: 인터페이스, 상태 전이, 시간 배율, 컨텍스트, `NoopSlowMotionSelector` 까지. 카드 덱과 UI 는 Task 1.2~1.4.
- 발동 빈도 가이드(v0.2.0): 일반 결과 티어 2(값 8) 이상 머지는 1분에 2~4회를 목표로 한다. 최대 티어 소멸은 희귀한 마일스톤이므로 별도로 항상 선택을 연다. 너무 잦으면 피로, 너무 드물면 잊힌다.

### 3.2 리스크 카드 (Risk Card)

**의도:** 선택에 긴장을 넣는다. 항상 좋은 카드만 있으면 선택은 계산으로 끝난다. 3장 중 1장은 반드시 대가가 붙는다.

**스펙:**

- 타입: `RiskCard extends MergeCard { kind: 'risk'; penalty: RiskPenaltyKind; severity: number }`. `RiskPenaltyKind = 'score_loss' | 'spawn_larger_balls' | 'raise_danger_line'`.
- 계약: `IMergeCardProvider.draw(merge, count, riskCount)` 는 정확히 `riskCount` 장의 리스크 카드를 포함해야 한다(테스트로 강제).
- 설계 원칙: 리스크 카드의 보상은 같은 세트의 보상 카드보다 **눈에 띄게** 커야 한다(예: ×4 배율 vs ×2). 대가는 즉시 보이고 되돌릴 수 없어야 한다. `severity` 는 UI 강도(테두리 색, 흔들림)에 쓴다.
- 페널티별 의미: `score_loss` 는 현재 점수의 일정 비율 차감, `spawn_larger_balls` 는 다음 N 회 스폰 티어 하한 상승(보드 압박 — 하한은 그 시점 이후 굴리는 신규 발급에만 적용되고, 이미 손에 들렸거나 NEXT 로 보이는 공은 바뀌지 않는다. 런 재시작 시 해제), `raise_danger_line` 은 위험선을 아래로 이동(런의 남은 시간 단축)한다. `raise_danger_line` 은 50점을 지불하고 위험선을 30 보드 단위만큼 아래로 옮기는 대신 다음 머지에 ×4 배율을 준다. 값은 `MERGE_CARDS` 가 단일 진실이다. 두 이동형 페널티는 `MergeCardContext` 의 필드로 호스트에 위임한다(기존 필드 제거 없음).
- v0.1.0 범위: 타입, 타입 가드 `isRiskCard`, 컨텍스트만.

### 3.3 근접 실패 연출 (Near-Miss Presentation)

**의도:** 죽을 뻔한 순간을 게임이 알아채고 크게 연출해서, 생존은 안도감으로, 사망은 재도전 욕구로 바꾼다.

**스펙:**

- 감지: `OverflowDetector.update` 가 정지 상태(속도 < 0.6)인 공 중 위험선 아래 90px 이내의 공을 찾아 가장 심각한 `NearMissSample { severity, ballId, distanceToLine }` 을 만든다.
- 훅: `INearMissEffect.onNearMissEnter / onNearMissUpdate / onNearMissExit` 와 `getIntensity()`. 같은 내용이 `danger:nearMissEnter/Update/Exit` 이벤트로도 나가 오디오/파티클이 독립적으로 반응할 수 있다.
- 연출 목표(v0.2.0+): enter 시 슬로우모션(0.4초, 0.25배) + 붉은 비네트 페이드인 + 심박음 루프 시작. update 마다 severity 에 따라 비네트 알파와 심박 템포 상승. exit 시 0.3초 페이드아웃. 게임 오버로 이어지면 비네트를 유지한 채 오버레이 표시.
- v0.1.0 범위: 감지, 훅, 이벤트, `NoopNearMissEffect`(intensity 저장만), 위험선 불투명도 + 비네트 알파를 intensity 에 연결한 최소 렌더.

---

## 4. 승리 / 패배 조건

**패배 (런 종료):** 어떤 공이든 위 가장자리(`position.y - radius`)가 위험선(y = 120) 위에 있고, 속도가 0.6 미만인 상태가 누적 1,000ms 이상 지속되면 `overflow` 가 발생하고 상태가 `game_over` 로 전이한다. 빠르게 지나가는 공(막 떨어뜨린 공)은 카운트하지 않으며, 공이 구역을 벗어나면 누적 시간은 리셋된다. 이 규칙은 `OverflowDetector` 에 순수 로직으로 구현되어 있고 테스트로 고정되어 있다.

**승리:** v0.1.0 은 무한 모드다. 명시적 승리는 없고 점수와 세션 베스트가 성과다. 2048 두 개의 합체(보드 정리 + 10,000점)가 사실상의 마일스톤 역할을 한다. `IRoundSystem` 구현체(`BasicRoundSystem`)는 라운드마다 목표 점수를 제시해 중간 승리 조건이 된다(Task 2.2): 라운드가 시작되면 그 라운드 안에서 `ROUNDS.firstTargetScore`(=150) + 100×(라운드−1) 점을 `dropBudget`(=15 + 3×(라운드−1)) 회 드롭 안에 벌면 클리어이고, 클리어 시 보상 카드 3장(`+N점`(N = 50 + 25×(라운드−1)) · `SCORE ×2` 2회 · `SCORE ×3` 1회, 전부 reward) 중 1장을 고른다(Task 2.13). 선택은 머지 순간의 슬로우모션 카드 선택과 같은 플로우(`slowmo_select`, 400ms 타임아웃, 리스크 없음)이며, 라운드는 선택과 동시에 넘어가 고른 보상은 새 라운드의 소득으로 합산된다. 머지 선택창이 이미 열려 선택을 열 수 없을 때만 맨 앞의 `+N점` 카드가 즉시 지급된다. 현재 라운드 번호·목표 진행도·남은 드롭은 HUD 좌측(`GameSnapshot.round`, Task 2.12)에 표시된다. 드롭 예산을 먼저 쓰면 라운드는 보상 없이 넘어간다(라운드 실패). 수치는 `src/config/gameConfig.ts` 의 `ROUNDS` 가 단일 진실이다. v1.0.0 에서 최종 라운드 클리어를 런 승리로 정의한다(`docs/ROADMAP.md`).

**점수 규칙 요약:** 합체 점수 = 결과 공의 값 × (1 + 0.5 × chainIndex), 이후 `IScoreModifier` 체인 적용, 0 미만 불가. 최대 티어 합체는 결과 공 대신 10,000 점.
