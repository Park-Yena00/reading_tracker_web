# 웹 UI 구현 계획서

## 개요

이 문서는 Reading Tracker 웹 프론트엔드 구현을 위한 단계별 계획을 정리합니다.

**참고 문서:**
- [웹 UI 아키텍처 문서](./features/WEB_UI_ARCHITECTURE.md) - 기술적 구현 가이드
- [웹 UI 디자인 문서](./features/WEB_UI_DESIGN.md) - UI/UX 디자인 명세
- [API 명세서](./API_REFERENCE.md) - 백엔드 API 엔드포인트 명세

## 구현 원칙

1. **아키텍처 문서 준수**: WEB_UI_ARCHITECTURE.md의 디렉토리 구조와 모듈 분리 원칙 준수
2. **디자인 문서 준수**: WEB_UI_DESIGN.md의 색상, 폰트, 컴포넌트 스타일 준수
3. **API 명세 준수**: API_REFERENCE.md의 요청/응답 형식 준수
4. **Event-Driven 패턴**: 상태 관리는 Event Bus를 통한 이벤트 기반 처리
5. **점진적 구현**: 단계별로 구현하고 테스트하며 진행

## 구현 단계

### 1단계: 프로젝트 인프라 및 기반 구조 구축

**목표**: 개발을 위한 기본 디렉토리 구조와 공통 유틸리티를 구축합니다.

#### 1.1 디렉토리 구조 생성
- [ ] `client/web/pages/` 디렉토리 생성
- [ ] `client/web/css/common/` 디렉토리 생성
- [ ] `client/web/css/components/` 디렉토리 생성
- [ ] `client/web/css/pages/` 디렉토리 생성
- [ ] `client/web/js/services/` 디렉토리 생성
- [ ] `client/web/js/views/common/` 디렉토리 생성
- [ ] `client/web/js/views/pages/` 디렉토리 생성
- [ ] `client/web/js/state/` 디렉토리 생성
- [ ] `client/web/js/utils/` 디렉토리 생성
- [ ] `client/web/js/constants/` 디렉토리 생성
- [ ] `client/web/assets/` 디렉토리 생성

#### 1.2 공통 CSS 변수 및 리셋
- [ ] `css/common/variables.css` - CSS 변수 정의 (색상, 폰트, 간격 등)
- [ ] `css/common/reset.css` - 브라우저 기본 스타일 리셋
- [ ] `css/common/layout.css` - 공통 레이아웃 스타일

#### 1.3 공통 JavaScript 유틸리티
- [ ] `js/utils/event-bus.js` - Event Bus 구현
- [ ] `js/utils/token-manager.js` - JWT 토큰 관리
- [ ] `js/utils/date-formatter.js` - 날짜/시간 포맷팅
- [ ] `js/utils/validators.js` - 입력 검증 함수
- [ ] `js/constants/events.js` - 이벤트 이름 상수 정의
- [ ] `js/constants/api-endpoints.js` - API 엔드포인트 상수 정의
- [ ] `js/constants/routes.js` - 라우트 경로 상수 정의

#### 1.4 상태 관리 클래스
- [ ] `js/state/auth-state.js` - 인증 상태 관리
- [ ] `js/state/app-state.js` - 애플리케이션 전역 상태 관리
- [ ] `js/state/book-state.js` - 도서 관련 상태 관리

#### 1.5 공통 API 클라이언트
- [ ] `js/services/api-client.js` - Fetch API 래퍼 (인증 토큰 자동 추가, 401 에러 처리)
- [ ] 기존 `js/api/client.js` 검토 및 통합 또는 대체

#### 1.6 공통 컴포넌트 CSS
- [ ] `css/components/button.css` - 버튼 컴포넌트 스타일
- [ ] `css/components/input.css` - 입력 필드 컴포넌트 스타일
- [ ] `css/components/card.css` - 카드 컴포넌트 스타일
- [ ] `css/components/modal.css` - 모달 컴포넌트 스타일
- [ ] `css/components/loading.css` - 로딩 스피너 스타일
- [ ] `css/components/badge.css` - 배지 컴포넌트 스타일

