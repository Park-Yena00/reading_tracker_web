# 추가 구현 사항

이 문서는 프로젝트에 추가로 구현할 기능들을 정리하는 문서입니다.

## 작성 규칙

- 각 항목은 명확하고 구체적으로 작성합니다.
- 우선순위가 있는 경우 표시합니다.
- 구현 완료된 항목은 체크박스로 표시합니다.
- 관련 이슈나 참고사항이 있으면 함께 기록합니다.

---

## 구현 예정 기능

### 우선순위: 높음

- [ ] **내 서재 화면 UI 개편: 카테고리 책갈피 + 도서 목록 (상하 레이아웃)**

  #### 개요
  내 서재 화면(`currentView === 'library'`)의 레이아웃을 인덱스 노트와 유사한 구조로 변경합니다. 카테고리 책갈피를 선택하면 해당 카테고리로 값이 지정된 책들이 도서 카드 목록 형태로 출력됩니다.

  #### 1. 레이아웃 변경 사항

  | 영역 | 설명 | 배치 | 비고 |
  |------|------|------|------|
  | 카테고리 책갈피 (`#categorySidebar`) | 사용자가 저장한 도서에 사용된 모든 유효 카테고리의 목록 (인덱스 역할) | 화면 상단 (전체 너비) | 뷰 진입 시 한 번 로드. '전체' 옵션 없음 |
  | 도서 목록 (`#libraryBookList`) | 현재 선택된 카테고리에 해당하는 도서 카드 목록 | 카테고리 책갈피 아래 (전체 너비) | 스크롤 가능. 카테고리 선택 시 해당 카테고리의 책들만 표시 |

  #### 2. 카테고리 책갈피 컴포넌트 (`#categorySidebar`)

  **카테고리 목록 규칙:**
  - 사용자의 서재에 실제로 사용된 카테고리만 표시
  - 카테고리 종류: `ToRead`(읽을 예정), `Reading`(읽는 중), `AlmostFinished`(거의 다 읽음), `Finished`(완독)
  - **'전체' 옵션은 제공하지 않음** (인덱스 노트와 유사한 구조)
  - 카테고리 목록은 `GET /api/v1/user/books` 응답의 `books` 배열에서 `category` 필드를 추출하여 중복 제거

  | 컴포넌트 | 기능 명세 | API 연동 및 데이터 처리 |
  |----------|-----------|------------------------|
  | 카테고리 목록 | 사용자의 **서재에 사용된** 실제 카테고리만 목록 형태로 표시. 카테고리: `ToRead`(읽을 예정), `Reading`(읽는 중), `AlmostFinished`(거의 다 읽음), `Finished`(완독). **'전체' 옵션은 제공하지 않음** | **API 호출:** `GET /api/v1/user/books`로 전체 조회 후 응답의 `books` 배열에서 사용된 `category` 값들을 추출하여 중복 제거. 별도 카테고리 목록 API는 없음 |
  | 선택 상태 표시 | 현재 활성화된 카테고리는 시각적으로 강조 (예: 배경색, 굵은 글씨) | - |
  | 책갈피 액션 | 특정 카테고리 클릭 시 `handleCategorySelect(categoryName)` 호출. 선택된 카테고리의 책들만 도서 카드 목록에 표시됨 | - |

  #### 3. 도서 목록 컨테이너 (`#libraryBookList`)

  | 컴포넌트 | 기능 명세 | API 연동 및 데이터 처리 |
  |----------|-----------|------------------------|
  | 데이터 로딩 | `handleCategorySelect()` 호출 시, 해당 카테고리에 해당하는 도서만 필터링하여 로드. 선택된 카테고리의 책들만 도서 카드 목록으로 출력됨 | **API 호출:** `GET /api/v1/user/books?category={categoryName}` - `category` 파라미터로 필터링. 카테고리 값: `ToRead`, `Reading`, `AlmostFinished`, `Finished` |
  | 도서 카드 | 도서 표지 이미지, 도서 이름, 저자명을 표시. 도서 카드 목록 형태로 출력 | - |
  | 스크롤 | 도서 카드 목록은 스크롤 가능 | - |
  | 카드 액션 | 카드 클릭 시 `handleCardClick(userBookId, 'library')` 호출 | - |

  #### 4. 핵심 구현 로직 (JS) 변경 사항

  | 로직 | 기존 (정렬/필터 미정) | 업데이트된 로직 (필터링) |
  |------|----------------------|------------------------|
  | `loadBookshelf()` (기존 메서드 수정) | 서재 목록 전체를 로드하고 기본 상태로 렌더링 | 1. **카테고리 목록 추출**: `GET /api/v1/user/books`로 전체 조회 후 응답의 `books` 배열에서 사용된 `category` 값들을 추출하여 중복 제거. 2. 상단 `#categorySidebar` 렌더링. 3. **목록의 첫 번째 카테고리를 기본값으로 선택**하고 `loadBooksByCategory()` 호출. |
  | `handleCategorySelect(category)` (새로 구현) | - | 1. 선택된 카테고리를 활성화 상태로 설정. 2. **`loadBooksByCategory(category)`** 호출. |
  | `loadBooksByCategory(category)` (새로 구현) | - | 1. `bookService.getBookshelf({ category })` 호출 (`GET /api/v1/user/books?category={category}`). 2. `#libraryBookList` 영역에 선택된 카테고리의 도서 카드 목록으로 렌더링. 3. 스크롤 가능한 영역으로 구성 |

  #### 구현 필요 파일
  - `html/bookshelf.html` - 레이아웃 구조 변경 (상하 레이아웃: `#categorySidebar`, `#libraryBookList`)
  - `css/pages/bookshelf.css` - 상하 레이아웃 스타일 추가 (카테고리 책갈피, 도서 목록 스크롤)
  - `js/views/pages/bookshelf-view.js` - 카테고리 필터링 로직 구현 (`loadBookshelf()` 수정, `handleCategorySelect()`, `loadBooksByCategory()` 추가)
  - `js/services/book-service.js` - 기존 `getBookshelf()` 메서드 활용 (수정 불필요)

  #### 실제 API 엔드포인트 (백엔드)
  - `GET /api/v1/user/books` - 내 서재 전체 조회 (카테고리 목록 추출용)
  - `GET /api/v1/user/books?category={categoryName}` - 카테고리별 도서 목록 조회
    - `category` 값: `ToRead`, `Reading`, `AlmostFinished`, `Finished`
    - 응답 형식: `MyShelfResponse { totalCount, books[] }`

  #### 카테고리 값 매핑
  - `ToRead` → "읽을 예정"
  - `Reading` → "읽는 중"
  - `AlmostFinished` → "거의 다 읽음"
  - `Finished` → "완독"

