# 메모 작성 시간 UTC 변환 문제

## 문제 정의

메모 작성 후 화면에 표시되는 메모의 생성 시간이 실제 한국 시간과 9시간 차이가 발생하는 문제가 발생했습니다.

### 증상

- **실제 한국 시간**: 오후 12시 28분
- **화면에 표시되는 시간**: 오전 3시 28분
- **차이**: 9시간 (UTC와 KST의 차이)

### 참고사항

- 서버에서 생성하는 `created_at`과 `updated_at` 필드값은 정상적으로 한국 시간대를 적용하여 생성하고 DB에 저장됨
- 문제는 프론트엔드에서 생성하는 `memoStartTime` 필드값에만 발생

---

## 원인 분석

### 현재 코드 (flow-view.js:1454)

```javascript
memoStartTime: new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' })).toISOString(),
```

### 문제점

1. **`toLocaleString('en-US', { timeZone: 'Asia/Seoul' })`**
   - 한국 시간대로 문자열을 생성 (예: "12/28/2024, 12:28:00 PM")
   - 이는 올바르게 한국 시간을 반환함

2. **`new Date("문자열")`**
   - 생성된 문자열을 `Date` 객체로 파싱
   - 브라우저가 이를 로컬 타임존으로 해석
   - 브라우저가 한국 시간대라면 정상 작동해야 하지만, 파싱 과정에서 문제가 발생할 수 있음

3. **`toISOString()`**
   - **핵심 문제**: `toISOString()`은 항상 UTC로 변환함
   - 브라우저가 한국 시간대여도 UTC로 변환되어 9시간이 빼짐
   - 예: 한국 시간 `12:28:00` → UTC `03:28:00`

### 예시

```
실제 한국 시간: 2024-12-28 12:28:00 (KST, UTC+9)
↓
toLocaleString('en-US', { timeZone: 'Asia/Seoul' })
→ "12/28/2024, 12:28:00 PM"
↓
new Date("12/28/2024, 12:28:00 PM")
→ 브라우저가 로컬 타임존(한국)으로 해석
→ 2024-12-28 12:28:00 (로컬 시간)
↓
toISOString()
→ 항상 UTC로 변환
→ 2024-12-28T03:28:00.000Z (UTC, 9시간 빼짐)
```

---

## 해결 방안

### 방안 6: 브라우저가 한국 시간대일 때 (채택)

브라우저가 한국 시간대라면, `new Date()`로 현재 시간을 가져온 후 타임존 정보 없이 ISO 형식으로 직접 생성합니다.

#### 장점

1. **간단함**: 브라우저가 한국 시간대면 `new Date()`가 한국 시간을 반환
2. **UTC 변환 없음**: `toISOString()`을 사용하지 않아 UTC 변환 문제 해결
3. **백엔드 호환**: 타임존 정보 없이 ISO 형식으로 생성하여 백엔드 `LocalDateTime` 파싱과 호환
4. **명확함**: 구현이 단순하고 이해하기 쉬움

#### 구현 코드

```javascript
// 한국 시간대의 현재 시간을 ISO 문자열로 생성 (타임존 정보 없이)
const getKoreaTimeISOString = () => {
  const now = new Date(); // 브라우저가 한국 시간대면 한국 시간
  
  // 한국 시간대의 현재 시간을 ISO 형식으로 직접 생성 (타임존 정보 없이)
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
};

memoStartTime: getKoreaTimeISOString(),
```

#### 동작 방식

1. `new Date()`로 현재 시간 가져오기
   - 브라우저가 한국 시간대면 한국 시간 반환
   - 예: 2024-12-28 12:28:00

2. 각 시간 구성 요소 추출
   - `getFullYear()`, `getMonth()`, `getDate()`, `getHours()`, `getMinutes()`, `getSeconds()`
   - 로컬 시간 기준으로 추출 (UTC 변환 없음)

3. ISO 형식으로 직접 생성
   - 형식: `YYYY-MM-DDTHH:MM:SS`
   - 타임존 정보 없음 (백엔드 `LocalDateTime`과 호환)

4. 백엔드 전송
   - 백엔드의 `LocalDateTime`이 타임존 정보 없이 파싱
   - 한국 시간 그대로 저장됨

---

## 예상 효과

### 변경 전
- 한국 시간 `2024-12-28 12:28:00`에 메모 작성
- `memoStartTime`: `2024-12-28T03:28:00.000Z` (UTC, 9시간 차이)
- 화면 표시: 오전 3시 28분

### 변경 후
- 한국 시간 `2024-12-28 12:28:00`에 메모 작성
- `memoStartTime`: `2024-12-28T12:28:00` (한국 시간, 타임존 정보 없음)
- 화면 표시: 오후 12시 28분

---

## 주의사항

1. **브라우저 시간대 의존성**: 이 방법은 브라우저가 한국 시간대로 설정되어 있어야 정확히 작동합니다.
2. **다른 시간대 사용자**: 향후 다른 국가 사용자를 지원하려면 방안 7을 고려해야 합니다.
3. **서버 시간과의 일관성**: 서버의 `created_at`, `updated_at`은 한국 시간대로 정상 작동하므로, `memoStartTime`도 동일하게 한국 시간대로 저장되어 일관성이 유지됩니다.

---

## 관련 파일

- 프론트엔드: `분산2_프로젝트_프론트/js/views/pages/flow-view.js:1454`
- 백엔드 DTO: `분산2_프로젝트/src/main/java/com/readingtracker/server/dto/requestDTO/MemoCreateRequest.java:25`
- 백엔드 Mapper: `분산2_프로젝트/src/main/java/com/readingtracker/server/mapper/MemoMapper.java:43`
- 메모 카드 표시: `분산2_프로젝트_프론트/js/components/memo-card.js:66-74`

---

## 작성일

2024년 12월


