# 중복 도서 카드 강제 삭제 가이드

## 문제 상황
- 중복으로 생성된 도서 카드 중 이미지가 보이지 않는 카드가 삭제되지 않음
- 두 DB에 해당 도서 정보가 없음
- 읽을 예정 카테고리와 읽는 중 카테고리에서 삭제 필요

## 해결 방법

### 방법 1: 브라우저 콘솔에서 직접 삭제 (권장)

1. **브라우저 개발자 도구 열기**
   - `F12` 또는 `Ctrl + Shift + I` (Windows)
   - `Cmd + Option + I` (Mac)

2. **Console 탭으로 이동**

3. **다음 스크립트를 복사하여 실행**

```javascript
// IndexedDB에서 이미지가 없는 중복 도서 카드 강제 삭제
(async function() {
  try {
    // IndexedDB 초기화
    const dbName = 'reading-tracker';
    const dbVersion = 2;
    
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open(dbName, dbVersion);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    
    // offline_books 테이블에서 모든 도서 조회
    const allBooks = await new Promise((resolve, reject) => {
      const transaction = db.transaction(['offline_books'], 'readonly');
      const store = transaction.objectStore('offline_books');
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
    
    console.log('전체 도서 수:', allBooks.length);
    
    // 읽을 예정(ToRead)과 읽는 중(Reading) 카테고리 필터링
    const targetBooks = allBooks.filter(book => 
      (book.category === 'ToRead' || book.category === 'Reading') &&
      (!book.coverUrl || book.coverUrl === '' || book.coverUrl === null)
    );
    
    console.log('삭제 대상 도서 수:', targetBooks.length);
    console.log('삭제 대상 도서:', targetBooks.map(b => ({
      localId: b.localId,
      serverId: b.serverId,
      title: b.title,
      category: b.category,
      coverUrl: b.coverUrl
    })));
    
    if (targetBooks.length === 0) {
      console.log('삭제할 도서가 없습니다.');
      return;
    }
    
    // 확인 메시지
    const confirmed = confirm(`삭제할 도서 ${targetBooks.length}개를 찾았습니다. 삭제하시겠습니까?`);
    if (!confirmed) {
      console.log('삭제가 취소되었습니다.');
      return;
    }
    
    // 삭제 실행
    let deletedCount = 0;
    for (const book of targetBooks) {
      try {
        await new Promise((resolve, reject) => {
          const transaction = db.transaction(['offline_books'], 'readwrite');
          const store = transaction.objectStore('offline_books');
          const request = store.delete(book.localId);
          request.onsuccess = () => {
            console.log(`삭제 완료: ${book.title} (localId: ${book.localId})`);
            deletedCount++;
            resolve();
          };
          request.onerror = () => reject(request.error);
        });
      } catch (error) {
        console.error(`삭제 실패: ${book.title}`, error);
      }
    }
    
    console.log(`총 ${deletedCount}개의 도서가 삭제되었습니다.`);
    alert(`총 ${deletedCount}개의 도서가 삭제되었습니다. 페이지를 새로고침해주세요.`);
    
    // 페이지 새로고침 안내
    const reload = confirm('페이지를 새로고침하시겠습니까?');
    if (reload) {
      window.location.reload();
    }
    
  } catch (error) {
    console.error('오류 발생:', error);
    alert('오류가 발생했습니다: ' + error.message);
  }
})();
```

4. **스크립트 실행 후 확인**
   - 콘솔에 삭제된 도서 정보가 출력됩니다
   - 페이지를 새로고침하여 변경사항을 확인합니다

### 방법 2: 특정 도서만 선택적으로 삭제

특정 도서만 삭제하고 싶은 경우:

```javascript
// 특정 localId로 도서 삭제
(async function() {
  const localIdToDelete = 'YOUR_LOCAL_ID_HERE'; // 삭제할 도서의 localId 입력
  
  try {
    const dbName = 'reading-tracker';
    const dbVersion = 2;
    
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open(dbName, dbVersion);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    
    // 도서 조회
    const book = await new Promise((resolve, reject) => {
      const transaction = db.transaction(['offline_books'], 'readonly');
      const store = transaction.objectStore('offline_books');
      const request = store.get(localIdToDelete);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
    
    if (!book) {
      console.log('도서를 찾을 수 없습니다.');
      return;
    }
    
    console.log('삭제할 도서:', book);
    const confirmed = confirm(`"${book.title}"을(를) 삭제하시겠습니까?`);
    if (!confirmed) {
      return;
    }
    
    // 삭제 실행
    await new Promise((resolve, reject) => {
      const transaction = db.transaction(['offline_books'], 'readwrite');
      const store = transaction.objectStore('offline_books');
      const request = store.delete(localIdToDelete);
      request.onsuccess = () => {
        console.log('삭제 완료');
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
    
    alert('도서가 삭제되었습니다. 페이지를 새로고침해주세요.');
    window.location.reload();
    
  } catch (error) {
    console.error('오류 발생:', error);
    alert('오류가 발생했습니다: ' + error.message);
  }
})();
```

