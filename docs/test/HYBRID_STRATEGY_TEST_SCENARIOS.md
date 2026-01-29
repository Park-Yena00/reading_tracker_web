# 하이브리드 전략 테스트 시나리오

> **작성일**: 2025-12-09  
> **목적**: 하이브리드 전략 A (네트워크 상태 기반 분기) 및 공통 로직 추출 개선 사항 테스트  
> **상태**: ✅ 테스트 시나리오 작성 완료

---

## 1. 테스트 개요

### 1-1. 개선 사항 요약

1. **하이브리드 전략 A 적용**: 네트워크 상태 기반 분기
   - 온라인: 서버 우선 처리 후 IndexedDB 갱신
   - 오프라인: 로컬 우선 처리 (Offline-First)

2. **공통 로직 추출**: `MemoOperationHelper` 클래스 생성
   - IndexedDB 갱신 로직 추출
   - 오류 처리 로직 추출

3. **이벤트 기반 상태 전환 처리**: `NetworkStateManager` 생성
   - 이벤트 기반 상태 전환 알림
   - 느슨한 결합 유지

### 1-2. 테스트 범위

- 메모 생성 (createMemo)
- 메모 수정 (updateMemo)
- 메모 삭제 (deleteMemo)
- 메모 조회 (getMemosByBook)
- 네트워크 상태 전환 처리

---

## 2. 테스트 시나리오

### 시나리오 1: 온라인 상태에서 메모 생성

**목적**: 온라인 상태에서 서버 우선 전략이 올바르게 작동하는지 확인

**전제 조건**:
- 네트워크 연결 상태
- 로그인 완료
- 서재에 책 추가 완료

**테스트 절차**:
1. 브라우저 개발자 도구에서 네트워크 상태 확인 (`networkMonitor.isOnline === true`)
2. 메모 작성 화면에서 메모 작성
3. 저장 버튼 클릭

**예상 결과**:
- ✅ 서버에 메모가 생성됨 (Primary/Secondary DB 모두)
- ✅ IndexedDB에 메모가 저장됨 (최근 7일 메모인 경우)
- ✅ UI에 메모가 즉시 표시됨
- ✅ 서버 메모 ID가 할당됨

**검증 방법**:
```javascript
// 브라우저 콘솔에서 확인
const memos = await memoService.getMemosByBook(userBookId);
console.log('생성된 메모:', memos);
// serverId가 있는지 확인
```

---

### 시나리오 2: 오프라인 상태에서 메모 생성

**목적**: 오프라인 상태에서 로컬 우선 전략이 올바르게 작동하는지 확인

**전제 조건**:
- 네트워크 연결 끊김 (오프라인 모드)
- 로그인 완료
- 서재에 책 추가 완료

**테스트 절차**:
1. 브라우저 개발자 도구에서 네트워크를 오프라인으로 설정
2. 메모 작성 화면에서 메모 작성
3. 저장 버튼 클릭

**예상 결과**:
- ✅ IndexedDB에 메모가 저장됨 (localId 할당)
- ✅ 동기화 큐에 CREATE 항목이 추가됨
- ✅ UI에 메모가 즉시 표시됨 (낙관적 업데이트)
- ✅ 동기화 상태: `pending` 또는 `syncing_create`

**검증 방법**:
```javascript
// 브라우저 콘솔에서 확인
const memos = await memoService.getMemosByBook(userBookId);
console.log('오프라인 메모:', memos);
// localId가 있고 serverId가 null인지 확인
// syncStatus가 'pending'인지 확인
```

---

### 시나리오 3: 오프라인 → 온라인 전환 시 자동 동기화

**목적**: 네트워크 복구 시 자동 동기화가 올바르게 작동하는지 확인

**전제 조건**:
- 오프라인 상태에서 메모 생성 완료
- 동기화 큐에 PENDING 항목 존재

**테스트 절차**:
1. 오프라인 상태에서 메모 생성
2. 브라우저 개발자 도구에서 네트워크를 온라인으로 설정
3. 네트워크 복구 대기 (1-2초)

