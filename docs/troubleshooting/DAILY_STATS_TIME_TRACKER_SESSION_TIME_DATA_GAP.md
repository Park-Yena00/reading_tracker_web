# 일별 통계(Time Tracker) “독서 시작~종료” 시간 집계 데이터 부재 이슈

## 1. 요구사항(사용자 목표)
홈 화면의 **일별 통계**에서 다음 형태의 타임 트래커를 표시하고자 합니다.

- **세로축**: 24H (0~23시)
- **가로축**: 60M를 6등분(10분 단위)
- **표기 구간**: 오늘의 흐름 페이지에서
  - 사용자가 “메모 작성 → 책 선택”으로 **독서를 시작한 시점**
  - “책 덮기”로 **독서를 종료한 시점**
  - 사이의 시간 구간을 **해당 책 색상으로 채워** 표시

즉, “메모를 작성한 시간”이 아니라 **독서 세션(Reading Session)의 시작/종료 이벤트 시간**을 기준으로 집계하는 것이 핵심입니다.

---

## 2. 현재 구현/데이터 구조(현 상태)

### 2.1 프론트에서 일별 통계가 사용하는 데이터
- `HomeView`의 일별 통계는 `memoService.getTodayFlow({ sortBy: 'BOOK' })` 응답의 `memosByBook`을 기반으로 타임트래커를 만듭니다.
- `StatisticsHelper.calculateDailyTimeTrack()`는 각 도서의 메모들에서 `memoStartTime || createdAt`의 **최소/최대값(min/max)** 으로 “읽은 시간 구간”을 추정합니다.

### 2.2 프론트에서 “독서 시작/종료” 이벤트가 발생하는 지점
- **독서 시작(책 선택)**: `flow-view.js`의 `handleBookSelect(book)`에서 발생
  - 이 시점은 UI 이벤트이며, 현재 서버/DB에 별도로 기록되지 않습니다.
- **독서 종료(책 덮기)**: `memoService.closeBook(userBookId, requestData)` 호출로 발생
  - 요청에는 `lastReadPage`, 경우에 따라 `readingFinishedDate` 등이 포함되지만,
  - “종료 시점(endedAt)”을 서버가 세션 데이터로 저장/반환한다는 보장이 없습니다.

### 2.3 DB(백엔드) 스키마 관점
현재 마이그레이션 기준으로 확인되는 테이블/컬럼은 다음과 같습니다.

- `user_books`
  - `last_read_at DATETIME NULL`
  - `last_page_at DATETIME NULL`
  - `added_at`, `updated_at` 등
- `memo`
  - `memo_start_time TIMESTAMP NOT NULL` (메모 작성 시간)
  - `created_at`, `updated_at` 등

즉, **메모 시간(`memo_start_time`)은 존재**하지만, “책 선택(시작)~책 덮기(종료)”의 **세션 단위 이벤트 시간**은 독립 데이터로 존재하지 않습니다.

---

## 3. 문제의 본질(왜 정확한 집계가 불가능한가)

현재 일별 통계는 “오늘 작성된 메모”만으로 시간을 만들기 때문에 다음 한계가 있습니다.

1. **독서 시작 시점 ≠ 첫 메모 작성 시점**
   - 사용자가 책을 선택한 뒤 한동안 메모를 쓰지 않을 수 있습니다.
2. **독서 종료 시점 ≠ 마지막 메모 작성 시점**
   - 마지막 메모 작성 후 한참 뒤에 책 덮기를 누를 수 있습니다.
3. **메모가 0개인 독서 세션**
   - 책을 선택하고 읽다가 메모를 하나도 작성하지 않고 “책 덮기”를 누르는 케이스는,
     메모 기반 통계로는 **구간 자체가 0으로 소실**됩니다.

따라서 “독서 시작(책 선택)~독서 종료(책 덮기)”를 정확히 그리려면,
그 **시작/종료 타임스탬프가 영속 저장되어야** 합니다.

---

## 4. 해결 방향(선택지)

### 선택지 A) DB/서버에 ‘독서 세션’ 데이터를 저장 (정확도/재사용성 최우선)
**권장안**입니다. 멀티디바이스/새로고침/장기 통계에서도 일관되게 동작합니다.

- 핵심: “독서 세션(Reading Session)”을 1레코드로 저장
  - 시작: 책 선택 시점
  - 종료: 책 덮기 시점
- 일별 통계는 “오늘과 겹치는 세션”을 조회하여 10분 단위 그리드로 변환

### 선택지 B) 프론트 로컬 저장(IndexedDB/localStorage)만으로 세션을 기록 (서버 변경 없음)
구현은 가능하지만 통계의 진실성이 “해당 기기/브라우저”에만 종속됩니다.