- [ ] **도서 상세 화면: 내 서재에 저장하기 모달 기능**

  #### 개요
  도서 상세 화면(`book-detail.html`)에서 "내 서재에 저장하기" 버튼 클릭 시 모달이 표시되고, 사용자가 카테고리를 선택하고 각 카테고리별 필수 정보를 입력한 후 서재에 추가할 수 있습니다.

  #### 1. 모달 동작 흐름

  1. **버튼 클릭**: 도서 상세 화면의 "내 서재에 저장하기" 버튼 클릭
  2. **모달 표시**: 카테고리 선택 및 입력 폼이 포함된 모달 표시
  3. **카테고리 선택**: 사용자가 카테고리 선택 (`ToRead`, `Reading`, `AlmostFinished`, `Finished`)
  4. **동적 필드 표시**: 선택한 카테고리에 따라 필수 입력 필드가 동적으로 표시됨
  5. **입력 검증**: 각 필드에 대한 클라이언트 측 검증 수행
  6. **API 호출**: 검증 통과 시 `POST /api/v1/user/books` 호출하여 서재에 추가
  7. **모달 닫기**: 성공 시 모달 닫기 및 성공 메시지 표시

  #### 2. 카테고리별 필수 입력 필드

  | 카테고리 | 필수 필드 | 선택 필드 | 검증 규칙 |
  |----------|----------|----------|----------|
  | `ToRead` (읽을 예정) | 없음 | `expectation` (기대평) | `expectation`: 최대 500자 |
  | `Reading` (읽는 중) | `readingStartDate` (독서 시작일)<br>`readingProgress` (현재 읽은 페이지 수) | `purchaseType` (구매/대여 여부) | `readingProgress`: 0 이상, 전체 페이지 수 이하 |
  | `AlmostFinished` (거의 다 읽음) | `readingStartDate` (독서 시작일)<br>`readingProgress` (현재 읽은 페이지 수) | 없음 | `readingProgress`: 0 이상, 전체 페이지 수 이하 |
  | `Finished` (완독) | `readingStartDate` (독서 시작일)<br>`readingFinishedDate` (독서 종료일)<br>`rating` (평점) | `review` (후기) | `readingFinishedDate`: 독서 시작일 이후<br>`rating`: 1~5 사이 정수<br>`readingProgress`: 자동으로 전체 페이지 수로 설정 (또는 수동 입력) |

  #### 3. 모달 UI 구성 요소

  | 컴포넌트 | 설명 | 구현 방법 |
  |----------|------|-----------|
  | 카테고리 선택 | 라디오 버튼 또는 드롭다운으로 카테고리 선택 | `<select>` 또는 라디오 버튼 그룹 |
  | 동적 입력 필드 영역 | 선택한 카테고리에 따라 필수 필드가 동적으로 표시/숨김 | JavaScript로 `display: none/block` 토글 |
  | 날짜 입력 | `readingStartDate`, `readingFinishedDate` 입력 | `<input type="date">` |
  | 숫자 입력 | `readingProgress`, `rating` 입력 | `<input type="number">` (min, max 속성 설정) |
  | 텍스트 입력 | `expectation`, `review` 입력 | `<textarea>` (최대 길이 제한) |
  | 구매 유형 선택 | `purchaseType` 선택 (Reading 카테고리만) | `<select>` (PURCHASED, BORROWED, GIFTED, LIBRARY) |
  | 제출 버튼 | 폼 제출 및 API 호출 | 검증 통과 시 `bookService.addBookToShelf()` 호출 |
  | 취소 버튼 | 모달 닫기 | 모달 닫기 및 입력값 초기화 |

  #### 4. 핵심 구현 로직 (JS)

  | 로직 | 기능 명세 | 구현 방법 |
  |------|-----------|-----------|
  | `handleAddToShelf()` (수정) | "내 서재에 저장하기" 버튼 클릭 시 모달 표시 | 기존 API 호출 로직 제거, 모달 표시 로직 추가 |
  | `showAddToShelfModal()` (새로 구현) | 모달 표시 및 초기화 | 모달 DOM 요소 표시, 카테고리 기본값 설정 (`ToRead`) |
  | `handleCategoryChange(category)` (새로 구현) | 카테고리 선택 변경 시 동적 필드 표시/숨김 | 선택한 카테고리에 따라 필수 필드 영역 토글 |
  | `validateForm(category, formData)` (새로 구현) | 폼 입력값 검증 | 카테고리별 필수 필드 및 검증 규칙 확인 |
  | `submitAddToShelfForm(formData)` (새로 구현) | 폼 제출 및 API 호출 | 검증 통과 시 `bookService.addBookToShelf()` 호출 |

  #### 5. API 요청 형식

  **엔드포인트**: `POST /api/v1/user/books`

  **요청 본문** (`BookAdditionRequest`):
  ```json
  {
    "isbn": "9788937461234",
    "title": "책 제목",
    "author": "저자명",
    "publisher": "출판사명",
    "pubDate": "2024-01-01",
    "description": "책 설명",
    "coverUrl": "https://...",
    "totalPages": 300,
    "mainGenre": "소설",
    "category": "ToRead",
    "expectation": "이 책에 대한 기대감",
    "readingStartDate": "2024-01-15",
    "readingProgress": 50,
    "readingFinishedDate": "2024-01-20",
    "rating": 5,
    "review": "후기 내용",
    "purchaseType": "PURCHASED"
  }
  ```

  **응답** (`BookAdditionResponse`):
  ```json
  {
    "ok": true,
    "data": {
      "userBookId": 1,
      "isbn": "9788937461234",
      "title": "책 제목",
      "category": "ToRead",
      "addedAt": "2024-01-15T10:30:00"
    },
    "error": null
  }
  ```

  #### 6. 구현 필요 파일

  - `html/book-detail.html` - 모달 HTML 구조 추가 (`#add-to-shelf-modal`)
  - `css/pages/book-detail.css` - 모달 스타일 추가
  - `js/views/pages/book-detail-view.js` - 모달 로직 구현 (`handleAddToShelf()` 수정, `showAddToShelfModal()`, `handleCategoryChange()`, `validateForm()`, `submitAddToShelfForm()` 추가)
  - `js/services/book-service.js` - 기존 `addBookToShelf()` 메서드 활용 (수정 불필요)

  #### 7. 검증 규칙 상세

  - **독서 시작일** (`readingStartDate`): `YYYY-MM-DD` 형식, 필수 (Reading, AlmostFinished, Finished)
  - **독서 종료일** (`readingFinishedDate`): `YYYY-MM-DD` 형식, 필수 (Finished), 독서 시작일 이후여야 함
  - **현재 읽은 페이지 수** (`readingProgress`): 정수, 0 이상, 전체 페이지 수 이하 (Reading, AlmostFinished)
  - **평점** (`rating`): 정수, 1~5 사이 (Finished)
  - **기대평** (`expectation`): 문자열, 최대 500자 (ToRead, 선택사항)
  - **후기** (`review`): 문자열, 제한 없음 (Finished, 선택사항)
  - **구매 유형** (`purchaseType`): `PURCHASED`, `BORROWED`, `GIFTED`, `LIBRARY` 중 하나 (Reading, 선택사항)

