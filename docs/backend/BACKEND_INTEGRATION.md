# 백엔드 연동 가이드

이 문서는 분산2_프로젝트(백엔드)와 프론트엔드를 연동하기 위한 상세 가이드를 제공합니다.

## 목차

1. [사전 준비](#사전-준비)
2. [환경 설정](#환경-설정)
3. [API 클라이언트 설정](#api-클라이언트-설정)
4. [CORS 설정](#cors-설정)
5. [인증 처리](#인증-처리)
6. [API 엔드포인트 구현](#api-엔드포인트-구현)
7. [테스트 및 디버깅](#테스트-및-디버깅)

## 사전 준비

### 1. 백엔드 서버 확인

백엔드 프로젝트가 정상적으로 실행되는지 확인하세요:

```bash
# 백엔드 서버 실행 (백엔드 프로젝트 디렉토리에서)
# Spring Boot의 경우
./mvnw spring-boot:run
# 또는
java -jar target/your-backend-app.jar
```

백엔드 서버가 `http://localhost:8080`에서 실행되는지 확인합니다.

### 2. 백엔드 API 문서 확인

백엔드에서 제공하는 API 엔드포인트 목록과 스펙을 확인하세요:
- REST API 엔드포인트 목록
- 요청/응답 형식
- 인증 방식 (JWT, Session 등)
- 에러 응답 형식

## 환경 설정

### 1. API 서버 주소 설정

`js/api/config.js` 파일에서 백엔드 서버 주소를 설정합니다:

```javascript
const API_BASE_URL = window.API_BASE_URL || 'http://localhost:8080';
```

또는 HTML 파일에서 전역 변수로 설정할 수 있습니다:

```html
<script>
    // API 서버 주소 설정 (선택사항)
    window.API_BASE_URL = 'http://localhost:8080';
</script>
<script src="js/api/config.js"></script>
<script src="js/api/client.js"></script>
```

### 2. 개발/프로덕션 환경별 설정

환경별로 다른 백엔드 주소를 사용하는 경우, HTML 파일에서 조건부로 설정:

```javascript
// 개발 환경
if (window.location.hostname === 'localhost') {
    window.API_BASE_URL = 'http://localhost:8080';
} else {
    // 프로덕션 환경
    window.API_BASE_URL = 'https://api.yourdomain.com';
}
```

## API 클라이언트 설정

### 현재 설정 확인

`js/api/config.js` 파일에서 API 기본 URL이 올바르게 설정되어 있는지 확인합니다.

### API 클라이언트 사용

`js/api/client.js`는 Fetch API를 사용하여 HTTP 요청을 처리합니다.

**중요**: HTML 파일에서 스크립트를 다음 순서로 로드해야 합니다:

```html
<!-- 1. API 설정 로드 -->
<script src="js/api/config.js"></script>
<!-- 2. API 클라이언트 로드 -->
<script src="js/api/client.js"></script>
<!-- 3. 메인 JavaScript 로드 -->
<script src="js/main.js"></script>
```

## CORS 설정

### 백엔드에서 CORS 허용

백엔드 서버에서 프론트엔드 도메인을 허용하도록 설정해야 합니다.

#### Spring Boot 예시:

```java
@Configuration
public class CorsConfig {
    @Bean
    public WebMvcConfigurer corsConfigurer() {
        return new WebMvcConfigurer() {
            @Override
            public void addCorsMappings(CorsRegistry registry) {
                registry.addMapping("/api/**")
                        .allowedOrigins("http://localhost:5500", "file://")  // 프론트엔드 주소
                        .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
                        .allowedHeaders("*")
                        .allowCredentials(true);
            }
        };
    }
}
```

또는 컨트롤러 레벨에서:

```java
@CrossOrigin(origins = {"http://localhost:5500", "file://"})
@RestController
@RequestMapping("/api")
public class YourController {
    // ...
}
```

**참고**: `file://` 프로토콜을 허용하면 HTML 파일을 직접 열어도 API를 호출할 수 있습니다 (개발 환경).

## 인증 처리

### JWT 토큰 기반 인증

현재 `js/api/client.js`에 JWT 토큰 처리가 포함되어 있습니다:

1. **로그인 시 토큰 저장**:
```javascript
// 로그인 API 호출
try {
    const response = await window.apiClient.post('/api/auth/login', { 
        username: 'user', 
        password: 'pass' 
    });
    // 응답에서 토큰 추출 및 저장
    localStorage.setItem('token', response.token);
    // 또는 response.data.token (백엔드 응답 구조에 따라)
} catch (error) {
    console.error('로그인 실패:', error);
}
```

2. **자동 토큰 추가**:
`apiClient`가 자동으로 `localStorage`에서 토큰을 가져와 Authorization 헤더에 추가합니다.

3. **토큰 만료 처리**:
401 응답 시 자동으로 로그인 페이지로 리다이렉트됩니다.

### 세션 기반 인증

세션을 사용하는 경우, `js/api/client.js`의 `request` 함수를 수정해야 합니다:

```javascript
async function request(url, options = {}) {
    const fullUrl = url.startsWith('http') ? url : `${API_BASE_URL}${url}`;
    
    const config = {
        ...options,
        credentials: 'include',  // 세션 쿠키 전송
        headers: {
            ...getHeaders(),
            ...options.headers,
        },
    };
    
    // ... 나머지 코드
}
```

## API 엔드포인트 구현

### 1. API 서비스 파일 생성

각 도메인별로 API 서비스 파일을 생성합니다:

```javascript
// js/api/readingRecord.js

/**
 * 독서 기록 목록 조회
 */
async function getReadingRecords(params = {}) {
    try {
        const records = await window.apiClient.get('/api/reading-records', params);
        return records;
    } catch (error) {
        console.error('독서 기록 조회 실패:', error);
        throw error;
    }
}

/**
 * 독서 기록 상세 조회
 */
async function getReadingRecord(id) {
    try {
        const record = await window.apiClient.get(`/api/reading-records/${id}`);
        return record;
    } catch (error) {
        console.error('독서 기록 상세 조회 실패:', error);
        throw error;
    }
}

/**
 * 독서 기록 생성
 */
async function createReadingRecord(data) {
    try {
        const result = await window.apiClient.post('/api/reading-records', data);
        return result;
    } catch (error) {
        console.error('독서 기록 생성 실패:', error);
        throw error;
    }
}

/**
 * 독서 기록 수정
 */
async function updateReadingRecord(id, data) {
    try {
        const result = await window.apiClient.put(`/api/reading-records/${id}`, data);
        return result;
    } catch (error) {
        console.error('독서 기록 수정 실패:', error);
        throw error;
    }
}

/**
 * 독서 기록 삭제
 */
async function deleteReadingRecord(id) {
    try {
        const result = await window.apiClient.delete(`/api/reading-records/${id}`);
        return result;
    } catch (error) {
        console.error('독서 기록 삭제 실패:', error);
        throw error;
    }
}
```

HTML 파일에서 로드:

```html
<script src="js/api/config.js"></script>
<script src="js/api/client.js"></script>
<script src="js/api/readingRecord.js"></script>
```

### 2. HTML/JavaScript에서 사용

```html
<!DOCTYPE html>
<html>
<head>
    <title>독서 기록 목록</title>
</head>
<body>
    <div id="reading-records"></div>
    
    <script src="js/api/config.js"></script>
    <script src="js/api/client.js"></script>
    <script src="js/api/readingRecord.js"></script>
    <script>
        // DOM이 로드된 후 실행
        document.addEventListener('DOMContentLoaded', async function() {
            try {
                const records = await getReadingRecords();
                const container = document.getElementById('reading-records');
                
                if (records && records.length > 0) {
                    records.forEach(record => {
                        const div = document.createElement('div');
                        div.textContent = record.title || record.name;
                        container.appendChild(div);
                    });
                } else {
                    container.textContent = '독서 기록이 없습니다.';
                }
            } catch (error) {
                console.error('데이터 로드 실패:', error);
                document.getElementById('reading-records').textContent = 
                    '데이터를 불러오는 중 오류가 발생했습니다.';
            }
        });
    </script>
</body>
</html>
```

## 테스트 및 디버깅

### 1. 개발 서버 실행

#### 방법 1: npm 스크립트 사용

```bash
npm run dev
```

개발 서버는 `http://localhost:5500`에서 실행됩니다.

#### 방법 2: 직접 파일 열기

브라우저에서 `index.html` 파일을 직접 열어도 됩니다.

#### 방법 3: Python HTTP 서버

```bash
python -m http.server 5500
```

### 2. 브라우저 개발자 도구 활용

- **Network 탭**: API 요청/응답 확인
- **Console 탭**: 에러 메시지 확인
- **Application 탭**: localStorage의 토큰 확인

### 3. 일반적인 문제 해결

#### CORS 에러
- 백엔드 CORS 설정 확인
- 프론트엔드 서버 주소가 백엔드 CORS 허용 목록에 포함되어 있는지 확인
- `file://` 프로토콜 사용 시 백엔드에서 `file://` 허용 필요

#### 401 Unauthorized
- 토큰이 올바르게 저장되었는지 확인 (localStorage)
- 토큰 만료 여부 확인
- 백엔드 인증 로직 확인
- Authorization 헤더 형식 확인 (`Bearer {token}`)

#### 404 Not Found
- API 엔드포인트 URL 확인
- 백엔드 라우팅 설정 확인
- API_BASE_URL이 올바른지 확인

#### 네트워크 에러
- 백엔드 서버가 실행 중인지 확인
- 방화벽 설정 확인
- 포트 번호 확인 (기본: 8080)

#### API 클라이언트가 정의되지 않음
- 스크립트 로드 순서 확인 (config.js → client.js → 사용)
- 브라우저 콘솔에서 스크립트 로드 오류 확인

### 4. API 테스트 도구 사용

Postman이나 Insomnia를 사용하여 백엔드 API를 직접 테스트하는 것을 권장합니다.

## 다음 단계

1. 백엔드 API 문서를 기반으로 필요한 API 서비스 함수 구현
2. 각 HTML 페이지에서 API 호출 구현
3. 에러 처리 및 로딩 상태 관리
4. 사용자 인증 플로우 구현
5. 테스트 작성

## 참고 자료

- [Fetch API 문서](https://developer.mozilla.org/ko/docs/Web/API/Fetch_API)
- [Spring Boot CORS 설정](https://spring.io/guides/gs/rest-service-cors/)
- [Spring MVC 문서](https://docs.spring.io/spring-framework/reference/web/webmvc.html)