#### 1.7 공통 View 컴포넌트
- [ ] `js/views/common/header.js` - 헤더 컴포넌트 (인증 상태에 따라 메뉴 변경)
- [ ] `js/views/common/footer.js` - 푸터 컴포넌트
- [ ] `js/views/common/modal.js` - 모달 컴포넌트 (재사용 가능)
- [ ] `js/views/common/loading.js` - 로딩 스피너 컴포넌트

**예상 시간**: 1-2일

---

### 2단계: 인증 기능 구현

**목표**: 사용자 로그인, 회원가입 기능을 구현합니다.

#### 2.1 인증 API 서비스
- [ ] `js/services/auth-service.js` - 인증 관련 API 호출 함수
  - `login(loginData)` - 로그인
  - `register(registerData)` - 회원가입
  - `refreshToken(refreshToken)` - 토큰 갱신
  - `logout()` - 로그아웃 (선택사항)

#### 2.2 인증 헬퍼 함수
- [ ] `js/utils/auth-helper.js` - 인증 관련 헬퍼 함수
  - `isAuthenticated()` - 인증 상태 확인
  - `checkAuth()` - 보호된 페이지 접근 확인
  - `handleLogin(loginData)` - 로그인 처리
  - `handleLogout()` - 로그아웃 처리

#### 2.3 로그인 페이지
- [ ] `pages/login.html` - 로그인 페이지 HTML 구조
- [ ] `css/pages/login.css` - 로그인 페이지 스타일
- [ ] `js/views/pages/login-view.js` - 로그인 뷰 로직
  - 폼 제출 처리
  - 에러 메시지 표시
  - 로그인 성공 시 리다이렉트

#### 2.4 회원가입 페이지
- [ ] `pages/register.html` - 회원가입 페이지 HTML 구조
- [ ] `css/pages/register.css` - 회원가입 페이지 스타일
- [ ] `js/views/pages/register-view.js` - 회원가입 뷰 로직
  - 입력 검증 (실시간 또는 제출 시)
  - 중복 확인 (로그인 ID, 이메일) - API 연동
  - 필드별 에러 메시지 표시
  - 회원가입 성공 시 리다이렉트

**예상 시간**: 2-3일

---

### 3단계: 메인 페이지 및 공통 레이아웃

**목표**: 홈 페이지와 모든 페이지에서 사용할 공통 레이아웃을 구현합니다.

#### 3.1 홈 페이지
- [ ] `pages/home.html` 또는 `index.html` 수정
  - 헤더 포함
  - 메인 배너
  - 기능 소개 섹션
  - 푸터 포함
- [ ] `css/pages/home.css` - 홈 페이지 스타일

#### 3.2 공통 레이아웃 템플릿화
- [ ] 헤더 컴포넌트 인증 상태 연동
- [ ] 푸터 컴포넌트 통합
- [ ] 모든 페이지에서 공통 레이아웃 적용

**예상 시간**: 1일

---

### 4단계: 도서 검색 기능 구현

**목표**: 도서를 검색하고 결과를 표시하는 기능을 구현합니다.

#### 4.1 도서 API 서비스
- [ ] `js/services/book-service.js` - 도서 관련 API 호출 함수
  - `searchBooks(query, queryType, start, maxResults)` - 도서 검색
  - `getBookDetail(isbn)` - 도서 상세 정보 조회

#### 4.2 도서 검색 페이지
- [ ] `pages/book-search.html` - 도서 검색 페이지 HTML 구조
- [ ] `css/pages/book-search.css` - 검색 페이지 스타일
- [ ] `js/views/pages/book-search-view.js` - 검색 뷰 로직
  - 검색어 입력 및 검색 타입 선택
  - 검색 결과 표시 (도서 카드 리스트)
  - 페이지네이션 처리
  - 로딩 상태 표시

#### 4.3 도서 카드 컴포넌트
- [ ] 도서 카드 HTML 구조 및 스타일
- [ ] 도서 정보 표시 (제목, 저자, 출판사, 표지 이미지)
- [ ] "서재에 추가" 버튼 (인증 시만 표시)

