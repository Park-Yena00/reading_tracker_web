# 오늘의 흐름 화면 메모 에디터 DOM 제거 문제

## 문제 발생 일시
- 메모 작성 UI 위치 개선 작업 후
- 메모 에디터 보호 로직 개선 작업 후

## 문제 증상

### 1. 메모가 표시되지 않음
- 이전에 작성했던 메모들이 오늘의 흐름 화면에서 출력되지 않음
- MySQL 데이터베이스에는 메모 데이터가 정상적으로 존재함 (데이터 손실 없음)
- 프론트엔드 렌더링 문제로 확인됨

### 2. 버튼이 작동하지 않음
- 홈으로 버튼을 제외한 모든 버튼이 작동하지 않음
- 버튼 클릭 시 어떠한 변화도 발생하지 않음
- 영향을 받는 버튼:
  - 캘린더 버튼
  - 그룹화 방식 선택 버튼 (세션/책별/태그별)
  - 태그 대분류 선택 버튼 (유형/주제)
  - 책 선택하기 버튼
  - 메모 저장 버튼
  - 메모 수정/삭제 버튼

---

## 원인 분석

### 1. 메모가 표시되지 않는 문제

#### 문제 위치
- 파일: `js/views/pages/flow-view.js`
- 메서드: `renderMemos()` (368-421번째 줄)

#### 원인

**문제 1: 메모 에디터를 DOM에서 완전히 제거**
```javascript
// 문제가 있던 코드
memoEditorBackup.remove(); // DOM에서 완전히 제거
this.memoList.innerHTML = ''; // memoList 비우기
```

**문제 설명:**
1. `memoEditorBackup.remove()`로 메모 에디터를 DOM에서 완전히 제거
2. `innerHTML = ''` 실행으로 `memoList` 내부의 모든 내용 제거
3. 메모 렌더링 후 `restoreMemoEditor()` 호출
4. `restoreMemoEditor()`에서 `this.memoEditor.container`를 사용하려고 하지만, 이미 DOM에서 제거된 상태
5. `this.memoEditor.container`가 DOM에 없어서 메모 에디터 복원 실패
6. 메모 렌더링 중 에러 발생 시 복원 로직이 실행되지 않음

**문제 2: 조건부 복원 로직**
```javascript
// 문제가 있던 코드
if (memoEditorBackup && memoEditorWasInList && this.selectedBookId) {
  this.restoreMemoEditor();
}
```

**문제 설명:**
- `this.selectedBookId`가 없으면 메모 에디터가 복원되지 않음
- 메모가 없을 때도 복원이 필요하지만 조건 때문에 실행되지 않음

**문제 3: 메모 에디터의 이벤트 리스너 손실**
- `remove()`로 DOM에서 제거하면 이벤트 리스너가 모두 제거됨
- `MemoEditor` 컴포넌트가 `init()`에서 등록한 이벤트 리스너가 무효화됨
- 메모 에디터 내부 버튼(`btn-save-memo` 등)이 작동하지 않음

---

### 2. 버튼이 작동하지 않는 문제

#### 원인

**문제 1: 메모 에디터의 이벤트 리스너 손실**
- 메모 에디터를 DOM에서 제거하면 내부 이벤트 리스너가 모두 제거됨
- `MemoEditor` 컴포넌트의 `init()` 메서드에서 등록한 이벤트 리스너가 무효화됨
- 메모 저장 버튼, 태그 선택 버튼 등이 작동하지 않음

**문제 2: 메모 에디터 복원 실패**
- `restoreMemoEditor()`가 제대로 실행되지 않아 메모 에디터가 DOM에 없음
- 메모 에디터가 없으면 내부 버튼들도 존재하지 않음

**문제 3: 다른 버튼들의 이벤트 리스너**
- 메모 에디터 문제와 직접적인 관련은 없지만, 메모 렌더링 실패로 인해 전체적인 UI 상태가 불안정해짐
- 메모 에디터 복원 실패로 인한 에러가 다른 기능에도 영향을 미칠 수 있음

---

## 해결 방안

### 선택된 해결 방법: 방안 1 - 메모 에디터를 DOM에서 완전히 제거하지 않기

#### 핵심 아이디어
- 메모 에디터를 DOM에서 제거하지 않고, `memoList` 밖으로 임시 이동
- 렌더링 완료 후 올바른 위치로 재배치
- 이벤트 리스너가 유지되어 안정적인 동작 보장

#### 구현 방법

**1. 메모 에디터를 `flow-content`로 임시 이동**
```javascript
// 개선된 코드
if (parent && (parent === this.memoList || this.memoList.contains(parent))) {
  memoEditorWasInList = true;
  // DOM에서 제거하지 않고 flow-content로 임시 이동 (이벤트 리스너 유지)
  if (this.flowContent && this.memoEditor.container.parentNode !== this.flowContent) {
    this.flowContent.appendChild(this.memoEditor.container);
    this.memoEditor.container.style.display = 'none'; // 임시로 숨김
  }
}
```

**2. `innerHTML = ''` 실행**
- 메모 에디터는 이미 `flow-content`로 이동했으므로 `memoList.innerHTML = ''`의 영향을 받지 않음
- 메모 섹션만 제거됨

**3. 메모 렌더링 후 복원**
```javascript
// 개선된 코드
// 메모 렌더링 후 메모 에디터 복원
// renderMemosByBook에서 이미 삽입했을 수 있으므로, 항상 복원 로직 실행
this.restoreMemoEditor();
```