- 장점: 서버/DB 변경 없음
- 단점: 기기 변경/브라우저 변경/캐시 삭제 시 통계가 유실될 수 있음

### 선택지 C) 기존 ‘메모 시간(min/max)’으로 근사 (간단하지만 요구사항 불일치)
세션 시간 대신 “메모 작성 시간”을 독서 시간으로 보는 방식이며,
요구사항의 “책 선택~책 덮기” 정의와 다릅니다.

---

## 5. 결론
요구사항을 **정의 그대로** 충족하려면,
현재 데이터 모델만으로는 부족하며 **독서 세션 시작/종료 시간의 영속 저장이 필요**합니다.

- 정확도/재사용성/쿼리 성능까지 고려하면 **선택지 A(신규 세션 테이블)** 이 가장 합리적입니다.

---

## 6. DB 설계 권장안(신규 테이블)

### 6.1 왜 `user_books`에 컬럼 추가만으로는 부족한가
`user_books`는 “한 사용자-한 책”의 **현재 상태/요약**에 적합합니다.
하지만 일별 통계는 하루에 여러 번 발생하는 “독서 세션의 타임라인”이 필요하므로,
세션을 컬럼으로만 저장하면 아래 문제가 생깁니다.

- 하루에 여러 세션(시작/종료)이 있을 때 **기록이 덮어써짐**
- “지난주/지난달 세션” 같은 재사용 통계에 확장하기 어려움
- 세션 단위로 정확한 조회(기간 겹침 포함)를 하기가 어려움

### 6.2 추천 테이블: `reading_sessions` (또는 `reading_activity_sessions`)
**세션 1개 = 레코드 1개**로 저장합니다.

- **주요 컬럼 예시**
  - `id` (PK)
  - `user_id` (FK → `users.id`)
  - `user_book_id` (FK → `user_books.id`)
  - `started_at` (DATETIME/TIMESTAMP)
  - `ended_at` (DATETIME/TIMESTAMP, 종료 전이면 NULL)
  - `created_at`, `updated_at`
  - (선택) `status`(OPEN/CLOSED), `device_id`, `source`(FLOW_SELECT/CLOSE_BOOK) 등

- **인덱스 권장(조회 성능 핵심)**
  - `(user_id, started_at)`
  - `(user_id, ended_at)`
  - `(user_book_id, started_at)`
  - 필요 시 “하루 단위 조회” 최적화를 위해 `(user_id, started_at, ended_at)`도 고려

### 6.3 일별 통계 조회 쿼리(개념)
“해당 날짜와 겹치는 세션”을 가져오면 됩니다.

- 조건(개념):  
  - `started_at < dayEnd` AND (`ended_at` IS NULL OR `ended_at >= dayStart`)

이렇게 하면 자정 경계를 넘는 세션도 정확히 처리할 수 있습니다.

### 6.4 `memo`와의 관계(선택)
정밀한 분석/재사용성을 높이려면,
`memo`에 `reading_session_id`(FK)를 두는 것도 유용합니다.

- 장점: “세션별 메모 묶기”, “세션당 메모 수”, “세션 품질(평점/태그)” 같은 확장 통계가 쉬움
- 단점: 기존 데이터 마이그레이션/연동 로직이 추가로 필요

---

## 7. `created_at`, `updated_at` 포함 여부 결정 기준

### 7.1 최소 스키마 (필수 컬럼만)
**핵심 도메인 데이터만 포함**하는 방식입니다.

```sql
CREATE TABLE reading_sessions (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    user_book_id BIGINT NOT NULL,
    started_at TIMESTAMP NOT NULL,
    ended_at TIMESTAMP NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (user_book_id) REFERENCES user_books(id) ON DELETE CASCADE,
    INDEX idx_reading_sessions_user_started (user_id, started_at),
    INDEX idx_reading_sessions_user_book_started (user_book_id, started_at)
);
```

#### 장점
- **단순함**: 스키마가 간결하고 이해하기 쉬움
- **저장 공간 절약**: 컬럼 수가 적어 저장 비용이 낮음
- **빠른 개발**: 초기 구현이 빠름

#### 단점
- **오프라인/동기화 이슈 추적 어려움**: 네트워크 지연으로 인한 기록 지연, 중복 기록 등을 감지하기 어려움
- **멀티 디바이스 충돌 감지 어려움**: 여러 기기에서 동시에 세션을 시작/종료할 때 충돌을 감지하기 어려움
- **데이터 정합성 검증 어려움**: “실제 시작 시간”과 “DB 기록 시간”의 차이를 확인할 수 없음
- **증분 동기화 비효율**: “최근 변경된 세션만 가져오기” 같은 증분 조회가 어려움