#### 4.4 도서 상세 페이지
- [ ] `pages/book-detail.html` - 도서 상세 페이지 HTML 구조
- [ ] `css/pages/book-detail.css` - 상세 페이지 스타일
- [ ] `js/views/pages/book-detail-view.js` - 상세 페이지 뷰 로직
  - URL 파라미터에서 ISBN 추출
  - 도서 상세 정보 로드 및 표시
  - "서재에 추가" 버튼 (인증 시만 표시)

**예상 시간**: 2-3일

---

### 5단계: 서재 관리 기능 구현

**목표**: 사용자의 서재(읽는 중, 읽음, 읽고 싶음)를 관리하는 기능을 구현합니다.

#### 5.1 서재 API 서비스 확장
- [ ] `js/services/book-service.js`에 추가
  - `getBookshelf()` - 서재 조회
  - `addBookToShelf(bookData)` - 서재에 도서 추가
  - `updateBookStatus(userBookId, status)` - 도서 상태 변경
  - `removeBookFromShelf(userBookId)` - 서재에서 도서 삭제

#### 5.2 서재 페이지
- [ ] `pages/bookshelf.html` - 서재 페이지 HTML 구조
- [ ] `css/pages/bookshelf.css` - 서재 페이지 스타일
- [ ] `js/views/pages/bookshelf-view.js` - 서재 뷰 로직
  - 서재 목록 로드 및 표시
  - 필터링 (독서 상태별)
  - 정렬 (추가일순, 제목순, 저자순)
  - 도서 상태 변경 UI 및 처리
  - 도서 삭제 확인 모달 및 처리
  - 통계 정보 표시 (선택사항)

#### 5.3 서재 상태 관리
- [ ] `js/state/book-state.js` 구현
  - 서재 데이터 관리
  - 상태 변경 이벤트 발행

**예상 시간**: 2-3일

---

### 6단계: 사용자 프로필 기능 구현

**목표**: 사용자 프로필 조회 및 수정 기능을 구현합니다.

#### 6.1 사용자 API 서비스
- [ ] `js/services/user-service.js` - 사용자 관련 API 호출 함수
  - `getProfile()` - 프로필 조회
  - `updateProfile(profileData)` - 프로필 수정

#### 6.2 프로필 페이지
- [ ] `pages/profile.html` - 프로필 페이지 HTML 구조
- [ ] `css/pages/profile.css` - 프로필 페이지 스타일
- [ ] `js/views/pages/profile-view.js` - 프로필 뷰 로직
  - 프로필 정보 표시
  - 프로필 수정 폼
  - 수정 사항 저장
  - 로그아웃 버튼

**예상 시간**: 1-2일

---

### 7단계: 보호된 페이지 접근 제어

**목표**: 인증이 필요한 페이지에 대한 접근 제어를 구현합니다.

#### 7.1 페이지 접근 제어
- [ ] 각 보호된 페이지 (`bookshelf.html`, `profile.html`)에서 인증 확인
- [ ] 미인증 시 로그인 페이지로 리다이렉트
- [ ] 인증 상태 변경 시 자동 리다이렉트 처리

#### 7.2 토큰 갱신 자동 처리
- [ ] `api-client.js`에서 401 에러 시 자동 토큰 갱신
- [ ] 토큰 갱신 실패 시 자동 로그아웃 및 리다이렉트

**예상 시간**: 1일

---

### 8단계: 반응형 디자인 및 최적화

**목표**: 모바일, 태블릿, 데스크톱에서 모두 잘 작동하도록 최적화합니다.

#### 8.1 반응형 CSS
- [ ] 모바일 레이아웃 (320px ~ 768px)
- [ ] 태블릿 레이아웃 (769px ~ 1024px)
- [ ] 데스크톱 레이아웃 (1025px 이상)
- [ ] 햄버거 메뉴 구현 (모바일)

#### 8.2 성능 최적화
- [ ] 이미지 lazy loading 적용
- [ ] 불필요한 API 호출 최소화
- [ ] 코드 최적화 및 정리

**예상 시간**: 1-2일

---

### 9단계: 에러 처리 및 사용자 피드백 개선

**목표**: 에러 상황에 대한 적절한 피드백을 제공합니다.

#### 9.1 에러 처리 강화
- [ ] 네트워크 에러 처리
- [ ] API 에러 메시지 사용자 친화적 표시
- [ ] 필드별 에러 메시지 표시 (회원가입, 프로필 수정 등)