- [ ] **오늘의 흐름 화면 구현**

  #### 개요
  독서 기록 사이트의 핵심 기능인 '오늘의 흐름' 화면을 구현합니다. 바인더 노트 형식의 UI로 메모를 작성하고 관리할 수 있으며, 세션/책별/태그별 그룹화를 지원합니다. 조건: `currentView === 'flow'` 일 때 메인 콘텐츠 영역에 노출 (인증 필수).

  #### 1. UI 디자인: 바인더 노트 형식 (Binder Note Style)

  | 영역 | 설명 | 배치 | UX 특징 |
  |------|------|------|---------|
  | 전체 배경 | 노트 및 책갈피 형태의 디자인 요소 적용 | - | 마치 실제 바인더 노트를 펼친 듯한 경험 제공 |
  | 레이아웃 | 좌측 필터/네비게이션 패널과 우측 메모 콘텐츠 영역의 2컬럼 레이아웃 | - | 좌측에서 흐름 파악, 우측에서 내용 확인/작성 |

  #### 2. 좌측 네비게이션/필터 패널 (`#flowSidebar`)

  | 컴포넌트 | 기능 명세 | 데이터 연동 및 로직 |
  |----------|-----------|---------------------|
  | 날짜 선택 헤더 | 현재 메모 중인 날짜를 표시. 캘린더 이모티콘(📅) 배치 | 기본값: 오늘 날짜 |
  | 캘린더 모달 (`#calendarModal`) | 캘린더 이모티콘(📅) 클릭 시 실제 시간을 반영한 해당 년/월의 한달 캘린더 표시. 메모가 작성된 날짜에는 검정색 동그라미 표시. 동그라미 표시가 된 날짜 선택 시 해당 날짜의 메모 표시 (`loadMemoFlow(date, ...)` 호출). 동그라미 표시가 없는 날짜 선택 시 "해당 날짜에 작성된 메모가 없습니다." 안내 문구 출력 | **메모 작성 날짜 목록 API:** 백엔드에 새로운 API 추가 필요: `GET /api/v1/memos/dates?year={year}&month={month}` - 해당 년/월에 메모가 작성된 날짜 목록 반환 (예: `["2024-01-15", "2024-01-20", ...]`) |
  | 그룹화 선택 (`#groupingToggle`) | 사용자가 3가지 그룹화 방식 중 선택 가능:<br>1. **세션 그룹화 (기본값):** 독서 세션 순서. 시간 흐름에 따라 사용자가 실제로 책을 전환한 순서대로 세션 그룹 생성. 책이 전환되는 시점이 새로운 세션의 시작점이 됨. 각 세션 그룹 내부에서 태그 그룹화(선택 시) 가능 - 선택된 태그 대분류(유형/주제)의 대표 태그(1개)를 기준으로 하위 그룹화. 태그가 없는 메모는 "기타" 그룹으로 포함되며, 세션 내부에서 시간 순으로 표시<br>2. **책별 그룹화:** 도서 제목별 그룹화. 책 그룹의 배치 순서는 "해당 날짜에 첫 메모가 작성된 시간"을 기준으로 결정. 각 책 그룹 내부에서 세션 구분 없이 작성된 시간 순으로 정렬<br>3. **태그별 그룹화:** 태그 대분류(유형/주제)별 그룹화. 기본적으로 태그 대분류 중 1순위인 **TYPE(유형)**에 속하는 태그별로 그룹화. UI에서 스위치나 칩스 등의 컴포넌트를 통해 **TOPIC(주제)** 대분류로 선택하여 전환 가능. 각 태그 그룹 내부에서 출처인 책에 따라 다시 묶음. 각 책별 하위 그룹 내부에서 메모 작성 시간 순으로 정렬. "기타(태그 없음)" 그룹은 항상 맨 마지막에 표시 | `loadMemoFlow(..., grouping)` 파라미터로 선택값 전달. `sortBy` 값: `SESSION`, `BOOK`, `TAG`. SESSION 모드의 2차 태그 그룹화 및 TAG 모드에서 `tagCategory` 파라미터로 태그 대분류 전달 |
  | 태그 대분류 선택 (`#tagCategoryToggle`) | SESSION 모드의 2차 태그 그룹화 및 TAG 모드에서 사용. 태그 대분류(유형/주제) 중 하나를 선택할 수 있는 UI 제공. 선택된 대분류가 대표 태그 결정 시 1순위가 됨. 기본값: `TYPE`(유형) | `tagCategory` 파라미터로 백엔드에 전달. `TYPE` 또는 `TOPIC` |

  #### 3. 메인 콘텐츠 영역: 메모 디스플레이 및 입력

  **중요: 모든 메모 관련 화면(작성/확인/수정/삭제)은 실제 바인더 노트 형식으로 구현되어야 합니다.**

  | 컴포넌트 | 기능 명세 | 데이터 연동 및 로직 |
  |----------|-----------|---------------------|
  | 메모 디스플레이 (`#memoList`) | **바인더 노트 형식으로 구현:** 각 메모는 실제 노트 페이지처럼 표시되어야 함 (노트 배경, 줄무늬 패턴, 페이지 느낌 등). **메모 배치 로직:** 한 페이지는 중앙의 긴 가로선(세로선)을 기준으로 좌측 섹션과 우측 섹션으로 나뉨. 메모는 좌측 섹션 상단에서 시작하여 상 → 하로 채워지며, 좌측이 가득 차면 자동으로 우측 섹션 상단으로 넘어가 이어서 채워짐. 메모 내용의 실제 용량(길이)에 따라 화면에 출력되는 메모의 개수와 높이가 동적으로 결정됨. **정렬 기준:** 그룹화 내에서 항상 시간 순 (`memoStartTime`)으로 나열. **자정 경과 로직:** 실제 시간을 반영하여 날짜가 바뀌면 (자정이 지나면) 자동으로 해당 날짜의 메모만 조회하고 완전히 새로운 페이지를 표시. 이전 날짜의 메모는 저장된 상태로 유지되며, 새로운 날짜의 빈 페이지 표시. 각 날짜는 완전히 독립적인 "바인더 노트"로 취급됨. **페이지 전환 UX:** 수평 슬라이딩(Horizontal Sliding) 방식을 권장. 사용자가 다음 페이지로 이동할 때, 현재 페이지가 왼쪽으로 사라지고 새 페이지가 오른쪽에서 들어오는 부드러운 슬라이드 모션 사용. 각 메모 카드에는 수정/삭제 버튼이 포함되어야 하며, 이 버튼들도 바인더 노트 스타일에 맞게 디자인되어야 함 | **조회 API:** `GET /api/v1/today-flow?date={date}&sortBy={type}&tagCategory={category}`<br>- `date`: 조회할 날짜 (ISO 8601 형식: `YYYY-MM-DD`, 기본값: 오늘)<br>- `sortBy`: `SESSION`(기본값), `BOOK`, `TAG`<br>- `tagCategory`: `TYPE`(기본값), `TOPIC` (TAG 모드에서만 사용, SESSION 모드의 2차 태그 그룹화에서도 사용) |
  | 메모 입력 모듈 (`#memoEditor`) | **바인더 노트 형식으로 구현:** 메모 작성 영역도 실제 노트 페이지처럼 표시되어야 함 (노트 배경, 줄무늬 패턴 등). 메모 본문, 도서 연결, 태그 선택, 저장 버튼 포함 | - |

  #### 3.1. 메모 입력 모듈 상세

  **모든 입력 컴포넌트는 바인더 노트 스타일에 맞게 디자인되어야 합니다.**

  | 컴포넌트 | 기능 명세 | 데이터 연동 및 로직 |
  |----------|-----------|---------------------|
  | 텍스트 입력 필드 (`#memoInput`) | **바인더 노트 형식으로 구현:** 메모 본문을 작성하는 에디터. 노트 페이지 느낌의 배경과 줄무늬 패턴이 적용된 텍스트 영역으로 표시 | - |
  | 도서 연결 Dropdown (`#bookSelector`) | **첫 메모 작성 시 필수:** 사용자가 '오늘의 흐름'에서 해당 날짜에 대한 첫 메모를 작성하려고 할 때, 먼저 어떤 책에 메모를 작성할 것인지 선택해야 함. 책 선택 버튼을 클릭하면 내 서재에 저장된 책들 중 `Finished`(완독) 카테고리를 제외한 나머지 카테고리(`ToRead`, `Reading`, `AlmostFinished`)의 책들이 목록으로 표시됨. 사용자가 목록에서 특정 책을 선택하면, 오늘의 흐름 화면 상단 제목 영역에 해당 책의 도서명과 저자명이 함께 표시되고, 그 아래에 메모 입력 영역이 활성화되어 해당 책에 대한 메모를 바로 작성할 수 있음. 다른 책으로 전환하고자 할 때도 동일한 책 선택 UX를 재사용하며, 책이 전환되는 시점이 새로운 세션의 시작점이 됨(SESSION 모드의 세션 구분 기준). 바인더 노트 스타일에 맞게 디자인 | **서재 도서 목록 API:** `GET /api/v1/user/books?category=ToRead,Reading,AlmostFinished` - `Finished` 카테고리를 제외한 도서 목록 조회 |
  | 태그 선택 Chip Group (`#tagChips`) | 고정 카탈로그 기반 태그 목록을 칩 형태로 나열. 1개 이상의 태그 선택 가능. 바인더 노트 스타일에 맞게 디자인 | **태그 목록:** 백엔드에서 태그는 DB에 저장되어 있으며, 프론트엔드에서 직접 조회하는 별도 API는 없음. 메모 작성/수정 시 태그 코드(`code`) 리스트를 전달. 태그 대분류: `TYPE`(유형), `TOPIC`(주제) |
  | '저장' 버튼 (`#btnSaveMemo`) | 클릭 시 `memoStartTime`을 현재 시각으로 기록하여 메모 데이터 저장. 바인더 노트 스타일에 맞게 디자인 | **저장 API:** `POST /api/v1/memos` |

  #### 3.2. 메모 수정/삭제 UI

  **메모 수정 및 삭제 화면도 바인더 노트 형식으로 구현되어야 합니다.**

  | 컴포넌트 | 기능 명세 | 데이터 연동 및 로직 |
  |----------|-----------|---------------------|
  | 메모 수정 모드 (`#memoEditMode`) | 기존 메모를 클릭하거나 수정 버튼을 클릭하면, 해당 메모가 바인더 노트 형식의 편집 모드로 전환됨. 메모 입력 모듈과 동일한 바인더 노트 스타일 적용 | **수정 API:** `PUT /api/v1/memos/{memoId}` |
  | 메모 삭제 버튼 (`#btnDeleteMemo`) | 각 메모 카드에 삭제 버튼이 포함되어야 하며, 클릭 시 확인 후 삭제. 바인더 노트 스타일에 맞게 디자인 | **삭제 API:** `DELETE /api/v1/memos/{memoId}` |

  #### 4. 핵심 구현 로직 (JS)

  | 로직 | 설명 | 트리거 |
  |------|------|--------|
  | `handleNavToFlow()` | 인증 확인 후 `currentView = 'flow'`로 전환하고 `loadMemoFlow('today', 'SESSION')` 호출하여 기본 메모 상태 로드 | 상단 네비게이션 `#navTodayFlow.onClick` |
  | `handleMemoFlowFromDetail(userBookId)` | 상세 화면에서 진입 시, 해당 `userBookId`를 필터로 사용하여 `loadMemoFlow()` 호출 | 상세 화면 `#btnMemoFlow.onClick` |
  | `loadMemoFlow(date, grouping, userBookId = null)` | 지정된 조건에 맞는 메모 목록을 API로 로드하고 노트 영역을 렌더링. `userBookId`가 있으면 해당 도서 메모만 필터링 요청 | 뷰 전환, 날짜/그룹화/필터 변경 시 |
  | `handleMemoSave()` | 입력된 메모 데이터를 수집하고 `memoStartTime`과 함께 저장 API를 호출. **메모 내용 필수 검증:** 내용 없으면 저장 불가능. **메모 수 제한 없음:** 페이지당 메모 개수 제한 없이 자유롭게 기록 가능. 성공 시 UI 업데이트 | `#btnSaveMemo.onClick` |
  | `showCalendarModal()` (새로 구현) | 캘린더 이모티콘(📅) 클릭 시 캘린더 모달 표시. 실제 시간을 반영한 현재 년/월 기준으로 한달 캘린더 렌더링. 메모가 작성된 날짜에 검정색 동그라미 표시 | 캘린더 이모티콘 클릭 시 호출. `GET /api/v1/memos/dates?year={year}&month={month}` 호출하여 메모 작성 날짜 목록 로드 후 캘린더에 검정색 동그라미 표시 |
  | `handleCalendarDateSelect(date)` (새로 구현) | 캘린더에서 날짜 선택 처리. 동그라미 표시가 된 날짜 선택 시 해당 날짜의 메모 표시 (`loadMemoFlow(date, ...)` 호출). 동그라미 표시가 없는 날짜 선택 시 "해당 날짜에 작성된 메모가 없습니다." 안내 문구 출력 | 캘린더 날짜 클릭 시 호출. 선택된 날짜가 메모 작성 날짜 목록에 포함되어 있는지 확인 후 처리 |
  | `handleGroupingChange(grouping)` | 그룹화 방식 변경 처리. `SESSION`, `BOOK`, `TAG` 중 선택 | `#groupingToggle` 변경 이벤트 |
  | `handleBookSelect(userBookId)` (새로 구현) | 첫 메모 작성 시 또는 다른 책으로 전환 시 책 선택 처리. 선택된 책의 도서명과 저자명을 화면 상단 제목 영역에 표시하고 메모 입력 영역 활성화. 책 전환 시점이 새로운 세션의 시작점이 됨(SESSION 모드) | 책 선택 버튼 클릭 시 호출 |
  | `handleBookFilter(userBookId)` (새로 구현) | 오늘의 흐름에서 특정 책을 선택하여 해당 책의 메모만 필터링하여 표시. `GET /api/v1/memos/books/{userBookId}?date={date}` 호출 | 특정 책 아이콘/제목 클릭 시 호출 |
  | `handleCloseBook(userBookId, lastReadPage)` (새로 구현) | 책 덮기 기능. 독서 활동 종료 시 마지막으로 읽은 페이지 수를 기록하고 독서 진행률을 업데이트. 진행률에 따라 카테고리 자동 변경. 오늘의 흐름에서 해당 책의 메모가 섹션으로 구분되어 표시됨 | 책 덮기 버튼 클릭 시 호출. `POST /api/v1/memos/books/{userBookId}/close` |
  | `handleDateChangeDetection()` (새로 구현) | 실제 시간을 반영하여 날짜가 바뀌면 (자정이 지나면) 자동으로 해당 날짜의 메모만 조회하고 완전히 새로운 페이지를 표시. **날짜 판단 기준:** 사용자가 메모 작성을 시작한 시간(`memoStartTime`)을 기준으로 날짜를 판단. 자정 전에 메모 작성을 시작했지만 자정 후에 저장하는 경우, `memoStartTime`이 자정 전이면 해당 메모는 이전 날짜의 바인더 노트에 저장되고 표시됨. 이전 날짜의 메모는 저장된 상태로 유지되며, 새로운 날짜의 빈 페이지 표시. 각 날짜는 완전히 독립적인 "바인더 노트"로 취급됨 | 주기적으로 날짜 확인 (예: 1분마다 또는 사용자 액션 시) |

  #### 5. API 엔드포인트 (백엔드)

  | 엔드포인트 | 메서드 | 설명 | 파라미터 |
  |-----------|--------|------|----------|
  | `/api/v1/today-flow` | GET | 오늘의 흐름 조회 | `date` (선택), `sortBy` (선택, 기본값: `SESSION`), `tagCategory` (선택, TAG 모드에서만 사용) |
  | `/api/v1/memos` | POST | 메모 작성 | 요청 본문: `MemoCreateRequest` |
  | `/api/v1/memos/{memoId}` | PUT | 메모 수정 | 경로 변수: `memoId`, 요청 본문: `MemoUpdateRequest` |
  | `/api/v1/memos/{memoId}` | DELETE | 메모 삭제 | 경로 변수: `memoId` |
  | `/api/v1/memos/books/{userBookId}` | GET | 특정 책의 메모 조회 | 경로 변수: `userBookId`, 쿼리 파라미터: `date` (선택) - `date`가 있으면 해당 날짜에 작성된 메모만 조회, 없으면 날짜 제한 없이 해당 책의 모든 메모 조회 |
  | `/api/v1/memos/books/{userBookId}/close` | POST | 책 덮기 (독서 활동 종료) | 경로 변수: `userBookId`, 요청 본문: `CloseBookRequest { lastReadPage }` |
  | `/api/v1/memos/books/recent` | GET | 최근 메모 작성 책 목록 조회 | 쿼리 파라미터: `months` (선택, 기본값: 1) - 최근 N개월 이내에 메모가 작성된 책들의 목록 반환. 각 책의 최신 메모 작성 시간 기준으로 내림차순 정렬 |
  | `/api/v1/memos/dates` | GET | 메모 작성 날짜 목록 조회 (캘린더용) | `year` (필수), `month` (필수) - 예: `?year=2024&month=1`<br>**응답:** `List<String>` - 날짜 문자열 리스트 (ISO 8601 형식: `YYYY-MM-DD`) |
  | `/api/v1/user/books` | GET | 서재 도서 목록 조회 (도서 연결용) | 쿼리 파라미터: `category` (선택), `sortBy` (선택). 책 선택 시 `Finished` 카테고리를 제외한 나머지 카테고리(`ToRead`, `Reading`, `AlmostFinished`)의 책들만 조회 |

  #### 6. API 요청/응답 형식

  **오늘의 흐름 조회 요청:**
  ```
  GET /api/v1/today-flow?date=2024-01-15&sortBy=SESSION
  GET /api/v1/today-flow?date=2024-01-15&sortBy=BOOK
  GET /api/v1/today-flow?date=2024-01-15&sortBy=TAG&tagCategory=TYPE
  ```

  **SESSION/BOOK 모드 응답** (`TodayFlowResponse`):
  ```json
  {
    "ok": true,
    "data": {
      "date": "2024-01-15",
      "sortBy": "SESSION",
      "memosByBook": {
        "1": {
          "bookId": 1,
          "bookTitle": "책 제목",
          "bookIsbn": "9788937461234",
          "memos": [
            {
              "id": 1,
              "userBookId": 1,
              "bookTitle": "책 제목",
              "bookIsbn": "9788937461234",
              "pageNumber": 50,
              "content": "메모 내용",
              "tags": ["인사이트", "요약"],
              "memoStartTime": "2024-01-15T10:30:00",
              "createdAt": "2024-01-15T10:30:00",
              "updatedAt": "2024-01-15T10:30:00"
            }
          ],
          "memoCount": 1,
          "sortBy": "SESSION"
        }
      },
      "memosByTag": null,
      "totalMemoCount": 1
    },
    "error": null
  }
  ```

  **TAG 모드 응답** (`TodayFlowResponse`):
  ```json
  {
    "ok": true,
    "data": {
      "date": "2024-01-15",
      "sortBy": "TAG",
      "memosByBook": null,
      "memosByTag": {
        "INSIGHT": {
          "tagCode": "INSIGHT",
          "memos": [],
          "memosByBook": {
            "1": {
              "bookId": 1,
              "bookTitle": "책 제목",
              "bookIsbn": "9788937461234",
              "memos": [],
              "memosByTag": null,
              "memoCount": 1,
              "sortBy": "TAG"
            }
          },
          "memoCount": 1
        }
      },
      "totalMemoCount": 1
    },
    "error": null
  }
  ```

  **메모 작성 요청** (`MemoCreateRequest`):
  ```json
  {
    "userBookId": 1,
    "pageNumber": 50,
    "content": "메모 내용",
    "tags": ["인사이트", "요약"],
    "memoStartTime": "2024-01-15T10:30:00"
  }
  ```

  **메모 작성 응답** (`MemoResponse`):
  ```json
  {
    "ok": true,
    "data": {
      "id": 1,
      "userBookId": 1,
      "bookTitle": "책 제목",
      "bookIsbn": "9788937461234",
      "pageNumber": 50,
      "content": "메모 내용",
      "tags": ["인사이트", "요약"],
      "memoStartTime": "2024-01-15T10:30:00",
      "createdAt": "2024-01-15T10:30:00",
      "updatedAt": "2024-01-15T10:30:00"
    },
    "error": null
  }
  ```

  #### 7. 캘린더 기능 상세

  **캘린더 모달 UI 구성:**
  - 캘린더 이모티콘(📅) 클릭 시 모달 표시
  - 현재 년/월 기준으로 한달 캘린더 렌더링 (실제 시간 반영)
  - 년/월 변경 버튼 (이전 달, 다음 달)
  - 각 날짜 셀에 메모가 작성된 날짜는 검정색 동그라미 표시
  - 날짜 클릭 시 선택 처리

  **캘린더 동작 흐름:**
  1. 캘린더 이모티콘(📅) 클릭 → `showCalendarModal()` 호출
  2. 현재 년/월 기준으로 캘린더 렌더링
  3. `GET /api/v1/memos/dates?year={year}&month={month}` 호출하여 메모 작성 날짜 목록 로드
  4. 메모가 작성된 날짜에 검정색 동그라미 표시
  5. 날짜 클릭 시:
     - 동그라미 표시가 있는 날짜: `handleCalendarDateSelect(date)` 호출 → `loadMemoFlow(date, ...)` 호출하여 해당 날짜의 메모 표시
     - 동그라미 표시가 없는 날짜: "해당 날짜에 작성된 메모가 없습니다." 안내 문구 출력

  **메모 작성 날짜 목록 API 응답 형식:**
  ```json
  {
    "ok": true,
    "data": ["2024-01-15", "2024-01-20", "2024-01-25"],
    "error": null
  }
  ```

  #### 8. 구현 필요 파일

  - `html/flow.html` - 오늘의 흐름 화면 HTML 구조 (2컬럼 레이아웃: `#flowSidebar`, `#memoList`, `#memoEditor`, 캘린더 모달 `#calendarModal`)
  - `css/pages/flow.css` - 바인더 노트 스타일, 2컬럼 레이아웃 스타일, 캘린더 모달 스타일
  - `js/views/pages/flow-view.js` - 오늘의 흐름 뷰 로직 구현 (`handleNavToFlow()`, `loadMemoFlow()`, `handleMemoSave()`, `showCalendarModal()`, `handleCalendarDateSelect()`, `handleGroupingChange()` 등)
  - `js/components/calendar-modal.js` - 캘린더 모달 컴포넌트 (한달 캘린더 렌더링, 날짜 선택 처리, 검정색 동그라미 표시)
  - `js/services/memo-service.js` - 메모 관련 API 호출 메서드 추가 (`getTodayFlow()`, `getMemoDates(year, month)`, `createMemo()`, `updateMemo()`, `deleteMemo()` 등)
  - `js/components/memo-card.js` - 메모 카드 컴포넌트 (메모 표시용, 수정/삭제 버튼 포함)
  - `js/components/memo-editor.js` - 메모 입력 모듈 컴포넌트 (책 선택, 태그 선택, 메모 본문 입력)
  - `js/components/book-selector.js` - 책 선택 컴포넌트 (첫 메모 작성 시 또는 책 전환 시 사용)
  - `js/components/close-book-modal.js` - 책 덮기 모달 컴포넌트 (마지막 페이지 수 입력)

  #### 9. 필드명 및 데이터 구조

  - **메모 시작 시간**: `memoStartTime` (LocalDateTime 형식: `YYYY-MM-DDTHH:mm:ss`)
  - **페이지 번호**: `pageNumber` (Integer, 메모 작성 시점의 SESSION 모드 기준 초기 위치)
  - **메모 내용**: `content` (String, 최대 5000자)
  - **태그**: `tags` (List<String>, 태그 코드 리스트)
  - **태그 대분류**: `TagCategory` enum (`TYPE`, `TOPIC`)
  - **그룹화 방식**: `sortBy` (`SESSION`, `BOOK`, `TAG`)

  #### 10. 세션 그룹화 상세 로직

  **세션 구분 기준:**
  - 한 세션은 **책 선택 → 해당 책에 대한 메모 작성 → 책 덮기(독서 활동 종료)**로 구성됨
  - 책 덮기 이후 다른 책에 메모를 작성하려면 다시 책 선택 UX를 통해 새 책을 선택해야 함
  - 새로 선택된 책의 `userBookId`가 세션 구분 기준이 되며, 이 전환 시점이 새로운 세션의 시작점이 됨
  - SESSION 모드에서는 시간 흐름에 따라 사용자가 실제로 책을 전환한 순서대로 세션 그룹 생성

  **세션 내부 태그 그룹화 (선택 사항):**
  - 각 세션 그룹 내부에서 "선택된 태그 대분류(유형/주제)"의 **대표 태그(1개)**를 기준으로 하위 그룹화 가능
  - 태그 대분류 선택: 프론트에서 사용자가 대분류(예: 유형 vs 주제)를 선택하며, 백엔드 API에 `tagCategory` 파라미터로 전달됨
  - 해당 대분류 내 최대 8개 태그 중 실제로 붙은 태그 기준으로 그룹화됨
  - 태그가 없는 메모: "기타" 그룹으로 포함되며, 세션 내부에서 시간 순으로 표시

  #### 11. 메모 배치 및 레이아웃 상세

  **좌우 섹션 레이아웃:**
  - 한 페이지는 중앙의 긴 가로선(세로선)을 기준으로 좌측 섹션과 우측 섹션으로 나뉨
  - 좌/우 섹션을 구분하는 **중앙선(제본 영역)**의 시각적 요소를 강조하여, 페이지가 넘어갈 때 중앙선을 중심으로 전환되는 듯한 인상을 연출

  **메모 배치 로직:**
  - 메모는 좌측 섹션 상단에서 시작하여 상 → 하로 채워짐
  - 좌측이 가득 차면 자동으로 우측 섹션 상단으로 넘어가 이어서 채워짐
  - 메모 내용의 실제 용량(길이)에 따라 화면에 출력되는 메모의 개수와 높이가 동적으로 결정됨
  - 메모 작성 순서가 곧 기록 순서가 되므로, 메모 재배치 기능은 없음

  **페이지 전환 UX:**
  - 수평 슬라이딩(Horizontal Sliding) 방식을 권장
  - 사용자가 다음 페이지로 이동할 때, 현재 페이지가 왼쪽으로 사라지고 새 페이지가 오른쪽에서 들어오는 부드러운 슬라이드 모션 사용
  - 사용자가 페이지가 연결되어 있음을 인지하고 **기록의 공간감(바인더 노트 느낌)**을 유지하게 함

  **pageNumber의 의미:**
  - `pageNumber`는 "메모 작성 시점의 SESSION 모드 기준 초기 위치"를 나타내는 메타데이터
  - 정렬 방식(SESSION/BOOK/TAG)이 변경되어도 `pageNumber`는 변경하지 않으며, 원본 위치 정보를 보존
  - 실제 UI 렌더링 위치는 프론트엔드에서 현재 선택된 정렬 방식에 따라 동적으로 계산됨
  - 메모 수정 시에도 `pageNumber`는 변경하지 않음 (원본 위치 정보 보존)

  #### 12. 특정 책 필터링 기능

  **기능 설명:**
  - 오늘의 흐름 화면에서 특정 책 아이콘/제목을 선택하면 해당 책의 메모만 표시됨
  - 여러 책의 메모가 섞여 있는 상태에서 특정 책의 메모만 확인 가능
  - 해당 책을 제외한 나머지 책들의 메모는 표시되지 않음
  - 날짜 파라미터가 있으면 해당 날짜에 작성된 메모만 조회, 없으면 날짜 제한 없이 해당 책의 모든 메모 조회
  - 오늘의 흐름과 동일한 화면 구성으로 표시

  **API 호출:**
  - `GET /api/v1/memos/books/{userBookId}?date={date}` - 특정 책의 메모 조회
  - `date` 파라미터가 있으면 해당 날짜에 작성된 메모만 조회
  - `date` 파라미터가 없으면 날짜 제한 없이 해당 책의 모든 메모 조회

  #### 13. 책 덮기 기능

  **기능 설명:**
  - 독서 활동 종료 시 마지막으로 읽은 페이지 수를 기록하고 독서 진행률을 업데이트
  - 마지막으로 읽은 페이지 수를 `user_books.reading_progress`에 기록
  - 독서 진행률 업데이트 (전체 페이지 수 대비 퍼센티지로 계산)
  - 독서 진행률에 따라 카테고리 자동 변경 (BookService 연동)
  - 오늘의 흐름에서 해당 책의 메모가 섹션으로 구분되어 표시됨

  **API 호출:**
  - `POST /api/v1/memos/books/{userBookId}/close`
  - 요청 본문: `{ "lastReadPage": 150 }`

  **카테고리 변경 기준 (예시):**
  - 진행률 0%: `ToRead`
  - 진행률 1~80%: `Reading`
  - 진행률 81~99%: `AlmostFinished`
  - 진행률 100%: `Finished`

  #### 14. 최근 메모 작성 책 목록 조회

  **기능 설명:**
  - 최근 N개월 이내에 메모가 작성된 책들의 목록을 반환
  - 각 책의 최신 메모 작성 시간 기준으로 내림차순 정렬 (가장 최근에 메모를 작성한 책이 위에)
  - 책의 흐름 기능에서 월별 책 목록으로 사용

  **API 호출:**
  - `GET /api/v1/memos/books/recent?months={months}` (기본값: 1개월)

  #### 15. 메모 작성 날짜 제한 기능

  **요구사항:**
  - 사용자가 날짜를 변경해도, 실제 시간 기준으로 오늘 날짜가 아닌 다른 날짜에는 메모를 작성할 수 없음
  - 사용자는 '오늘의 흐름' 기능에서 무조건 오늘 날짜의 바인더 노트에서만 메모를 작성할 수 있음
  - 과거 날짜나 미래 날짜에는 메모 작성 불가

  **구현 위치:**
  - **서버 측 검증 (필수)**: `MemoService.createMemo()` 메서드에서 `memoStartTime`의 날짜가 오늘 날짜인지 검증
  - **프론트엔드 검증 (권장)**: 사용자 경험 개선을 위해 `handleMemoSave()` 메서드에서도 검증하여 사전에 오류 메시지 표시

  **서버 측 구현:**
  - `MemoService.createMemo()` 메서드에 날짜 검증 로직 추가
  - `memo.getMemoStartTime().toLocalDate()`가 `LocalDate.now()`와 일치하는지 확인
  - 일치하지 않으면 `IllegalArgumentException` 발생: "메모는 오늘 날짜에만 작성할 수 있습니다."

  **프론트엔드 구현:**
  - `handleMemoSave()` 메서드에서 메모 저장 전 날짜 검증
  - 현재 선택된 날짜가 오늘 날짜가 아닌 경우 메모 입력 필드 비활성화 또는 경고 메시지 표시
  - 서버 API 호출 전 클라이언트 측 검증 수행

  **구현 필요 파일:**
  - `src/main/java/com/readingtracker/server/service/MemoService.java` - `createMemo()` 메서드에 날짜 검증 로직 추가
  - `js/views/pages/flow-view.js` - `handleMemoSave()` 메서드에 날짜 검증 로직 추가