**예상 결과**:
- ✅ `NetworkStateManager`가 `network:online` 이벤트 발행
- ✅ `offlineMemoService`가 동기화 큐 처리
- ✅ 서버에 메모가 생성됨
- ✅ IndexedDB의 메모에 serverId 할당
- ✅ 동기화 상태: `synced`
- ✅ Toast 메시지 표시: "✅ N개의 메모 동기화 완료."

**검증 방법**:
```javascript
// 브라우저 콘솔에서 확인
const memos = await memoService.getMemosByBook(userBookId);
console.log('동기화된 메모:', memos);
// serverId가 할당되었는지 확인
// syncStatus가 'synced'인지 확인
```

---

### 시나리오 4: 온라인 상태에서 메모 수정

**목적**: 온라인 상태에서 서버 우선 전략이 올바르게 작동하는지 확인

**전제 조건**:
- 네트워크 연결 상태
- 서버에 존재하는 메모 (serverId 있음)

**테스트 절차**:
1. 기존 메모 수정
2. 저장 버튼 클릭

**예상 결과**:
- ✅ 서버에 메모가 수정됨 (Primary/Secondary DB 모두)
- ✅ IndexedDB에 메모가 업데이트됨
- ✅ UI에 수정된 메모가 즉시 표시됨
- ✅ 동기화 상태: `synced`

**검증 방법**:
```javascript
// 브라우저 콘솔에서 확인
const memos = await memoService.getMemosByBook(userBookId);
console.log('수정된 메모:', memos);
// 수정된 내용이 반영되었는지 확인
```

---

### 시나리오 5: 오프라인 상태에서 메모 수정

**목적**: 오프라인 상태에서 로컬 우선 전략이 올바르게 작동하는지 확인

**전제 조건**:
- 네트워크 연결 끊김 (오프라인 모드)
- 서버에 존재하는 메모 (serverId 있음)

**테스트 절차**:
1. 브라우저 개발자 도구에서 네트워크를 오프라인으로 설정
2. 기존 메모 수정
3. 저장 버튼 클릭

**예상 결과**:
- ✅ IndexedDB에 메모가 수정됨
- ✅ 동기화 큐에 UPDATE 항목이 추가됨
- ✅ UI에 수정된 메모가 즉시 표시됨
- ✅ 동기화 상태: `pending` 또는 `syncing_update`

**검증 방법**:
```javascript
// 브라우저 콘솔에서 확인
const memos = await memoService.getMemosByBook(userBookId);
console.log('오프라인 수정된 메모:', memos);
// 수정된 내용이 반영되었는지 확인
// syncStatus가 'pending'인지 확인
```

---

### 시나리오 6: 온라인 상태에서 메모 삭제

**목적**: 온라인 상태에서 서버 우선 전략이 올바르게 작동하는지 확인

**전제 조건**:
- 네트워크 연결 상태
- 서버에 존재하는 메모 (serverId 있음)

**테스트 절차**:
1. 기존 메모 삭제
2. 삭제 확인

**예상 결과**:
- ✅ 서버에서 메모가 삭제됨 (Primary/Secondary DB 모두)
- ✅ IndexedDB에서 메모가 삭제됨
- ✅ UI에서 메모가 즉시 제거됨
- ✅ 성공 메시지: "메모가 삭제되었습니다."

**검증 방법**:
```javascript
// 브라우저 콘솔에서 확인
const memos = await memoService.getMemosByBook(userBookId);
console.log('삭제 후 메모 목록:', memos);
// 삭제된 메모가 목록에 없는지 확인
```

---

### 시나리오 7: 오프라인 상태에서 메모 삭제

**목적**: 오프라인 상태에서 로컬 우선 전략이 올바르게 작동하는지 확인

**전제 조건**:
- 네트워크 연결 끊김 (오프라인 모드)
- 서버에 존재하는 메모 (serverId 있음)

**테스트 절차**:
1. 브라우저 개발자 도구에서 네트워크를 오프라인으로 설정
2. 기존 메모 삭제
3. 삭제 확인

**예상 결과**:
- ✅ IndexedDB에서 메모가 삭제 표시됨 (실제 삭제는 동기화 후)
- ✅ 동기화 큐에 DELETE 항목이 추가됨
- ✅ UI에서 메모가 즉시 제거됨 (낙관적 삭제)
- ✅ 동기화 상태: `pending` 또는 `syncing_delete`
- ✅ 메시지: "메모 삭제가 예약되었습니다. 네트워크 복구 시 자동 동기화됩니다."