#### 9.2 사용자 피드백
- [ ] 토스트 메시지 또는 인라인 성공/에러 메시지
- [ ] 로딩 상태 명확한 표시
- [ ] 빈 상태 (Empty State) UI

**예상 시간**: 1일

---

### 10단계: 테스트 및 버그 수정

**목표**: 전체 기능을 테스트하고 발견된 버그를 수정합니다.

#### 10.1 기능 테스트
- [ ] 회원가입 플로우 테스트
- [ ] 로그인 플로우 테스트
- [ ] 도서 검색 및 서재 추가 테스트
- [ ] 서재 관리 (상태 변경, 삭제) 테스트
- [ ] 프로필 수정 테스트
- [ ] 로그아웃 테스트

#### 10.2 브라우저 호환성 테스트
- [ ] Chrome
- [ ] Firefox
- [ ] Safari
- [ ] Edge

#### 10.3 반응형 테스트
- [ ] 모바일 기기 테스트
- [ ] 태블릿 기기 테스트
- [ ] 데스크톱 테스트

**예상 시간**: 2-3일

---

## 구현 우선순위

### 높은 우선순위 (필수)
1. 1단계: 프로젝트 인프라 및 기반 구조 구축
2. 2단계: 인증 기능 구현
3. 3단계: 메인 페이지 및 공통 레이아웃
4. 4단계: 도서 검색 기능 구현
5. 7단계: 보호된 페이지 접근 제어

### 중간 우선순위 (중요)
6. 5단계: 서재 관리 기능 구현
7. 6단계: 사용자 프로필 기능 구현

### 낮은 우선순위 (개선)
8. 8단계: 반응형 디자인 및 최적화
9. 9단계: 에러 처리 및 사용자 피드백 개선
10. 10단계: 테스트 및 버그 수정

## 기술 스택 요약

- **HTML5**: 페이지 구조
- **CSS3**: 스타일링 (CSS 변수 사용)
- **JavaScript (ES6+)**: 순수 JavaScript, ES Modules
- **Fetch API**: HTTP 요청
- **localStorage**: 토큰 저장

## 파일 구조 최종 목표

```
client/web/
├── index.html
├── pages/
│   ├── home.html
│   ├── login.html
│   ├── register.html
│   ├── book-search.html
│   ├── book-detail.html
│   ├── bookshelf.html
│   └── profile.html
├── css/
│   ├── common/
│   │   ├── reset.css
│   │   ├── variables.css
│   │   └── layout.css
│   ├── components/
│   │   ├── button.css
│   │   ├── input.css
│   │   ├── card.css
│   │   ├── modal.css
│   │   ├── loading.css
│   │   └── badge.css
│   └── pages/
│       ├── home.css
│       ├── login.css
│       ├── register.css
│       ├── book-search.css
│       ├── book-detail.css
│       ├── bookshelf.css
│       └── profile.css
├── js/
│   ├── services/
│   │   ├── api-client.js
│   │   ├── auth-service.js
│   │   ├── book-service.js
│   │   └── user-service.js
│   ├── views/
│   │   ├── common/
│   │   │   ├── header.js
│   │   │   ├── footer.js
│   │   │   ├── modal.js
│   │   │   └── loading.js
│   │   └── pages/
│   │       ├── login-view.js
│   │       ├── register-view.js
│   │       ├── book-search-view.js
│   │       ├── book-detail-view.js
│   │       ├── bookshelf-view.js
│   │       └── profile-view.js
│   ├── state/
│   │   ├── auth-state.js
│   │   ├── app-state.js
│   │   └── book-state.js
│   ├── utils/
│   │   ├── event-bus.js
│   │   ├── token-manager.js
│   │   ├── date-formatter.js
│   │   ├── validators.js
│   │   └── auth-helper.js
│   ├── constants/
│   │   ├── events.js
│   │   ├── api-endpoints.js
│   │   └── routes.js
│   └── main.js
└── assets/
    ├── images/
    ├── icons/
    └── fonts/
```

## 테스트 시 백엔드 서버 필요 여부

### 서버가 필요한 경우

**API 통신이 포함된 기능 테스트 시 백엔드 서버(Spring Boot)가 실행되어 있어야 합니다:**

