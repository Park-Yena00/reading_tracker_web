# 문서 활용 가이드

이 문서는 프론트엔드 프로젝트에서 백엔드 문서를 어떻게 활용하는지 설명합니다.

## 문서 구조

프론트엔드 프로젝트의 문서는 `docs/` 디렉토리에 있습니다:

```
docs/
├── API_REFERENCE.md          # API 명세서 (백엔드에서 제공)
├── BACKEND_INTEGRATION.md    # 백엔드 연동 가이드
├── PROJECT_DESIGN.md         # 프로젝트 설계 문서
└── DOCUMENT_USAGE.md         # 이 문서 (문서 활용 가이드)
```

## 각 문서의 역할과 활용 방법

### 1. API_REFERENCE.md

**역할**: 백엔드 API의 완전한 명세서

**내용**:
- 모든 API 엔드포인트 목록
- 요청/응답 형식
- 인증 방식
- 에러 코드

**활용 방법**:

#### 개발 중 참고
- API 호출 함수를 작성할 때 엔드포인트와 파라미터 확인
- 요청/응답 데이터 구조 확인
- 에러 처리 로직 작성 시 참고

#### 예시: API 함수 작성
```javascript
// docs/API_REFERENCE.md를 참고하여 작성
// 3.2 내 서재 조회 API 참고

async function getMyBooks(category = null, sortBy = 'TITLE') {
    const params = {};
    if (category) params.category = category;
    if (sortBy) params.sortBy = sortBy;
    
    try {
        const response = await window.apiClient.get('/user/books', params);
        // response는 이미 data 필드만 반환됨 (apiClient에서 처리)
        return response;
    } catch (error) {
        console.error('서재 조회 실패:', error);
        throw error;
    }
}
```

#### 위치
- `docs/API_REFERENCE.md`에 저장
- 백엔드 프로젝트의 `API_REFERENCE.md`와 동일한 내용
- 백엔드에서 업데이트되면 이 파일도 업데이트 필요

---

### 2. BACKEND_INTEGRATION.md

**역할**: 백엔드와 프론트엔드를 연동하기 위한 실용적인 가이드

**내용**:
- 환경 설정 방법
- CORS 설정
- 인증 처리
- API 클라이언트 사용법
- 테스트 및 디버깅

**활용 방법**:

#### 초기 설정 시
- 백엔드 서버 실행 확인
- API 서버 주소 설정 (`js/api/config.js`)
- CORS 설정 확인

#### 개발 중
- API 클라이언트 사용법 참고
- 인증 토큰 처리 방법 확인
- 에러 처리 패턴 참고

#### 예시: 환경 설정
```javascript
// BACKEND_INTEGRATION.md의 "환경 설정" 섹션 참고
// js/api/config.js 파일 수정
const API_BASE_URL = window.API_BASE_URL || 'http://localhost:8080';
```

---

### 3. PROJECT_DESIGN.md

**역할**: 프론트엔드 프로젝트의 전체 설계 문서

**내용**:
- 페이지 구성
- 컴포넌트 구조
- API 클라이언트 구조
- 개발 우선순위

**활용 방법**:

#### 프로젝트 시작 시
- 전체 페이지 구조 파악
- 개발 우선순위 확인
- 컴포넌트 구조 이해

#### 개발 중
- 다음에 구현할 페이지 확인
- 페이지별 필요한 API 확인
- 공통 컴포넌트 확인

#### 예시: 페이지 구현 계획
```
Phase 1 우선순위에 따라:
1. login.html 구현
   - PROJECT_DESIGN.md의 "1.1 로그인 페이지" 참고
   - API_REFERENCE.md의 "1.4 로그인" API 참고
```

---

### 4. ARCHITECTURE.md (프로젝트 루트)

**역할**: 프로젝트의 기술 스택과 아키텍처 개요

**내용**:
- 기술 스택
- 아키텍처 구조
- 데이터 흐름
- 보안 고려사항

**활용 방법**:

#### 프로젝트 이해
- 전체 시스템 구조 파악
- 기술 스택 확인
- 데이터 흐름 이해