**검증 방법**:
```javascript
// 브라우저 콘솔에서 확인
const memos = await memoService.getMemosByBook(userBookId);
console.log('오프라인 삭제 후 메모 목록:', memos);
// 삭제된 메모가 목록에 없는지 확인
```

---

### 시나리오 8: 서버에만 존재하는 메모 삭제 (온라인)

**목적**: 하이브리드 전략(최근 7일만 IndexedDB 보관)으로 인해 로컬에 없지만 서버에 존재하는 메모 삭제

**전제 조건**:
- 네트워크 연결 상태
- 서버에만 존재하는 메모 (IndexedDB에 없음, 7일 이상 된 메모)

**테스트 절차**:
1. 7일 이상 된 메모 삭제 시도
2. 삭제 확인

**예상 결과**:
- ✅ 서버에서 메모가 삭제됨 (Primary/Secondary DB 모두)
- ✅ IndexedDB에는 없으므로 갱신 불필요
- ✅ UI에서 메모가 즉시 제거됨
- ✅ 성공 메시지: "메모가 삭제되었습니다."

**검증 방법**:
```javascript
// 브라우저 콘솔에서 확인
// 서버에서 메모 조회
const serverMemos = await apiClient.get(API_ENDPOINTS.MEMOS.BY_BOOK(userBookId));
console.log('서버 메모 목록:', serverMemos);
// 삭제된 메모가 목록에 없는지 확인
```

---

### 시나리오 9: 서버 오류 시 오프라인 모드로 전환

**목적**: 서버 오류 발생 시 자동으로 오프라인 모드로 전환되는지 확인

**전제 조건**:
- 네트워크 연결 상태
- 서버 다운 또는 네트워크 오류

**테스트 절차**:
1. 서버를 중단하거나 네트워크를 끊음
2. 메모 생성/수정/삭제 시도

**예상 결과**:
- ✅ 서버 요청 실패
- ✅ `MemoOperationHelper.handleServerError()`가 네트워크 오류 감지
- ✅ 자동으로 오프라인 로직으로 전환
- ✅ IndexedDB에 저장 및 동기화 큐에 추가
- ✅ UI에 메모가 표시됨 (낙관적 업데이트)

**검증 방법**:
```javascript
// 브라우저 콘솔에서 확인
const memos = await memoService.getMemosByBook(userBookId);
console.log('오프라인 모드로 전환된 메모:', memos);
// localId가 있고 serverId가 null인지 확인
// syncStatus가 'pending'인지 확인
```

---

### 시나리오 10: 이벤트 기반 상태 전환 처리

**목적**: `NetworkStateManager`가 이벤트를 올바르게 발행하고 구독하는지 확인

**전제 조건**:
- `NetworkStateManager` 초기화 완료
- `offlineMemoService` 이벤트 구독 완료

**테스트 절차**:
1. 브라우저 개발자 도구에서 네트워크를 오프라인으로 설정
2. 이벤트 발행 확인
3. 브라우저 개발자 도구에서 네트워크를 온라인으로 설정
4. 이벤트 발행 및 동기화 확인

**예상 결과**:
- ✅ `network:offline` 이벤트 발행
- ✅ `offlineMemoService`가 이벤트 구독
- ✅ `network:online` 이벤트 발행
- ✅ `offlineMemoService`가 동기화 큐 처리

**검증 방법**:
```javascript
// 브라우저 콘솔에서 확인
// 이벤트 구독 확인
import { eventBus } from './js/utils/event-bus.js';
eventBus.subscribe('network:online', (data) => {
    console.log('network:online 이벤트 수신:', data);
});
eventBus.subscribe('network:offline', (data) => {
    console.log('network:offline 이벤트 수신:', data);
});
```

---

## 3. 공통 로직 추출 검증

### 3-1. MemoOperationHelper 사용 확인