1. **인증 기능 테스트** (2단계)
   - 로그인, 회원가입 테스트
   - 토큰 저장 및 관리 테스트
   - **서버 필요**: ✅

2. **도서 검색 기능 테스트** (4단계)
   - 도서 검색 API 호출
   - 도서 상세 정보 조회
   - **서버 필요**: ✅

3. **서재 관리 기능 테스트** (5단계)
   - 서재 조회, 도서 추가/삭제
   - 도서 상태 변경
   - **서버 필요**: ✅

4. **프로필 기능 테스트** (6단계)
   - 프로필 조회 및 수정
   - **서버 필요**: ✅

5. **보호된 페이지 접근 제어 테스트** (7단계)
   - 인증 상태 확인
   - 토큰 갱신 테스트
   - **서버 필요**: ✅

### 서버가 불필요한 경우

**정적 UI/레이아웃 및 로직 구현 테스트:**

1. **CSS/레이아웃 테스트** (1단계, 3단계, 8단계)
   - 스타일 확인
   - 반응형 디자인 확인
   - **서버 불필요**: ❌

2. **JavaScript 로직 테스트**
   - 이벤트 처리 로직
   - 상태 관리 로직 (Mock 데이터 사용 가능)
   - **서버 불필요** (Mock 데이터로 가능): ⚠️

3. **컴포넌트 렌더링 테스트**
   - DOM 조작 확인
   - UI 컴포넌트 동작 확인
   - **서버 불필요**: ❌

### 서버 실행 방법

**백엔드 서버 실행 (분산2_프로젝트 디렉토리에서):**

```bash
# Spring Boot 실행
./mvnw spring-boot:run
# 또는
java -jar target/your-backend-app.jar
```

**서버가 실행되면:**
- `http://localhost:8080`에서 실행
- API 엔드포인트: `http://localhost:8080/api/v1`
- swagger 문서 : 'http://localhost:8080/swagger-ui/index.html'

**프론트엔드 개발 서버 실행 (현재 프로젝트 디렉토리에서):**

```bash
# 방법 1: npm 스크립트
npm run dev
# 또는
npm start

# 방법 2: Python HTTP 서버
python -m http.server 8000

# 방법 3: Node.js http-server
npx http-server -p 8000
```

**참고:**
- 프론트엔드는 `localhost:8000` (또는 다른 포트)에서 실행
- 백엔드는 `localhost:8080`에서 실행
- 두 서버가 **동시에 실행**되어 있어야 API 통신이 가능합니다

### Mock 데이터 사용 (선택사항)

서버가 없어도 개발할 수 있도록 Mock 데이터를 사용할 수 있습니다:

```javascript
// 예시: Mock 데이터 사용
if (process.env.NODE_ENV === 'development' && !API_BASE_URL) {
    // Mock 데이터 반환
    return mockBooks;
}
```

하지만 **실제 API 통신 테스트**를 위해서는 백엔드 서버가 필요합니다.

## 주의사항

1. **API 응답 형식**: 모든 API는 `ApiResponse<T>` 형식으로 응답하므로, `response.data`를 사용해야 합니다.
2. **인증 토큰**: 모든 인증이 필요한 API 요청에 `Authorization: Bearer {token}` 헤더 포함 필요.
3. **CORS**: 개발 환경에서는 백엔드 서버의 CORS 설정이 `localhost:8000`을 허용해야 합니다.
4. **에러 처리**: 모든 API 호출에서 에러 처리를 구현하고, 사용자에게 명확한 메시지를 제공해야 합니다.
5. **Event-Driven**: 상태 변경은 반드시 Event Bus를 통해 이벤트로 발행하고, 필요한 컴포넌트에서 구독하도록 구현합니다.
6. **서버 실행**: API 통신이 필요한 기능 테스트 시에는 백엔드 서버가 실행되어 있어야 합니다.

## 다음 단계

이 계획서가 승인되면, **1단계부터 순차적으로 구현**을 시작합니다.

각 단계 완료 후에는 해당 기능이 정상 작동하는지 테스트하고, 다음 단계로 진행합니다.

---

**문서 작성일**: 2024년
**버전**: 1.0