#### 새로운 개발자 온보딩
- 프로젝트 개요 파악
- 기술 스택 학습
- 아키텍처 이해

---

## 문서 업데이트 프로세스

### 백엔드 API 변경 시

1. **API_REFERENCE.md 업데이트**
   - 백엔드 프로젝트의 `API_REFERENCE.md` 확인
   - 변경사항을 프론트엔드의 `docs/API_REFERENCE.md`에 반영

2. **관련 코드 업데이트**
   - 변경된 API에 해당하는 JavaScript 함수 수정
   - 관련 HTML 페이지 수정

3. **PROJECT_DESIGN.md 업데이트** (필요시)
   - 새로운 API가 추가되면 페이지 설계 업데이트

### 프론트엔드 설계 변경 시

1. **PROJECT_DESIGN.md 업데이트**
   - 페이지 구조 변경사항 반영
   - 컴포넌트 변경사항 반영

2. **ARCHITECTURE.md 업데이트** (필요시)
   - 기술 스택 변경
   - 아키텍처 구조 변경

---

## 개발 워크플로우

### 1. 새 페이지 구현 시

```
1. PROJECT_DESIGN.md 확인
   → 페이지 요구사항 파악
   → 필요한 API 확인

2. API_REFERENCE.md 확인
   → API 엔드포인트 상세 확인
   → 요청/응답 형식 확인

3. BACKEND_INTEGRATION.md 참고
   → API 클라이언트 사용법 확인
   → 인증 처리 방법 확인

4. 코드 구현
   → HTML 페이지 작성
   → JavaScript 함수 작성
   → API 호출 구현
```

### 2. API 호출 함수 작성 시

```
1. API_REFERENCE.md에서 해당 API 확인
   → 엔드포인트 경로
   → 요청 파라미터
   → 응답 형식

2. js/api/ 디렉토리에 함수 작성
   → 예: js/api/userBooks.js

3. BACKEND_INTEGRATION.md 참고
   → 에러 처리
   → 인증 토큰 처리
```

### 3. 문제 해결 시

```
1. BACKEND_INTEGRATION.md의 "테스트 및 디버깅" 섹션 확인
   → 일반적인 문제 해결 방법

2. API_REFERENCE.md의 "에러 코드" 섹션 확인
   → 에러 코드 의미 파악

3. 브라우저 개발자 도구 확인
   → Network 탭에서 요청/응답 확인
   → Console 탭에서 에러 확인
```

---

## 문서 검색 팁

### API 엔드포인트 찾기
- `API_REFERENCE.md`에서 섹션별로 정리되어 있음
- 예: 인증 관련 → "1. 인증 관련 API"
- 예: 서재 관리 → "3. 사용자 서재 관리 API"

### 페이지 구현 방법 찾기
- `PROJECT_DESIGN.md`에서 페이지별로 정리되어 있음
- 각 페이지에 필요한 API가 명시되어 있음

### 설정 방법 찾기
- `BACKEND_INTEGRATION.md`의 "환경 설정" 섹션
- `ARCHITECTURE.md`의 "주요 컴포넌트" 섹션

---

## 주의사항

1. **API_REFERENCE.md는 백엔드와 동기화 유지**
   - 백엔드 API가 변경되면 반드시 업데이트
   - 버전 정보 확인 (현재: v1.1)

2. **문서는 항상 최신 상태 유지**
   - 코드 변경 시 관련 문서도 업데이트
   - 다른 개발자와 공유하기 위해 중요

3. **문서를 참고하되, 실제 API 응답 확인**
   - Swagger UI 활용: `http://localhost:8080/swagger-ui/index.html`
   - 브라우저 개발자 도구로 실제 응답 확인

---

## 추가 리소스

- **Swagger UI**: 백엔드 서버 실행 후 `http://localhost:8080/swagger-ui/index.html`에서 API 테스트 가능
- **브라우저 개발자 도구**: Network 탭에서 실제 API 요청/응답 확인
- **백엔드 README.md**: 서버 실행 방법 및 환경 설정 참고

---

**마지막 업데이트**: 2024년 12월