**검증 항목**:
- ✅ `updateLocalAfterDelete()` 사용: `memo-service.js`의 `deleteMemo()`
- ✅ `updateLocalAfterCreate()` 사용: `memo-service.js`의 `createMemo()`
- ✅ `updateLocalAfterUpdate()` 사용: `memo-service.js`의 `updateMemo()`
- ✅ `getLocalMemo()` 사용: `memo-service.js`의 `updateMemo()`, `deleteMemo()`
- ✅ `saveServerMemoAsLocal()` 사용: `memo-service.js`의 `getMemosByBook()`
- ✅ `handleServerError()` 사용: `memo-service.js`의 모든 메서드

**검증 방법**:
```bash
# grep으로 확인
grep -r "MemoOperationHelper" js/services/memo-service.js
```

---

## 4. 잠재적 문제점 및 해결 방안

### 4-1. createMemo에서 idempotency key 처리

**문제**: 온라인 상태에서 서버 우선 처리 시 idempotency key가 필요할 수 있음

**현재 상태**: 
- 온라인: 서버에서 직접 생성하므로 idempotency key 불필요
- 오프라인: `offlineMemoService.createMemo()`에서 idempotency key 생성

**해결 방안**: 
- 현재 구조 유지 (온라인에서는 idempotency key 불필요)
- 필요 시 추가 가능

### 4-2. updateLocalAfterCreate에서 기존 로컬 메모 처리

**문제**: 서버에서 생성된 메모가 이미 로컬에 존재할 수 있음 (오프라인에서 생성 후 동기화 대기 중)

**현재 상태**: 
- `updateLocalAfterCreate()`에서 `serverId`로 기존 로컬 메모 조회
- 존재하면 서버 ID 업데이트 및 동기화 상태 변경

**해결 방안**: 
- 현재 구조로 충분 (기존 로컬 메모 처리 포함)

### 4-3. 네트워크 상태 전환 중 요청 처리

**문제**: 네트워크 상태 전환 중 발생하는 요청이 올바르게 처리되지 않을 수 있음

**현재 상태**: 
- `NetworkStateManager`에서 `transitioning` 상태 관리
- 이벤트 기반 처리로 느슨한 결합

**해결 방안**: 
- 현재 구조로 충분
- 필요 시 큐 기반 처리 추가 가능

---

## 5. 테스트 체크리스트

### 5-1. 기능 테스트

- [ ] 시나리오 1: 온라인 상태에서 메모 생성
- [ ] 시나리오 2: 오프라인 상태에서 메모 생성
- [ ] 시나리오 3: 오프라인 → 온라인 전환 시 자동 동기화
- [ ] 시나리오 4: 온라인 상태에서 메모 수정
- [ ] 시나리오 5: 오프라인 상태에서 메모 수정
- [ ] 시나리오 6: 온라인 상태에서 메모 삭제
- [ ] 시나리오 7: 오프라인 상태에서 메모 삭제
- [ ] 시나리오 8: 서버에만 존재하는 메모 삭제 (온라인)
- [ ] 시나리오 9: 서버 오류 시 오프라인 모드로 전환
- [ ] 시나리오 10: 이벤트 기반 상태 전환 처리

### 5-2. 코드 검증

- [ ] Lint 오류 없음
- [ ] `MemoOperationHelper` 모든 메서드 사용 확인
- [ ] `NetworkStateManager` 이벤트 발행 확인
- [ ] `offlineMemoService` 이벤트 구독 확인

### 5-3. 통합 테스트

- [ ] 하이브리드 전략 A 정상 작동
- [ ] 공통 로직 추출로 코드 중복 제거
- [ ] 이벤트 기반 상태 전환 처리 정상 작동

---

## 6. 참고 문서

- `분산2_프로젝트/docs/troubleshooting/OFFLINE_ONLINE_HYBRID_STRATEGY_ANALYSIS.md`: 하이브리드 전략 분석
- `분산2_프로젝트/docs/troubleshooting/HYBRID_STRATEGY_IMPROVEMENT_PLAN.md`: 개선 방안 상세
- `분산2_프로젝트/docs/troubleshooting/HYBRID_STRATEGY_ARCHITECTURE_COMPLIANCE_ANALYSIS.md`: 아키텍처 준수 분석