---

### 7.2 권장 스키마 (운영/동기화까지 고려)
**도메인 데이터 + 감사/운영 메타데이터**를 포함하는 방식입니다.

```sql
CREATE TABLE reading_sessions (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    user_book_id BIGINT NOT NULL,
    started_at TIMESTAMP NOT NULL,  -- 도메인: 실제 독서 시작 시간
    ended_at TIMESTAMP NULL,        -- 도메인: 실제 독서 종료 시간
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,  -- 메타: 레코드 생성 시간
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,  -- 메타: 레코드 수정 시간
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (user_book_id) REFERENCES user_books(id) ON DELETE CASCADE,
    INDEX idx_reading_sessions_user_started (user_id, started_at),
    INDEX idx_reading_sessions_user_book_started (user_book_id, started_at),
    INDEX idx_reading_sessions_updated_at (user_id, updated_at)  -- 증분 동기화용
);
```

#### 장점
- **오프라인/동기화 이슈 추적 가능**: 
  - 예: `started_at = 10:00`, `created_at = 10:05` → 네트워크 지연 5분 감지
  - 예: `started_at = 10:00`, `created_at = 10:00` → 정상 즉시 기록
- **멀티 디바이스 충돌 감지 가능**: 
  - 같은 `started_at`인데 `created_at`이 다르면 → 다른 기기에서 동시 시작 감지
- **증분 동기화 효율**: 
  - `WHERE updated_at > lastSyncTime` 같은 쿼리로 변경된 세션만 가져오기 가능
- **데이터 정합성 검증**: 
  - `started_at`과 `created_at`의 차이가 비정상적으로 크면 → 데이터 오류 의심 가능
- **운영 감사(Audit)**: 
  - 누가/언제/어떤 흐름으로 데이터가 저장·수정됐는지 추적 가능
- **기존 프로젝트 일관성**: 
  - `memo`, `user_books` 등 기존 테이블이 이미 `created_at`, `updated_at`을 사용 중이므로 **스키마 일관성** 유지

#### 단점
- **스키마 복잡도 증가**: 컬럼이 2개 추가됨
- **저장 공간 약간 증가**: 타임스탬프 2개 추가 (약 16바이트/레코드)

---

### 7.3 선택 기준 (프로젝트 특성 기반)

#### **권장 스키마를 선택해야 하는 경우** (이 프로젝트에 해당)
1. ✅ **오프라인 지원(Offline-First) 전략 사용 중**
   - 네트워크 지연/재시도로 인한 기록 지연을 추적해야 함
   - `started_at`과 `created_at`의 차이로 “늦게 기록된 세션” 감지 가능

2. ✅ **동기화 큐 관리 필요**
   - `updated_at` 기준으로 “최근 변경된 세션만 동기화” 가능
   - 증분 동기화 성능 향상

3. ✅ **멀티 디바이스 지원**
   - 여러 기기에서 동시에 세션을 시작/종료할 때 충돌 감지 필요
   - `created_at`으로 “어느 기기에서 먼저 기록됐는지” 추적 가능

4. ✅ **기존 테이블과의 일관성**
   - `memo`, `user_books` 등이 이미 `created_at`, `updated_at` 사용 중
   - 프로젝트 전체 스키마 일관성 유지

5. ✅ **장기 운영/디버깅 고려**
   - 향후 데이터 정합성 이슈 발생 시 원인 추적 용이
   - 운영 감사 로그로 활용 가능

#### **최소 스키마를 선택해도 되는 경우**
1. ❌ 오프라인 지원이 없고 항상 온라인만 사용
2. ❌ 단일 기기만 지원
3. ❌ 동기화/충돌 해결이 필요 없음
4. ❌ 프로토타입/임시 기능으로 빠른 구현이 최우선

---

### 7.4 결론 및 권장사항
**이 프로젝트의 특성(오프라인 지원, 동기화, 멀티 디바이스, 기존 테이블 일관성)을 고려하면, `created_at`, `updated_at`을 포함한 권장 스키마를 사용하는 것이 적합합니다.**

- **비용**: 저장 공간 증가는 미미함 (타임스탬프 2개 ≈ 16바이트/레코드)
- **이익**: 오프라인/동기화/멀티 디바이스 이슈 추적, 증분 동기화 효율, 운영 감사 등 실질적 이점
- **일관성**: 기존 `memo`, `user_books` 테이블과 동일한 패턴 유지로 코드/쿼리 일관성 확보