### 우선순위: 중간

- [ ] 

### 우선순위: 낮음

- [ ] 

---

## 구현 완료 기능

### 2024년

- [x] 프로필 화면에 "홈 화면" 버튼 추가
- [x] 내 서재 화면에 "홈 화면" 버튼 추가
- [x] 홈 화면 버튼 클릭 시 홈 화면으로 이동하는 기능 구현
- [x] JavaScript 모듈 로딩 타이밍 문제 해결 (인라인 스크립트 추가)
- [x] 내 서재 화면 도서 카드 정보 표시 구현
  - **구현 파일**: `js/components/bookshelf-book-card.js`
  - **표시 정보**: 도서 표지, 도서명, 저자명, 출판사명
  - **제외 정보**: 책 소개(description)는 표시하지 않음 (도서 검색 결과와 차별화)
  - **추가 정보**: 카테고리 배지, 추가일 표시 (내 서재 전용 정보)

---

## 기술 부채 및 개선 사항

- [ ] 

---

## 참고사항

### 관련 문서
- [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) - 초기 구현 계획
- [WEB_UI_DESIGN.md](./features/WEB_UI_DESIGN.md) - UI 설계 문서
- [API_REFERENCE.md](./API_REFERENCE.md) - API 참조 문서

### 작성 가이드
- 각 기능은 독립적인 섹션으로 작성합니다.
- 구현 시 필요한 기술 스택이나 의존성을 명시합니다.
- 테스트 계획이나 검증 방법을 포함합니다.