**4. `restoreMemoEditor()` 개선**
```javascript
// 개선된 코드
restoreMemoEditor() {
  if (!this.memoEditor || !this.memoEditor.container) return;
  
  // 선택된 책이 있는 경우에만 메모 섹션 내부로 이동
  if (this.selectedBookId) {
    // 선택된 책의 메모 섹션 찾기
    const selectedBookSection = Array.from(this.memoList.querySelectorAll('.memo-book-section')).find(
      section => section.dataset.bookId === String(this.selectedBookId)
    );
    
    if (selectedBookSection) {
      this.insertMemoEditorIntoSection(selectedBookSection);
    } else {
      // 선택된 책의 섹션이 없으면 빈 섹션 생성
      this.createEmptyBookSectionWithEditor();
    }
  } else {
    // 선택된 책이 없으면 flow-content의 원래 위치로 복원 (숨김 상태 유지)
    if (this.flowContent && this.memoEditor.container.parentNode !== this.flowContent) {
      this.flowContent.appendChild(this.memoEditor.container);
    }
    this.memoEditor.container.style.display = 'none';
  }
}
```

---

## 수정된 파일

### `js/views/pages/flow-view.js`

#### 1. DOM 요소 참조 추가
```javascript
this.flowContent = document.querySelector('.flow-content'); // 메모 에디터 임시 보관용
```

#### 2. `renderMemos()` 메서드 수정
- 메모 에디터를 DOM에서 제거하지 않고 `flow-content`로 임시 이동
- `remove()` 대신 `appendChild()` 사용
- 이벤트 리스너 유지

#### 3. `restoreMemoEditor()` 메서드 개선
- `selectedBookId`가 없어도 원래 위치로 복원
- 항상 복원 로직 실행 (조건 제거)
- 에러 처리 개선

---

## 개선된 로직 흐름

### 1. 메모 렌더링 시작
```
1. 메모 에디터가 memoList 내부에 있는지 확인
2. 있으면 → flow-content로 임시 이동 (DOM에서 제거하지 않음)
3. innerHTML = '' 실행 → 메모 섹션만 제거 (메모 에디터는 이미 flow-content에 있음)
```

### 2. 메모 렌더링
```
1. renderMemosByBook() 또는 renderMemosByTag() 실행
2. 선택된 책의 섹션에 메모 에디터 삽입 (이미 flow-content에 있으면 이동)
```

### 3. 메모 에디터 복원
```
1. restoreMemoEditor() 실행
2. 선택된 책이 있으면 → 해당 섹션으로 이동
3. 없으면 → 원래 위치(flow-content)로 복원
```

---

## 해결된 문제

### ✅ 메모 표시 문제
- 메모가 정상적으로 렌더링됨
- 이전에 작성한 메모들이 모두 표시됨
- 메모 에디터가 올바른 위치에 배치됨

### ✅ 버튼 작동 문제
- 메모 에디터의 이벤트 리스너가 유지되어 버튼이 정상 작동
- 메모 저장 버튼, 태그 선택 버튼 등이 모두 정상 작동
- 다른 버튼들도 정상 작동

### ✅ 안정성 향상
- DOM 제거 없이 위치만 변경하여 안정성 향상
- 에러 발생 시에도 메모 에디터가 안전하게 보호됨
- 이벤트 리스너가 유지되어 사용자 경험 개선

---

## 핵심 교훈

### 1. DOM 요소 제거 시 주의사항
- `remove()`로 DOM에서 제거하면 이벤트 리스너가 모두 제거됨
- 중요한 컴포넌트는 제거하지 않고 위치만 변경하는 것이 안전함
- `appendChild()`는 요소를 이동시키므로 이벤트 리스너가 유지됨

### 2. 조건부 복원 로직의 위험성
- 복원 로직이 조건에 따라 실행되지 않으면 컴포넌트가 손실될 수 있음
- 항상 복원 로직을 실행하되, 조건에 따라 위치만 다르게 설정하는 것이 안전함

### 3. `innerHTML = ''` 사용 시 주의사항
- `innerHTML = ''`는 모든 자식 요소를 제거하므로 중요한 컴포넌트는 미리 보호해야 함
- 보호 방법: 제거하기 전에 다른 위치로 이동

---

## 테스트 체크리스트

- [x] 이전에 작성한 메모들이 정상적으로 표시되는지 확인
- [x] 메모 작성 UI가 정상적으로 동작하는지 확인
- [x] 메모 저장 버튼이 정상적으로 작동하는지 확인
- [x] 태그 선택 버튼이 정상적으로 작동하는지 확인
- [x] 책 선택하기 버튼이 정상적으로 작동하는지 확인
- [x] 그룹화 방식 선택 버튼이 정상적으로 작동하는지 확인
- [x] 메모 수정/삭제 버튼이 정상적으로 작동하는지 확인
- [x] 메모 저장 후 새 메모가 올바른 위치에 표시되는지 확인
- [x] 여러 책의 메모가 모두 정상적으로 표시되는지 확인
- [x] 메모 에디터가 올바른 위치에 배치되는지 확인

---

## 참고 사항

- 메모 에디터는 동적으로 메모 섹션 내부로 이동하는 특수한 컴포넌트
- `innerHTML = ''` 사용 시 모든 자식 요소가 제거되므로 주의 필요
- DOM 요소를 제거하지 않고 위치만 변경하면 이벤트 리스너가 유지됨
- 프로덕션 환경에서는 안정성이 가장 중요하므로, 가능한 한 DOM 제거를 피하는 것이 좋음