### 방법 3: 모든 중복 도서 확인 및 삭제

중복된 도서를 모두 확인하고 삭제:

```javascript
// 중복 도서 확인 및 삭제
(async function() {
  try {
    const dbName = 'reading-tracker';
    const dbVersion = 2;
    
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open(dbName, dbVersion);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    
    const allBooks = await new Promise((resolve, reject) => {
      const transaction = db.transaction(['offline_books'], 'readonly');
      const store = transaction.objectStore('offline_books');
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
    
    // ISBN 또는 제목으로 그룹화하여 중복 찾기
    const booksByIsbn = {};
    const booksByTitle = {};
    
    allBooks.forEach(book => {
      // ISBN으로 그룹화
      if (book.isbn) {
        if (!booksByIsbn[book.isbn]) {
          booksByIsbn[book.isbn] = [];
        }
        booksByIsbn[book.isbn].push(book);
      }
      
      // 제목으로 그룹화
      if (book.title) {
        if (!booksByTitle[book.title]) {
          booksByTitle[book.title] = [];
        }
        booksByTitle[book.title].push(book);
      }
    });
    
    // 중복 도서 찾기 (2개 이상인 경우)
    const duplicates = [];
    Object.values(booksByIsbn).forEach(books => {
      if (books.length > 1) {
        duplicates.push(...books);
      }
    });
    
    // 이미지가 없는 중복 도서 필터링
    const toDelete = duplicates.filter(book => 
      (!book.coverUrl || book.coverUrl === '' || book.coverUrl === null) &&
      (book.category === 'ToRead' || book.category === 'Reading')
    );
    
    console.log('중복 도서:', duplicates);
    console.log('삭제 대상:', toDelete);
    
    if (toDelete.length === 0) {
      console.log('삭제할 중복 도서가 없습니다.');
      return;
    }
    
    const confirmed = confirm(`삭제할 중복 도서 ${toDelete.length}개를 찾았습니다. 삭제하시겠습니까?`);
    if (!confirmed) {
      return;
    }
    
    // 삭제 실행
    let deletedCount = 0;
    for (const book of toDelete) {
      try {
        await new Promise((resolve, reject) => {
          const transaction = db.transaction(['offline_books'], 'readwrite');
          const store = transaction.objectStore('offline_books');
          const request = store.delete(book.localId);
          request.onsuccess = () => {
            console.log(`삭제 완료: ${book.title}`);
            deletedCount++;
            resolve();
          };
          request.onerror = () => reject(request.error);
        });
      } catch (error) {
        console.error(`삭제 실패: ${book.title}`, error);
      }
    }
    
    console.log(`총 ${deletedCount}개의 중복 도서가 삭제되었습니다.`);
    alert(`총 ${deletedCount}개의 중복 도서가 삭제되었습니다. 페이지를 새로고침해주세요.`);
    window.location.reload();
    
  } catch (error) {
    console.error('오류 발생:', error);
    alert('오류가 발생했습니다: ' + error.message);
  }
})();
```

## 주의사항

1. **백업 권장**: 삭제 전에 브라우저의 IndexedDB를 백업하는 것을 권장합니다.
2. **페이지 새로고침**: 삭제 후 반드시 페이지를 새로고침하여 변경사항을 확인하세요.
3. **확인 후 실행**: 스크립트 실행 전에 삭제 대상 도서를 확인하고 실행하세요.

## 문제 해결

### 스크립트 실행 시 오류가 발생하는 경우

1. **IndexedDB 접근 권한 확인**
   - 브라우저 설정에서 IndexedDB 사용이 허용되어 있는지 확인
   - 시크릿 모드가 아닌 일반 모드에서 실행

2. **데이터베이스 버전 확인**
   - 콘솔에서 `indexedDB.databases()` 실행하여 데이터베이스 정보 확인

3. **수동 삭제**
   - 브라우저 개발자 도구 → Application → IndexedDB → reading-tracker → offline_books
   - 수동으로 삭제할 도서 선택 후 삭제

## 참고

- 삭제된 도서는 복구할 수 없습니다.
- 서버에 동기화되지 않은 로컬 데이터만 삭제됩니다.
- 서버에 동기화된 데이터는 서버에서도 삭제해야 합니다.









